(function installPaymentInternalNotes() {
  'use strict';
  if (typeof PortonProApp === 'undefined' || PortonProApp.prototype.__paymentInternalNotes73) return;
  const proto = PortonProApp.prototype;
  proto.__paymentInternalNotes73 = true;

  const COLLECTION = 'notas_internas_consolidado';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const docId = id => encodeURIComponent(String(id || ''));
  const noteFor = (app, id) => app.paymentInternalNotesByTask?.[String(id)] || null;
  const activeNote = note => note && note.status !== 'deleted' && String(note.body || '').trim() ? note : null;
  const noteStatus = note => !activeNote(note) ? 'none' : note.status === 'completed' ? 'completed' : 'pending';
  const currentUserLabel = app => String(app.currentUser?.fullName || app.currentUser?.username || app.currentUser?.name || 'Administrador');
  const dateTimeLabel = value => {
    const date = new Date(Number(value) || value || 0);
    return Number.isFinite(date.getTime()) && date.getTime() > 0
      ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(date)
      : '—';
  };

  proto.stopPaymentInternalNotes = function () {
    try { this.paymentInternalNotesUnsubscribe?.(); } catch (_) {}
    this.paymentInternalNotesUnsubscribe = null;
    this.paymentInternalNotesByTask = {};
    this.paymentInternalNotesLoaded = false;
  };

  proto.subscribePaymentInternalNotes = function () {
    if (this.currentUser?.role !== 'admin' || !window.db?.collection || this.paymentInternalNotesUnsubscribe) return;
    this.paymentInternalNotesByTask = this.paymentInternalNotesByTask || {};
    this.paymentInternalNotesUnsubscribe = window.db.collection(COLLECTION).onSnapshot(snapshot => {
      if (this.currentUser?.role !== 'admin') { this.stopPaymentInternalNotes(); return; }
      const notes = {};
      snapshot.forEach(document => {
        const data = document.data() || {};
        if (data.taskId) notes[String(data.taskId)] = { id: document.id, ...data };
      });
      this.paymentInternalNotesByTask = notes;
      this.paymentInternalNotesLoaded = true;
      if (this.showDocumentControl) this.renderDocumentControlRecords();
    }, error => {
      console.warn('[CONSOLIDADO] No se pudieron sincronizar las notas internas.', error);
      this.showToast?.('No se pudieron cargar los seguimientos internos.', 'error');
    });
  };

  proto.ensurePaymentInternalNoteDialog = function () {
    let dialog = document.getElementById('payment-internal-note-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.id = 'payment-internal-note-dialog';
    dialog.className = 'payment-internal-note-dialog hidden';
    dialog.innerHTML = `<section class="payment-internal-note-card" role="dialog" aria-modal="true" aria-labelledby="payment-internal-note-title">
      <header><div><span class="payment-internal-note-icon"><i data-lucide="notebook-pen"></i></span><div><h3 id="payment-internal-note-title">Seguimiento interno</h3><p data-note-task-label></p></div></div><button type="button" data-note-close aria-label="Cerrar">×</button></header>
      <label for="payment-internal-note-heading">Título <small>(opcional)</small></label>
      <input id="payment-internal-note-heading" type="text" maxlength="120" autocomplete="off" placeholder="Ej. Llamar al cliente el viernes">
      <label for="payment-internal-note-body">Nota o seguimiento</label>
      <textarea id="payment-internal-note-body" rows="5" maxlength="6000" placeholder="Escribe el recordatorio para el equipo administrativo…"></textarea>
      <label for="payment-internal-note-status">Estado del seguimiento</label>
      <select id="payment-internal-note-status"><option value="pending">📌 Pendiente</option><option value="completed">📌 Completado</option></select>
      <section class="payment-internal-note-history" aria-label="Historial de seguimiento"><b>Historial</b><div data-note-history></div></section>
      <footer><button type="button" class="payment-internal-note-delete" data-note-delete>Eliminar nota</button><span></span><button type="button" class="payment-internal-note-cancel" data-note-close>Cancelar</button><button type="button" class="payment-internal-note-save" data-note-save>Guardar</button></footer>
    </section>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', async event => {
      if (event.target === dialog || event.target.closest('[data-note-close]')) { dialog.classList.add('hidden'); return; }
      const save = event.target.closest('[data-note-save]');
      if (save) {
        if (save.disabled) return;
        save.disabled = true;
        try {
          await this.savePaymentInternalNote(
            dialog.dataset.taskId,
            dialog.querySelector('#payment-internal-note-heading')?.value || '',
            dialog.querySelector('#payment-internal-note-body')?.value || '',
            dialog.querySelector('#payment-internal-note-status')?.value || 'pending'
          );
        } finally { save.disabled = false; }
        return;
      }
      const remove = event.target.closest('[data-note-delete]');
      if (remove && !remove.disabled) {
        remove.disabled = true;
        try { await this.deletePaymentInternalNote(dialog.dataset.taskId); }
        finally { remove.disabled = false; }
      }
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !dialog.classList.contains('hidden')) dialog.classList.add('hidden');
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); dialog.querySelector('[data-note-save]')?.click(); }
    });
    return dialog;
  };

  proto.openPaymentInternalNote = async function (id) {
    if (this.currentUser?.role !== 'admin') return this.showToast?.('Las notas internas están disponibles solo para el administrador.', 'error');
    const task = (this.tasks || []).find(item => String(item.id) === String(id));
    if (!task) return this.showToast?.('No se encontró la orden del seguimiento.', 'error');
    this.subscribePaymentInternalNotes();
    const key = String(id);
    let note = noteFor(this, key);
    if (!this.paymentInternalNotesLoaded && window.db?.collection) {
      try {
        const snapshot = await window.db.collection(COLLECTION).doc(docId(key)).get();
        if (snapshot.exists) {
          note = { id: snapshot.id, ...snapshot.data() };
          this.paymentInternalNotesByTask[key] = note;
        }
      } catch (error) { console.warn('[CONSOLIDADO] No se pudo abrir la nota interna.', error); }
    }
    note = activeNote(note);
    const dialog = this.ensurePaymentInternalNoteDialog();
    dialog.dataset.taskId = key;
    dialog.querySelector('[data-note-task-label]').textContent = `${task.id} · ${task.client || 'Cliente'}`;
    dialog.querySelector('#payment-internal-note-heading').value = note?.title || '';
    dialog.querySelector('#payment-internal-note-body').value = note?.body || '';
    dialog.querySelector('#payment-internal-note-status').value = note?.status === 'completed' ? 'completed' : 'pending';
    const remove = dialog.querySelector('[data-note-delete]');
    remove.hidden = !note;
    const history = (noteFor(this, key)?.history || []).slice(-12).reverse();
    dialog.querySelector('[data-note-history]').innerHTML = history.length
      ? history.map(item => `<article><div><b>${safe(item.action || 'Actualización')}</b><time>${safe(dateTimeLabel(item.at))}</time></div><p>${safe(item.title ? `${item.title}: ` : '')}${safe(item.body || '')}</p><small>${safe(item.by || 'Administrador')} · ${item.status === 'completed' ? 'Completado' : 'Pendiente'}</small></article>`).join('')
      : '<p class="payment-internal-note-history-empty">Aún no hay cambios registrados.</p>';
    dialog.classList.remove('hidden');
    if (window.lucide) lucide.createIcons({ root: dialog });
    dialog.querySelector('#payment-internal-note-body')?.focus({ preventScroll: true });
  };

  proto.savePaymentInternalNote = async function (id, title, body, status) {
    if (this.currentUser?.role !== 'admin') return this.showToast?.('Solo el administrador puede guardar seguimientos.', 'error');
    if (!window.db?.collection || !navigator.onLine) return this.showToast?.('Conéctate a internet para guardar el seguimiento.', 'error');
    const taskId = String(id || ''), text = String(body || '').trim(), heading = String(title || '').trim();
    if (!taskId || !text) return this.showToast?.('Escribe una nota antes de guardarla.', 'error');
    const ref = window.db.collection(COLLECTION).doc(docId(taskId));
    const now = Date.now(), user = currentUserLabel(this), nextStatus = status === 'completed' ? 'completed' : 'pending';
    try {
      await window.db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const previous = snapshot.exists ? snapshot.data() || {} : {};
        const action = activeNote(previous) ? 'Actualizada' : previous.status === 'deleted' ? 'Reactivada' : 'Creada';
        const entry = { action, title: heading, body: text, status: nextStatus, at: now, by: user };
        const history = [...(Array.isArray(previous.history) ? previous.history : []), entry].slice(-50);
        transaction.set(ref, {
          taskId,
          title: heading,
          body: text,
          status: nextStatus,
          createdAt: Number(previous.createdAt) || now,
          createdBy: String(previous.createdBy || user),
          updatedAt: now,
          updatedBy: user,
          deletedAt: null,
          history
        }, { merge: true });
      });
      this.ensurePaymentInternalNoteDialog()?.classList.add('hidden');
      this.showToast?.('Seguimiento guardado.', 'success');
    } catch (error) {
      console.error('[CONSOLIDADO] No se pudo guardar la nota interna.', error);
      this.showToast?.('No se pudo guardar el seguimiento. Inténtalo nuevamente.', 'error');
    }
  };

  proto.deletePaymentInternalNote = async function (id) {
    if (this.currentUser?.role !== 'admin') return this.showToast?.('Solo el administrador puede eliminar seguimientos.', 'error');
    const key = String(id || ''), existing = noteFor(this, key);
    if (!existing || !activeNote(existing)) return this.showToast?.('No hay una nota activa para eliminar.', 'info');
    const confirmed = await this.showSystemConfirm?.(`¿Eliminar el seguimiento de ${key}? El registro se retirará y su historial se conservará.`, { title: 'Eliminar nota interna', confirmText: 'Eliminar', cancelText: 'Cancelar', icon: 'trash' });
    if (!confirmed) return;
    if (!window.db?.collection || !navigator.onLine) return this.showToast?.('Conéctate a internet para eliminar el seguimiento.', 'error');
    const ref = window.db.collection(COLLECTION).doc(docId(key)), now = Date.now(), user = currentUserLabel(this);
    try {
      await window.db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return;
        const previous = snapshot.data() || {};
        if (!activeNote(previous)) return;
        const history = [...(Array.isArray(previous.history) ? previous.history : []), {
          action: 'Eliminada', title: previous.title || '', body: previous.body || '', status: previous.status || 'pending', at: now, by: user
        }].slice(-50);
        transaction.set(ref, { title: '', body: '', status: 'deleted', deletedAt: now, updatedAt: now, updatedBy: user, history }, { merge: true });
      });
      this.ensurePaymentInternalNoteDialog()?.classList.add('hidden');
      this.showToast?.('Nota eliminada; el historial se conservó.', 'success');
    } catch (error) {
      console.error('[CONSOLIDADO] No se pudo eliminar la nota interna.', error);
      this.showToast?.('No se pudo eliminar el seguimiento. Inténtalo nuevamente.', 'error');
    }
  };

  const noteIndicator = (id, note) => {
    const active = activeNote(note), status = noteStatus(note);
    const message = active ? `${active.title ? `${active.title}: ` : ''}${active.body}` : 'Sin nota interna. Clic para agregar un seguimiento.';
    return `<button type="button" class="payment-internal-note-indicator is-${status}" data-payment-note-open="${safe(id)}" title="${safe(message)}" aria-label="${safe(active ? `Ver seguimiento de ${id}: ${message}` : `Agregar seguimiento a ${id}`)}"><i data-lucide="pin"></i></button>`;
  };
  const noteAction = (id, note) => {
    const status = noteStatus(note);
    return `<button type="button" class="payment-internal-note-action is-${status}" data-payment-note-edit="${safe(id)}" title="${safe(activeNote(note) ? 'Editar seguimiento interno' : 'Agregar nota interna')}" aria-label="${safe(`Nota interna para ${id}`)}"><i data-lucide="notebook-pen"></i><span>Nota</span></button>`;
  };

  const originalRender = proto.renderDocumentControlRecords;
  if (typeof originalRender === 'function' && !originalRender.__paymentNotes73) {
    const wrappedRender = function (...args) {
      const result = originalRender.apply(this, args);
      if (this.currentUser?.role !== 'admin') return result;
      const area = document.getElementById('payment-table-area');
      if (!area) return result;
      area.querySelectorAll('.payment-table tbody tr').forEach(row => {
        const view = row.querySelector('[data-payment-view]');
        const id = view?.dataset.paymentView || row.querySelector('[data-payment-unarchive]')?.dataset.paymentUnarchive;
        if (!id) return;
        const note = noteFor(this, id);
        const orderLabel = row.cells?.[1]?.querySelector('small');
        if (orderLabel && !orderLabel.querySelector('[data-payment-note-open]')) orderLabel.insertAdjacentHTML('beforeend', noteIndicator(id, note));
        const actions = row.querySelector('.payment-order-actions');
        if (actions && !actions.querySelector('[data-payment-note-edit]')) actions.insertAdjacentHTML('beforeend', noteAction(id, note));
      });
      area.querySelectorAll('.payment-mobile-card').forEach(card => {
        const view = card.querySelector('[data-payment-view]');
        const id = view?.dataset.paymentView || card.querySelector('[data-payment-unarchive]')?.dataset.paymentUnarchive;
        if (!id) return;
        const note = noteFor(this, id);
        const top = card.querySelector('.payment-mobile-top');
        if (top && !top.querySelector('[data-payment-note-open]')) top.insertAdjacentHTML('beforeend', noteIndicator(id, note));
        const actions = card.querySelector('.payment-order-actions-mobile');
        if (actions && !actions.querySelector('[data-payment-note-edit]')) actions.insertAdjacentHTML('beforeend', noteAction(id, note));
      });
      if (window.lucide) lucide.createIcons({ root: area });
      return result;
    };
    wrappedRender.__paymentNotes73 = true;
    proto.renderDocumentControlRecords = wrappedRender;
  }

  const originalOpen = proto.openDocumentControl;
  if (typeof originalOpen === 'function' && !originalOpen.__paymentNotes73) {
    const wrappedOpen = function (...args) {
      if (this.currentUser?.role === 'admin') this.subscribePaymentInternalNotes();
      return originalOpen.apply(this, args);
    };
    wrappedOpen.__paymentNotes73 = true;
    proto.openDocumentControl = wrappedOpen;
  }

  const originalLogout = proto.logout;
  if (typeof originalLogout === 'function' && !originalLogout.__paymentNotes73) {
    const wrappedLogout = function (...args) {
      this.stopPaymentInternalNotes();
      document.getElementById('payment-internal-note-dialog')?.classList.add('hidden');
      return originalLogout.apply(this, args);
    };
    wrappedLogout.__paymentNotes73 = true;
    proto.logout = wrappedLogout;
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-payment-note-edit], [data-payment-note-open]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.app?.openPaymentInternalNote(trigger.dataset.paymentNoteEdit || trigger.dataset.paymentNoteOpen);
  }, true);
})();
