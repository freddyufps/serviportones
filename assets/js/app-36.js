(function () {
  'use strict';
  if (typeof PortonProApp === 'undefined' || !PortonProApp.prototype) return;
  const prototype = PortonProApp.prototype;
  const expandedArchivedOrders = new Set();

  document.addEventListener('toggle', event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.matches('.archived-order-extra')) return;
    const id = details.closest('.order-card')?.dataset.taskId;
    if (!id) return;
    if (details.open) expandedArchivedOrders.add(id);
    else expandedArchivedOrders.delete(id);
  }, true);

  prototype.showArchivedOrdersView = function () {
    if (this.currentUser?.role !== 'admin') return;
    this.showArchivedTasks = true;
    this.showDocumentControl = false;
    this.renderTasks();
  };
  prototype.showActiveOrdersView = function () {
    this.showArchivedTasks = false;
    this.showDocumentControl = false;
    this.renderTasks();
  };

  const ensureOrdersNavigation = app => {
    const tasks = document.getElementById('tasks-container');
    const section = tasks?.closest('section');
    if (!section) return null;
    let nav = section.querySelector('#orders-view-navigation');
    if (!nav) {
      const legacyButton = document.getElementById('btn-toggle-archived-orders');
      const header = legacyButton?.parentElement?.parentElement;
      if (!header) return null;
      nav = document.createElement('nav');
      nav.id = 'orders-view-navigation';
      nav.setAttribute('aria-label', 'Navegación de órdenes');
      nav.innerHTML = '<button type="button" data-order-view="archived" onclick="app.showArchivedOrdersView()" aria-current="false"><i data-lucide="archive"></i><span>Órdenes archivadas</span><b id="orders-nav-archive-count">0</b></button>' +
        '<button id="btn-archived-quotes" type="button" class="quote-archive-button" onclick="app.openQuotesArchive()" aria-label="Abrir cotizaciones archivadas"><span aria-hidden="true">▣</span><span>Cotizaciones archivadas</span><span id="quotes-archive-count" class="quote-archive-count">0</span></button>' +
        '<button type="button" data-order-view="invoices" onclick="app.openDocumentControl()" aria-current="false"><i data-lucide="receipt-text"></i><span>Consolidado de facturas</span></button>' +
        '<button type="button" data-order-view="active" onclick="app.showActiveOrdersView()" aria-current="false"><i data-lucide="arrow-left"></i><span>Volver a órdenes</span></button>';
      header.parentElement.insertBefore(nav, header);
    }
    if (typeof app.renderQuotesCount === 'function') app.renderQuotesCount();
    return nav;
  };

  const updateOrdersNavigation = app => {
    const isAdmin = app.currentUser?.role === 'admin';
    const nav = ensureOrdersNavigation(app);
    if (nav) {
      nav.classList.toggle('hidden', !isAdmin);
      const archivedCount = (app.tasks || []).filter(task => !!task.archivedAt).length;
      const counter = nav.querySelector('#orders-nav-archive-count');
      if (counter) counter.textContent = String(archivedCount);
      const view = app.showDocumentControl ? 'invoices' : app.showArchivedTasks ? 'archived' : 'active';
      nav.querySelectorAll('[data-order-view]').forEach(button => {
        const key = button.dataset.orderView;
        button.setAttribute('aria-current', String(key === view));
        button.classList.toggle('is-current', key === view);
        if (key === 'active') button.classList.toggle('hidden', view === 'active');
      });
      if (window.lucide) lucide.createIcons();
    }
    const title = document.getElementById('orders-view-title');
    const count = document.getElementById('filtered-count');
    const view = app.showDocumentControl ? 'invoices' : app.showArchivedTasks ? 'archived' : 'active';
    if (title) title.textContent = view === 'invoices' ? 'Consolidado de facturas' : view === 'archived' ? 'Órdenes archivadas' : 'Órdenes de trabajo';
    if (count) {
      count.textContent = view === 'archived'
        ? String((app.tasks || []).filter(task => !!task.archivedAt).length)
        : String(app.filteredTasks?.length ?? count.textContent);
      count.classList.toggle('hidden', view === 'invoices');
    }
    ['btn-toggle-archived-orders', 'btn-archived-document-control'].forEach(id => {
      const legacy = document.getElementById(id);
      if (legacy) legacy.style.setProperty('display', 'none', 'important');
    });
    const audit = document.getElementById('section-admin-audit-log');
    if (audit) audit.classList.toggle('hidden', !isAdmin || view !== 'active');
  };

  const navStyle = document.createElement('style');
  navStyle.textContent = '#orders-view-navigation{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;padding:9px;border:1px solid #dbe5ec;border-radius:16px;background:linear-gradient(135deg,#fff,#f7fafc);box-shadow:0 4px 14px rgba(15,23,42,.045)}#orders-view-navigation.hidden{display:none!important}#orders-view-navigation button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 14px;border:1px solid #d8e2ea;border-radius:11px;background:#fff;color:#40536a;font-size:11px;font-weight:800;cursor:pointer;touch-action:manipulation;transition:transform .15s,box-shadow .15s,border-color .15s}#orders-view-navigation button:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(15,23,42,.09)}#orders-view-navigation button svg{width:15px;height:15px}#orders-view-navigation button[data-order-view=archived] svg{color:#53769a}#orders-view-navigation button[data-order-view=invoices] svg{color:#68a32f}#orders-view-navigation button[data-order-view=active] svg{color:#74869a}#orders-view-navigation button b{display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#edf2f6;color:#546579;font-size:10px}#orders-view-navigation button[data-order-view=archived].is-current{border-color:#5d83ad;background:#eef5fc;color:#254a72}#orders-view-navigation button[data-order-view=invoices].is-current{border-color:#79ad43;background:#eff8e8;color:#456f22}#orders-view-navigation button[data-order-view=active].is-current{border-color:#b8c7d4;background:#edf2f6;color:#33465b}body.theme-dark #orders-view-navigation,body.theme-halloween #orders-view-navigation{border-color:#33465d;background:linear-gradient(135deg,#172235,#111b2b)}body.theme-dark #orders-view-navigation button,body.theme-halloween #orders-view-navigation button{border-color:#40536b;background:#1d2b40;color:#dce6f1}body.theme-dark #orders-view-navigation button.is-current,body.theme-halloween #orders-view-navigation button.is-current{background:#253b53}@media(max-width:540px){#orders-view-navigation{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:8px}#orders-view-navigation button{min-width:0;width:100%;min-height:38px;padding:0 8px;font-size:10px}#orders-view-navigation button[data-order-view=active]{grid-column:1/-1}}';
  document.head.appendChild(navStyle);

  if (typeof prototype.renderTasks === 'function' && !prototype.renderTasksWithNavigationViews) {
    const renderTasks = prototype.renderTasks;
    prototype.renderTasks = function (...args) {
      if (this.showArchivedTasks) {
        document.querySelectorAll('.order-card').forEach(card => {
          const id = card.dataset.taskId;
          const details = card.querySelector('.archived-order-extra');
          if (!id || !details) return;
          if (details.open) expandedArchivedOrders.add(id);
          else expandedArchivedOrders.delete(id);
        });
      }
      const result = renderTasks.apply(this, args);
      if (this.showArchivedTasks && !this.showDocumentControl) {
        document.querySelectorAll('.order-card').forEach(card => {
          const disclosure = card.querySelector('.archived-order-extra');
          const address = card.querySelector('.order-client-panel');
          const instructions = card.querySelector('.order-instructions');
          const content = disclosure?.querySelector('.archived-order-extra-content');
          const id = card.dataset.taskId;
          if (!disclosure || !address || !instructions || !content || !id) return;
          const summary = disclosure.querySelector('summary span');
          if (summary) summary.textContent = 'Ver dirección, rutas e informe';
          address.parentElement.insertBefore(disclosure, address);
          content.prepend(instructions);
          content.prepend(address);
          disclosure.dataset.addressDisclosureApplied = 'true';
          disclosure.open = expandedArchivedOrders.has(id);
        });
        if (window.lucide) lucide.createIcons();
      }
      updateOrdersNavigation(this);
      return result;
    };
    prototype.renderTasksWithNavigationViews = true;
  }

  const mobileProfileStyle = document.createElement('style');
  mobileProfileStyle.textContent = `
    @media (max-width: 639px) {
      html body #dashboard-header-inner #header-presence-profile #header-profile-copy { display:block!important; flex:1 1 auto!important; min-width:0!important; text-align:left!important; }
      html body #dashboard-header-inner #header-presence-profile #admin-presence-control { display:block!important; position:relative!important; z-index:1001!important; min-width:0!important; overflow:visible!important; pointer-events:auto!important; }
      html body #dashboard-header-inner #header-presence-profile #admin-presence-toggle { display:inline-flex!important; align-items:center!important; justify-content:flex-start!important; min-width:0!important; min-height:27px!important; max-width:100%!important; padding:4px 5px!important; border:1px solid rgba(16,185,129,.35)!important; border-radius:7px!important; background:rgba(16,185,129,.1)!important; color:#6ee7b7!important; font-size:9px!important; line-height:1.1!important; pointer-events:auto!important; touch-action:manipulation!important; cursor:pointer!important; position:relative!important; z-index:1002!important; }
      html body #dashboard-header-inner #header-presence-profile #admin-presence-toggle span { overflow:visible!important; text-overflow:clip!important; }
      html body #dashboard-header-inner #header-presence-profile #admin-presence-menu { position:fixed!important; z-index:2147483647!important; pointer-events:auto!important; touch-action:manipulation!important; }
      html body #dashboard-header-inner #header-presence-profile #admin-presence-menu button { min-height:42px!important; pointer-events:auto!important; touch-action:manipulation!important; }
    }
  `;
  document.head.appendChild(mobileProfileStyle);
})();