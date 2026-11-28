(function () {
  'use strict';
  if (window.__maintenanceReminders83Installed || typeof PortonProApp === 'undefined') return;
  window.__maintenanceReminders83Installed = true;

  const DAY = 86400000;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const isAdmin = app => ['admin', 'administrador'].includes(String(app?.currentUser?.role || '').toLowerCase());

  function serviceTimestamp(task) {
    const completed = Number(task?.completedAtMs || 0);
    if (completed > 0) return completed;
    const due = Number(task?.paymentDueAt || 0);
    if (due > 0) return due - 30 * DAY;
    const completedValue = task?.completedAt;
    if (completedValue && typeof completedValue.toDate === 'function') return completedValue.toDate().getTime();
    if (completedValue instanceof Date && Number.isFinite(completedValue.getTime())) return completedValue.getTime();
    const display = String(task?.completedAt || '');
    const match = display.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12).getTime();
    const date = String(task?.workDate || task?.date || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Date(`${date}T12:00:00`).getTime();
    return Date.now();
  }

  function addMonths(timestamp, amount) {
    const date = new Date(timestamp);
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  function nextReminderDate(reminder) {
    const months = 4;
    let nextDueAt = addMonths(Number(reminder?.dueAt) || Date.now(), months);
    const now = Date.now();
    while (nextDueAt <= now) nextDueAt = addMonths(nextDueAt, months);
    return nextDueAt;
  }

  async function askConfirmation(app, message, options) {
    if (typeof app?.showSystemConfirm !== 'function') {
      app?.showToast?.('No se pudo abrir la confirmación. Inténtalo nuevamente.', 'error');
      return false;
    }
    return app.showSystemConfirm(message, options);
  }

  async function persistReminder(app, task, reminder, successMessage) {
    const previous = task.maintenanceReminder;
    if (reminder) task.maintenanceReminder = reminder;
    else delete task.maintenanceReminder;
    try {
      const saved = await app.saveTasks(true);
      if (!saved?.ok) throw new Error('Firestore no confirmó el guardado.');
      app.renderDocumentControlRecords?.();
      renderAlertBar(app);
      app.showToast?.(successMessage, 'success');
      return true;
    } catch (error) {
      if (previous === undefined) delete task.maintenanceReminder;
      else task.maintenanceReminder = previous;
      console.warn('[CONSOLIDADO] No se pudo guardar el recordatorio de mantenimiento.', error);
      app.showToast?.('No se pudo guardar el recordatorio. Inténtalo nuevamente.', 'error');
      return false;
    }
  }

  async function silenceReminder(app, task) {
    const reminder = task?.maintenanceReminder;
    if (!reminder || reminder.enabled === false || Number(reminder.dueAt) <= 0) return;
    const nextDueAt = nextReminderDate(reminder);
    const nextDate = new Intl.DateTimeFormat('es-CO', { day:'numeric', month:'long', year:'numeric' }).format(new Date(nextDueAt));
    const confirmed = await askConfirmation(app, `La alerta actual se ocultará. El recordatorio volverá a aparecer el ${nextDate} y continuará repitiéndose cada 4 meses. ¿Desea silenciarlo?`, { title:'Silenciar recordatorio', confirmText:'Silenciar 4 meses', cancelText:'Cancelar', icon:'success', variant:'info' });
    if (!confirmed) return;
    return persistReminder(app, task, { ...reminder, intervalMonths:4, dueAt:nextDueAt, lastSilencedAt:Date.now(), updatedAt:Date.now() }, 'Alerta silenciada; volverá a aparecer en cuatro meses.');
  }

  function ensureAlertBar() {
    const dashboard = document.getElementById('view-dashboard');
    const header = dashboard?.querySelector('header');
    if (!header) return null;
    let bar = document.getElementById('maintenance-reminder-bar');
    if (!bar) {
      bar = document.createElement('aside');
      bar.id = 'maintenance-reminder-bar';
      bar.className = 'maintenance-reminder-bar';
      bar.hidden = true;
      bar.setAttribute('aria-label', 'Recordatorios de mantenimiento');
      bar.innerHTML = '<div class="maintenance-reminder-label"><i data-lucide="bell-ring" aria-hidden="true"></i><span>MANTENIMIENTOS</span></div><div class="maintenance-reminder-viewport"><div class="maintenance-reminder-track"></div></div><button type="button" class="maintenance-reminder-open">Ver órdenes</button>';
      const creditsBar = document.getElementById('credits-reminder-bar');
      (creditsBar || header).insertAdjacentElement('afterend', bar);
      bar.querySelector('.maintenance-reminder-open')?.addEventListener('click', () => window.app?.openDocumentControl?.());
    }
    if (bar.dataset.maintenanceActionsReady !== 'true') {
      bar.dataset.maintenanceActionsReady = 'true';
      bar.addEventListener('click', async event => {
        const silence = event.target.closest('[data-maintenance-silence]');
        if (!silence) return;
        event.preventDefault();
        if (silence.disabled) return;
        silence.disabled = true;
        const app = window.app;
        const task = (app?.tasks || []).find(item => String(item.id) === silence.dataset.maintenanceSilence);
        if (!task || !isAdmin(app)) { silence.disabled = false; return; }
        if (!window.db || !navigator.onLine) { silence.disabled = false; app?.showToast?.('Conéctate a internet para guardar la próxima fecha del recordatorio.', 'error'); return; }
        try { await silenceReminder(app, task); }
        finally { if (silence.isConnected) silence.disabled = false; }
      });
    }
    return bar;
  }

  function renderAlertBar(app) {
    const bar = ensureAlertBar();
    if (!bar) return;
    const track = bar.querySelector('.maintenance-reminder-track');
    const now = Date.now();
    const dueItems = (app?.tasks || [])
      .filter(task => task?.status === 'REALIZADA' && task?.maintenanceReminder?.enabled !== false && Number(task?.maintenanceReminder?.dueAt) > 0 && Number(task.maintenanceReminder.dueAt) <= now)
      .sort((a, b) => Number(a.maintenanceReminder.dueAt) - Number(b.maintenanceReminder.dueAt));
    bar.hidden = !isAdmin(app) || dueItems.length === 0;
    track.replaceChildren();
    if (bar.hidden) return;
    track.innerHTML = `<div class="maintenance-reminder-group">${dueItems.map((task, index) => {
      const reminder = task.maintenanceReminder;
      const due = new Date(Number(reminder.dueAt));
      const lateDays = Math.max(0, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(due.getFullYear(), due.getMonth(), due.getDate())) / DAY));
      const delay = lateDays ? ` · ${lateDays} ${lateDays === 1 ? 'día' : 'días'} de retraso` : ' · VENCE HOY';
      return `${index ? '<span class="maintenance-alert-separator" aria-hidden="true">•</span>' : ''}<span class="maintenance-alert-message"><i data-lucide="calendar-clock" aria-hidden="true"></i><strong>${safe(task.client || task.clientName || 'Cliente')}</strong><b>RECORDATORIO DE MANTENIMIENTO</b><span>Mantenimiento programado 4 meses${delay}</span><small>${safe(task.id || '')}</small><button type="button" class="maintenance-alert-silence" data-maintenance-silence="${safe(task.id)}">Silenciar 4 meses</button></span>`;
    }).join('')}</div>`;
    const group = track.firstElementChild;
    const viewport = bar.querySelector('.maintenance-reminder-viewport');
    const width = Math.max(1, Math.ceil(group?.getBoundingClientRect().width || 1));
    const viewportWidth = Math.max(1, viewport?.clientWidth || 1);
    track.style.setProperty('--maintenance-scroll-start', `${viewportWidth}px`);
    track.style.setProperty('--maintenance-scroll-end', `${width}px`);
    track.style.setProperty('--maintenance-scroll-duration', `${Math.max(24, Math.min(70, (viewportWidth + width) / 30))}s`);
    if (window.lucide) window.lucide.createIcons();
  }

  function buttonMarkup(task) {
    const active = task?.maintenanceReminder?.enabled !== false && Number(task?.maintenanceReminder?.dueAt) > 0;
    const due = active ? new Intl.DateTimeFormat('es-CO', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(Number(task.maintenanceReminder.dueAt))) : '';
    return `<div class="maintenance-reminder-action-wrap"><button type="button" class="maintenance-reminder-action${active ? ' is-scheduled' : ''}" data-maintenance-reminder-toggle="${safe(task.id)}" aria-label="${active ? 'Desactivar recordatorio de mantenimiento' : 'Activar recordatorio de mantenimiento por cuatro meses'}" aria-pressed="${active}" title="${active ? `Recordatorio de mantenimiento activo · ${safe(due)}` : 'Activar recordatorio de mantenimiento por cuatro meses'}"><i data-lucide="bell-ring" aria-hidden="true"></i></button></div>`;
  }

  function renderActions(app) {
    const panel = document.getElementById('archived-documents-panel');
    if (!panel || panel.classList.contains('hidden') || !isAdmin(app)) return;
    const taskById = new Map((app.tasks || []).map(task => [String(task.id), task]));
    panel.querySelectorAll('.payment-table tbody tr').forEach(row => {
      const id = row.cells?.[1]?.querySelector('small')?.textContent?.trim();
      const task = id && taskById.get(id);
      const actions = row.querySelector('.payment-order-actions');
      if (!task || !actions) return;
      actions.querySelector('.maintenance-reminder-action-wrap')?.remove();
      actions.insertAdjacentHTML('beforeend', buttonMarkup(task));
    });
    panel.querySelectorAll('.payment-mobile-card').forEach(card => {
      const top = card.querySelector('.payment-mobile-top')?.textContent || '';
      const id = [...taskById.keys()].find(key => top.endsWith(`· ${key}`));
      const task = id && taskById.get(id);
      const actions = card.querySelector('.payment-order-actions-mobile');
      if (!task || !actions) return;
      actions.querySelector('.maintenance-reminder-action-wrap')?.remove();
      actions.insertAdjacentHTML('beforeend', buttonMarkup(task));
    });
    if (window.lucide) window.lucide.createIcons({ root:panel });
  }

  function installPanelHandlers(panel) {
    if (!panel || panel.dataset.maintenanceReminderReady === 'true') return;
    panel.dataset.maintenanceReminderReady = 'true';
    panel.addEventListener('click', async event => {
      const toggle = event.target.closest('[data-maintenance-reminder-toggle]');
      if (!toggle) return;
      event.preventDefault();
      if (toggle.disabled) return;
      toggle.disabled = true;
      const id = toggle.dataset.maintenanceReminderToggle;
      const task = (window.app?.tasks || []).find(item => String(item.id) === String(id));
      if (!task || !isAdmin(window.app)) { toggle.disabled = false; return window.app?.showToast?.('Solo el administrador puede programar recordatorios.', 'error'); }
      if (!window.db || !navigator.onLine) { toggle.disabled = false; return window.app?.showToast?.('Conéctate a internet para guardar el recordatorio.', 'error'); }
      const previous = task.maintenanceReminder;
      const active = previous?.enabled !== false && Number(previous?.dueAt) > 0;
      const activating = !active;
      const confirmed = await askConfirmation(window.app,
        activating
          ? 'Se activará un recordatorio de mantenimiento para esta orden. La primera alerta aparecerá cuatro meses después de la fecha del servicio y se repetirá cada cuatro meses.'
          : 'Se desactivará el recordatorio de mantenimiento de esta orden y dejarán de aparecer sus próximas alertas.',
        { title:activating ? 'Activar recordatorio' : 'Desactivar recordatorio', confirmText:activating ? 'Activar' : 'Desactivar', cancelText:'Cancelar', icon:activating ? 'success' : 'warning', variant:activating ? 'info' : 'danger' }
      );
      if (!confirmed) { toggle.disabled = false; return; }
      let nextReminder;
      if (activating) {
        const base = previous ? Date.now() : serviceTimestamp(task);
        nextReminder = { ...(previous || {}), enabled:true, intervalMonths:4, serviceAt:base, dueAt:addMonths(base, 4), createdAt:previous?.createdAt || Date.now(), updatedAt:Date.now() };
      } else nextReminder = { ...previous, enabled:false, disabledAt:Date.now(), updatedAt:Date.now() };
      await persistReminder(window.app, task, nextReminder, activating ? 'Recordatorio activado; se repetirá cada cuatro meses.' : 'Recordatorio desactivado.');
      toggle.disabled = false;
    });
  }

  const proto = PortonProApp.prototype;
  if (typeof proto.ensureDocumentControlPanel === 'function' && !proto.ensureDocumentControlPanel.__maintenanceReminders83) {
    const original = proto.ensureDocumentControlPanel;
    const wrapped = function (...args) {
      const panel = original.apply(this, args);
      installPanelHandlers(panel);
      return panel;
    };
    wrapped.__maintenanceReminders83 = true;
    proto.ensureDocumentControlPanel = wrapped;
  }
  if (typeof proto.renderDocumentControlRecords === 'function' && !proto.renderDocumentControlRecords.__maintenanceReminders83) {
    const original = proto.renderDocumentControlRecords;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      renderActions(this);
      renderAlertBar(this);
      return result;
    };
    wrapped.__maintenanceReminders83 = true;
    proto.renderDocumentControlRecords = wrapped;
  }
  if (typeof proto.renderTasks === 'function' && !proto.renderTasks.__maintenanceReminders83) {
    const original = proto.renderTasks;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      renderAlertBar(this);
      return result;
    };
    wrapped.__maintenanceReminders83 = true;
    proto.renderTasks = wrapped;
  }

  window.setInterval(() => renderAlertBar(window.app), 60000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => renderAlertBar(window.app), { once:true });
  else renderAlertBar(window.app);
})();
