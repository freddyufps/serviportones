(function () {
  'use strict';
  if (window.__businessCreditsModuleInstalled) return;
  window.__businessCreditsModuleInstalled = true;

  const CREDITS = 'creditos_negocio';
  const HISTORY = 'creditos_negocio_historial';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const now = () => new Date();
  const currentPeriod = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const money = value => new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(Number(value) || 0);
  const roleIsAdmin = () => ['admin', 'administrador'].includes(String(window.app?.currentUser?.role || '').toLowerCase());
  let creditRecords = [];
  let paymentRecords = [];
  let activeTab = 'credits';
  let dataLoadedForSession = '';
  let loadPromise = null;
  let lastReadAt = 0;
  let previousBodyOverflow = '';
  let isOpen = false;
  let reminderRefreshTimer = 0;

  function currentUserCanManage() {
    if (!roleIsAdmin()) {
      window.app?.showToast?.('Esta sección está disponible únicamente para el administrador.', 'error');
      return false;
    }
    return true;
  }

  function dayParts(date) { return { year:date.getFullYear(), month:date.getMonth() + 1, day:date.getDate() }; }
  function dateAtDay(year, month, day) { return new Date(year, month - 1, Math.min(day, new Date(year, month, 0).getDate()), 0, 0, 0, 0); }
  function daysBetween(left, right) {
    const a = dayParts(left), b = dayParts(right);
    return Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86400000);
  }
  function dateLabel(date) { return new Intl.DateTimeFormat('es-CO', { day:'2-digit', month:'long', year:'numeric' }).format(date); }
  function sortCreditRecords() {
    creditRecords.sort((a, b) => Number(a.dueDay || 0) - Number(b.dueDay || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { numeric:true, sensitivity:'base' }));
  }

  function creditState(credit, today = now()) {
    const period = currentPeriod(today);
    const dueDate = dateAtDay(today.getFullYear(), today.getMonth() + 1, Number(credit.dueDay) || 1);
    if (String(credit.lastPaidPeriod || '') === period) return { key:'paid', label:'Pagado este mes', dueDate, period };
    const daysUntil = daysBetween(dueDate, today);
    if (daysUntil < 0) return { key:'overdue', label:`Vencido hace ${Math.abs(daysUntil)} ${Math.abs(daysUntil) === 1 ? 'día' : 'días'}`, dueDate, daysUntil, period };
    if (daysUntil === 0) return { key:'today', label:'Vence hoy', dueDate, daysUntil, period };
    if (daysUntil <= 7) return { key:'soon', label:`Vence en ${daysUntil} ${daysUntil === 1 ? 'día' : 'días'}`, dueDate, daysUntil, period };
    return { key:'ontime', label:'Al día', dueDate, daysUntil, period };
  }

  function toast(message, type = 'success') { window.app?.showToast?.(message, type); }

  function ensureUi() {
    const dashboard = document.getElementById('view-dashboard');
    const settings = document.getElementById('btn-nav-settings');
    const profile = document.getElementById('header-presence-profile');
    const header = dashboard?.querySelector('header');
    if (!dashboard || !settings || !profile || !header) return false;

    if (!document.getElementById('admin-finance-entry')) {
      const group = document.createElement('div');
      group.id = 'admin-finance-entry';
      group.className = 'credits-admin-entry';
      group.hidden = true;
      group.innerHTML = '<button id="btn-nav-credits" type="button" class="credits-nav-button" aria-label="Créditos" title="Créditos"><i data-lucide="credit-card" aria-hidden="true"></i><span>Créditos</span></button>';
      profile.insertAdjacentElement('beforebegin', group);
    }

    if (!document.getElementById('credits-reminder-bar')) {
      const ticker = document.createElement('aside');
      ticker.id = 'credits-reminder-bar';
      ticker.className = 'credits-reminder-bar';
      ticker.hidden = true;
      ticker.setAttribute('aria-label', 'Recordatorios de créditos');
      ticker.innerHTML = '<div class="credits-reminder-label"><i data-lucide="bell-ring" aria-hidden="true"></i><span>ALERTAS DE PAGO</span></div><div class="credits-reminder-viewport"><div class="credits-reminder-track" data-credits-reminder-track></div></div><button type="button" class="credits-reminder-open" data-credits-open aria-label="Abrir créditos">Ver créditos</button>';
      header.insertAdjacentElement('afterend', ticker);
      ticker.querySelector('[data-credits-open]')?.addEventListener('click', openModule);
    }

    if (!document.getElementById('credits-module-root')) {
      const root = document.createElement('div');
      root.id = 'credits-module-root';
      root.className = 'credits-module-root';
      root.hidden = true;
      root.innerHTML = `
        <div class="credits-module-backdrop" data-credits-close></div>
        <section class="credits-module-window" role="dialog" aria-modal="true" aria-labelledby="credits-module-title">
          <header class="credits-module-header">
            <div class="credits-module-brand"><span class="credits-module-icon"><i data-lucide="credit-card" aria-hidden="true"></i></span><div><span class="credits-module-kicker">ADMINISTRACIÓN FINANCIERA</span><h1 id="credits-module-title">Créditos</h1><p>Obligaciones y pagos recurrentes del negocio</p></div></div>
            <button type="button" class="credits-close-button" data-credits-close aria-label="Cerrar Créditos">×</button>
          </header>
          <div class="credits-module-body">
            <div class="credits-toolbar"><div class="credits-tabs" role="tablist"><button type="button" class="is-active" data-credits-tab="credits" role="tab" aria-selected="true">Obligaciones</button><button type="button" data-credits-tab="history" role="tab" aria-selected="false">Historial de pagos</button></div><div class="credits-toolbar-actions"><button type="button" class="credits-secondary-button" data-credits-refresh><i data-lucide="refresh-cw" aria-hidden="true"></i><span>Actualizar</span></button><button type="button" class="credits-primary-button" data-credits-new><i data-lucide="plus" aria-hidden="true"></i><span>Nuevo crédito</span></button></div></div>
            <div class="credits-summary" data-credits-summary></div>
            <div class="credits-list" data-credits-list></div>
            <div class="credits-history hidden" data-credits-history></div>
            <p class="credits-data-note" data-credits-status role="status"></p>
          </div>
        </section>
        <div class="credits-child-modal" data-credits-editor hidden>
          <div class="credits-child-scrim" data-editor-close></div>
          <section class="credits-child-card" role="dialog" aria-modal="true" aria-labelledby="credits-editor-title"><header><span class="credits-child-icon"><i data-lucide="wallet-cards" aria-hidden="true"></i></span><div><h2 id="credits-editor-title">Nuevo crédito</h2><p>El crédito se repetirá automáticamente cada mes.</p></div><button type="button" data-editor-close aria-label="Cerrar">×</button></header>
            <form data-credit-form><input type="hidden" name="id"><label>Nombre<input name="name" maxlength="120" required autocomplete="off" placeholder="Ej. Colpatria 2 crédito"></label><div class="credits-form-row"><label>Día de vencimiento<input name="dueDay" type="number" min="1" max="31" step="1" required inputmode="numeric" placeholder="1–31"></label><label>Valor mensual<input name="amount" type="number" min="0" step="1" required inputmode="decimal" placeholder="$ 0"></label></div><label>Observaciones <span>(opcional)</span><textarea name="notes" rows="3" maxlength="1200" placeholder="Detalles de la obligación"></textarea></label><footer><button type="button" class="credits-secondary-button" data-editor-close>Cancelar</button><button type="submit" class="credits-primary-button"><i data-lucide="save" aria-hidden="true"></i><span>Guardar crédito</span></button></footer></form>
          </section>
        </div>
        <div class="credits-child-modal" data-credits-payment-modal hidden>
          <div class="credits-child-scrim" data-payment-close></div>
          <section class="credits-child-card credits-payment-card" role="dialog" aria-modal="true" aria-labelledby="credits-payment-title"><header><span class="credits-child-icon is-green"><i data-lucide="circle-check" aria-hidden="true"></i></span><div><h2 id="credits-payment-title">Registrar pago</h2><p data-payment-credit-name></p></div><button type="button" data-payment-close aria-label="Cerrar">×</button></header>
            <form data-payment-form><input type="hidden" name="id"><div class="credits-payment-amount" data-payment-amount></div><label>Observación del pago <span>(opcional)</span><textarea name="observation" rows="3" maxlength="1200" placeholder="Ej. Pagado por transferencia"></textarea></label><p class="credits-payment-period" data-payment-period></p><footer><button type="button" class="credits-secondary-button" data-payment-close>Cancelar</button><button type="submit" class="credits-primary-button"><i data-lucide="check" aria-hidden="true"></i><span>Confirmar pago</span></button></footer></form>
          </section>
        </div>`;
      document.body.appendChild(root);
    }

    const button = document.getElementById('btn-nav-credits');
    button?.addEventListener('click', openModule);
    document.getElementById('credits-module-root')?.addEventListener('click', handleModuleClick);
    document.querySelector('[data-credit-form]')?.addEventListener('submit', saveCreditForm);
    document.querySelector('[data-payment-form]')?.addEventListener('submit', submitPaymentForm);
    document.addEventListener('keydown', handleEscape);
    return true;
  }

  async function readCredits() {
    if (!currentUserCanManage()) return false;
    if (!window.db) { setStatus('No hay conexión con la base de datos.', true); return false; }
    if (loadPromise) return loadPromise;
    const sessionId = String(window.app?.currentUser?.authSessionId || 'admin');
    loadPromise = (async () => {
      setStatus('Cargando créditos…');
      try {
        const snapshot = await window.db.collection(CREDITS).get();
        if (!roleIsAdmin() || String(window.app?.currentUser?.authSessionId || 'admin') !== sessionId) return false;
        creditRecords = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));
        sortCreditRecords();
        lastReadAt = Date.now();
        renderModule();
        renderReminderBar();
        setStatus('');
        return true;
      } catch (error) {
        console.error('[CRÉDITOS] No se pudieron cargar las obligaciones:', error);
        setStatus('No se pudieron cargar los créditos. Revisa la conexión o los permisos de Firestore.', true);
        return false;
      } finally { loadPromise = null; }
    })();
    return loadPromise;
  }

  async function readHistory() {
    if (!currentUserCanManage() || !window.db) return false;
    setStatus('Cargando historial…');
    try {
      const snapshot = await window.db.collection(HISTORY).get();
      if (!roleIsAdmin()) return false;
      paymentRecords = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() })).sort((a, b) => Number(b.paidAt || 0) - Number(a.paidAt || 0));
      renderModule();
      setStatus('');
      return true;
    } catch (error) {
      console.error('[CRÉDITOS] No se pudo cargar el historial:', error);
      setStatus('No se pudo cargar el historial de pagos.', true);
      return false;
    }
  }

  function setStatus(message, isError = false) {
    const status = document.querySelector('[data-credits-status]');
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', Boolean(isError));
  }

  function renderSummary() {
    const summary = document.querySelector('[data-credits-summary]');
    if (!summary) return;
    const today = now();
    const counts = { total:creditRecords.length, overdue:0, due:0, upcoming:0 };
    creditRecords.forEach(credit => {
      const state = creditState(credit, today);
      if (state.key === 'overdue') counts.overdue++;
      else if (state.key === 'today') counts.due++;
      else if (state.key === 'soon') counts.upcoming++;
    });
    summary.innerHTML = `<article><span>Créditos registrados</span><strong>${counts.total}</strong></article><article class="is-overdue"><span>Atrasados</span><strong>${counts.overdue}</strong></article><article class="is-due"><span>Vencen hoy</span><strong>${counts.due}</strong></article><article class="is-soon"><span>Próximos 7 días</span><strong>${counts.upcoming}</strong></article>`;
  }

  function renderCredits() {
    const host = document.querySelector('[data-credits-list]');
    if (!host) return;
    if (!creditRecords.length) {
      host.innerHTML = '<div class="credits-empty"><span><i data-lucide="wallet-cards"></i></span><h3>Aún no hay créditos</h3><p>Agrega una obligación mensual para empezar el seguimiento.</p><button type="button" class="credits-primary-button" data-credits-new><i data-lucide="plus"></i><span>Agregar primer crédito</span></button></div>';
      return;
    }
    const statusInfo = state => ({
      overdue:['overdue','Atrasado','triangle-alert'],
      today:['today','Vence hoy','calendar-clock'],
      soon:['soon','Próximo a vencer','clock-3'],
      paid:['paid','Pagado este mes','circle-check'],
      ontime:['ontime','Al día','check']
    }[state.key] || ['ontime',state.label,'check']);
    const sortedCredits = [...creditRecords].sort((a, b) => Number(a.dueDay || 0) - Number(b.dueDay || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { numeric:true, sensitivity:'base' }));
    host.innerHTML = `<div class="credits-table-wrap"><table class="credits-table"><thead><tr><th scope="col">Día</th><th scope="col">Crédito</th><th scope="col">Valor mensual</th><th scope="col">Estado</th><th scope="col">Vencimiento</th><th scope="col">Atraso</th><th scope="col">Acciones</th></tr></thead><tbody>${sortedCredits.map(credit => {
      const state = creditState(credit);
      const paid = state.key === 'paid';
      const notes = String(credit.notes || '').trim();
      const [statusClass, statusLabel, statusIcon] = statusInfo(state);
      const lateDays = state.key === 'overdue' ? `${Math.abs(state.daysUntil)} ${Math.abs(state.daysUntil) === 1 ? 'día' : 'días'}` : '—';
      const dueDate = state.dueDate ? new Intl.DateTimeFormat('es-CO', { day:'numeric', month:'short', year:'numeric' }).format(state.dueDate) : `Día ${credit.dueDay}`;
      return `<tr class="credits-table-row status-${esc(statusClass)}"><td class="credits-table-day"><span class="status-${esc(statusClass)}">${esc(credit.dueDay)}</span></td><td class="credits-table-name"><strong>${esc(credit.name || 'Crédito')}</strong>${notes ? `<small>${esc(notes)}</small>` : ''}</td><td class="credits-table-amount">${money(credit.amount)}</td><td><span class="credits-state-badge status-${esc(statusClass)}"><i data-lucide="${statusIcon}"></i>${esc(statusLabel)}</span></td><td class="credits-table-date">${esc(dueDate)}</td><td class="credits-table-late ${state.key === 'overdue' ? 'is-late' : ''}">${esc(lateDays)}</td><td><div class="credits-table-actions">${!paid ? `<button type="button" class="credits-paid-button" data-credit-pay="${esc(credit.id)}"><i data-lucide="check"></i><span>Ya se pagó</span></button>` : `<span class="credits-paid-this-month"><i data-lucide="circle-check"></i> Pagado</span>`}<button type="button" class="credits-icon-button" data-credit-edit="${esc(credit.id)}" aria-label="Editar ${esc(credit.name)}" title="Editar"><i data-lucide="pencil"></i></button><button type="button" class="credits-icon-button is-delete" data-credit-delete="${esc(credit.id)}" aria-label="Eliminar ${esc(credit.name)}" title="Eliminar"><i data-lucide="trash-2"></i></button></div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function renderHistory() {
    const host = document.querySelector('[data-credits-history]');
    if (!host) return;
    if (!paymentRecords.length) {
      host.innerHTML = '<div class="credits-empty credits-history-empty"><span><i data-lucide="history"></i></span><h3>Sin pagos registrados</h3><p>Los pagos confirmados aparecerán aquí con su fecha y observación.</p></div>';
      return;
    }
    host.innerHTML = `<div class="credits-history-table-wrap"><table class="credits-history-table"><thead><tr><th>Fecha de pago</th><th>Crédito</th><th>Periodo</th><th>Valor</th><th>Observación</th></tr></thead><tbody>${paymentRecords.map(payment => `<tr><td>${esc(dateLabel(new Date(Number(payment.paidAt) || 0)))}</td><td><strong>${esc(payment.name || 'Crédito eliminado')}</strong></td><td>${esc(payment.period || '—')}</td><td class="credits-history-amount">${money(payment.amount)}</td><td>${esc(payment.observation || '—')}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderModule() {
    renderSummary();
    const list = document.querySelector('[data-credits-list]');
    const history = document.querySelector('[data-credits-history]');
    const summary = document.querySelector('[data-credits-summary]');
    list?.classList.toggle('hidden', activeTab !== 'credits');
    summary?.classList.toggle('hidden', activeTab !== 'credits');
    history?.classList.toggle('hidden', activeTab !== 'history');
    document.querySelectorAll('[data-credits-tab]').forEach(button => {
      const selected = button.dataset.creditsTab === activeTab;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    renderCredits();
    if (activeTab === 'history') renderHistory();
    if (window.lucide) window.lucide.createIcons();
  }

  function renderReminderBar() {
    const bar = document.getElementById('credits-reminder-bar');
    const track = bar?.querySelector('[data-credits-reminder-track]');
    if (!bar || !track) return;
    const items = creditRecords
      .map(credit => ({ credit, state:creditState(credit) }))
      .filter(item => ['overdue', 'today'].includes(item.state.key));
    bar.hidden = !roleIsAdmin() || items.length === 0;
    if (!bar.hidden) bar.dataset.alertLevel = items.some(item => item.state.key === 'overdue') ? 'overdue' : 'today';
    else delete bar.dataset.alertLevel;
    track.replaceChildren();
    if (bar.hidden) return;
    const renderItem = ({ credit, state }) => {
      const tone = state.key === 'overdue' ? 'is-danger' : 'is-today';
      const icon = state.key === 'overdue' ? 'triangle-alert' : 'calendar-clock';
      const label = state.key === 'overdue' ? `ATRASADO ${Math.abs(state.daysUntil)} ${Math.abs(state.daysUntil) === 1 ? 'DÍA' : 'DÍAS'}` : 'VENCE HOY';
      return `<span class="credits-alert-message ${tone}"><i data-lucide="${icon}" aria-hidden="true"></i><strong>${esc(credit.name || 'Crédito')}</strong><b>${label}</b><strong>${money(credit.amount)}</strong></span>`;
    };
    const groupMarkup = `<div class="credits-reminder-group">${items.map((item, index) => `${index ? '<span class="credits-alert-separator" aria-hidden="true">•</span>' : ''}${renderItem(item)}`).join('')}</div>`;
    track.innerHTML = groupMarkup;
    const group = track.firstElementChild;
    const viewport = bar.querySelector('.credits-reminder-viewport');
    const groupWidth = Math.max(1, Math.ceil(group?.getBoundingClientRect().width || 1));
    const viewportWidth = Math.max(1, viewport?.clientWidth || 1);
    track.style.setProperty('--credits-scroll-start', `${viewportWidth}px`);
    track.style.setProperty('--credits-scroll-end', `${groupWidth}px`);
    track.style.setProperty('--credits-scroll-duration', `${Math.max(24, Math.min(70, (viewportWidth + groupWidth) / 30))}s`);
    if (window.lucide) window.lucide.createIcons();
  }

  function scheduleReminderRefresh() {
    window.clearTimeout(reminderRefreshTimer);
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 1, 0);
    reminderRefreshTimer = window.setTimeout(() => {
      renderReminderBar();
      if (isOpen) renderModule();
      scheduleReminderRefresh();
    }, Math.max(1000, tomorrow.getTime() - Date.now()));
  }

  function openModule() {
    if (!currentUserCanManage()) return;
    const root = document.getElementById('credits-module-root');
    if (!root) return;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.hidden = false;
    isOpen = true;
    activeTab = 'credits';
    renderModule();
    if (Date.now() - lastReadAt > 60000) readCredits();
    document.querySelector('[data-credits-new]')?.focus({ preventScroll:true });
  }

  function closeModule() {
    const root = document.getElementById('credits-module-root');
    if (!root) return;
    root.hidden = true;
    isOpen = false;
    document.body.style.overflow = previousBodyOverflow;
    closeEditor();
    closePaymentModal();
  }

  function openEditor(id = '') {
    if (!currentUserCanManage()) return;
    const layer = document.querySelector('[data-credits-editor]');
    const form = layer?.querySelector('[data-credit-form]');
    if (!layer || !form) return;
    form.reset();
    const credit = id ? creditRecords.find(item => item.id === id) : null;
    form.elements.id.value = credit?.id || '';
    form.elements.name.value = credit?.name || '';
    form.elements.dueDay.value = credit?.dueDay || '';
    form.elements.amount.value = credit?.amount ?? '';
    form.elements.notes.value = credit?.notes || '';
    layer.querySelector('#credits-editor-title').textContent = credit ? 'Editar crédito' : 'Nuevo crédito';
    layer.hidden = false;
    requestAnimationFrame(() => form.elements.name.focus({ preventScroll:true }));
  }

  function closeEditor() { const layer = document.querySelector('[data-credits-editor]'); if (layer) layer.hidden = true; }

  function openPaymentForm(id) {
    if (!currentUserCanManage()) return;
    const credit = creditRecords.find(item => item.id === id);
    if (!credit || creditState(credit).key === 'paid') return;
    const layer = document.querySelector('[data-credits-payment-modal]');
    const form = layer?.querySelector('[data-payment-form]');
    if (!layer || !form) return;
    form.reset();
    form.elements.id.value = credit.id;
    layer.querySelector('[data-payment-credit-name]').textContent = credit.name;
    layer.querySelector('[data-payment-amount]').textContent = money(credit.amount);
    layer.querySelector('[data-payment-period]').textContent = `Pago correspondiente a ${currentPeriod(now())}.`;
    layer.hidden = false;
    requestAnimationFrame(() => form.querySelector('textarea')?.focus({ preventScroll:true }));
  }

  function closePaymentModal() { const layer = document.querySelector('[data-credits-payment-modal]'); if (layer) layer.hidden = true; }

  async function saveCreditForm(event) {
    event.preventDefault();
    if (!currentUserCanManage()) return;
    const form = event.currentTarget;
    const id = String(form.elements.id.value || '').trim();
    const name = String(form.elements.name.value || '').trim();
    const dueDay = Number(form.elements.dueDay.value);
    const amount = Number(form.elements.amount.value);
    const notes = String(form.elements.notes.value || '').trim();
    if (!name || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || !Number.isFinite(amount) || amount < 0) {
      toast('Revisa el nombre, el día de vencimiento y el valor mensual.', 'error');
      return;
    }
    if (!window.db) { toast('No hay conexión con la base de datos.', 'error'); return; }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const payload = { name, dueDay, amount, notes, updatedAt:Date.now() };
      if (id) {
        await window.db.collection(CREDITS).doc(id).set(payload, { merge:true });
        creditRecords = creditRecords.map(credit => credit.id === id ? { ...credit, ...payload } : credit);
        sortCreditRecords();
        toast('Crédito actualizado.');
      } else {
        payload.createdAt = Date.now();
        payload.lastPaidPeriod = '';
        const reference = await window.db.collection(CREDITS).add(payload);
        creditRecords.push({ id:reference.id, ...payload });
        sortCreditRecords();
        toast('Crédito agregado.');
      }
      lastReadAt = Date.now();
      closeEditor();
      renderModule();
      renderReminderBar();
    } catch (error) {
      console.error('[CRÉDITOS] No se pudo guardar:', error);
      toast('No se pudo guardar el crédito. Inténtalo de nuevo.', 'error');
    } finally { submit.disabled = false; }
  }

  async function submitPaymentForm(event) {
    event.preventDefault();
    if (!currentUserCanManage()) return;
    const form = event.currentTarget;
    const credit = creditRecords.find(item => item.id === String(form.elements.id.value || ''));
    if (!credit || creditState(credit).key === 'paid') { closePaymentModal(); renderModule(); return; }
    if (!window.db) { toast('No hay conexión con la base de datos.', 'error'); return; }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    const period = currentPeriod(now());
    const paymentId = `${credit.id.replace(/[\/\\]/g, '_')}_${period}`;
    const paidAt = Date.now();
    const observation = String(form.elements.observation.value || '').trim();
    try {
      const batch = window.db.batch();
      batch.set(window.db.collection(HISTORY).doc(paymentId), { creditId:credit.id, name:credit.name, amount:Number(credit.amount) || 0, period, paidAt, observation });
      batch.set(window.db.collection(CREDITS).doc(credit.id), { lastPaidPeriod:period, lastPaidAt:paidAt, updatedAt:paidAt }, { merge:true });
      await batch.commit();
      credit.lastPaidPeriod = period;
      credit.lastPaidAt = paidAt;
      paymentRecords = [{ id:paymentId, creditId:credit.id, name:credit.name, amount:Number(credit.amount) || 0, period, paidAt, observation }, ...paymentRecords.filter(payment => payment.id !== paymentId)];
      closePaymentModal();
      lastReadAt = Date.now();
      renderModule();
      renderReminderBar();
      toast(`${credit.name} quedó registrado como pagado este mes.`);
    } catch (error) {
      console.error('[CRÉDITOS] No se pudo registrar el pago:', error);
      toast('No se pudo registrar el pago. Inténtalo de nuevo.', 'error');
    } finally { submit.disabled = false; }
  }

  async function deleteCredit(id) {
    if (!currentUserCanManage()) return;
    const credit = creditRecords.find(item => item.id === id);
    if (!credit) return;
    const confirmed = await window.app?.showSystemConfirm?.(`¿Eliminar el crédito “${credit.name}”? Los pagos guardados en el historial se conservarán.`, { title:'Eliminar crédito', confirmText:'Eliminar crédito', cancelText:'Cancelar', icon:'trash' });
    if (!confirmed) return;
    try {
      await window.db.collection(CREDITS).doc(id).delete();
      creditRecords = creditRecords.filter(item => item.id !== id);
      renderModule();
      renderReminderBar();
      toast('Crédito eliminado. El historial de pagos se conservó.');
    } catch (error) {
      console.error('[CRÉDITOS] No se pudo eliminar:', error);
      toast('No se pudo eliminar el crédito.', 'error');
    }
  }

  async function handleModuleClick(event) {
    const target = event.target;
    if (target.closest('[data-credits-close]')) { closeModule(); return; }
    if (target.closest('[data-editor-close]')) { closeEditor(); return; }
    if (target.closest('[data-payment-close]')) { closePaymentModal(); return; }
    if (target.closest('[data-credits-new]')) { openEditor(); return; }
    const edit = target.closest('[data-credit-edit]'); if (edit) { openEditor(edit.dataset.creditEdit); return; }
    const remove = target.closest('[data-credit-delete]'); if (remove) { await deleteCredit(remove.dataset.creditDelete); return; }
    const pay = target.closest('[data-credit-pay]'); if (pay) { openPaymentForm(pay.dataset.creditPay); return; }
    const tab = target.closest('[data-credits-tab]');
    if (tab) {
      activeTab = tab.dataset.creditsTab;
      renderModule();
      if (activeTab === 'history') readHistory();
      return;
    }
    if (target.closest('[data-credits-refresh]')) {
      await readCredits();
      if (activeTab === 'history') await readHistory();
    }
  }

  function handleEscape(event) {
    if (event.key !== 'Escape' || !isOpen) return;
    if (!document.querySelector('[data-credits-payment-modal][hidden]')) { closePaymentModal(); return; }
    if (!document.querySelector('[data-credits-editor][hidden]')) { closeEditor(); return; }
    closeModule();
  }

  function syncRoleVisibility() {
    const admin = roleIsAdmin() && !document.getElementById('view-dashboard')?.classList.contains('hidden');
    const entry = document.getElementById('admin-finance-entry');
    const bar = document.getElementById('credits-reminder-bar');
    if (entry) entry.hidden = !admin;
    // Mantener la alerta oculta mientras se valida el estado real de los pagos.
    if (bar) bar.hidden = true;
    if (!admin) {
      dataLoadedForSession = '';
      window.clearTimeout(reminderRefreshTimer);
      reminderRefreshTimer = 0;
      if (isOpen) closeModule();
      return;
    }
    if (!reminderRefreshTimer) scheduleReminderRefresh();
    const sessionId = String(window.app?.currentUser?.authSessionId || 'admin');
    if (dataLoadedForSession !== sessionId) {
      dataLoadedForSession = sessionId;
      readCredits();
    } else renderReminderBar();
  }

  function install() {
    if (!ensureUi()) return false;
    const dashboard = document.getElementById('view-dashboard');
    const login = document.getElementById('view-login');
    const observer = new MutationObserver(syncRoleVisibility);
    observer.observe(dashboard, { attributes:true, attributeFilter:['class'] });
    observer.observe(login, { attributes:true, attributeFilter:['class'] });
    const roleBadge = document.getElementById('header-role-badge');
    if (roleBadge) observer.observe(roleBadge, { childList:true, characterData:true, subtree:true });
    syncRoleVisibility();
    if (window.lucide) window.lucide.createIcons();
    return true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
