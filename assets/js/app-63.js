(function () {
  'use strict';

  if (window.__archivedOrdersInvoiceSummary63) return;
  window.__archivedOrdersInvoiceSummary63 = true;

  const DAY = 86400000;
  const money = value => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const hasInvoice = task => Boolean(String(task?.invoiceNumber || '').trim());
  const completionTime = task => {
    const numeric = Number(task?.completedAtMs || 0);
    if (numeric > 0) return numeric;
    const due = Number(task?.paymentDueAt || 0);
    if (due > 0) return due - 30 * DAY;
    const display = String(task?.completedAt || '');
    const match = display.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
    const iso = String(task?.date || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(iso + 'T12:00:00').getTime();
    return 0;
  };
  const statusOf = task => {
    const status = String(task?.paymentStatus || '').toUpperCase();
    return status === 'PAGADA' || status === 'PENDIENTE' ? status : hasInvoice(task) ? 'PAGADA' : 'PENDIENTE';
  };

  function archivedOrdersActive(instance) {
    return Boolean(instance?.showArchivedTasks && !instance?.showDocumentControl && !instance?.clientsDirectoryOpen && !instance?.quoteArchiveInlineOpen && !instance?.quoteConsolidationOpen);
  }

  function applySearch(input) {
    const host = document.getElementById('tasks-container');
    if (!host || host.classList.contains('hidden')) return;
    const term = normalize(input.value.trim());
    let visible = 0;
    host.querySelectorAll('.order-card').forEach(card => {
      const match = !term || normalize(card.textContent).includes(term);
      card.classList.toggle('hidden', !match);
      if (match) visible += 1;
    });
    const count = document.getElementById('filtered-count');
    if (count) count.textContent = String(visible);
    const empty = document.getElementById('empty-state');
    if (empty) {
      empty.classList.toggle('hidden', visible > 0);
      const heading = empty.querySelector('h3');
      const detail = empty.querySelector('p');
      if (heading) heading.textContent = term ? 'No hay órdenes que coincidan' : 'No hay órdenes para mostrar';
      if (detail) detail.textContent = term ? 'Prueba con otro cliente, dirección, equipo o número de orden.' : 'No hay órdenes archivadas con los filtros actuales.';
    }
  }

  function syncToolbar() {
    const toolbar = document.getElementById('orders-toolbar');
    const input = document.getElementById('filter-search');
    const active = archivedOrdersActive(window.app);
    if (toolbar) toolbar.classList.toggle('archived-orders-toolbar', active);
    if (input && active) {
      input.placeholder = 'Buscar cliente, dirección, equipo o número de orden';
      input.setAttribute('aria-label', 'Buscar órdenes archivadas');
    } else if (input) {
      input.placeholder = 'Buscar cliente, dirección o motor...';
      input.setAttribute('aria-label', 'Buscar órdenes');
    }
  }

  function ensureSummary() {
    const tasks = document.getElementById('tasks-container');
    if (!tasks) return null;
    let summary = document.getElementById('archived-invoice-summary');
    if (!summary) {
      summary = document.createElement('section');
      summary.id = 'archived-invoice-summary';
      summary.className = 'payment-summary archived-invoice-summary';
      summary.setAttribute('aria-label', 'Resumen de facturas de órdenes archivadas');
      summary.innerHTML = '<article><span>Total de facturas</span><b data-archived-invoice="total">0</b></article>' +
        '<article><span>Pendientes de pago</span><b data-archived-invoice="pending">0</b></article>' +
        '<article><span>Facturas pagadas</span><b data-archived-invoice="paid">0</b></article>' +
        '<article><span>Valor total facturado</span><b data-archived-invoice="value">$ 0</b></article>' +
        '<article class="payment-overdue-stat"><span>Facturas vencidas · +30 días</span><b data-archived-invoice="overdue">0</b></article>';
      tasks.parentNode.insertBefore(summary, tasks);
    } else if (summary.nextElementSibling !== tasks) {
      tasks.parentNode.insertBefore(summary, tasks);
    }
    return summary;
  }

  function updateSummary(instance) {
    const summary = ensureSummary();
    if (!summary) return;
    const invoices = (instance.tasks || []).filter(task => task?.status === 'REALIZADA' && Boolean(task.archivedAt) && hasInvoice(task));
    const pending = invoices.filter(task => statusOf(task) === 'PENDIENTE');
    const paid = invoices.filter(task => statusOf(task) === 'PAGADA');
    const now = Date.now();
    const overdue = pending.filter(task => completionTime(task) && now >= completionTime(task) + 30 * DAY);
    const values = {
      total: invoices.length,
      pending: pending.length,
      paid: paid.length,
      value: money(invoices.reduce((total, task) => total + (Number(task.workValue) || 0), 0)),
      overdue: overdue.length
    };
    Object.entries(values).forEach(([key, value]) => {
      const target = summary.querySelector(`[data-archived-invoice="${key}"]`);
      if (target) target.textContent = String(value);
    });
  }

  function syncArchivedUI(instance) {
    const summary = document.getElementById('archived-invoice-summary');
    if (!archivedOrdersActive(instance)) {
      document.getElementById('orders-toolbar')?.classList.remove('archived-orders-toolbar');
      summary?.remove();
      const input = document.getElementById('filter-search');
      if (input) {
        input.placeholder = 'Buscar cliente, dirección o motor...';
        input.setAttribute('aria-label', 'Buscar órdenes');
      }
      return;
    }
    syncToolbar();
    updateSummary(instance);
    const input = document.getElementById('filter-search');
    if (input) applySearch(input);
  }

  document.addEventListener('input', event => {
    if (event.target?.id !== 'filter-search' || !archivedOrdersActive(window.app)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    applySearch(event.target);
  }, true);

  function install() {
    const App = window.PortonProApp;
    const proto = App?.prototype;
    if (!proto) return false;
    if (!proto.__archivedOrdersInvoices63 && typeof proto.renderTasks === 'function') {
      const original = proto.renderTasks;
      proto.renderTasks = function (...args) {
        const result = original.apply(this, args);
        syncArchivedUI(this);
        return result;
      };
      proto.__archivedOrdersInvoices63 = true;
    }
    syncArchivedUI(window.app);
    return true;
  }

  if (!install()) {
    const timer = window.setInterval(() => {
      if (install()) window.clearInterval(timer);
    }, 40);
    window.setTimeout(() => window.clearInterval(timer), 15000);
  }
})();
