(function () {
  'use strict';
  if (typeof PortonProApp === 'undefined') return;
  const proto = PortonProApp.prototype;
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
  const kind = app => {
    const role = norm(app?.currentUser?.role || app?.currentUser?.rol || app?.currentUser?.userType);
    if (role.includes('admin')) return 'admin';
    if (role.includes('worker') || role.includes('trabajador') || role.includes('tecnico') || role.includes('technician')) return 'worker';
    return '';
  };
  const originalPreview = proto.openPaymentOrderPreview;
  if (typeof originalPreview === 'function') {
    proto.openPaymentOrderPreview = function (id, ...args) {
      const task = (this.tasks || []).find(item => String(item?.id) === String(id));
      if (!task) return this.showToast?.('No se encontró la orden seleccionada.', 'error');
      const role = kind(this);
      if (role !== 'admin' && role !== 'worker') return this.showToast?.('No tienes permiso para ver esta orden.', 'error');
      const isFree = !!this.isTaskFree?.(task);
      const myName = norm(this.getCurrentDisplayName?.() || this.currentUser?.fullName || this.currentUser?.username);
      if (role === 'worker' && !isFree && norm(task.assignedTo) !== myName) return this.showToast?.('No tienes permiso para ver esta orden.', 'error');

      const previousUser = this.currentUser;
      if (role === 'worker') this.currentUser = { ...previousUser, role: 'admin' };
      try {
        const result = originalPreview.call(this, task.id, ...args);
        const dialog = document.getElementById('payment-order-preview');
        dialog?.querySelectorAll('.payment-order-preview-field').forEach(field => {
          const label = norm(field.querySelector('span')?.textContent);
          if (label.includes('prioridad') || label.includes('equipo') || label.includes('motor')) field.remove();
        });
        if (role === 'worker') {
          dialog?.querySelector('.payment-order-preview-payment')?.remove();
          dialog?.querySelectorAll('.payment-order-preview-field').forEach(field => {
            const label = field.querySelector('span')?.textContent?.trim().toLocaleLowerCase();
            if (label === 'factura' || label === 'valor del trabajo') field.remove();
          });
          const status = dialog?.querySelector('.payment-order-preview-status');
          if (status) status.textContent = ({ PENDIENTE:'Pendiente', EN_PROCESO:'En proceso', REALIZADA:'Realizada', NO_REALIZADA:'No realizada' })[task.status] || task.status || 'Pendiente';
        }
        return result;
      } finally {
        this.currentUser = previousUser;
      }
    };
  }

  // Los ojos de las tarjetas y del consolidado comparten una única ficha de orden.
  proto.viewOrderDetails = function (id) {
    return this.openPaymentOrderPreview(id);
  };
})();
