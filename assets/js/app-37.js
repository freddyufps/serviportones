(function () {
  'use strict';
  if (typeof PortonProApp === 'undefined') return;
  const proto = PortonProApp.prototype;
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
  const roleKind = value => {
    const role = normalize(value);
    if (role === 'admin' || role.includes('admin') || role.includes('administrador')) return 'admin';
    if (role === 'worker' || role.includes('trabajador') || role.includes('tecnico') || role.includes('technician')) return 'worker';
    return '';
  };
  const originalView = proto.viewOrderDetails;
  if (typeof originalView === 'function') {
    proto.viewOrderDetails = function (id) {
      const task = (Array.isArray(this.tasks) ? this.tasks : []).find(item => String(item?.id) === String(id));
      if (!task) { this.showToast?.('No se encontró la orden. Actualiza la lista e intenta otra vez.', 'error'); return; }
      const user = this.currentUser;
      const kind = roleKind(user?.role || user?.rol || user?.userType);
      const displayName = this.getCurrentDisplayName?.() || user?.fullName || user?.name || user?.username || '';
      const isAdmin = kind === 'admin';
      const isAssignedToMe = normalize(task.assignedTo) === normalize(displayName);
      if (!isAdmin && (kind !== 'worker' || (!this.isTaskFree?.(task) && !isAssignedToMe))) {
        this.showToast?.('No tienes permiso para ver esta orden.', 'error'); return;
      }
      const oldUser = this.currentUser;
      const oldInvoiceRenderer = this.renderOrderInvoice;
      if (user && isAdmin) this.currentUser = { ...user, role: 'admin' };
      else if (user && kind === 'worker') this.currentUser = { ...user, role: 'worker' };
      if (typeof oldInvoiceRenderer === 'function') {
        this.renderOrderInvoice = function (...args) {
          try { return oldInvoiceRenderer.apply(this, args); }
          catch (error) { console.warn('[ORDEN] No se pudo cargar el panel de factura:', error); }
        };
      }
      try {
        const result = originalView.call(this, task.id);
        document.getElementById('modal-view-order')?.classList.remove('hidden');
        document.getElementById('btn-view-order-worker-edit')?.classList.toggle('hidden', isAdmin || !isAssignedToMe || this.isTaskFree?.(task));
        return result;
      } catch (error) {
        console.error('[ORDEN] No se pudo abrir el detalle:', error);
        this.selectedTask = task;
        document.getElementById('modal-view-order')?.classList.remove('hidden');
        this.showToast?.('Se abrió el detalle, pero algunos datos no pudieron cargarse.', 'error');
      } finally {
        this.currentUser = oldUser;
        if (typeof oldInvoiceRenderer === 'function') this.renderOrderInvoice = oldInvoiceRenderer;
      }
    };
  }
  proto.takeFreeOrder = async function (id) {
    const user = this.currentUser;
    const kind = roleKind(user?.role || user?.rol || user?.userType);
    if (kind !== 'worker') { this.showToast?.('Solo un trabajador puede tomar una orden libre.', 'error'); return; }
    const dbInstance = window.db;
    const displayName = this.getCurrentDisplayName?.() || user?.fullName || user?.name || user?.username || '';
    if (!displayName || !dbInstance || typeof dbInstance.runTransaction !== 'function') {
      this.showToast?.('No se pudo conectar para tomar la orden. Revisa tu sesión e intenta de nuevo.', 'error'); return;
    }
    const orderRef = dbInstance.collection('ordenes').doc('todas');
    this.showToast?.('Verificando disponibilidad de la orden…', 'info');
    try {
      const result = await dbInstance.runTransaction(async transaction => {
        const snapshot = await transaction.get(orderRef);
        if (!snapshot.exists) return { state: 'missing' };
        const documentData = snapshot.data() || {};
        const storedTasks = Array.isArray(documentData.tasks) ? documentData.tasks : [];
        const task = storedTasks.find(item => String(item?.id) === String(id));
        if (!task) return { state: 'missing' };
        if (task.archivedAt || task.archived === true) return { state: 'archived' };
        const free = !String(task.assignedTo || '').trim() || normalize(task.assignedTo) === 'libre';
        if (!free) return { state: normalize(task.assignedTo) === normalize(displayName) ? 'already-mine' : 'already-assigned' };
        const updatedTasks = storedTasks.map(item => String(item?.id) === String(id)
          ? { ...item, assignedTo: displayName, assignedAt: new Date().toISOString() }
          : item);
        transaction.set(orderRef, { ...documentData, tasks: updatedTasks }, { merge: true });
        return { state: 'claimed', tasks: updatedTasks };
      });
      if (Array.isArray(result?.tasks)) {
        this.tasks = result.tasks;
        try { localStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks)); } catch (_) {}
        this.updateStats?.();
        this.renderTasks?.();
      }
      if (result?.state === 'claimed') this.showToast?.('Orden asignada a ' + displayName, 'success');
      else if (result?.state === 'already-mine') this.showToast?.('Esta orden ya está asignada a tu usuario.', 'info');
      else if (result?.state === 'already-assigned') this.showToast?.('Esta orden ya fue asignada a otro técnico.', 'error');
      else if (result?.state === 'archived') this.showToast?.('Esta orden ya fue archivada por el administrador.', 'info');
      else this.showToast?.('No se encontró la orden. Actualiza la lista e intenta otra vez.', 'error');
    } catch (error) {
      console.error('[ORDEN] No se pudo tomar la orden:', error);
      const message = error?.code === 'permission-denied'
        ? 'Firestore no permite asignar esta orden con los permisos actuales. Revisa las reglas de escritura de órdenes.'
        : 'No se pudo tomar la orden: ' + (error?.message || 'error de conexión');
      this.showToast?.(message, 'error');
    }
  };
  // Renderiza tarjetas con rol canónico para que toda orden libre ofrezca "Tomar orden".
  const originalRenderTasks = proto.renderTasks;
  if (typeof originalRenderTasks === 'function') {
    proto.renderTasks = function (...args) {
      const previousUser = this.currentUser;
      const kind = roleKind(previousUser?.role || previousUser?.rol || previousUser?.userType);
      if (previousUser && kind === 'worker' && previousUser.role !== 'worker') {
        this.currentUser = { ...previousUser, role: 'worker' };
      }
      try { return originalRenderTasks.apply(this, args); }
      finally { this.currentUser = previousUser; }
    };
  }

  const workerOwnsTask = function (task) {
    const user = this.currentUser;
    if (roleKind(user?.role || user?.rol || user?.userType) !== 'worker') return true;
    const name = this.getCurrentDisplayName?.() || user?.fullName || user?.name || user?.username || '';
    return !!name && !this.isTaskFree?.(task) && normalize(task?.assignedTo) === normalize(name);
  };
  const denyFreeEdit = function () {
    this.showToast?.('Primero debes tomar esta orden. Una orden libre no se puede editar ni cerrar.', 'info');
  };

  const originalOpenReport = proto.openReportModal;
  if (typeof originalOpenReport === 'function') {
    proto.openReportModal = function (id) {
      const task = (Array.isArray(this.tasks) ? this.tasks : []).find(item => String(item?.id) === String(id));
      if (!task) return;
      if (!workerOwnsTask.call(this, task)) return denyFreeEdit.call(this);
      return originalOpenReport.call(this, task.id);
    };
  }

  const originalEditReport = proto.editCompletedOrderReport;
  if (typeof originalEditReport === 'function') {
    proto.editCompletedOrderReport = function (...args) {
      const task = this.selectedTask;
      if (!task || !workerOwnsTask.call(this, task)) return denyFreeEdit.call(this);
      const previousUser = this.currentUser;
      if (previousUser && roleKind(previousUser.role || previousUser.rol || previousUser.userType) === 'worker') {
        this.currentUser = { ...previousUser, role: 'worker' };
      }
      try { return originalEditReport.apply(this, args); }
      finally { this.currentUser = previousUser; }
    };
  }

  const originalSetReportStatus = proto.setReportStatus;
  if (typeof originalSetReportStatus === 'function') {
    proto.setReportStatus = function (status) {
      if (this.selectedTask && !workerOwnsTask.call(this, this.selectedTask)) return denyFreeEdit.call(this);
      return originalSetReportStatus.call(this, status);
    };
  }

  const originalSubmitReport = proto.submitReport;
  if (typeof originalSubmitReport === 'function') {
    proto.submitReport = async function (...args) {
      if (!this.selectedTask || !workerOwnsTask.call(this, this.selectedTask)) return denyFreeEdit.call(this);
      return originalSubmitReport.apply(this, args);
    };
  }

  const originalUploadEvidence = proto.handleUploadEvidence;
  if (typeof originalUploadEvidence === 'function') {
    proto.handleUploadEvidence = function (event, ...args) {
      if (!this.selectedTask || !workerOwnsTask.call(this, this.selectedTask)) {
        if (event?.target) event.target.value = '';
        return denyFreeEdit.call(this);
      }
      return originalUploadEvidence.call(this, event, ...args);
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('rep-btn-waze')?.setAttribute('aria-label', 'Abrir ruta en Waze');
    document.getElementById('rep-btn-maps')?.setAttribute('aria-label', 'Abrir ruta en Google Maps');
  });
})();