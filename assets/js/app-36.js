(function () {
  'use strict';
  if (typeof PortonProApp === 'undefined' || !PortonProApp.prototype) return;
  const prototype = PortonProApp.prototype;
  const expandedArchivedOrders = new Set();

  // Guardar el estado incluso cuando Firestore vuelve a dibujar las tarjetas.
  document.addEventListener('toggle', event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.matches('.archived-order-extra')) return;
    const id = details.closest('.order-card')?.dataset.taskId;
    if (!id) return;
    if (details.open) expandedArchivedOrders.add(id);
    else expandedArchivedOrders.delete(id);
  }, true);

  if (typeof prototype.renderTasks === 'function' && !prototype.renderTasksWithArchiveDisclosure) {
    const renderTasks = prototype.renderTasks;
    prototype.renderTasks = function (...args) {
      // Capturar cómo estaban antes de que el render sustituya el contenido.
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
      if (this.showArchivedTasks) {
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
      return result;
    };
    prototype.renderTasksWithArchiveDisclosure = true;
  }

  // En pantallas pequeñas el perfil tenía el control dentro de un contenedor
  // marcado como hidden. Mostrar ese contenido compacto permite abrir el menú.
  const mobileProfileStyle = document.createElement('style');
  mobileProfileStyle.textContent = `
    @media (max-width: 639px) {
      html body #dashboard-header-inner #header-presence-profile #header-profile-copy {
        display: block !important;
        flex: 1 1 auto !important;
        min-width: 0 !important;
        text-align: left !important;
      }
      html body #dashboard-header-inner #header-presence-profile #admin-presence-control {
        display: block !important;
        position: relative !important;
        z-index: 1001 !important;
        min-width: 0 !important;
        overflow: visible !important;
        pointer-events: auto !important;
      }
      html body #dashboard-header-inner #header-presence-profile #admin-presence-toggle {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        min-width: 0 !important;
        min-height: 27px !important;
        max-width: 100% !important;
        padding: 4px 5px !important;
        border: 1px solid rgba(16,185,129,.35) !important;
        border-radius: 7px !important;
        background: rgba(16,185,129,.1) !important;
        color: #6ee7b7 !important;
        font-size: 9px !important;
        line-height: 1.1 !important;
        pointer-events: auto !important;
        touch-action: manipulation !important;
        cursor: pointer !important;
        position: relative !important;
        z-index: 1002 !important;
      }
      html body #dashboard-header-inner #header-presence-profile #admin-presence-toggle span {
        overflow: visible !important;
        text-overflow: clip !important;
      }
      html body #dashboard-header-inner #header-presence-profile #admin-presence-menu {
        position: fixed !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        touch-action: manipulation !important;
      }
      html body #dashboard-header-inner #header-presence-profile #admin-presence-menu button {
        min-height: 42px !important;
        pointer-events: auto !important;
        touch-action: manipulation !important;
      }
    }
  `;
  document.head.appendChild(mobileProfileStyle);
})();