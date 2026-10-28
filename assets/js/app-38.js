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
  const roleOf = app => roleKind(app?.currentUser?.role || app?.currentUser?.rol || app?.currentUser?.userType);
  const displayName = app => app?.getCurrentDisplayName?.() || app?.currentUser?.fullName || app?.currentUser?.name || app?.currentUser?.username || '';
  const ownsTask = (app, task) => roleOf(app) === 'worker' && !!task && !app.isTaskFree?.(task) && normalize(task.assignedTo) === normalize(displayName(app));
  const deny = (app, message = 'Primero debes tomar esta orden para registrar el informe.') => app.showToast?.(message, 'info');
  const selectedTaskIsAllowed = app => roleOf(app) !== 'worker' || ownsTask(app, app.selectedTask);

  const originalRender = proto.renderTasks;
  if (typeof originalRender === 'function') {
    proto.renderTasks = function (...args) {
      const result = originalRender.apply(this, args);
      if (roleOf(this) !== 'admin') {
        document.querySelectorAll('#tasks-container button[onclick*="app.openEditTaskModal("], #tasks-container button[onclick*="app.deleteTask("]').forEach(button => button.remove());
      }
      if (roleOf(this) === 'worker') {
        document.querySelectorAll('#tasks-container [data-task-id]').forEach(card => {
          const task = (this.tasks || []).find(item => String(item.id) === card.getAttribute('data-task-id'));
          if (task && !ownsTask(this, task)) card.querySelector('button[onclick*="app.openReportModal("]')?.remove();
        });
      }
      return result;
    };
  }

  const originalOpenReport = proto.openReportModal;
  if (typeof originalOpenReport === 'function') {
    proto.openReportModal = function (id, ...args) {
      const task = (this.tasks || []).find(item => String(item.id) === String(id));
      if (!task) return;
      if (roleOf(this) === 'worker' && !ownsTask(this, task)) return deny(this);
      return originalOpenReport.call(this, id, ...args);
    };
  }

  const originalViewOrder = proto.viewOrderDetails;
  if (typeof originalViewOrder === 'function') {
    proto.viewOrderDetails = function (id, ...args) {
      const result = originalViewOrder.call(this, id, ...args);
      if (roleOf(this) === 'worker') {
        const editReportButton = document.getElementById('btn-view-order-worker-edit');
        editReportButton?.classList.toggle('hidden', !ownsTask(this, this.selectedTask));
      }
      return result;
    };
  }

  for (const method of ['submitReport', 'setReportStatus', 'handleUploadEvidence', 'addFieldFinding', 'deleteFieldFinding']) {
    const original = proto[method];
    if (typeof original !== 'function') continue;
    proto[method] = function (...args) {
      if (!selectedTaskIsAllowed(this)) return deny(this);
      return original.apply(this, args);
    };
  }

  const originalEditCompletedReport = proto.editCompletedOrderReport;
  if (typeof originalEditCompletedReport === 'function') {
    proto.editCompletedOrderReport = function (...args) {
      if (roleOf(this) === 'worker' && !ownsTask(this, this.selectedTask)) return deny(this);
      return originalEditCompletedReport.apply(this, args);
    };
  }

  for (const method of ['openEditTaskModal', 'deleteTask']) {
    const original = proto[method];
    if (typeof original !== 'function') continue;
    proto[method] = function (...args) {
      if (roleOf(this) !== 'admin') return deny(this, 'Editar y eliminar órdenes solo está permitido para el administrador.');
      return original.apply(this, args);
    };
  }
})();


