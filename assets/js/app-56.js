(() => {
  'use strict';
  const install = () => {
    const app = window.app;
    const proto = app?.constructor?.prototype;
    if (!app || !proto || app.__quoteConsolidation56) return false;
    app.__quoteConsolidation56 = true;

    const clearQuoteOverlay = () => {
      document.getElementById('quotes-shell')?.classList.add('hidden');
      document.body.classList.remove('quotes-open');
    };
    const ensureButton = () => {
      const nav = document.getElementById('orders-view-navigation');
      if (!nav) return null;
      let button = nav.querySelector('[data-order-view="quote-consolidation"]');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.dataset.orderView = 'quote-consolidation';
        button.setAttribute('aria-current', 'false');
        button.innerHTML = '<i data-lucide="files"></i><span>Consolidado de cotizaciones</span>';
        button.addEventListener('click', () => app.openQuoteConsolidation());
        const invoices = nav.querySelector('[data-order-view="invoices"]');
        if (invoices) invoices.insertAdjacentElement('afterend', button);
        else nav.appendChild(button);
      }
      return button;
    };
    const syncNav = instance => {
      const nav = document.getElementById('orders-view-navigation');
      if (!nav) return;
      ensureButton();
      const view = instance.quoteConsolidationOpen ? 'quote-consolidation'
        : instance.showDocumentControl ? 'invoices'
        : instance.clientsDirectoryOpen ? 'clients'
        : instance.quoteArchiveInlineOpen ? 'quotes'
        : instance.showArchivedTasks ? 'archived' : 'active';
      nav.dataset.currentView = view;
      nav.querySelectorAll('[data-order-view], #btn-archived-quotes').forEach(button => {
        const key = button.dataset.orderView || (button.id === 'btn-archived-quotes' ? 'quotes' : '');
        const selected = key === view;
        button.classList.toggle('is-current', selected);
        button.setAttribute('aria-current', selected ? 'page' : 'false');
        button.setAttribute('aria-pressed', String(selected));
      });
      if (window.lucide) window.lucide.createIcons();
    };
    const renderConsolidation = instance => {
      if (!instance.quoteConsolidationOpen) return;
      const host = document.getElementById('tasks-container');
      if (!host) return;
      clearQuoteOverlay();
      const quotes = Array.isArray(instance.quotes) ? instance.quotes : [];
      let markup = instance.quoteArchiveMarkup();
      markup = markup
        .replace('ARCHIVO COMERCIAL', 'RESUMEN COMERCIAL')
        .replace('Cotizaciones Archivadas', 'Consolidado de cotizaciones')
        .replace('Consulta y administra tus propuestas.', 'Todas tus propuestas en un solo lugar.');
      const totalValue = quotes.reduce((sum, quote) => sum + (Number(quote.total) || 0), 0);
      const summary = `<div class="quote-consolidation-summary" aria-label="Resumen de cotizaciones">
        <div><span>Cotizaciones registradas</span><strong>${quotes.length}</strong></div>
        <div><span>Valor cotizado</span><strong>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalValue)}</strong></div>
      </div>`;
      markup = markup.replace('<div class="quotes-filters">', `${summary}<div class="quotes-filters">`);
      host.innerHTML = markup;
      host.classList.remove('hidden');
      host.style.setProperty('display', 'block');
      host.style.setProperty('width', '100%');
      document.getElementById('empty-state')?.classList.add('hidden');
      document.getElementById('archived-documents-panel')?.classList.add('hidden');
      const title = document.getElementById('orders-view-title');
      if (title) title.textContent = 'Consolidado de cotizaciones';
      const count = document.getElementById('filtered-count');
      if (count) { count.textContent = String(quotes.length); count.classList.remove('hidden'); }
      document.getElementById('section-admin-audit-log')?.classList.add('hidden');
      syncNav(instance);
    };

    proto.openQuoteConsolidation = function () {
      if (this.currentUser?.role !== 'admin') return;
      this.showDocumentControl = false;
      this.showArchivedTasks = false;
      this.clientsDirectoryOpen = false;
      this.quoteArchiveInlineOpen = false;
      this.quoteConsolidationOpen = true;
      document.getElementById('clients-directory')?.remove();
      clearQuoteOverlay();
      this.renderTasks();
      renderConsolidation(this);
    };

    const originalRender = proto.renderTasks;
    if (typeof originalRender === 'function') {
      proto.renderTasks = function (...args) {
        const result = originalRender.apply(this, args);
        if (this.showDocumentControl) {
          clearQuoteOverlay();
          const host = document.getElementById('tasks-container');
          // app-44 gives inline quote archives an !important display rule;
          // remove stale quote markup so it cannot leak into the invoice view.
          if (host?.querySelector('.quotes-archive')) host.replaceChildren();
        }
        if (this.quoteConsolidationOpen) renderConsolidation(this);
        else syncNav(this);
        return result;
      };
    }
    const originalQuoteCount = proto.renderQuotesCount;
    if (typeof originalQuoteCount === 'function') {
      proto.renderQuotesCount = function (...args) {
        const result = originalQuoteCount.apply(this, args);
        if (this.quoteConsolidationOpen) renderConsolidation(this);
        return result;
      };
    }
    ensureButton();
    syncNav(app);
    return true;
  };
  if (!install()) {
    const timer = setInterval(() => { if (install()) clearInterval(timer); }, 50);
    setTimeout(() => clearInterval(timer), 15000);
  }
})();
