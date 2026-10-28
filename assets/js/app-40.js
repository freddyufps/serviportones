(function () {
  'use strict';
  if (typeof PortonProApp === 'undefined') return;
  const proto = PortonProApp.prototype;
  const originalToggle = proto.toggleTaskDatePicker;
  proto.toggleTaskDatePicker = function () {
    const input = document.getElementById('task-date');
    const button = document.querySelector('.task-date-toggle');
    if (!input) return;
    const setOpen = value => {
      this.taskDatePickerOpen = !!value;
      button?.setAttribute('aria-pressed', String(!!value));
      button?.setAttribute('aria-expanded', String(!!value));
    };
    if (this.taskDatePickerOpen) {
      input.blur();
      setOpen(false);
      return;
    }
    if (!this.taskDateDismissInstalled) {
      document.addEventListener('pointerdown', event => {
        if (event.target.closest?.('.task-date-control')) return;
        setOpen(false);
        input.blur();
      });
      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        input.blur();
        setOpen(false);
      });
      input.addEventListener('change', () => setOpen(false));
      this.taskDateDismissInstalled = true;
    }
    try {
      input.focus({ preventScroll: true });
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
      setOpen(true);
    } catch (_) {
      input.blur();
      setOpen(false);
      try { input.showPicker?.(); setOpen(true); } catch (_) { input.click(); setOpen(true); }
    }
  };
  if (typeof originalToggle !== 'function') console.warn('Se instaló el control unificado de fecha.');
})();
