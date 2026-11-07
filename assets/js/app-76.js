(() => {
  'use strict';

  const normalizeClient = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es');

  const isActiveOrder = (app, order) => {
    if (!order || order.archivedAt || order.archived === true || order.invoiceInConsolidated === true || order.inConsolidated === true) return false;
    const status = normalizeClient(order.status || order.estado || 'PENDIENTE').replace(/ /g, '_').toUpperCase();
    return ['PENDIENTE', 'PENDIENTE_DE_ATENCION', 'EN_PROCESO', 'NO_REALIZADA', 'LIBRE'].includes(status)
      || normalizeClient(order.assignedTo || order.assignment || '').replace(/ /g, '_').toUpperCase() === 'LIBRE';
  };

  const identityNames = record => [
    record?.client, record?.clientName, record?.customer, record?.customerName,
    record?.name, record?.legalName, record?.businessName, record?.razonSocial,
    record?.condo, record?.condominium, record?.propertyName, record?.buildingName,
    record?.conjunto, record?.edificio
  ].map(normalizeClient).filter(Boolean);

  const identityIds = (record, includeClientRecordId = false) => [record?.clientId, record?.customerId, record?.directoryClientId,
    record?.clientDocumentId, record?.customerDocumentId, record?.idCliente,
    ...(includeClientRecordId ? [record?.id] : [])]
    .map(value => String(value ?? '').trim()).filter(Boolean);

  const identityDocuments = record => [record?.documentNumber, record?.document, record?.nit,
    record?.identification, record?.taxId, record?.cedula]
    .map(normalizeClient).filter(Boolean);

  const identityPhones = record => [record?.phone, record?.telephone, record?.mobile, record?.celular]
    .map(value => String(value ?? '').replace(/\D/g, '')).filter(value => value.length >= 7);

  function findDirectoryClient(app, name) {
    const key = normalizeClient(name);
    if (!key) return null;
    const list = Array.isArray(app.clientDirectory) ? app.clientDirectory : [];
    return list.find(client => identityNames(client).includes(key)) || null;
  }

  function sameClient(app, name, order) {
    const selected = { client: name, ...(findDirectoryClient(app, name) || {}) };
    const selectedIds = identityIds(selected, true);
    const selectedDocuments = identityDocuments(selected);
    const selectedPhones = identityPhones(selected);
    const selectedNames = new Set(identityNames(selected));
    const orderNames = identityNames(order);
    if (selectedIds.length && identityIds(order).some(id => selectedIds.includes(id))) return true;
    if (selectedDocuments.length && identityDocuments(order).some(value => selectedDocuments.includes(value))) return true;
    if (selectedNames.size && orderNames.some(value => selectedNames.has(value))) return true;
    return selectedPhones.length > 0 && identityPhones(order).some(value => selectedPhones.includes(value));
  }

  const orderStateLabel = (app, order) => {
    const status = normalizeClient(order.status || order.estado || 'PENDIENTE').replace(/ /g, '_').toUpperCase();
    if (status === 'EN_PROCESO') return 'En Proceso';
    if (app.isTaskFree?.(order) || status === 'LIBRE') return 'Libre';
    return 'Pendiente';
  };

  function showWarning(app, clientName, matches) {
    const overlay = document.createElement('div');
    overlay.className = 'active-order-warning-backdrop';
    overlay.setAttribute('role', 'presentation');

    const dialog = document.createElement('section');
    dialog.className = 'active-order-warning';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'active-order-warning-title');
    dialog.setAttribute('aria-describedby', 'active-order-warning-message');

    const heading = document.createElement('div');
    heading.className = 'active-order-warning-heading';
    heading.innerHTML = '<span class="active-order-warning-icon" aria-hidden="true">⚠</span><div><h2 id="active-order-warning-title">Cliente con órdenes activas</h2><p>Revisa las órdenes existentes antes de continuar.</p></div>';

    const message = document.createElement('p');
    message.className = 'active-order-warning-message';
    message.id = 'active-order-warning-message';
    message.append('El cliente ');
    const client = document.createElement('strong');
    client.textContent = clientName;
    message.append(client, ` ya tiene ${matches.length} orden${matches.length === 1 ? '' : 'es'} activa${matches.length === 1 ? '' : 's'}.`);

    const selectionLabel = document.createElement('label');
    selectionLabel.className = 'active-order-warning-select-label';
    selectionLabel.textContent = 'Orden que deseas modificar';
    const select = document.createElement('select');
    select.className = 'active-order-warning-select';
    select.setAttribute('aria-label', 'Seleccionar orden activa para modificar');

    const list = document.createElement('div');
    list.className = 'active-order-warning-list';
    list.hidden = true;

    for (const order of matches) {
      const id = String(order.id || '');
      const state = orderStateLabel(app, order);
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${id} · ${state}`;
      select.append(option);

      const row = document.createElement('article');
      row.className = 'active-order-warning-row';
      const details = document.createElement('div');
      const orderId = document.createElement('strong');
      orderId.textContent = id;
      const badge = document.createElement('span');
      badge.className = 'active-order-warning-state';
      badge.textContent = state;
      details.append(orderId, badge);
      const meta = document.createElement('small');
      meta.textContent = [order.date, order.assignedTo && !app.isTaskFree?.(order) ? `Técnico: ${order.assignedTo}` : ''].filter(Boolean).join(' · ');
      row.append(details, meta);

      const actions = document.createElement('div');
      actions.className = 'active-order-warning-row-actions';
      const view = document.createElement('button');
      view.type = 'button';
      view.textContent = 'Ver';
      view.dataset.viewOrder = id;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Modificar';
      edit.dataset.editOrder = id;
      actions.append(view, edit);
      row.append(actions);
      list.append(row);
    }

    const actions = document.createElement('div');
    actions.className = 'active-order-warning-actions';
    const viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.className = 'active-order-warning-secondary';
    viewButton.textContent = 'Ver órdenes existentes';
    viewButton.dataset.action = 'view';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'active-order-warning-secondary';
    editButton.textContent = 'Modificar orden existente';
    editButton.dataset.action = 'edit';
    const createButton = document.createElement('button');
    createButton.type = 'button';
    createButton.className = 'active-order-warning-primary';
    createButton.textContent = 'Crear nueva orden';
    createButton.dataset.action = 'create';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'active-order-warning-cancel';
    cancelButton.textContent = 'Cancelar';
    cancelButton.dataset.action = 'cancel';
    actions.append(viewButton, editButton, createButton, cancelButton);

    selectionLabel.append(select);
    dialog.append(heading, message, selectionLabel, list, actions);
    overlay.append(dialog);
    document.body.append(overlay);

    return new Promise(resolve => {
      let closed = false;
      const finish = result => {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKeydown, true);
        overlay.classList.add('is-closing');
        window.setTimeout(() => { overlay.remove(); resolve(result); }, 140);
      };
      const onKeydown = event => {
        if (event.key === 'Escape') { event.preventDefault(); finish({ action: 'cancel' }); }
        else if (event.key === 'Enter' && event.target === select) { event.preventDefault(); finish({ action: 'edit', id: select.value }); }
      };
      overlay.addEventListener('click', event => {
        const actionButton = event.target.closest('[data-action]');
        if (actionButton) {
          const action = actionButton.dataset.action;
          if (action === 'view') list.hidden = !list.hidden;
          else if (action === 'edit') finish({ action, id: select.value });
          else if (action === 'create') finish({ action });
          else finish({ action: 'cancel' });
          return;
        }
        const viewOrder = event.target.closest('[data-view-order]');
        if (viewOrder) { finish({ action: 'view-order', id: viewOrder.dataset.viewOrder }); return; }
        const editOrder = event.target.closest('[data-edit-order]');
        if (editOrder) finish({ action: 'edit', id: editOrder.dataset.editOrder });
        else if (event.target === overlay) finish({ action: 'cancel' });
      });
      document.addEventListener('keydown', onKeydown, true);
      requestAnimationFrame(() => viewButton.focus({ preventScroll: true }));
    });
  }

  function install() {
    const app = window.app;
    if (!app || app.__activeOrderDuplicateWarningInstalled || typeof app.handleSaveTask !== 'function') return false;
    app.__activeOrderDuplicateWarningInstalled = true;
    const saveTask = app.handleSaveTask;

    app.handleSaveTask = async function (event) {
      if (this.currentUser?.role !== 'admin') return saveTask.call(this, event);

      const currentId = String(document.getElementById('task-id')?.value || '');
      const clientName = String(document.getElementById('task-client')?.value || '').trim();
      const clientKey = normalizeClient(clientName);
      if (!clientKey) return saveTask.call(this, event);

      const matches = (Array.isArray(this.tasks) ? this.tasks : []).filter(order =>
        String(order.id || '') !== currentId &&
        sameClient(this, clientName, order) &&
        isActiveOrder(this, order)
      );
      if (!matches.length) return saveTask.call(this, event);

      const choice = await showWarning(this, clientName, matches);
      if (!choice || choice.action === 'cancel') return;
      if (choice.action === 'view-order') {
        this.viewOrderDetails?.(choice.id);
        return;
      }
      if (choice.action === 'edit') {
        this.openEditTaskModal?.(choice.id);
        return;
      }
      if (choice.action === 'create') return saveTask.call(this, event);
    };
    return true;
  }

  function startWhenReady() {
    if (install()) return;
    const timer = window.setInterval(() => {
      if (install()) window.clearInterval(timer);
    }, 50);
    window.setTimeout(() => window.clearInterval(timer), 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startWhenReady, { once: true });
  else startWhenReady();
})();
