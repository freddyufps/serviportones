(() => {
  'use strict';
  const openQuotesArchive = app => {
    if (!app || app.currentUser?.role !== 'admin') return false;
    const navBar = document.getElementById('orders-view-navigation');
    if (navBar) {
      navBar.dataset.currentView = 'quotes';
      navBar.querySelectorAll('[data-order-view], #btn-archived-quotes').forEach(button => {
        const selected = button.id === 'btn-archived-quotes';
        button.classList.toggle('is-current', selected);
        button.setAttribute('aria-current', selected ? 'page' : 'false');
        button.setAttribute('aria-pressed', String(selected));
      });
    }
    if (typeof app.openQuotesArchive === 'function') {
      try {
        app.openQuotesArchive();
        const inline = document.getElementById('tasks-container')?.querySelector('.quotes-archive');
        if (inline) return true;
      } catch (error) { console.warn('[COTIZACIONES] Se activa la ruta de respaldo.', error); }
    }
    if (typeof app.quoteArchiveMarkup !== 'function') return false;
    app.quotes = Array.isArray(app.quotes) ? app.quotes : [];
    app.quoteArchiveInlineOpen = true;
    app.clientsDirectoryOpen = false;
    app.showArchivedTasks = false;
    app.showDocumentControl = false;
    const host = document.getElementById('tasks-container');
    if (!host) return false;
    document.getElementById('quotes-shell')?.classList.add('hidden');
    document.body.classList.remove('quotes-open');
    document.getElementById('clients-directory')?.remove();
    document.getElementById('archived-documents-panel')?.classList.add('hidden');
    host.innerHTML = app.quoteArchiveMarkup();
    host.style.display = 'block';
    host.style.width = '100%';
    const title = document.getElementById('orders-view-title');
    if (title) title.textContent = 'Cotizaciones archivadas';
    const count = document.getElementById('filtered-count');
    if (count) { count.textContent = String((app.quotes || []).length); count.classList.remove('hidden'); }
    document.getElementById('section-admin-audit-log')?.classList.add('hidden');
    const nav = document.getElementById('orders-view-navigation');
    if (nav) {
      nav.dataset.currentView = 'quotes';
      nav.querySelectorAll('[data-order-view], #btn-archived-quotes').forEach(button => {
        const selected = button.id === 'btn-archived-quotes';
        button.classList.toggle('is-current', selected);
        button.setAttribute('aria-current', selected ? 'page' : 'false');
        button.setAttribute('aria-pressed', String(selected));
      });
    }
    if (window.lucide) window.lucide.createIcons();
    return true;
  };
  const bindQuotesArchive = () => {
    const button = document.getElementById('btn-archived-quotes');
    if (!button || button.dataset.quotesArchiveClickBound === '1') return;
    button.dataset.quotesArchiveClickBound = '1';
    button.addEventListener('click', event => {
      event.preventDefault();
      openQuotesArchive(window.app);
    });
  };
  bindQuotesArchive();
  new MutationObserver(bindQuotesArchive).observe(document.documentElement, { childList: true, subtree: true });
  const bindCreateQuote = () => {
    const button = document.getElementById('btn-create-quote');
    if (!button || button.dataset.createQuoteClickBound === '1') return;
    button.dataset.createQuoteClickBound = '1';
    button.removeAttribute('onclick');
    button.addEventListener('click', event => {
      event.preventDefault();
      const app = window.app;
      if (typeof app?.openQuoteForm === 'function') app.openQuoteForm();
    });
  };
  bindCreateQuote();
  new MutationObserver(bindCreateQuote).observe(document.documentElement, { childList: true, subtree: true });
  const install = () => {
    const app = window.app, proto = app?.constructor?.prototype;
    if (!app || !proto || app.__independentOrderViews55 || !app.__quoteModule44 || !app.__mobileClientModule47) return false;
    app.__independentOrderViews55 = true;
    const clearLegacyQuotesWindow = () => {
      document.getElementById('quotes-shell')?.classList.add('hidden');
      document.body.classList.remove('quotes-open');
    };
    const setView = (instance, view, closeLegacyQuotes = true) => {
      instance.showDocumentControl = view === 'invoices';
      instance.quoteArchiveInlineOpen = view === 'quotes';
      instance.clientsDirectoryOpen = view === 'clients';
      instance.showArchivedTasks = view === 'archived';
      if (closeLegacyQuotes) clearLegacyQuotesWindow();
      const host = document.getElementById('tasks-container');
      if (host) {
        host.style.removeProperty('display');
        host.style.removeProperty('width');
        host.style.removeProperty('grid-template-columns');
      }
      if (view !== 'invoices') document.getElementById('archived-documents-panel')?.classList.add('hidden');
      if (view !== 'clients') document.getElementById('clients-directory')?.remove();
    };
    const syncNav = instance => {
      const nav = document.getElementById('orders-view-navigation');
      if (!nav) return;
      const view = instance.showDocumentControl ? 'invoices' : instance.clientsDirectoryOpen ? 'clients' : instance.quoteArchiveInlineOpen ? 'quotes' : instance.showArchivedTasks ? 'archived' : 'active';
      nav.dataset.currentView = view;
      nav.querySelectorAll('[data-order-view], #btn-archived-quotes').forEach(button => {
        const key = button.dataset.orderView || (button.id === 'btn-archived-quotes' ? 'quotes' : '');
        const selected = key === view;
        button.classList.toggle('is-current', selected);
        button.setAttribute('aria-current', selected ? 'page' : 'false');
        button.setAttribute('aria-pressed', String(selected));
      });
      const quotes = nav.querySelector('#btn-archived-quotes');
      if (quotes) { quotes.classList.remove('hidden'); quotes.removeAttribute('aria-hidden'); quotes.tabIndex = 0; }
    };
    const wrapView = (method, view) => {
      const original = proto[method];
      if (typeof original !== 'function' || original.__exclusiveView55) return;
      const wrapped = function (...args) {
        setView(this, view);
        const result = original.apply(this, args);
        if (view === 'invoices') this.showArchivedTasks = false;
        syncNav(this);
        return result;
      };
      wrapped.__exclusiveView55 = true;
      proto[method] = wrapped;
    };
    wrapView('showActiveOrdersView', 'active');
    wrapView('showArchivedOrdersView', 'archived');
    wrapView('openQuotesArchive', 'quotes');
    wrapView('openDocumentControl', 'invoices');
    wrapView('openClientsDirectory', 'clients');    // Keep the Clients destination independent from archived and invoice views.
    proto.openClientsDirectory = function () {
      if (this.currentUser?.role !== 'admin') return;
      setView(this, 'clients');
      this.clientsDirectoryOpen = true;
      this.showDocumentControl = false;
      this.quoteArchiveInlineOpen = false;
      this.showArchivedTasks = false;
      document.getElementById('archived-documents-panel')?.classList.add('hidden');
      this.renderTasks();
      this.renderClientsDirectory();
      syncNav(this);
    };
    const originalRender = proto.renderTasks;
    if (typeof originalRender === 'function' && !originalRender.__exclusiveViews55) {
      const wrappedRender = function (...args) {
        if (this.showDocumentControl) setView(this, 'invoices', false);
        else if (this.clientsDirectoryOpen) setView(this, 'clients', false);
        else if (this.quoteArchiveInlineOpen) setView(this, 'quotes', false);
        else if (this.showArchivedTasks) setView(this, 'archived', false);
        else setView(this, 'active', false);
        const result = originalRender.apply(this, args);
        syncNav(this);
        return result;
      };
      wrappedRender.__exclusiveViews55 = true;
      proto.renderTasks = wrappedRender;
    }
    syncNav(app);
    return true;
  };
  if (!install()) {
    const timer = setInterval(() => { if (install()) clearInterval(timer); }, 50);
    setTimeout(() => clearInterval(timer), 15000);
  }
})();
