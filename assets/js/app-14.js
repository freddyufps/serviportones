(function () {
  if (typeof PortonProApp === 'undefined' || PortonProApp.prototype.__documentControlInstalled) return;
  PortonProApp.prototype.__documentControlInstalled = true;

  const DAY = 86400000;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
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
  const dateLabel = task => {
    const stamp = completionTime(task);
    return stamp ? new Intl.DateTimeFormat('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(stamp)) : '—';
  };
  const dateMonth = task => {
    const stamp = completionTime(task);
    if (stamp) { const d = new Date(stamp); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
    return String(task?.date || '').slice(0, 7);
  };
  const statusOf = task => { const saved = String(task?.paymentStatus || '').toUpperCase(); return saved === 'PAGADA' || saved === 'PENDIENTE' ? saved : hasInvoice(task) ? 'PAGADA' : 'PENDIENTE'; };
  const currencyLabel = value => value === null || value === undefined || value === '' ? '—' : new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(value) || 0);
  const paymentId = task => 'pago_' + encodeURIComponent(String(task?.id || ''));

  PortonProApp.prototype.ensureDocumentControlPanel = function () {
    let panel = document.getElementById('archived-documents-panel');
    if (!panel) {
      const tasks = document.getElementById('tasks-container');
      if (!tasks) return null;
      panel = document.createElement('div');
      panel.id = 'archived-documents-panel';
      panel.className = 'hidden';
      tasks.insertAdjacentElement('afterend', panel);
    }
    if (panel.dataset.ready === 'true') return panel;
    panel.dataset.ready = 'true';
    panel.innerHTML = `
      <section class="payment-console">
        <header class="payment-console-header">
          <div class="payment-console-heading-icon"><i data-lucide="receipt-text"></i></div>
          <div class="payment-console-heading"><h3>Consolidado de facturas</h3><p>Órdenes realizadas y seguimiento de pago a 30 días</p></div>
          <button type="button" class="payment-back-button" data-payment-back><i data-lucide="arrow-left"></i><span>Volver a órdenes archivadas</span></button>
        </header>
        <div class="payment-console-content">
          <div class="payment-summary" aria-label="Resumen de pagos">
            <article><span>Órdenes realizadas</span><b id="payment-total">0</b></article>
            <article><span>Pendientes de pago</span><b id="payment-pending">0</b></article>
            <article><span>Pagadas</span><b id="payment-paid">0</b></article>
            <article><span>Valor registrado</span><b id="payment-value-total">$ 0</b></article>
            <article class="payment-overdue-stat"><span>Vencidas · +30 días</span><b id="payment-overdue-count">0</b></article>
          </div>
          <section id="payment-alerts" class="payment-alerts" aria-live="polite"></section>
          <div class="payment-tools">
            <label class="payment-search"><i data-lucide="search"></i><input id="payment-search" type="search" placeholder="Buscar cliente, orden o factura FE…" autocomplete="off"></label>
            <label class="payment-filter"><span>Estado</span><select id="payment-status-filter"><option value="TODAS">Todos</option><option value="PENDIENTE">Pendiente</option><option value="PAGADA">Pagada</option><option value="VENCIDA">Vencida · +30 días</option></select></label>
            <label class="payment-filter"><span>Mes realizado</span><input id="payment-month-filter" type="month"></label>
          </div>
          <p id="payment-results-count" class="payment-results-count"></p>
          <div id="payment-table-area"></div>
        </div>
      </section>`;
    panel.addEventListener('click', async event => {
      const editInvoice = event.target.closest('[data-payment-edit]');
      if (editInvoice) {
        this.openOrderInvoiceNumber(editInvoice.dataset.paymentEdit);
        return;
      }
      const editValue = event.target.closest('[data-payment-value-edit]');
      if (editValue) { this.openOrderPaymentValue(editValue.dataset.paymentValueEdit); return; }
      const viewOrder = event.target.closest('[data-payment-view]');
      if (viewOrder) { this.openPaymentOrderPreview(viewOrder.dataset.paymentView); return; }
      const toggleStatus = event.target.closest('[data-payment-status-toggle]');
      if (toggleStatus) {
        if (toggleStatus.disabled) return;
        toggleStatus.disabled = true;
        const saved = await this.saveOrderPaymentStatus(toggleStatus.closest('.payment-status-editor')?.dataset.taskId, toggleStatus.dataset.nextStatus);
        if (!saved && toggleStatus.isConnected) toggleStatus.disabled = false;
        return;
      }
      if (event.target.closest('[data-payment-back]')) {
        this.showDocumentControl = false;
        this.renderTasks();
        return;
      }
    });
    ['payment-search','payment-status-filter','payment-month-filter'].forEach(id => {
      const input = panel.querySelector('#' + id);
      input?.addEventListener(id === 'payment-search' ? 'input' : 'change', () => this.renderDocumentControlRecords());
    });
    return panel;
  };

  PortonProApp.prototype.openDocumentControl = function () {
    if (this.currentUser?.role !== 'admin') return this.showToast('Esta sección está disponible para el administrador.', 'error');
    this.showArchivedTasks = true;
    this.showDocumentControl = true;
    this.ensureDocumentControlPanel();
    this.renderTasks();
    if (window.lucide) lucide.createIcons();
  };

  PortonProApp.prototype.closeDocumentControl = function () {
    this.showDocumentControl = false;
    this.renderTasks();
  };

  PortonProApp.prototype.renderDocumentControlRecords = function () {
    const panel = this.ensureDocumentControlPanel();
    if (!panel) return;
    // El consolidado solo cuenta órdenes que siguen archivadas; al restaurarlas desaparecen y los totales se recalculan.
    const completed = (this.tasks || []).filter(task => task?.status === 'REALIZADA' && Boolean(task.archivedAt));
    const now = Date.now();
    const overdue = completed.filter(task => statusOf(task) === 'PENDIENTE' && completionTime(task) && now >= completionTime(task) + 30 * DAY);
    const pending = completed.filter(task => statusOf(task) === 'PENDIENTE');
    const paid = completed.filter(task => statusOf(task) === 'PAGADA');
    const set = (id, value) => { const el = panel.querySelector('#' + id); if (el) el.textContent = String(value); };
    set('payment-total', completed.length);
    set('payment-pending', pending.length);
    set('payment-paid', paid.length);
    set('payment-value-total', currencyLabel(completed.reduce((sum, task) => sum + (Number(task.workValue) || 0), 0)));
    set('payment-overdue-count', overdue.length);
    const alerts = panel.querySelector('#payment-alerts');
    alerts.innerHTML = overdue.length
      ? `<div class="payment-alert-heading"><span class="payment-alert-icon"><i data-lucide="bell-ring"></i></span><div><b>Pagos · ${overdue.length} pago${overdue.length === 1 ? '' : 's'} vencido${overdue.length === 1 ? '' : 's'}</b><p>Órdenes realizadas hace 30 días o más pendientes de pago.</p></div></div><div class="payment-alert-list">${overdue.map(task => `<button type="button" data-payment-order="${safe(task.id)}"><b>${safe(task.client || 'Cliente')}</b><span>${safe(task.id)} · ${dateLabel(task)}</span></button>`).join('')}</div>`
      : `<div class="payment-alert-heading is-clear"><span class="payment-alert-icon"><i data-lucide="badge-check"></i></span><div><b>Pagos al día</b><p>No hay órdenes vencidas pendientes de pago.</p></div></div>`;
    panel.querySelectorAll('[data-payment-order]').forEach(button => button.addEventListener('click', () => this.openOrderInvoiceNumber(button.dataset.paymentOrder)));

    const search = (panel.querySelector('#payment-search')?.value || '').trim().toLocaleLowerCase('es');
    const state = panel.querySelector('#payment-status-filter')?.value || 'TODAS';
    const month = panel.querySelector('#payment-month-filter')?.value || '';
    const filtered = completed.filter(task => {
      const text = `${task.id || ''} ${task.client || ''} ${task.invoiceNumber || ''}`.toLocaleLowerCase('es');
      const status = statusOf(task);
      const isOverdue = status === 'PENDIENTE' && completionTime(task) && now >= completionTime(task) + 30 * DAY;
      return (!search || text.includes(search)) && (!month || dateMonth(task) === month) && (state === 'TODAS' || (state === 'VENCIDA' ? isOverdue : status === state));
    }).sort((a,b) => completionTime(b) - completionTime(a));
    set('payment-results-count', `${filtered.length} de ${completed.length} órdenes realizadas`);
    const tableArea = panel.querySelector('#payment-table-area');
    if (!filtered.length) {
      tableArea.innerHTML = `<div class="payment-empty-state"><i data-lucide="file-check-2"></i><b>${completed.length ? 'No hay órdenes con esos filtros' : 'Todavía no hay órdenes realizadas'}</b><span>${completed.length ? 'Prueba cambiando la búsqueda o los filtros.' : 'Cuando se complete una orden aparecerá en este consolidado.'}</span></div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }
    const statusEditor = task => {
      const current = statusOf(task);
      const overdueNow = current === 'PENDIENTE' && completionTime(task) && now >= completionTime(task) + 30 * DAY;
      return `<div class="payment-status-editor" data-task-id="${safe(task.id)}"><button type="button" class="payment-status-select payment-status-toggle ${current === 'PAGADA' ? 'is-pagada' : 'is-pendiente'}" data-payment-status-toggle data-next-status="${current === 'PAGADA' ? 'PENDIENTE' : 'PAGADA'}" aria-label="Cambiar estado de pago a ${current === 'PAGADA' ? 'pendiente' : 'pagada'}">${current === 'PAGADA' ? 'Pagada' : 'Pendiente'}</button>${overdueNow ? '<small>+30 días</small>' : ''}</div>`;
    };
    const rows = filtered.map(task => {
      const status = statusOf(task);
      const isOverdue = status === 'PENDIENTE' && completionTime(task) && now >= completionTime(task) + 30 * DAY;
      const badge = isOverdue ? '<span class="payment-state is-overdue">Vencida</span>' : `<span class="payment-state is-${status.toLowerCase()}">${status === 'PAGADA' ? 'Pagada' : 'Pendiente'}</span>`;
      const invoice = String(task.invoiceNumber || '').replace(/^FE-/i, '');
      return `<tr><td>${safe(dateLabel(task))}</td><td><b>${safe(task.client || '—')}</b><small>${safe(task.id || '')}</small></td><td><div class="payment-invoice-display"><span>${invoice ? 'FE-' + safe(invoice) : 'Sin FE registrada'}</span><button type="button" class="payment-edit-button" data-payment-edit="${safe(task.id)}" title="Editar factura" aria-label="Editar factura"><i data-lucide="pencil"></i></button></div></td><td><div class="payment-value-editor"><span class="payment-value-cell">${safe(currencyLabel(task.workValue))}</span><button type="button" class="payment-edit-button" data-payment-value-edit="${safe(task.id)}" title="Editar valor" aria-label="Editar valor de ${safe(task.id)}"><i data-lucide="pencil"></i></button></div></td><td>${statusEditor(task)}</td><td><button type="button" class="payment-view-order-button" data-payment-view="${safe(task.id)}" title="Ver orden completa" aria-label="Ver orden completa ${safe(task.id)}"><i data-lucide="eye"></i></button></td></tr>`;
    }).join('');
    const cards = filtered.map(task => {
      const status = statusOf(task), isOverdue = status === 'PENDIENTE' && completionTime(task) && now >= completionTime(task) + 30 * DAY;
      const invoice = String(task.invoiceNumber || '').replace(/^FE-/i, '');
      return `<article class="payment-mobile-card"><div class="payment-mobile-top"><span>${safe(dateLabel(task))} · ${safe(task.id)}</span></div><b>${safe(task.client || '—')}</b><div class="payment-mobile-document-row"><div class="payment-invoice-display"><span>${invoice ? 'FE-' + safe(invoice) : 'Sin FE registrada'}</span><button type="button" class="payment-edit-button" data-payment-edit="${safe(task.id)}" title="Editar factura y valor" aria-label="Editar factura y valor"><i data-lucide="pencil"></i></button></div><div class="payment-value-editor"><span class="payment-value-cell">${safe(currencyLabel(task.workValue))}</span><button type="button" class="payment-edit-button" data-payment-value-edit="${safe(task.id)}" title="Editar valor" aria-label="Editar valor de ${safe(task.id)}"><i data-lucide="pencil"></i></button></div></div>${statusEditor(task)}<button type="button" class="payment-view-order-button payment-view-order-mobile" data-payment-view="${safe(task.id)}" title="Ver orden completa" aria-label="Ver orden completa ${safe(task.id)}"><i data-lucide="eye"></i><span>Ver orden completa</span></button></article>`;
    }).join('');
    tableArea.innerHTML = `<div class="payment-table-wrap"><table class="payment-table"><thead><tr><th>Fecha</th><th>Cliente / orden</th><th>Factura</th><th>Valor</th><th>Pago</th><th>Orden</th></tr></thead><tbody>${rows}</tbody></table></div><div class="payment-mobile-list">${cards}</div>`;
    if (window.lucide) lucide.createIcons();
  };

  PortonProApp.prototype.openPaymentOrderPreview = function (id) {
    if (this.currentUser?.role !== 'admin') return this.showToast('Esta vista está disponible para el administrador.', 'error');
    const task = (this.tasks || []).find(item => String(item.id) === String(id));
    if (!task) return this.showToast('No se encontró la orden seleccionada.', 'error');
    let dialog = document.getElementById('payment-order-preview');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'payment-order-preview'; dialog.className = 'payment-order-preview hidden'; document.body.appendChild(dialog);
      dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('[data-order-preview-close]')) dialog.classList.add('hidden'); });
      document.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog.classList.contains('hidden')) dialog.classList.add('hidden'); });
    }
    const line = (label, value) => '<div class="payment-order-preview-field"><span>' + safe(label) + '</span><b>' + safe(value || '—') + '</b></div>';
    const statusNames = {PENDIENTE:'Pendiente',EN_PROCESO:'En proceso',REALIZADA:'Realizada',NO_REALIZADA:'No realizada'};
    const payStatus = statusOf(task), invoice = String(task.invoiceNumber || '').replace(/^FE-/i, '');
    const adminContact = task.administrator || task.adminContact || task.contact || task.contactName || '';
    const report = task.report || {}, performed = task.completedWork || task.workDone || report.description || report.details || task.reportText || '';
    const instructions = task.instructions || task.workToDo || task.todo || '', observations = task.observations || task.workObservations || report.observations || '';
    const sources = [task.evidence, report.evidence, task.workEvidence, task.evidences, task.attachments, report.attachments];
    const evidence = sources.flatMap(value => Array.isArray(value) ? value : value && typeof value === 'object' ? [value.items, value.photos, value.videos].filter(Array.isArray).flat() : []).filter(Boolean);
    const amount = task.workValue == null || task.workValue === '' ? '—' : currencyLabel(task.workValue), address = String(task.address || '');
    const mapHref = address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address) : '';
    dialog.innerHTML = '<article class="payment-order-preview-card" role="dialog" aria-modal="true" aria-labelledby="payment-order-preview-title">' +
      '<header class="payment-order-preview-header"><div class="payment-order-preview-brand"><img src="assets/media/media-3.jpg" alt="ServiPortones Eléctricos Martínez"><div><span>ORDEN DE SERVICIO</span><h2 id="payment-order-preview-title">' + safe(task.id) + '</h2></div></div><div class="payment-order-preview-header-actions"><span class="payment-order-preview-status">' + safe(statusNames[task.status] || task.status || 'Pendiente') + '</span><button type="button" data-order-preview-close aria-label="Cerrar">×</button></div></header>' +
      '<div class="payment-order-preview-body"><section class="payment-order-preview-client"><div><small>CLIENTE</small><h3>' + safe(task.client || 'Cliente') + '</h3></div><span class="payment-order-preview-payment ' + (payStatus === 'PAGADA' ? 'is-paid' : 'is-pending') + '">' + (payStatus === 'PAGADA' ? 'Pagada' : 'Pendiente de pago') + '</span></section>' +
      '<div class="payment-order-preview-grid">' + line('Fecha programada', task.date) + line('Fecha de realización', task.completedAt || dateLabel(task)) + line('Prioridad', task.priority) + line('Teléfono', task.phone) + line('Administrador / contacto', adminContact) + line('Técnico asignado', task.assignedTo) + line('Tipo de servicio', task.serviceType) + line('Equipo / motor', task.equipment) + line('Factura', invoice ? 'FE-' + invoice : 'Sin FE registrada') + line('Valor del trabajo', amount) + '</div>' +
      '<section class="payment-order-preview-section"><h3>Dirección del servicio</h3><p>' + safe(address || '—') + '</p>' + (mapHref ? '<a href="' + safe(mapHref) + '" target="_blank" rel="noopener noreferrer">Abrir ubicación en Google Maps ↗</a>' : '') + '</section>' +
      '<section class="payment-order-preview-section"><h3>Por hacer</h3><p>' + safe(instructions || 'Sin indicaciones registradas.') + '</p></section>' +
      '<section class="payment-order-preview-section is-work-done"><h3>Trabajo realizado</h3><p>' + safe(performed || observations || 'Sin informe registrado.') + '</p>' + (observations && performed ? '<div class="payment-order-preview-observations"><b>Observaciones</b><p>' + safe(observations) + '</p></div>' : '') + '</section>' +
      (Array.isArray(task.fieldFindings) && task.fieldFindings.length ? '<section class="payment-order-preview-section"><h3>Novedades encontradas</h3><ul>' + task.fieldFindings.map(item => '<li>' + safe(item.text || item) + '</li>').join('') + '</ul></section>' : '') +
      '<section class="payment-order-preview-evidence"><div><h3>Evidencias</h3><span>' + evidence.length + ' archivo(s)</span></div>' + (evidence.length ? '<ul>' + evidence.map((item,index) => { const name=safe(typeof item === 'string' ? 'Archivo ' + (index+1) : item?.name || item?.fileName || 'Archivo ' + (index+1)); const src=typeof item === 'string' ? item : item?.url || item?.src || item?.downloadURL || item?.dataUrl || item?.fileUrl || ''; const valid=/^(https?:\/\/|data:(image|video)\/)/i.test(String(src)); return '<li>' + (valid ? '<a href="' + safe(src) + '" target="_blank" rel="noopener noreferrer">' + name + ' ↗</a>' : name) + '</li>'; }).join('') + '</ul>' : '<p>No se adjuntaron evidencias.</p>') + '</section></div>' +
      '<footer class="payment-order-preview-footer"><span>ServiPortones Eléctricos Martínez · Control de servicio</span><button type="button" data-order-preview-close>Cerrar</button></footer></article>';
    dialog.classList.remove('hidden'); if (window.lucide) lucide.createIcons();
  };

  PortonProApp.prototype.ensureInvoiceEditor = function () {
    let dialog = document.getElementById('payment-invoice-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.id = 'payment-invoice-dialog';
    dialog.className = 'payment-invoice-dialog hidden';
    dialog.innerHTML = `<section class="payment-invoice-dialog-card" role="dialog" aria-modal="true" aria-labelledby="payment-invoice-title">
      <header><div><span class="payment-invoice-dialog-icon"><i data-lucide="receipt-text"></i></span><div><h3 id="payment-invoice-title">Factura de la orden</h3><p id="payment-invoice-subtitle"></p></div></div><button type="button" data-invoice-close aria-label="Cerrar">×</button></header>
      <label for="payment-invoice-number">Número de factura (opcional)</label><div class="payment-invoice-dialog-field"><span>FE-</span><input id="payment-invoice-number" type="text" maxlength="40" autocomplete="off" placeholder="Puedes dejarlo vacío"></div><label for="payment-invoice-value" class="payment-invoice-value-label">Valor a cobrar</label><div class="payment-invoice-dialog-field"><span>$</span><input id="payment-invoice-value" type="number" min="0" step="1000" inputmode="decimal" placeholder="Valor del trabajo"></div><small class="payment-invoice-dialog-note">Al guardar, la orden queda pendiente hasta que cambies el estado del pago en el consolidado.</small>
      <footer><button type="button" class="payment-invoice-cancel" data-invoice-close>Cancelar</button><button type="button" class="payment-invoice-confirm" data-invoice-save>Guardar factura</button></footer>
    </section>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-invoice-close]')) {
        dialog.classList.add('hidden');
        return;
      }
      if (event.target.closest('[data-invoice-save]')) this.saveOrderInvoiceNumber(dialog.dataset.taskId, dialog.querySelector('#payment-invoice-number')?.value, dialog.querySelector('#payment-invoice-value')?.value);
    });
    ['#payment-invoice-number','#payment-invoice-value'].forEach(selector => dialog.querySelector(selector)?.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); dialog.querySelector('[data-invoice-save]')?.click(); }
    }));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !dialog.classList.contains('hidden')) dialog.classList.add('hidden');
    });
    return dialog;
  };

  PortonProApp.prototype.openOrderInvoiceNumber = function (id) {
    if (this.currentUser?.role !== 'admin') return;
    const task = (this.tasks || []).find(item => String(item.id) === String(id));
    if (!task || task.status !== 'REALIZADA') return this.showToast('La factura FE se habilita al realizar la orden.', 'info');
    const dialog = this.ensureInvoiceEditor();
    dialog.dataset.taskId = String(task.id);
    dialog.querySelector('#payment-invoice-subtitle').textContent = `${task.client || 'Cliente'} · Orden ${task.id}`;
    const field = dialog.querySelector('#payment-invoice-number');
    field.value = String(task.invoiceNumber || '').replace(/^FE-/i, '');
    dialog.querySelector('[data-invoice-save]').textContent = 'Guardar factura y valor';
    dialog.querySelector('#payment-invoice-value').value = task.workValue ?? '';
    dialog.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    setTimeout(() => dialog.querySelector('#payment-invoice-number')?.focus(), 40);
  };
  PortonProApp.prototype.ensurePaymentValueEditor = function () {
    let dialog = document.getElementById('payment-value-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.id = 'payment-value-dialog';
    dialog.className = 'payment-invoice-dialog hidden';
    dialog.innerHTML = `<section class="payment-invoice-dialog-card" role="dialog" aria-modal="true" aria-labelledby="payment-value-title"><header><div><span class="payment-invoice-dialog-icon"><i data-lucide="banknote"></i></span><div><h3 id="payment-value-title">Editar valor de factura</h3><p id="payment-value-subtitle"></p></div></div><button type="button" data-value-close aria-label="Cerrar">×</button></header><label for="payment-value-input">Valor de la factura</label><div class="payment-invoice-dialog-field"><span>$</span><input id="payment-value-input" type="number" min="0" step="1000" inputmode="decimal" placeholder="Valor cobrado"></div><small class="payment-invoice-dialog-note">El cambio se guardará en el consolidado de pagos.</small><footer><button type="button" class="payment-invoice-cancel" data-value-close>Cancelar</button><button type="button" class="payment-invoice-confirm" data-value-save>Guardar valor</button></footer></section>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-value-close]')) { dialog.classList.add('hidden'); return; }
      if (event.target.closest('[data-value-save]')) this.saveOrderPaymentValue(dialog.dataset.taskId, dialog.querySelector('#payment-value-input')?.value);
    });
    dialog.querySelector('#payment-value-input')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); dialog.querySelector('[data-value-save]')?.click(); } });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog.classList.contains('hidden')) dialog.classList.add('hidden'); });
    return dialog;
  };
  PortonProApp.prototype.openOrderPaymentValue = function (id) {
    if (this.currentUser?.role !== 'admin') return;
    const task = (this.tasks || []).find(item => String(item.id) === String(id));
    if (!task || task.status !== 'REALIZADA') return;
    const dialog = this.ensurePaymentValueEditor();
    dialog.dataset.taskId = String(task.id);
    dialog.querySelector('#payment-value-subtitle').textContent = `${task.client || 'Cliente'} · Orden ${task.id}`;
    dialog.querySelector('#payment-value-input').value = task.workValue ?? '';
    dialog.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    setTimeout(() => dialog.querySelector('#payment-value-input')?.focus(), 40);
  };
  PortonProApp.prototype.saveOrderPaymentValue = async function (id, rawValue) {
    if (this.currentUser?.role !== 'admin') { this.showToast('Solo el administrador puede cambiar el valor.', 'error'); return false; }
    if (!window.db || !navigator.onLine) { this.showToast('Conéctate a internet para guardar el valor.', 'error'); return false; }
    const task = (this.tasks || []).find(item => String(item.id) === String(id));
    if (!task || task.status !== 'REALIZADA') return false;
    const text = String(rawValue ?? '').trim();
    const value = text === '' ? null : Number(text);
    if (text !== '' && (!Number.isFinite(value) || value < 0)) { this.showToast('Escribe un valor válido.', 'error'); return false; }
    const previous = task.workValue;
    task.workValue = value;
    const saved = await this.saveTasks(true);
    if (!saved?.ok) {
      if (previous === undefined) delete task.workValue; else task.workValue = previous;
      this.showToast('No se pudo guardar el valor. Inténtalo de nuevo.', 'error');
      return false;
    }
    document.getElementById('payment-value-dialog')?.classList.add('hidden');
    this.updateStats?.();
    this.renderTasks();
    this.showToast('Valor de factura actualizado.', 'success');
    return true;
  };
  PortonProApp.prototype.saveOrderInvoiceNumber = async function (id, rawNumber, rawValue) {
    if (this.currentUser?.role !== 'admin') return this.showToast('Solo el administrador puede registrar facturas.', 'error');
    if (!window.db || !navigator.onLine) return this.showToast('Conéctate a internet para guardar la factura.', 'error');
    const task = (this.tasks || []).find(item => String(item.id) === String(id));
    if (!task || task.status !== 'REALIZADA') return this.showToast('Solo puedes facturar órdenes realizadas.', 'error');
    const number = String(rawNumber ?? '').trim().replace(/^FE-/i, '').trim();
    const valueText = String(rawValue ?? '').trim();
    const workValue = valueText === '' ? null : Number(valueText);
    if (valueText !== '' && (!Number.isFinite(workValue) || workValue < 0)) return this.showToast('Escribe un valor válido para el trabajo.', 'error');
    const previous = { invoiceNumber: task.invoiceNumber, paymentStatus: task.paymentStatus, invoiceIssuedAt: task.invoiceIssuedAt, paymentDate: task.paymentDate, workValue: task.workValue, archivedAt: task.archivedAt, archivedBy: task.archivedBy };
    task.invoiceNumber = number;
    task.paymentStatus = 'PENDIENTE';
    task.workValue = workValue;
    if (number) {
      task.invoiceIssuedAt = task.invoiceIssuedAt || Date.now();
      delete task.paymentDate;
    } else {
      delete task.invoiceIssuedAt;
      delete task.paymentDate;
    }
    task.archivedAt = task.archivedAt || Date.now();
    task.archivedBy = task.archivedBy || this.getCurrentDisplayName?.() || 'Administrador';
    const saved = await this.saveTasks(true);
    if (!saved?.ok) {
      Object.keys(previous).forEach(key => previous[key] === undefined ? delete task[key] : task[key] = previous[key]);
      return;
    }
    const alertRef = window.db.collection('notificaciones').doc(paymentId(task));
    if (completionTime(task) && Date.now() >= completionTime(task) + 30 * DAY) {
      alertRef.set({ category:'Pagos', type:'payment_overdue', title:'Pagos', taskId:String(task.id), client:String(task.client || ''), details:`${task.client || 'Cliente'} · ${task.id} sigue pendiente de pago.`, timestamp:Date.now(), time:this.formatTime(new Date()), read:false, resolved:false }, { merge:true }).catch(error => console.warn('[PAGOS] No se pudo reactivar el aviso', error));
    } else {
      alertRef.set({ resolved:true, resolvedAt:Date.now() }, { merge:true }).catch(error => console.warn('[PAGOS] No se pudo cerrar el aviso', error));
    }
    document.getElementById('payment-invoice-dialog')?.classList.add('hidden');
    this.updateStats?.();
    this.renderTasks();
    this.showToast('Gestión FE guardada · orden archivada como pendiente de pago.', 'success');
  };

  PortonProApp.prototype.saveOrderPaymentStatus = async function (id, nextStatus) {
    if (this.currentUser?.role !== 'admin') { this.showToast('Solo el administrador puede cambiar el estado del pago.', 'error'); return false; }
    if (!window.db || !navigator.onLine) { this.showToast('Conéctate a internet para guardar el estado del pago.', 'error'); return false; }
    const task = (this.tasks || []).find(item => String(item.id) === String(id));
    if (!task || task.status !== 'REALIZADA') { this.showToast('Solo puedes actualizar pagos de órdenes realizadas.', 'error'); return false; }
    const status = nextStatus === 'PAGADA' ? 'PAGADA' : 'PENDIENTE';
    const previous = { paymentStatus:task.paymentStatus, paymentDate:task.paymentDate };
    task.paymentStatus = status;
    if (status === 'PAGADA') task.paymentDate = Date.now();
    else delete task.paymentDate;
    const saved = await this.saveTasks(true);
    if (!saved?.ok) {
      Object.keys(previous).forEach(key => previous[key] === undefined ? delete task[key] : task[key] = previous[key]);
      this.showToast('No se pudo guardar el estado del pago. Inténtalo de nuevo.', 'error');
      return false;
    }
    const alertRef = window.db.collection('notificaciones').doc(paymentId(task));
    if (status === 'PAGADA') {
      alertRef.set({ resolved:true, resolvedAt:Date.now() }, { merge:true }).catch(error => console.warn('[PAGOS] No se pudo cerrar el aviso', error));
    } else if (completionTime(task) && Date.now() >= completionTime(task) + 30 * DAY) {
      alertRef.set({ category:'Pagos', type:'payment_overdue', title:'Pagos', taskId:String(task.id), client:String(task.client || ''), details:`${task.client || 'Cliente'} · ${task.id} sigue pendiente de pago.`, timestamp:Date.now(), time:this.formatTime(new Date()), read:false, resolved:false }, { merge:true }).catch(error => console.warn('[PAGOS] No se pudo reactivar el aviso', error));
    }
    this.updateStats?.();
    this.renderTasks();
    this.showToast(status === 'PAGADA' ? 'Pago marcado como pagado.' : 'Pago marcado como pendiente.', 'success');
    return true;
  };

  PortonProApp.prototype.ensurePaymentNotificationScheduler = function () {
    if (this.paymentNotificationTimer) return;
    const run = () => {
      if (this.currentUser?.role === 'admin' && window.db && navigator.onLine) this.syncPaymentNotifications();
    };
    run();
    this.paymentNotificationTimer = window.setInterval(run, 30 * 60 * 1000);
  };

  PortonProApp.prototype.syncPaymentNotifications = async function () {
    if (this.paymentNotificationSync) return this.paymentNotificationSync;
    const due = (this.tasks || []).filter(task => task?.status === 'REALIZADA' && statusOf(task) === 'PENDIENTE' && completionTime(task) && Date.now() >= completionTime(task) + 30 * DAY);
    this.paymentNotificationSync = Promise.all(due.map(async task => {
      const ref = window.db.collection('notificaciones').doc(paymentId(task));
      try {
        const created = await window.db.runTransaction(async tx => {
          const snap = await tx.get(ref);
          if (snap.exists) return false;
          tx.set(ref, { category:'Pagos', type:'payment_overdue', title:'Pagos', taskId:String(task.id), client:String(task.client || ''), details:`${task.client || 'Cliente'} · ${task.id} lleva 30 días o más pendiente de pago.`, timestamp:Date.now(), time:this.formatTime(new Date()), read:false, resolved:false });
          return true;
        });
        if (created && this.currentUser?.role === 'admin') this.showPopupNotification({ title:'Pagos', subtitle:`${task.client || 'Cliente'} · ${task.id}`, details:'Orden realizada hace 30 días o más pendiente de pago.', type:'payment', icon:'💳', onClick:() => this.openDocumentControl() });
      } catch (error) { console.warn('[PAGOS] No se pudo guardar el aviso de vencimiento', error); }
    })).finally(() => { this.paymentNotificationSync = null; });
    return this.paymentNotificationSync;
  };

  // En los campos de acceso, coloca el cursor al final al tocar para permitir borrar o continuar escribiendo sin un segundo toque.
  const moveLoginCaretToEnd = input => {
    if (!input || !input.matches('#login-username, #login-password')) return;
    requestAnimationFrame(() => {
      if (!input.isConnected || document.activeElement !== input) return;
      const end = input.value.length;
      try { input.setSelectionRange(end, end); } catch (_) {}
    });
  };
  document.addEventListener('focusin', event => moveLoginCaretToEnd(event.target), true);
  document.addEventListener('click', event => moveLoginCaretToEnd(event.target), true);
  const syncLoginThemeMark = () => {
    const mark = document.querySelector('.login-santa-hat');
    if (!mark) return;
    const sources = {
      'theme-christmas': 'assets/media/santa-hat-3d.svg?v=20261028-hat-svg-mirror-11',
      'theme-halloween': 'assets/media/halloween-avatar.svg?v=20261028-halloween-glow-1',
      'theme-easter': 'assets/media/easter-login-mark.svg?v=20261028-theme-mark-1',
      'theme-holy-week': 'assets/media/holy-week-login-mark.svg?v=20261028-theme-mark-1'
    };
    const activeTheme = Object.keys(sources).find(theme => document.body.classList.contains(theme));
    if (activeTheme && !mark.getAttribute('src')?.includes(sources[activeTheme].split('?')[0])) mark.setAttribute('src', sources[activeTheme]);
  };
  syncLoginThemeMark();
  new MutationObserver(syncLoginThemeMark).observe(document.body, { attributes:true, attributeFilter:['class'] });
})();

