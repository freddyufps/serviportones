(function () {
  'use strict';
  if (typeof PortonProApp === 'undefined') return;

  const proto = PortonProApp.prototype;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
  const roleOf = app => normalize(app?.currentUser?.role || app?.currentUser?.rol || app?.currentUser?.userType);
  const isWorker = app => roleOf(app).includes('worker') || roleOf(app).includes('trabajador') || roleOf(app).includes('tecnico') || roleOf(app).includes('technician');
  const isAdmin = app => roleOf(app).includes('admin');
  const isAssignedWorker = (app, task) => {
    const myName = normalize(app?.getCurrentDisplayName?.() || app?.currentUser?.fullName || app?.currentUser?.name || app?.currentUser?.username);
    return isWorker(app) && !!myName && normalize(task?.assignedTo) === myName && !app.isTaskFree?.(task) && !app.isTaskHiddenFromWorkers?.(task);
  };
  const canEditMaterials = (app, task) => isAdmin(app) || isAssignedWorker(app, task);
  const resetFreeTaskState = (app, task) => {
    if (!app.isTaskFree?.(task)) return task;
    const staleFields = ['assignedWorkerId', 'assignedAt', 'claimedFromFree', 'claimedByWorkerId', 'claimedByWorkerName', 'workStarted', 'workStartedAt', 'workStartedBy', 'workStartedByName', 'startedAt', 'startedBy', 'startedByName'];
    const needsReset = task.status !== 'PENDIENTE' || staleFields.some(field => Object.prototype.hasOwnProperty.call(task, field) && Boolean(task[field]));
    if (!needsReset) return task;
    const reset = { ...task, assignedTo: 'LIBRE', assignedWorkerId: '', status: 'PENDIENTE' };
    staleFields.forEach(field => { delete reset[field]; });
    return reset;
  };

  proto.normalizeReleasedFreeTaskStates = function () {
    if (!Array.isArray(this.tasks)) return false;
    let changed = false;
    this.tasks = this.tasks.map(task => {
      const reset = resetFreeTaskState(this, task);
      if (reset !== task) changed = true;
      return reset;
    });
    if (!changed) return false;

    if (window.SafeStorage?.setItem) SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));
    else { try { localStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks)); } catch (_) {} }

    const dbInstance = window.db;
    if (!dbInstance?.collection || typeof dbInstance.runTransaction !== 'function' || this.__normalizingReleasedFreeTasks) return true;
    this.__normalizingReleasedFreeTasks = true;
    const orderRef = dbInstance.collection('ordenes').doc('todas');
    dbInstance.runTransaction(async transaction => {
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists) return;
      const data = snapshot.data() || {};
      const latestTasks = Array.isArray(data.tasks) ? data.tasks : [];
      let latestChanged = false;
      const normalizedTasks = latestTasks.map(task => {
        const reset = resetFreeTaskState(this, task);
        if (reset !== task) latestChanged = true;
        return reset;
      });
      if (latestChanged) transaction.update(orderRef, { tasks: normalizedTasks });
    }).catch(error => {
      console.warn('[ORDEN] No se pudo sincronizar la normalización de órdenes libres:', error?.code || error?.message || error);
    }).finally(() => { this.__normalizingReleasedFreeTasks = false; });
    return true;
  };
  const normalizedMaterials = list => (Array.isArray(list) ? list : []).map((entry, index) => ({
    id: String(entry?.id || `material-${index + 1}`),
    name: String(entry?.name || entry?.material || '').trim(),
    quantity: Number(entry?.quantity) > 0 ? Number(entry.quantity) : 1,
    unitCost: Math.max(0, Number(entry?.unitCost ?? entry?.price ?? entry?.cost) || 0)
  })).filter(entry => entry.name);
  const lineTotal = item => (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);

  proto.toggleWorkerOrderCard = function (button) {
    const card = button?.closest('.worker-order-card-compact');
    const taskId = String(card?.dataset.taskId || '');
    if (!card || !taskId) return;
    if (!(this._expandedWorkerOrderIds instanceof Set)) this._expandedWorkerOrderIds = new Set();
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    if (expanded) this._expandedWorkerOrderIds.add(taskId);
    else this._expandedWorkerOrderIds.delete(taskId);
    card.classList.toggle('is-expanded', expanded);
    button.setAttribute('aria-expanded', String(expanded));
    button.innerHTML = expanded ? '<i data-lucide="chevron-up" aria-hidden="true"></i><span>Ocultar detalles</span>' : '<i data-lucide="chevron-down" aria-hidden="true"></i><span>Ver detalles</span>';
    if (window.lucide) lucide.createIcons();
  };

  function restoreExpandedWorkerCards(instance) {
    if (!isWorker(instance) || !(instance._expandedWorkerOrderIds instanceof Set)) return;
    document.querySelectorAll('#tasks-container .worker-order-card-compact[data-task-id]').forEach(card => {
      const expanded = instance._expandedWorkerOrderIds.has(String(card.dataset.taskId));
      card.classList.toggle('is-expanded', expanded);
      const button = card.querySelector('.worker-order-expand');
      if (!button) return;
      button.setAttribute('aria-expanded', String(expanded));
      button.innerHTML = expanded
        ? '<i data-lucide="chevron-up" aria-hidden="true"></i><span>Ocultar detalles</span>'
        : '<i data-lucide="chevron-down" aria-hidden="true"></i><span>Ver detalles</span>';
    });
    if (window.lucide) lucide.createIcons();
  }

  function wrapRenderTasks(target) {
    if (!target || typeof target.renderTasks !== 'function' || target.renderTasks.__workerExpansionState80) return;
    const render = target.renderTasks;
    const wrapped = function (...args) {
      this.normalizeReleasedFreeTaskStates?.();
      const result = render.apply(this, args);
      restoreExpandedWorkerCards(this);
      return result;
    };
    wrapped.__workerExpansionState80 = true;
    target.renderTasks = wrapped;
  }

  // The navigation module wraps renderTasks on the app instance, so preserve
  // expansion there as well as on the prototype used by other app instances.
  wrapRenderTasks(proto);
  if (window.app) wrapRenderTasks(window.app);

  proto.releaseFreeOrder = async function (id) {
    if (!isWorker(this)) return this.showToast?.('Solo un trabajador puede liberar una orden tomada voluntariamente.', 'error');
    const user = this.currentUser || {};
    const workerName = String(this.getCurrentDisplayName?.() || user.fullName || user.name || user.username || '').trim();
    const workerId = String(user.id || this.users?.find(item => normalize(item?.fullName || item?.username) === normalize(workerName))?.id || '');
    const dbInstance = window.db;
    if (!workerName || !dbInstance?.collection || typeof dbInstance.runTransaction !== 'function') {
      return this.showToast?.('No se pudo conectar para liberar la orden. Inténtalo nuevamente.', 'error');
    }
    this.__releasingFreeOrderIds = this.__releasingFreeOrderIds || new Set();
    const key = String(id);
    if (this.__releasingFreeOrderIds.has(key)) return;
    this.__releasingFreeOrderIds.add(key);
    const orderRef = dbInstance.collection('ordenes').doc('todas');
    const canRelease = task => {
      if (task?.claimedFromFree !== true || task.archivedAt || task.archived === true || task.status === 'REALIZADA') return false;
      if (task.claimedByWorkerId) return !!workerId && String(task.claimedByWorkerId) === workerId;
      return !!workerName && normalize(task.claimedByWorkerName) === normalize(workerName);
    };
    const releaseFrom = tasks => {
      const task = tasks.find(item => String(item?.id) === key);
      if (!task) return { state: 'missing' };
      if (task.archivedAt || task.archived === true || task.status === 'REALIZADA') return { state: 'not-owner' };
      const alreadyFree = this.isTaskFree?.(task);
      const hasStaleState = task.status !== 'PENDIENTE'
        || Boolean(task.assignedWorkerId || task.assignedAt || task.claimedFromFree || task.claimedByWorkerId || task.claimedByWorkerName)
        || ['workStarted', 'workStartedAt', 'workStartedBy', 'workStartedByName', 'startedAt', 'startedBy', 'startedByName']
          .some(field => Object.prototype.hasOwnProperty.call(task, field));
      if (alreadyFree && !hasStaleState) return { state: 'already-free', tasks };
      if (!alreadyFree && (!canRelease(task) || normalize(task.assignedTo) !== normalize(task.claimedByWorkerName || workerName))) return { state: 'not-owner' };
      const updatedTasks = tasks.map(item => {
        if (String(item?.id) !== key) return item;
        const updated = { ...item, assignedTo: 'LIBRE', assignedWorkerId: '', status: 'PENDIENTE' };
        delete updated.claimedFromFree;
        delete updated.claimedByWorkerId;
        delete updated.claimedByWorkerName;
        delete updated.assignedAt;
        delete updated.workStartedAt;
        delete updated.workStartedBy;
        delete updated.workStartedByName;
        delete updated.workStarted;
        delete updated.startedAt;
        delete updated.startedBy;
        delete updated.startedByName;
        return updated;
      });
      return { state: 'released', tasks: updatedTasks };
    };
    try {
      this.showToast?.('Verificando la orden…', 'info');
      const result = await dbInstance.runTransaction(async transaction => {
        const snapshot = await transaction.get(orderRef);
        if (!snapshot.exists) return { state: 'missing' };
        const data = snapshot.data() || {};
        const currentTasks = Array.isArray(data.tasks) ? data.tasks : [];
        const release = releaseFrom(currentTasks);
        if (release.state === 'released') transaction.update(orderRef, { tasks: release.tasks });
        return release;
      });
      if (result?.state === 'released') {
        this.tasks = result.tasks;
        if (window.SafeStorage?.setItem) SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));
        else { try { localStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks)); } catch (_) {} }
        this.updateStats?.();
        this.renderTasks?.();
        this.showToast?.('Orden liberada y disponible para los demás trabajadores.', 'success');
      } else if (result?.state === 'not-owner') this.showToast?.('Solo puedes liberar una orden libre que hayas tomado voluntariamente.', 'error');
      else if (result?.state === 'already-free') this.showToast?.('La orden ya está disponible para los trabajadores.', 'info');
      else this.showToast?.('No se encontró la orden. Actualiza la lista e intenta otra vez.', 'error');
    } catch (error) {
      console.error('[ORDEN] Falló la liberación de una orden:', {
        taskId: key,
        workerId,
        firebaseCode: String(error?.code || 'unknown'),
        message: String(error?.message || error || '')
      }, error);
      this.showToast?.(error?.code === 'permission-denied'
        ? 'No tienes permiso para liberar esta orden. Contacta al administrador.'
        : error?.code === 'unauthenticated'
          ? 'Tu sesión no está validada. Cierra sesión y vuelve a ingresar.'
          : 'No se pudo liberar la orden. Revisa la conexión e inténtalo nuevamente.', 'error');
    } finally {
      this.__releasingFreeOrderIds.delete(key);
    }
  };

  function appendMaterialRow(container, item = {}) {
    const row = document.createElement('div');
    row.className = 'order-material-row';
    row.dataset.materialId = String(item.id || `material-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    row.innerHTML = `<input type="text" data-material-name required maxlength="160" aria-label="Material" placeholder="Nombre del material" value="${esc(item.name || '')}"><input type="number" data-material-quantity min="0.01" step="any" inputmode="decimal" aria-label="Cantidad" placeholder="1" value="${Number(item.quantity) > 0 ? Number(item.quantity) : 1}"><input type="number" data-material-cost min="0" step="1" inputmode="numeric" aria-label="Precio unitario" placeholder="0" value="${item.unitCost == null ? '' : Number(item.unitCost)}"><button type="button" data-material-remove aria-label="Eliminar material" title="Eliminar material">×</button>`;
    container.appendChild(row);
    return row;
  }

  function collectMaterials(container) {
    const materials = [];
    for (const row of [...(container?.querySelectorAll('.order-material-row') || [])]) {
      const name = String(row.querySelector('[data-material-name]')?.value || '').trim();
      const quantityRaw = String(row.querySelector('[data-material-quantity]')?.value || '').trim();
      const costRaw = String(row.querySelector('[data-material-cost]')?.value || '').trim();
      if (!name && !quantityRaw && !costRaw) continue;
      const quantity = quantityRaw === '' ? 1 : Number(quantityRaw);
      const unitCost = costRaw === '' ? NaN : Number(costRaw);
      if (!name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) return { valid: false, materials: [], row };
      materials.push({ id: row.dataset.materialId, name, quantity, unitCost });
    }
    return { valid: true, materials };
  }

  function updateTotal() {
    const container = document.getElementById('report-materials-list');
    const total = [...(container?.querySelectorAll('.order-material-row') || [])].reduce((sum, row) => {
      return sum + (Number(row.querySelector('[data-material-quantity]')?.value) || 0) * (Number(row.querySelector('[data-material-cost]')?.value) || 0);
    }, 0);
    const output = document.getElementById('report-materials-total');
    if (output) output.textContent = money(total);
  }

  function ensureReportMaterialsSection() {
    const reportModal = document.getElementById('modal-report');
    const observations = document.getElementById('rep-observations');
    if (!reportModal || !observations) return null;
    let section = document.getElementById('report-materials-section');
    if (!section) {
      section = document.createElement('section');
      section.id = 'report-materials-section';
      section.className = 'order-materials-editor';
      section.innerHTML = `<header><div><h3>Materiales utilizados</h3><p>Registra los materiales empleados en esta orden.</p></div><button type="button" data-material-add>＋ Agregar material</button></header><div class="order-material-columns" aria-hidden="true"><span>Material</span><span>Cantidad</span><span>Precio unitario</span><span></span></div><div id="report-materials-list" class="order-materials-list"></div><footer><span>Total materiales</span><strong id="report-materials-total">$ 0</strong></footer>`;
      observations.closest('div')?.after(section);
    }
    return section;
  }

  const originalOpenReport = proto.openReportModal;
  if (typeof originalOpenReport === 'function') {
    proto.openReportModal = function (id, ...args) {
      const result = originalOpenReport.call(this, id, ...args);
      const task = (this.tasks || []).find(item => String(item.id) === String(id));
      const section = ensureReportMaterialsSection();
      const list = document.getElementById('report-materials-list');
      if (!task || !section || !list) return result;
      section.classList.toggle('hidden', !canEditMaterials(this, task));
      list.replaceChildren();
      normalizedMaterials(task.materials).forEach(item => appendMaterialRow(list, item));
      updateTotal();
      return result;
    };
  }

  const originalSubmitReport = proto.submitReport;
  if (typeof originalSubmitReport === 'function') {
    proto.submitReport = async function (...args) {
      const task = this.selectedTask;
      const section = document.getElementById('report-materials-section');
      if (!task || !section || section.classList.contains('hidden') || !canEditMaterials(this, task)) return originalSubmitReport.apply(this, args);
      const result = collectMaterials(document.getElementById('report-materials-list'));
      if (!result.valid) {
        this.showToast?.('Completa nombre, cantidad y precio válido en cada material.', 'error');
        result.row?.querySelector('[data-material-name]')?.focus();
        return false;
      }
      const taskId = String(task.id);
      const nextMaterials = result.materials;
      const originalSaveTasks = this.saveTasks;
      if (typeof originalSaveTasks !== 'function') return originalSubmitReport.apply(this, args);
      const saveWithMaterials = async function (...saveArgs) {
        const target = (this.tasks || []).find(item => String(item.id) === taskId);
        if (!target) return originalSaveTasks.apply(this, saveArgs);
        const previous = target.materials;
        target.materials = nextMaterials;
        try {
          const saved = await originalSaveTasks.apply(this, saveArgs);
          if (!saved?.ok) {
            if (previous === undefined) delete target.materials; else target.materials = previous;
          }
          return saved;
        } catch (error) {
          if (previous === undefined) delete target.materials; else target.materials = previous;
          throw error;
        }
      };
      this.saveTasks = saveWithMaterials;
      try { return await originalSubmitReport.apply(this, args); }
      finally { if (this.saveTasks === saveWithMaterials) this.saveTasks = originalSaveTasks; }
    };
  }

  const originalOrderPreview = proto.openPaymentOrderPreview;
  if (typeof originalOrderPreview === 'function') {
    proto.openPaymentOrderPreview = function (id, ...args) {
      const result = originalOrderPreview.call(this, id, ...args);
      const task = (this.tasks || []).find(item => String(item.id) === String(id));
      const body = document.querySelector('#payment-order-preview .payment-order-preview-body');
      if (!body || !task) return result;
      body.querySelector('.payment-order-materials')?.remove();
      const rows = normalizedMaterials(task.materials);
      if (!rows.length) return result;
      const section = document.createElement('section');
      section.className = 'payment-order-preview-section payment-order-materials';
      section.innerHTML = `<div class="flex items-center justify-between gap-3 mb-3"><h3>Materiales utilizados</h3><strong class="text-sm font-extrabold text-emerald-700">Total: ${money(rows.reduce((sum, item) => sum + lineTotal(item), 0))}</strong></div><div class="space-y-2">${rows.map(item => `<div class="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"><span class="min-w-0"><b>${esc(item.name)}</b><span class="text-slate-500"> · ${item.quantity} × ${money(item.unitCost)}</span></span><strong class="shrink-0 text-slate-700">${money(lineTotal(item))}</strong></div>`).join('')}</div>`;
      const evidenceSection = body.querySelector('.payment-order-preview-evidence');
      if (evidenceSection) evidenceSection.before(section); else body.appendChild(section);
      return result;
    };
  }

  const reportModal = document.getElementById('modal-report');
  reportModal?.addEventListener('input', event => {
    if (event.target.closest('#report-materials-list')) updateTotal();
  });
  reportModal?.addEventListener('click', event => {
    const list = document.getElementById('report-materials-list');
    if (!list) return;
    if (event.target.closest('[data-material-add]')) {
      const row = appendMaterialRow(list);
      row.querySelector('[data-material-name]')?.focus();
    } else if (event.target.closest('[data-material-remove]')) {
      event.target.closest('.order-material-row')?.remove();
      updateTotal();
    }
  });
  reportModal?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.closest('#report-materials-list')) event.preventDefault();
  }, true);
})();
