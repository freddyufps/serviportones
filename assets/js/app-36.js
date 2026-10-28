(function () {
  'use strict';
  if (typeof PortonProApp === 'undefined' || !PortonProApp.prototype) return;
  const prototype = PortonProApp.prototype;
  if (typeof prototype.renderTasks !== 'function' || prototype.renderTasksWithArchiveDisclosure) return;
  const renderTasks = prototype.renderTasks;
  prototype.renderTasks = function (...args) {
    const result = renderTasks.apply(this, args);
    if (this.showArchivedTasks) {
      document.querySelectorAll('.order-card').forEach(card => {
        const disclosure = card.querySelector('.archived-order-extra');
        const address = card.querySelector('.order-client-panel');
        const instructions = card.querySelector('.order-instructions');
        const content = disclosure?.querySelector('.archived-order-extra-content');
        if (!disclosure || !address || !instructions || !content || disclosure.dataset.addressDisclosureApplied) return;
        const summary = disclosure.querySelector('summary span');
        if (summary) summary.textContent = 'Ver dirección, rutas e informe';
        address.parentElement.insertBefore(disclosure, address);
        content.prepend(instructions);
        content.prepend(address);
        disclosure.dataset.addressDisclosureApplied = 'true';
      });
      if (window.lucide) lucide.createIcons();
    }
    return result;
  };
  prototype.renderTasksWithArchiveDisclosure = true;
})();