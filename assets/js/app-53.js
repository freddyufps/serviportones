(() => {
  'use strict';

  const install = () => {
    const app = window.app;
    const proto = app?.constructor?.prototype;
    if (!app || !proto || app.__cleanInvoiceNavigation53) return false;
    app.__cleanInvoiceNavigation53 = true;

    const syncNavigation = instance => {
      const nav = document.getElementById('orders-view-navigation');
      if (!nav) return;
      const view = instance.showDocumentControl ? 'invoices'
        : instance.clientsDirectoryOpen ? 'clients'
        : instance.quoteArchiveInlineOpen ? 'quotes'
        : instance.showArchivedTasks ? 'archived' : 'active';
      nav.dataset.currentView = view;
      const quotesButton = nav.querySelector('#btn-archived-quotes');
      if (quotesButton) {
        quotesButton.classList.toggle('hidden', view === 'invoices');
        quotesButton.setAttribute('aria-hidden', String(view === 'invoices'));
        quotesButton.tabIndex = view === 'invoices' ? -1 : 0;
      }
    };

    const openDocuments = proto.openDocumentControl;
    if (typeof openDocuments === 'function' && !openDocuments.__cleanInvoice53) {
      const wrapped = function (...args) {
        this.clientsDirectoryOpen = false;
        this.quoteArchiveInlineOpen = false;
        const host = document.getElementById('tasks-container');
        document.getElementById('clients-directory')?.remove();
        if (host) {
          host.style.removeProperty('display');
          host.style.removeProperty('width');
          host.style.removeProperty('grid-template-columns');
        }
        const result = openDocuments.apply(this, args);
        syncNavigation(this);
        return result;
      };
      wrapped.__cleanInvoice53 = true;
      proto.openDocumentControl = wrapped;
    }

    const renderTasks = proto.renderTasks;
    if (typeof renderTasks === 'function' && !renderTasks.__cleanInvoice53) {
      const wrapped = function (...args) {
        if (this.showDocumentControl) {
          this.clientsDirectoryOpen = false;
          this.quoteArchiveInlineOpen = false;
          document.getElementById('clients-directory')?.remove();
          const host = document.getElementById('tasks-container');
          if (host) {
            host.style.removeProperty('display');
            host.style.removeProperty('width');
            host.style.removeProperty('grid-template-columns');
          }
        }
        const result = renderTasks.apply(this, args);
        syncNavigation(this);
        return result;
      };
      wrapped.__cleanInvoice53 = true;
      proto.renderTasks = wrapped;
    }

    syncNavigation(app);
    return true;
  };

  if (!install()) {
    const timer = setInterval(() => { if (install()) clearInterval(timer); }, 50);
    setTimeout(() => clearInterval(timer), 15000);
  }
})();
