/* Local-only recovery drafts for long task and quote forms. */
(function () {
  'use strict';

  const DB_NAME = 'serviportones-local-drafts-v1';
  const STORE_NAME = 'drafts';
  const FALLBACK_PREFIX = 'serviportones:form-draft:v1:';
  let dbPromise;
  let saveTimer;
  let interactionVersion = 0;
  let restoring = false;
  const wrappers = new WeakSet();
  let app;

  function openDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (!dbPromise) dbPromise = new Promise(resolve => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return dbPromise;
  }

  function draftKey(kind, id) {
    const username = String(app.currentUser?.username || app.currentUser?.id || 'anonymous').trim().toLowerCase();
    return `${username}:${kind}:${id || 'new'}`;
  }

  function currentForm() {
    const task = document.getElementById('modal-task-form');
    if (task && !task.classList.contains('hidden')) {
      const id = document.getElementById('task-id')?.value || '';
      return { kind: 'task', id, form: document.getElementById('task-form') };
    }
    const quote = document.getElementById('quotes-shell');
    if (quote && !quote.classList.contains('hidden')) {
      return { kind: 'quote', id: app.quoteCurrentId || '', form: document.getElementById('quote-form') };
    }
    return null;
  }

  function controlKey(control, index) {
    return control.id ? `id:${control.id}` : `name:${control.name}:${index}`;
  }

  function snapshotActiveForm() {
    const active = currentForm();
    if (!active?.form) return null;
    const fields = {};
    Array.from(active.form.elements || []).forEach((control, index) => {
      if (!control || control.disabled || control.type === 'file' || /^item(Image|Description|Quantity|Unit)$/.test(control.name || '')) return;
      if (control.type === 'radio' || control.type === 'checkbox') fields[controlKey(control, index)] = { checked: control.checked };
      else fields[controlKey(control, index)] = { value: control.value };
    });
    const draft = {
      kind: active.kind,
      id: active.id,
      savedAt: Date.now(),
      fields,
      meta: {}
    };
    if (active.kind === 'quote') {
      draft.meta.items = Array.from(active.form.querySelectorAll('#quote-items-body tr')).map(row => ({
        description: row.querySelector('[name="itemDescription"]')?.value || '',
        quantity: row.querySelector('[name="itemQuantity"]')?.value || '1',
        unit: row.querySelector('[name="itemUnit"]')?.value || '0',
        imageData: row.dataset.imageData || ''
      }));
    } else {
      draft.meta.taskClientMode = app.taskClientMode || 'new';
      draft.meta.checklist = Array.isArray(app.activeChecklistDraft) ? app.activeChecklistDraft : [];
      draft.meta.checklistDirty = !!app.checklistDraftDirty;
    }
    return draft;
  }

  function writeFallback(key, draft) {
    try {
      const safeDraft = JSON.parse(JSON.stringify(draft, (name, value) => name === 'imageData' ? '' : value));
      localStorage.setItem(FALLBACK_PREFIX + key, JSON.stringify(safeDraft));
    } catch (_) { /* Quota or privacy mode: IndexedDB remains the primary store. */ }
  }

  async function putDraft(key, draft) {
    writeFallback(key, draft);
    const database = await openDb();
    if (!database) return;
    await new Promise(resolve => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(draft, key);
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    });
  }

  async function getDraft(key) {
    const database = await openDb();
    if (database) {
      const value = await new Promise(resolve => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
      if (value) return value;
    }
    try { return JSON.parse(localStorage.getItem(FALLBACK_PREFIX + key) || 'null'); } catch (_) { return null; }
  }

  async function removeDraft(key) {
    try { localStorage.removeItem(FALLBACK_PREFIX + key); } catch (_) {}
    const database = await openDb();
    if (!database) return;
    await new Promise(resolve => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    });
  }

  async function saveCurrentDraft() {
    const active = currentForm();
    const draft = snapshotActiveForm();
    if (!active || !draft) return;
    await putDraft(draftKey(active.kind, active.id), draft);
  }

  function restoreFields(form, fields) {
    if (!form || !fields) return;
    const seen = new Map();
    Array.from(form.elements || []).forEach((control, index) => {
      if (!control || control.disabled || control.type === 'file' || /^item(Image|Description|Quantity|Unit)$/.test(control.name || '')) return;
      const key = controlKey(control, index);
      const entry = fields[key];
      if (!entry) return;
      if (control.type === 'radio' || control.type === 'checkbox') control.checked = !!entry.checked;
      else control.value = entry.value ?? '';
      seen.set(key, true);
    });
  }

  async function restoreForm(kind, id, versionAtOpen) {
    if (interactionVersion !== versionAtOpen) return;
    const key = draftKey(kind, id);
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(FALLBACK_PREFIX + key) || 'null'); } catch (_) {}
    if (draft) applyDraft(kind, id, draft);
    const fullDraft = await getDraft(key);
    if (fullDraft && fullDraft.savedAt >= (draft?.savedAt || 0) && interactionVersion === versionAtOpen) applyDraft(kind, id, fullDraft);
  }

  function applyDraft(kind, id, draft) {
    const active = currentForm();
    if (!active || active.kind !== kind || String(active.id || '') !== String(id || '') || !active.form || draft.kind !== kind || String(draft.id || '') !== String(id || '')) return;
    restoring = true;
    try {
      if (kind === 'task') {
        if (draft.meta?.taskClientMode) app.setTaskClientMode?.(draft.meta.taskClientMode);
        restoreFields(active.form, draft.fields);
        app.activeChecklistDraft = Array.isArray(draft.meta?.checklist) ? draft.meta.checklist : [];
        app.checklistDraftDirty = !!draft.meta?.checklistDirty;
        app.renderChecklistAdminEditor?.();
      } else {
        restoreFields(active.form, draft.fields);
        const tbody = active.form.querySelector('#quote-items-body');
        if (tbody && Array.isArray(draft.meta?.items) && draft.meta.items.length) {
          tbody.innerHTML = '';
          draft.meta.items.forEach(item => {
            app.addQuoteItem?.();
            const row = tbody.lastElementChild;
            if (!row) return;
            row.querySelector('[name="itemDescription"]').value = item.description || '';
            row.querySelector('[name="itemQuantity"]').value = item.quantity || '1';
            row.querySelector('[name="itemUnit"]').value = item.unit || '0';
            if (item.imageData) {
              row.dataset.imageData = item.imageData;
              const image = row.querySelector('.quote-item-image-preview');
              const empty = row.querySelector('.quote-item-image-empty');
              const clear = row.querySelector('.quote-item-image-clear');
              if (image) { image.src = item.imageData; image.hidden = false; }
              if (empty) empty.hidden = true;
              if (clear) clear.hidden = false;
            }
          });
        }
        app.updateQuoteTotals?.();
        app.toggleQuoteWarrantyOptions?.();
      }
      app.showToast?.('Se restauró el borrador local del formulario.', 'info');
    } finally {
      restoring = false;
    }
  }

  function wrap(methodName, before, after) {
    const original = app[methodName];
    if (typeof original !== 'function' || wrappers.has(original)) return;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      if (before) before.call(this, args);
      if (result && typeof result.then === 'function') {
        return result.then(value => after ? after.call(this, args, value) : value);
      }
      return after ? after.call(this, args, result) : result;
    };
    wrappers.add(original);
    app[methodName] = wrapped;
  }

  function scheduleSave() {
    if (restoring) return;
    interactionVersion++;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveCurrentDraft().catch(() => {}); }, 500);
  }

  function install() {
  app = window.app;
  if (!app || typeof app.openQuoteForm !== 'function' || typeof app.saveQuote !== 'function' || typeof app.closeQuotes !== 'function') return false;

  document.addEventListener('input', event => {
    if (event.target.closest?.('#task-form, #quote-form')) scheduleSave();
  });
  document.addEventListener('change', event => {
    if (event.target.closest?.('#task-form, #quote-form')) scheduleSave();
  });
  setInterval(() => { if (currentForm()) saveCurrentDraft().catch(() => {}); }, 3000);
  window.addEventListener('pagehide', () => { saveCurrentDraft().catch(() => {}); });
  window.addEventListener('beforeunload', () => {
    const draft = snapshotActiveForm();
    const active = currentForm();
    if (active && draft) writeFallback(draftKey(active.kind, active.id), draft);
    saveCurrentDraft().catch(() => {});
  });

  wrap('openNewTaskModal', function () {
    const version = interactionVersion;
    requestAnimationFrame(() => restoreForm('task', '', version).catch(() => {}));
  });
  wrap('openEditTaskModal', function (args) {
    const version = interactionVersion;
    requestAnimationFrame(() => restoreForm('task', args[0], version).catch(() => {}));
  });
  wrap('openQuoteForm', null, async function (args) {
    await restoreForm('quote', args[0] || '', interactionVersion);
  });

  const originalCloseTask = app.closeTaskModal;
  if (typeof originalCloseTask === 'function') app.closeTaskModal = function (...args) {
    if (!this.__discardingTaskDraft && !this.__savingTaskDraft) saveCurrentDraft().catch(() => {});
    return originalCloseTask.apply(this, args);
  };
  const originalCloseQuotes = app.closeQuotes;
  if (typeof originalCloseQuotes === 'function') app.closeQuotes = function (...args) {
    if (!this.__discardingQuoteDraft && !this.__savingQuoteDraft) saveCurrentDraft().catch(() => {});
    return originalCloseQuotes.apply(this, args);
  };

  const originalSaveTask = app.handleSaveTask;
  if (typeof originalSaveTask === 'function') app.handleSaveTask = async function (...args) {
    this.__savingTaskDraft = true;
    try { return await originalSaveTask.apply(this, args); }
    finally {
      this.__savingTaskDraft = false;
      if (document.getElementById('modal-task-form')?.classList.contains('hidden')) {
        const id = document.getElementById('task-id')?.value || '';
        removeDraft(draftKey('task', id));
        removeDraft(draftKey('task', ''));
      }
    }
  };
  const originalSaveQuote = app.saveQuote;
  if (typeof originalSaveQuote === 'function') app.saveQuote = async function (...args) {
    const quoteId = this.quoteCurrentId || '';
    this.__savingQuoteDraft = true;
    try {
      const result = await originalSaveQuote.apply(this, args);
      if (result === true) {
        removeDraft(draftKey('quote', quoteId));
        removeDraft(draftKey('quote', ''));
      }
      return result;
    } finally { this.__savingQuoteDraft = false; }
  };

  document.addEventListener('click', event => {
    if (event.target.closest?.('#modal-task-form .task-form-actions button[type="button"]')) {
      const button = event.target.closest('button');
      if (button?.textContent?.trim().toLowerCase().includes('cancel')) {
        const id = document.getElementById('task-id')?.value || '';
        app.__discardingTaskDraft = true;
        removeDraft(draftKey('task', id));
        removeDraft(draftKey('task', ''));
        setTimeout(() => { app.__discardingTaskDraft = false; }, 0);
      }
    }
    if (event.target.closest?.('#quotes-shell .quote-secondary-button')) {
      app.__discardingQuoteDraft = true;
      removeDraft(draftKey('quote', app.quoteCurrentId || ''));
      removeDraft(draftKey('quote', ''));
      setTimeout(() => { app.__discardingQuoteDraft = false; }, 0);
    }
  }, true);

  window.discardFormDraft = (kind, id = '') => removeDraft(draftKey(kind, id));
  return true;
  }

  function startWhenReady() {
    if (install()) return;
    const timer = setInterval(() => { if (install()) clearInterval(timer); }, 25);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startWhenReady, { once: true });
  else startWhenReady();
})();
