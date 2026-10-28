(function () {
  if (typeof PortonProApp === 'undefined' || !PortonProApp.prototype) return;
  const proto = PortonProApp.prototype;

  function activeAdminRecord(app) {
    const records = app.presenceRecords || {};
    if (app.currentUser?.role === 'admin') {
      return records[String(app.currentUser.username || '').toLowerCase()] || {};
    }
    return Object.values(records).find(record => String(record?.role || '').toLowerCase() === 'admin') || {};
  }

  function refreshAnnouncement(app) {
    const banner = document.getElementById('dashboard-banner');
    if (!banner || !app.currentUser) return;
    const text = String(activeAdminRecord(app).announcementMessage || '').trim();
    let display = document.getElementById('dashboard-announcement-display');
    if (!text) { display?.remove(); return; }
    if (!display || !banner.contains(display)) {
      display = document.createElement('div');
      display.id = 'dashboard-announcement-display';
      display.className = 'dashboard-announcement-display';
      const track = document.createElement('div');
      track.className = 'dashboard-announcement-track';
      const label = document.createElement('span');
      label.className = 'dashboard-announcement-label';
      label.textContent = 'Aviso';
      const message = document.createElement('span');
      message.className = 'dashboard-announcement-text';
      track.append(label, message);
      display.appendChild(track);
      const content = banner.querySelector(':scope > div:first-child') || banner;
      content.appendChild(display);
    }
    const message = display.querySelector('.dashboard-announcement-text');
    if (message && message.textContent !== text) message.textContent = text;
    display.setAttribute('aria-label', 'Aviso para todo el equipo: ' + text);
  }

  function mountAnnouncementSettings(app) {
    const panel = document.getElementById('settings-category-appearance');
    if (!panel || panel.querySelector('#settings-team-announcement')) return;
    const card = document.createElement('section');
    card.id = 'settings-team-announcement';
    card.className = 'settings-announcement-card';
    card.innerHTML = '<div class="settings-announcement-heading"><span class="settings-announcement-icon" aria-hidden="true">✦</span><div><b>Aviso para todo el equipo</b><p>El mensaje se desplaza en la pantalla de administradores y trabajadores hasta que lo quites.</p></div></div><label class="settings-announcement-label" for="settings-announcement-input">Mensaje</label><textarea id="settings-announcement-input" maxlength="180" rows="2" placeholder="Ej.: Feliz cumpleaños, Lisbeth. ¡Muchos éxitos en tu día!" aria-describedby="settings-announcement-hint"></textarea><div class="settings-announcement-actions"><small id="settings-announcement-hint">Máximo 180 caracteres · se conserva hasta que lo borres</small><div><button type="button" id="settings-announcement-clear" class="settings-announcement-clear">Quitar aviso</button><button type="button" id="settings-announcement-save" class="settings-announcement-save">Guardar aviso</button></div></div>';
    panel.appendChild(card);
    const input = card.querySelector('#settings-announcement-input');
    const save = async value => {
      if (app.currentUser?.role !== 'admin') return app.showToast('Solo el administrador puede cambiar este aviso.', 'error');
      if (!window.db || !navigator.onLine) return app.showToast('Conéctate para guardar el aviso para todo el equipo.', 'error');
      const username = String(app.currentUser.username || '').toLowerCase();
      if (!username) return app.showToast('No se encontró la cuenta administradora.', 'error');
      const previous = activeAdminRecord(app);
      const message = String(value || '').trim().slice(0, 180);
      app.presenceRecords = app.presenceRecords || {};
      app.presenceRecords[username] = { ...previous, role: 'admin', announcementMessage: message };
      refreshAnnouncement(app);
      const button = card.querySelector('#settings-announcement-save');
      if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
      try {
        await db.collection('presencia').doc(username).set({ announcementMessage: message, announcementUpdatedAt: Date.now() }, { merge: true });
        if (input) input.value = message;
        app.showToast(message ? 'Aviso publicado para todo el equipo.' : 'Aviso quitado para todo el equipo.', 'success');
      } catch (error) {
        app.presenceRecords[username] = previous;
        refreshAnnouncement(app);
        console.error('[AVISO] No se pudo guardar el aviso compartido:', error);
        app.showToast('No se pudo guardar el aviso. Revisa los permisos y la conexión.', 'error');
      } finally {
        if (button) { button.disabled = false; button.textContent = 'Guardar aviso'; }
      }
    };
    card.querySelector('#settings-announcement-save').addEventListener('click', () => save(input?.value));
    card.querySelector('#settings-announcement-clear').addEventListener('click', () => { if (input) input.value = ''; save(''); });
    const existing = String(activeAdminRecord(app).announcementMessage || '');
    if (input) input.value = existing;
  }

  if (typeof proto.ensureSettingsWorkspace === 'function') {
    const originalEnsure = proto.ensureSettingsWorkspace;
    proto.ensureSettingsWorkspace = function (...args) {
      const result = originalEnsure.apply(this, args);
      mountAnnouncementSettings(this);
      return result;
    };
  }
  if (typeof proto.openSettingsModal === 'function') {
    const originalOpenSettings = proto.openSettingsModal;
    proto.openSettingsModal = function (...args) {
      const result = originalOpenSettings.apply(this, args);
      mountAnnouncementSettings(this);
      const input = document.getElementById('settings-announcement-input');
      if (input) input.value = String(activeAdminRecord(this).announcementMessage || '');
      return result;
    };
  }
  if (typeof proto.renderTasks === 'function') {
    const originalRenderTasks = proto.renderTasks;
    proto.renderTasks = function (...args) {
      const result = originalRenderTasks.apply(this, args);
      refreshAnnouncement(this);
      return result;
    };
  }
  if (typeof proto.openReactionPicker === 'function') {
    proto.openReactionPicker = function (event, messageId, threadId) {
      this.closeReactionPicker?.();
      const picker = document.createElement('div');
      picker.className = 'chat-reaction-picker';
      const choices = ['❤️', '😂', '👍', '😮', '😢', '🙏'];
      const thread = threadId || this.getChatThreadId?.() || '';
      picker.innerHTML = choices.map(emoji => '<button type="button" data-message-id="' + this.escapeHtml(messageId) + '" data-thread-id="' + this.escapeHtml(thread) + '" data-chat-reaction-emoji="' + this.escapeHtml(emoji) + '" aria-label="Reaccionar ' + this.escapeHtml(emoji) + '">' + emoji + '</button>').join('');
      document.body.appendChild(picker);
      const viewport = window.visualViewport;
      const topEdge = Math.max(0, Number(viewport?.offsetTop || 0));
      const bottomEdge = Math.min(window.innerHeight, topEdge + Number(viewport?.height || window.innerHeight));
      const row = [...document.querySelectorAll('.chat-message-row[data-chat-message-id]')].find(item => item.dataset.chatMessageId === String(messageId) && (!thread || item.dataset.chatThreadId === String(thread)));
      const rect = row?.getBoundingClientRect();
      const width = picker.offsetWidth || 248;
      const height = picker.offsetHeight || 48;
      const x = Number(event?.clientX || (rect ? rect.left + rect.width / 2 : window.innerWidth / 2));
      let y = Number(event?.clientY || (rect ? rect.top : bottomEdge - 80));
      let left = Math.max(8, Math.min(x - width / 2, window.innerWidth - width - 8));
      let top = y - height - 8;
      if (top < topEdge + 8 && rect) top = rect.bottom + 8;
      top = Math.max(topEdge + 6, Math.min(top, bottomEdge - height - 6));
      picker.style.left = left + 'px';
      picker.style.top = top + 'px';
      picker.style.maxWidth = 'calc(100vw - 16px)';
      picker.style.touchAction = 'manipulation';
    };
  }
})();
