(() => {
  'use strict';
  const selectQuotesView = () => {
    const nav = document.getElementById('orders-view-navigation');
    if (!nav) return;
    nav.dataset.currentView = 'quotes';
    nav.querySelectorAll('[data-order-view], #btn-archived-quotes').forEach(button => {
      const selected = button.id === 'btn-archived-quotes';
      button.classList.toggle('is-current', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
      button.setAttribute('aria-pressed', String(selected));
    });
  };
  const getQuoteArchiveMarkup = app => {
    const render = typeof app?.quoteArchiveMarkup === 'function' ? app.quoteArchiveMarkup : app?.constructor?.prototype?.quoteArchiveMarkup;
    return typeof render === 'function' ? render.call(app) : '';
  };
  const renderQuoteArchiveMain = app => {
    const host = document.getElementById('quotes-view-container');
    if (!host || !app) return false;
    const markup = getQuoteArchiveMarkup(app);
    if (!markup) return false;
    host.innerHTML = markup;
    host.classList.remove('hidden');
    host.style.display = 'block';
    host.style.width = '100%';
    document.getElementById('empty-state')?.classList.add('hidden');
    document.getElementById('archived-documents-panel')?.classList.add('hidden');
    const title = document.getElementById('orders-view-title');
    if (title) title.textContent = 'Cotizaciones archivadas';
    const count = document.getElementById('filtered-count');
    if (count) { count.textContent = String((app.quotes || []).length); count.classList.add('hidden'); }
    document.getElementById('section-admin-audit-log')?.classList.add('hidden');
    selectQuotesView();
    if (window.lucide) window.lucide.createIcons();
    return true;
  };
  const openQuotesArchive = app => {
    if (!app || app.currentUser?.role !== 'admin') return false;
    app.closeQuotesArchiveInline?.();
    // The previous implementation also displayed this archive in a legacy modal.
    // app-43's cloud snapshot listener treats that modal as an active route and
    // reopens it asynchronously, competing with the single-page view below.
    document.getElementById('quotes-shell')?.classList.add('hidden');
    document.body.classList.remove('quotes-open');
    app.quotes = Array.isArray(app.quotes) ? app.quotes : [];
    app.quoteArchiveInlineOpen = true;
    app.clientsDirectoryOpen = false;
    app.showArchivedTasks = false;
    app.showDocumentControl = false;
    app.quoteConsolidationOpen = false;
    document.getElementById('tasks-container')?.classList.add('hidden');
    document.getElementById('clients-view-container')?.classList.add('hidden');
    document.getElementById('reports-view-container')?.classList.add('hidden');
    document.getElementById('quotes-view-container')?.classList.remove('hidden');
    selectQuotesView();
    // Render the inline route directly. Calling app.openQuotesArchive here can
    // hit the legacy own-property method from app-43.js, which opens the modal
    // on top of the already-rendered archive and creates the duplicate bubble.
    document.getElementById('quotes-shell')?.classList.add('hidden');
    document.body.classList.remove('quotes-open');
    return renderQuoteArchiveMain(app);
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
      const openForm = typeof app?.openQuoteForm === 'function' ? app.openQuoteForm : app?.constructor?.prototype?.openQuoteForm;
      if (typeof openForm !== 'function') return;
      app.closeQuotesArchiveInline?.();
      app.quoteArchiveInlineOpen = false;
      app.quoteConsolidationOpen = false;
      app.clientsDirectoryOpen = false;
      app.showDocumentControl = false;
      app.showArchivedTasks = false;
      openForm.call(app);
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
      // The reports module shares the legacy archived-orders navigation slot.
      // Every non-reports route must explicitly clear its active flag so late
      // Firestore/order renders cannot restore Reports over the selected view.
      if (view !== 'reports') instance.technicalReportsArchiveOpen = false;
      instance.showDocumentControl = view === 'invoices';
      instance.quoteArchiveInlineOpen = view === 'quotes';
      instance.clientsDirectoryOpen = view === 'clients';
      instance.showArchivedTasks = view === 'archived';
      instance.quoteConsolidationOpen = false;
      if (closeLegacyQuotes) clearLegacyQuotesWindow();
      const taskHost = document.getElementById('tasks-container');
      const clientsHost = document.getElementById('clients-view-container');
      const quotesHost = document.getElementById('quotes-view-container');
      const reportsHost = document.getElementById('reports-view-container');
      taskHost?.classList.toggle('hidden', !['active', 'archived'].includes(view));
      clientsHost?.classList.toggle('hidden', view !== 'clients');
      quotesHost?.classList.toggle('hidden', view !== 'quotes');
      reportsHost?.classList.toggle('hidden', view !== 'reports');
      if (view !== 'invoices') document.getElementById('archived-documents-panel')?.classList.add('hidden');
    };
    const syncNav = instance => {
      const nav = document.getElementById('orders-view-navigation');
      if (!nav) return;
      const reportsOpen = Boolean(instance.technicalReportsArchiveOpen && !instance.showDocumentControl && !instance.clientsDirectoryOpen && !instance.quoteArchiveInlineOpen && !instance.quoteConsolidationOpen && !instance.showArchivedTasks);
      const view = reportsOpen ? 'reports' : instance.showDocumentControl ? 'invoices' : instance.clientsDirectoryOpen ? 'clients' : instance.quoteArchiveInlineOpen ? 'quotes' : instance.showArchivedTasks ? 'archived' : 'active';
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
    app.openQuotesArchive = () => openQuotesArchive(app);
    // app-47 copied its methods onto the app instance. Remove that stale copy
    // so every navigation path uses this single prototype implementation.
    delete app.openClientsDirectory;
    delete app.renderClientsDirectory;
    delete app.filterClientDirectory;
    proto.openClientsDirectory = function () {
      if (this.currentUser?.role !== 'admin') return;
      setView(this, 'clients');
      this.clientsDirectoryOpen = true;
      this.showDocumentControl = false;
      this.quoteArchiveInlineOpen = false;
      this.showArchivedTasks = false;
      document.getElementById('archived-documents-panel')?.classList.add('hidden');
      this.startClientDirectorySync?.();
      this.renderClientsDirectory();
      syncNav(this);
    };
    syncNav(app);
    return true;
  };
  if (!install()) {
    const timer = setInterval(() => { if (install()) clearInterval(timer); }, 50);
    setTimeout(() => clearInterval(timer), 15000);
  }
})();
