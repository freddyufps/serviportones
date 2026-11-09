(function () {
  'use strict';
  if (typeof PortonProApp === 'undefined') return;

  const proto = PortonProApp.prototype;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
  const roleOf = app => normalize(app?.currentUser?.role || app?.currentUser?.rol || app?.currentUser?.userType);
  const isWorker = app => roleOf(app).includes('worker') || roleOf(app).includes('trabajador') || roleOf(app).includes('tecnico') || roleOf(app).includes('technician');
  const isAdmin = app => roleOf(app).includes('admin');
  const isAssignedWorker = (app, task) => {
    const myName = normalize(app?.getCurrentDisplayName?.() || app?.currentUser?.fullName || app?.currentUser?.name || app?.currentUser?.username);
    return isWorker(app) && !!myName && normalize(task?.assignedTo) === myName && !app.isTaskFree?.(task) && !app.isTaskHiddenFromWorkers?.(task);
  };
  const canManage = (app, task) => isAdmin(app) || isAssignedWorker(app, task);
  const normalizedMaterials = list => (Array.isArray(list) ? list : []).map((entry, index) => ({
    id: String(entry?.id || `material-${index + 1}`),
    name: String(entry?.name || entry?.material || '').trim(),
    quantity: Number(entry?.quantity) > 0 ? Number(entry.quantity) : 1,
    unitCost: Math.max(0, Number(entry?.unitCost ?? entry?.price ?? entry?.cost) || 0)
  })).filter(entry => entry.name);
  const lineTotal = item => (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);

  function appendMaterialRow(container, item = {}) {
    const row = document.createElement('div');
    row.className = 'order-material-row';
    row.innerHTML = `<label><span>Material</span><input type="text" data-material-name required maxlength="160" placeholder="Nombre del material" value="${esc(item.name || '')}"></label><label><span>Cantidad</span><input type="number" data-material-quantity min="0.01" step="any" inputmode="decimal" value="${Number(item.quantity) > 0 ? Number(item.quantity) : 1}"></label><label><span>Precio unitario</span><input type="number" data-material-cost min="0" step="1" inputmode="numeric" placeholder="0" value="${item.unitCost == null ? '' : Number(item.unitCost)}"></label><button type="button" data-material-remove aria-label="Eliminar material" title="Eliminar material">×</button>`;
    container.appendChild(row);
    return row;
  }

  function collectMaterials(container) {
    const materials = [];
    for (const [index, row] of [...(container?.querySelectorAll('.order-material-row') || [])].entries()) {
      const name = String(row.querySelector('[data-material-name]')?.value || '').trim();
      const quantityRaw = String(row.querySelector('[data-material-quantity]')?.value || '').trim();
      const costRaw = String(row.querySelector('[data-material-cost]')?.value || '').trim();
      if (!name && !quantityRaw && !costRaw) continue;
      const quantity = quantityRaw === '' ? 1 : Number(quantityRaw);
      const unitCost = costRaw === '' ? NaN : Number(costRaw);
      if (!name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        return { valid: false, materials: [], row };
      }
      materials.push({ id: row.dataset.materialId || `material-${Date.now()}-${index}`, name, quantity, unitCost });
    }
    return { valid: true, materials };
  }

  function updateTotal(listId, totalId) {
    const container = document.getElementById(listId);
    const total = [...(container?.querySelectorAll('.order-material-row') || [])].reduce((sum, row) => {
      const quantity = Number(row.querySelector('[data-material-quantity]')?.value) || 0;
      const cost = Number(row.querySelector('[data-material-cost]')?.value) || 0;
      return sum + quantity * cost;
    }, 0);
    const output = document.getElementById(totalId);
    if (output) output.textContent = money(total);
    return total;
  }

  function fillMaterials(listId, totalId, materials) {
    const container = document.getElementById(listId);
    if (!container) return;
    container.replaceChildren();
    normalizedMaterials(materials).forEach(item => {
      const row = appendMaterialRow(container, item);
      row.dataset.materialId = item.id;
    });
    updateTotal(listId, totalId);
  }

  proto.addTaskMaterialRow = function () {
    const container = document.getElementById('task-materials-list');
    if (!container || !isAdmin(this)) return;
    const row = appendMaterialRow(container);
    row.querySelector('[data-material-name]')?.focus();
  };

  proto.updateTaskMaterialsTotal = function () { return updateTotal('task-materials-list', 'task-materials-total'); };

  const originalNewTask = proto.openNewTaskModal;
  if (typeof originalNewTask === 'function') {
    proto.openNewTaskModal = function (...args) {
      const result = originalNewTask.apply(this, args);
      fillMaterials('task-materials-list', 'task-materials-total', []);
      return result;
    };
  }

  const originalEditTask = proto.openEditTaskModal;
  if (typeof originalEditTask === 'function') {
    proto.openEditTaskModal = function (id, ...args) {
      const result = originalEditTask.call(this, id, ...args);
      const task = (this.tasks || []).find(item => String(item.id) === String(id));
      fillMaterials('task-materials-list', 'task-materials-total', task?.materials);
      return result;
    };
  }

  const originalHandleSave = proto.handleSaveTask;
  if (typeof originalHandleSave === 'function') {
    proto.handleSaveTask = async function (...args) {
      if (!isAdmin(this)) return originalHandleSave.apply(this, args);
      const result = collectMaterials(document.getElementById('task-materials-list'));
      if (!result.valid) {
        this.showToast?.('Completa nombre, cantidad y precio válido en cada material.', 'error');
        result.row?.querySelector('[data-material-name]')?.focus();
        return false;
      }
      const oldId = String(document.getElementById('task-id')?.value || '');
      const orderNumber = Number(document.getElementById('task-order-number')?.value);
      const targetId = Number.isSafeInteger(orderNumber) && orderNumber > 0 ? `ORD-${orderNumber}` : oldId;
      const materials = result.materials;
      const originalSaveTasks = this.saveTasks;
      if (typeof originalSaveTasks === 'function') {
        const saveWithMaterials = function (...saveArgs) {
          const target = (this.tasks || []).find(item => String(item.id) === targetId) || (this.tasks || []).find(item => String(item.id) === oldId);
          if (target) target.materials = materials;
          return originalSaveTasks.apply(this, saveArgs);
        };
        this.saveTasks = saveWithMaterials;
        try { return await originalHandleSave.apply(this, args); }
        finally { if (this.saveTasks === saveWithMaterials) this.saveTasks = originalSaveTasks; }
      }
      return originalHandleSave.apply(this, args);
    };
  }

  proto.addOrderMaterialRow = function () {
    const container = document.getElementById('order-materials-list');
    if (!container) return;
    const row = appendMaterialRow(container);
    row.querySelector('[data-material-name]')?.focus();
  };
  proto.updateOrderMaterialsTotal = function () { return updateTotal('order-materials-list', 'order-materials-total'); };
  proto.saveOrderMaterials = async function (id) {
    const task = (this.tasks || []).find(item => String(item.id) === String(id));
    if (!task || !canManage(this, task)) return this.showToast?.('Solo el administrador o el técnico asignado puede editar estos materiales.', 'error');
    const result = collectMaterials(document.getElementById('order-materials-list'));
    if (!result.valid) {
      this.showToast?.('Completa nombre, cantidad y precio válido en cada material.', 'error');
      result.row?.querySelector('[data-material-name]')?.focus();
      return false;
    }
    const previous = task.materials;
    task.materials = result.materials;
    let saved;
    try { saved = await this.saveTasks(true); }
    catch (error) {
      if (previous === undefined) delete task.materials; else task.materials = previous;
      console.error('[ORDEN] No se pudieron guardar los materiales:', error);
      this.showToast?.('No se pudieron guardar los materiales. Inténtalo de nuevo.', 'error');
      return false;
    }
    if (!saved?.ok) {
      if (previous === undefined) delete task.materials; else task.materials = previous;
      this.showToast?.('No se pudieron guardar los materiales. Inténtalo de nuevo.', 'error');
      return false;
    }
    this.showToast?.('Materiales guardados en la orden.', 'success');
    this.openPaymentOrderPreview(task.id);
    return true;
  };

  const originalPreview = proto.openPaymentOrderPreview;
  if (typeof originalPreview === 'function') {
    proto.openPaymentOrderPreview = function (id, ...args) {
      const task = (this.tasks || []).find(item => String(item.id) === String(id));
      const result = originalPreview.call(this, id, ...args);
      if (!task || !canManage(this, task)) return result;
      const body = document.querySelector('#payment-order-preview .payment-order-preview-body');
      if (!body) return result;
      body.querySelector('.payment-order-materials')?.remove();
      const rows = normalizedMaterials(task.materials);
      const section = document.createElement('section');
      section.className = 'payment-order-preview-section payment-order-materials';
      section.innerHTML = `<header><div><h3>Materiales</h3><p>Materiales registrados para esta orden</p></div><button type="button" data-material-add>＋ Agregar</button></header><div id="order-materials-list" class="order-materials-list">${rows.map(item => `<div class="order-material-row" data-material-id="${esc(item.id)}"><label><span>Material</span><input type="text" data-material-name maxlength="160" placeholder="Nombre del material" value="${esc(item.name)}"></label><label><span>Cantidad</span><input type="number" data-material-quantity min="0.01" step="any" inputmode="decimal" value="${item.quantity}"></label><label><span>Precio unitario</span><input type="number" data-material-cost min="0" step="1" inputmode="numeric" value="${item.unitCost}"></label><button type="button" data-material-remove aria-label="Eliminar material" title="Eliminar material">×</button></div>`).join('')}</div><footer><span>Total materiales</span><strong id="order-materials-total">${money(rows.reduce((sum, item) => sum + lineTotal(item), 0))}</strong></footer><div class="order-materials-actions"><button type="button" data-material-save>Guardar materiales</button></div>`;
      body.appendChild(section);
      const dialog = document.getElementById('payment-order-preview');
      if (dialog) dialog.dataset.materialTaskId = String(task.id);
      if (dialog && dialog.dataset.materialHandlers !== 'true') {
        dialog.dataset.materialHandlers = 'true';
        dialog.addEventListener('input', event => {
          if (event.target.closest('.payment-order-materials')) updateTotal('order-materials-list', 'order-materials-total');
        });
        dialog.addEventListener('click', event => {
          const materialsSection = event.target.closest('.payment-order-materials');
          if (!materialsSection) return;
          if (event.target.closest('[data-material-add]')) this.addOrderMaterialRow();
          else if (event.target.closest('[data-material-remove]')) {
            event.target.closest('.order-material-row')?.remove();
            this.updateOrderMaterialsTotal();
          } else if (event.target.closest('[data-material-save]')) this.saveOrderMaterials(dialog.dataset.materialTaskId);
        });
      }
      const editable = canManage(this, task);
      section.querySelectorAll('input, [data-material-add], [data-material-remove], [data-material-save]').forEach(control => { control.disabled = !editable; });
      section.querySelector('[data-material-save]')?.classList.toggle('hidden', !editable);
      section.querySelector('[data-material-add]')?.classList.toggle('hidden', !editable);
      section.querySelectorAll('[data-material-remove]').forEach(button => button.classList.toggle('hidden', !editable));
      return result;
    };
  }

  const taskForm = document.getElementById('task-form');
  taskForm?.addEventListener('input', event => {
    if (event.target.closest('#task-materials-list')) updateTotal('task-materials-list', 'task-materials-total');
  });
  taskForm?.addEventListener('click', event => {
    if (!event.target.closest('#task-materials-list')) return;
    if (event.target.closest('[data-material-remove]')) {
      event.target.closest('.order-material-row')?.remove();
      updateTotal('task-materials-list', 'task-materials-total');
    }
  });
  taskForm?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.closest('#task-materials-list')) event.preventDefault();
  }, true);
})();
