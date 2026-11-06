/* Acciones y archivo de cotizaciones: acceso restringido a administradores. */
(function () {
  'use strict';

  const install = () => {
    const instance = window.app;
    if (!instance || instance.__ordersQuoteAdminGate62) return false;
    const createButton = document.getElementById('btn-create-quote');
    const assignButton = document.getElementById('btn-assign-order-filter');
    if (!createButton || !assignButton) return false;

    instance.__ordersQuoteAdminGate62 = true;
    const isAdmin = app => app?.currentUser?.role === 'admin';
    const setRoleVisibility = app => {
      const admin = isAdmin(app);
      const create = document.getElementById('btn-create-quote');
      const archive = document.getElementById('btn-archived-quotes');

      if (create) {
        create.classList.toggle('hidden', !admin);
        create.style.setProperty('display', admin ? '' : 'none', 'important');
        create.setAttribute('aria-hidden', String(!admin));
        create.tabIndex = admin ? 0 : -1;
      }
      if (archive) {
        archive.classList.toggle('hidden', !admin);
        archive.style.setProperty('display', admin ? '' : 'none', 'important');
        archive.setAttribute('aria-hidden', String(!admin));
        archive.tabIndex = admin ? 0 : -1;
      }

      if (!admin) {
        app.quoteArchiveInlineOpen = false;
        app.closeQuotesArchiveInline?.();
        app.quotesUnsubscribe?.();
        app.quotesUnsubscribe = null;
        app.quotes = [];
        document.getElementById('quotes-shell')?.classList.add('hidden');
        document.body.classList.remove('quotes-open');
        const title = document.getElementById('orders-view-title');
        if (title?.textContent?.trim().toLocaleLowerCase() === 'cotizaciones archivadas') {
          app.showDocumentControl = false;
          app.showArchivedTasks = false;
          app.clientsDirectoryOpen = false;
          app.renderTasks?.();
        }
      }
    };

    const denyArchive = function () {
      if (isAdmin(this)) return null;
      setRoleVisibility(this);
      return false;
    };
    ['openQuotesArchive', 'renderQuoteArchiveInline'].forEach(method => {
      const original = instance[method];
      if (typeof original !== 'function' || original.__adminOnly62) return;
      const guarded = function (...args) {
        if (!isAdmin(this)) return denyArchive.call(this);
        return original.apply(this, args);
      };
      guarded.__adminOnly62 = true;
      instance[method] = guarded;
    });

    const originalRender = instance.renderTasks;
    if (typeof originalRender === 'function') {
      instance.renderTasks = function (...args) {
        if (!isAdmin(this)) {
          this.quoteArchiveInlineOpen = false;
          this.showDocumentControl = false;
          this.showArchivedTasks = false;
        }
        const result = originalRender.apply(this, args);
        setRoleVisibility(this);
        return result;
      };
    }

    const originalSetup = instance.setupDashboardUI;
    if (typeof originalSetup === 'function') {
      instance.setupDashboardUI = function (...args) {
        const result = originalSetup.apply(this, args);
        setRoleVisibility(this);
        if (isAdmin(this)) this.syncQuotesFromCloud?.();
        return result;
      };
    }
    const originalSettings = instance.openSettingsModal;
    if (typeof originalSettings === 'function') {
      instance.openSettingsModal = function (...args) {
        const result = originalSettings.apply(this, args);
        setRoleVisibility(this);
        return result;
      };
    }

    setRoleVisibility(instance);
    const navigation = document.getElementById('orders-view-navigation');
    if (navigation?.parentElement) {
      new MutationObserver(() => setRoleVisibility(window.app)).observe(navigation.parentElement, { childList: true, subtree: true });
    }
    return true;
  };

  if (!install()) {
    const timer = setInterval(() => { if (install()) clearInterval(timer); }, 50);
    setTimeout(() => clearInterval(timer), 15000);
  }
})();
