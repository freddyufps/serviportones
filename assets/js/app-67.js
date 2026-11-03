(function installSystemDialogs(){
  const app = window.app;
  if (!app || app.__systemDialogsInstalled) return;
  app.__systemDialogsInstalled = true;

  const queue = [];
  let showing = false;
  const iconSvg = kind => kind === 'trash'
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>';

  function presentNext(){
    if (showing || !queue.length) return;
    showing = true;
    const item = queue.shift();
    const opts = item.options || {};
    const isPrompt = item.kind === 'prompt';
    const isAlert = item.kind === 'alert';
    const overlay = document.createElement('div');
    overlay.className = 'spem-dialog-backdrop';
    overlay.innerHTML = `<section class="spem-dialog ${opts.icon === 'trash' ? 'is-danger' : ''}" role="alertdialog" aria-modal="true" aria-labelledby="spem-dialog-title" aria-describedby="spem-dialog-message">
      <div class="spem-dialog-icon ${opts.icon === 'trash' ? 'is-danger' : ''}">${iconSvg(opts.icon)}</div>
      <div class="spem-dialog-copy"><h2 id="spem-dialog-title"></h2><p id="spem-dialog-message"></p>${isPrompt ? '<input class="spem-dialog-input" type="text">' : ''}</div>
      <div class="spem-dialog-actions">${isAlert ? '' : '<button type="button" class="spem-dialog-cancel"></button>'}<button type="button" class="spem-dialog-confirm"></button></div>
    </section>`;
    const title = overlay.querySelector('#spem-dialog-title');
    const message = overlay.querySelector('#spem-dialog-message');
    const confirmButton = overlay.querySelector('.spem-dialog-confirm');
    const cancelButton = overlay.querySelector('.spem-dialog-cancel');
    const input = overlay.querySelector('.spem-dialog-input');
    title.textContent = opts.title || (isAlert ? 'Aviso' : isPrompt ? 'Ingresar información' : 'Confirmar acción');
    message.textContent = String(item.message ?? '');
    confirmButton.textContent = opts.confirmText || (isAlert ? 'Entendido' : isPrompt ? 'Aceptar' : 'Confirmar');
    if (cancelButton) cancelButton.textContent = opts.cancelText || 'Cancelar';
    if (input) input.value = opts.defaultValue || '';
    document.body.appendChild(overlay);

    let closed = false;
    const previousFocus = document.activeElement;
    const finish = value => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.classList.add('is-closing');
      window.setTimeout(() => {
        overlay.remove();
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({preventScroll:true});
        item.resolve(value);
        showing = false;
        presentNext();
      }, 130);
    };
    const accept = () => finish(isPrompt ? input.value : isAlert ? undefined : true);
    const cancel = () => finish(isPrompt ? null : false);
    const onKeyDown = event => {
      if (event.key === 'Escape' && !isAlert) { event.preventDefault(); cancel(); }
      else if (event.key === 'Escape' && isAlert) { event.preventDefault(); accept(); }
      else if (event.key === 'Enter' && (event.target === input || event.target === confirmButton)) { event.preventDefault(); accept(); }
      else if (event.key === 'Tab') {
        const controls = [...overlay.querySelectorAll('button, input')].filter(control => !control.disabled);
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    confirmButton.addEventListener('click', accept);
    cancelButton?.addEventListener('click', cancel);
    overlay.addEventListener('click', event => { if (event.target === overlay && !isAlert) cancel(); });
    document.addEventListener('keydown', onKeyDown, true);
    (input || confirmButton).focus({preventScroll:true});
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }

  function enqueue(kind, message, options){
    return new Promise(resolve => { queue.push({kind, message, options, resolve}); presentNext(); });
  }
  app.showSystemConfirm = (message, options={}) => enqueue('confirm', message, options);
  app.showSystemAlert = (message, options={}) => enqueue('alert', message, options);
  app.showSystemPrompt = (message, options={}) => enqueue('prompt', message, options);
})();
