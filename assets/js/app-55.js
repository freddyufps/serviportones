(() => {
  'use strict';
  const install = () => {
    const app = window.app, proto = app?.constructor?.prototype;
    if (!app || !proto || app.__independentOrderViews55) return false;
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
