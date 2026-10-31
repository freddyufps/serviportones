(() => {
  'use strict';
  const artworks = {
    active: ['Órdenes', 'assets/media/boton-ordenes-transparent.png'],
    archived: ['Órdenes archivadas', 'assets/img/nav/ordenes-archivadas-transparent.png'],
    quotes: ['Cotizaciones archivadas', 'assets/img/nav/cotizaciones-archivadas-transparent.png'],
    invoices: ['Consolidado de facturas', 'assets/img/nav/consolidado-facturas-transparent.png'],
    clients: ['Clientes', 'assets/img/nav/clientes-transparent.png']
  };
  const addArtwork = (button, label, src, countSelector) => {
    if (!button || button.dataset.navArtwork === src) return;
    button.dataset.navArtwork = src;
    const count = countSelector ? button.querySelector(countSelector) : null;
    button.replaceChildren();
    const image = document.createElement('img');
    image.className = 'orders-nav-artwork'; image.src = src; image.alt = ''; image.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.className = 'orders-nav-label'; text.textContent = label;
    button.append(image, text); if (count) button.append(count);
  };
  const decorate = () => {
    const nav = document.getElementById('orders-view-navigation'); if (!nav) return;
    addArtwork(nav.querySelector('[data-order-view="active"]'), ...artworks.active);
    addArtwork(nav.querySelector('[data-order-view="archived"]'), ...artworks.archived, '#orders-nav-archive-count');
    addArtwork(nav.querySelector('#btn-archived-quotes'), ...artworks.quotes, '.quote-archive-count');
    addArtwork(nav.querySelector('[data-order-view="invoices"]'), ...artworks.invoices);
    addArtwork(nav.querySelector('[data-order-view="clients"]'), ...artworks.clients);
    const app = window.app;
    const current = app?.showDocumentControl ? 'invoices' : app?.clientsDirectoryOpen ? 'clients' : app?.quoteArchiveInlineOpen ? 'quotes' : app?.showArchivedTasks ? 'archived' : 'active';
    nav.querySelectorAll('[data-order-view], #btn-archived-quotes').forEach(button => {
      const key = button.dataset.orderView || (button.id === 'btn-archived-quotes' ? 'quotes' : '');
      const selected = key === current;
      button.classList.toggle('is-current', selected);
      button.setAttribute('aria-current', selected ? 'page' : 'false');
      button.setAttribute('aria-pressed', String(selected));
      if (key === 'quotes') { button.classList.remove('hidden'); button.removeAttribute('aria-hidden'); button.tabIndex = 0; }
    });
  };
  const install = () => {
    if (!window.app || window.app.__ordersNavArtwork54) return false;
    window.app.__ordersNavArtwork54 = true;
    const prototype = window.app.constructor?.prototype;
    if (prototype && typeof prototype.renderTasks === 'function' && !prototype.renderTasksNavArtwork54) {
      const render = prototype.renderTasks;
      prototype.renderTasks = function (...args) { const result = render.apply(this, args); decorate(); return result; };
      prototype.renderTasksNavArtwork54 = true;
    }
    decorate();
    const parent = document.getElementById('orders-view-navigation')?.parentElement;
    if (parent) new MutationObserver(decorate).observe(parent, { childList: true, subtree: true });
    return true;
  };
  if (!install()) { const timer = setInterval(() => { if (install()) clearInterval(timer); }, 50); setTimeout(() => clearInterval(timer), 15000); }
})();
