
(function () {
  if (typeof PortonProApp === 'undefined' || PortonProApp.prototype.__settingsWorkspaceInstalled) return;
  PortonProApp.prototype.__settingsWorkspaceInstalled = true;

  PortonProApp.prototype.ensureSettingsWorkspace = function () {
    if (document.getElementById('settings-workspace')) return;
    const modal = document.getElementById('modal-settings');
    const body = modal?.querySelector(':scope > div > .p-4');
    if (!modal || !body) return;
    const nodes = {
      appearance: document.getElementById('settings-theme-section'),
      administrators: document.getElementById('settings-admin-identities-section'),
      orders: document.getElementById('settings-order-sequence-section'),
      notifications: document.getElementById('pref-popup')?.closest('.bg-slate-50'),
      account: document.getElementById('settings-my-photo-preview')?.closest('.bg-slate-50'),
      security: document.getElementById('set-own-current-pass')?.closest('.bg-slate-50'),
      team: document.getElementById('settings-admin-users-section')
    };
    const soundLabel = document.getElementById('pref-sound')?.closest('label');
    const shell = document.createElement('div');
    shell.id = 'settings-workspace';
    shell.className = 'settings-workspace';
    const adminQuick = document.createElement('section');
    adminQuick.id = 'settings-admin-quick';
    adminQuick.className = 'settings-admin-quick';
    adminQuick.innerHTML = '<div class="settings-admin-quick-heading"><span class="settings-admin-icon">♙</span><div><h4>Administradores</h4><p>Cambio rápido de identidad. Ambas identidades comparten esta cuenta y sus permisos.</p></div><span class="settings-active-admin">ACTIVO</span></div>';
    if (nodes.administrators) adminQuick.appendChild(nodes.administrators);

    const nav = document.createElement('nav');
    nav.className = 'settings-category-nav';
    nav.setAttribute('aria-label', 'Categorías de configuración');
    const content = document.createElement('div');
    content.id = 'settings-category-content';
    content.className = 'settings-category-content';
    const defs = [
      ['account','Cuenta','user-round','Perfil y datos de acceso.',false],
      ['employees','Empleados','users-round','Crear y editar trabajadores.',true],
      ['sound','Sonidos','volume-2','Avisos de audio y preferencias.',false],
      ['notifications','Notificaciones','bell','Alertas y contadores.',false],
      ['appearance','Apariencia','palette','Temas visuales del sistema.',true],
      ['orders','Órdenes de trabajo','clipboard-list','Consecutivos y numeración.',true],
      ['security','Seguridad','shield-check','Contraseña y acceso.',false],
      ['chat','Chat y mensajería','messages-square','Preferencias de conversación.',false],
      ['application','Aplicación','smartphone','Estado y mantenimiento.',false],
      ['system','Sistema','activity','Resumen operativo.',true],
      ['backups','Respaldos','database-backup','Copias y restauración.',true]
    ];
    for (const [id, label, icon, description, adminOnly] of defs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-category-button';
      button.dataset.settingsCategory = id;
      if (adminOnly) button.dataset.adminOnly = 'true';
      button.innerHTML = '<i data-lucide="' + icon + '"></i><span><b>' + label + '</b><small>' + description + '</small></span>';
      nav.appendChild(button);
      const panel = document.createElement('section');
      panel.id = 'settings-category-' + id;
      panel.className = 'settings-category-panel hidden';
      panel.innerHTML = '<div class="settings-category-title"><div><h4>' + label + '</h4><p>' + description + '</p></div></div>';
      content.appendChild(panel);
    }

    const accountPanel = content.querySelector('#settings-category-account');
    const accountSummary = document.createElement('div');
    accountSummary.className = 'settings-account-summary';
    accountSummary.innerHTML = '<div class="settings-account-avatar"><img id="settings-account-summary-photo" class="hidden" alt="Foto del perfil"><i id="settings-account-summary-fallback" data-lucide="user-round"></i></div><div><b id="settings-account-name">Usuario</b><span id="settings-account-username">Cuenta</span></div><span id="settings-account-role"></span>';
    accountPanel.appendChild(accountSummary);
    if (nodes.account) accountPanel.appendChild(nodes.account);

    const soundPanel = content.querySelector('#settings-category-sound');
    if (soundLabel) {
      const soundCard = document.createElement('div');
      soundCard.className = 'settings-option-card';
      soundCard.innerHTML = '<div><b>Sonido general</b><p>Controla los avisos sonoros de mensajes, órdenes y conexiones.</p></div>';
      soundCard.appendChild(soundLabel);
      soundPanel.appendChild(soundCard);
      const soundFuture = document.createElement('div');
      soundFuture.className = 'settings-future-note';
      soundFuture.textContent = 'Los controles individuales de tipo de sonido y volumen se podrán configurar aquí en una mejora futura.';
      soundPanel.appendChild(soundFuture);
    }

    const notificationsPanel = content.querySelector('#settings-category-notifications');
    if (nodes.notifications) notificationsPanel.appendChild(nodes.notifications);
    const notificationFuture = document.createElement('div');
    notificationFuture.className = 'settings-future-note';
    notificationFuture.textContent = 'Las notificaciones push y alertas por vencimiento aún no están habilitadas en esta versión.';
    notificationsPanel.appendChild(notificationFuture);

    const appearancePanel = content.querySelector('#settings-category-appearance');
    if (nodes.appearance) appearancePanel.appendChild(nodes.appearance);
    const appearanceFuture = document.createElement('div');
    appearanceFuture.className = 'settings-future-note';
    appearanceFuture.textContent = 'Los temas estacionales se conservan y pueden combinarse con el modo oscuro del encabezado.';
    appearancePanel.appendChild(appearanceFuture);

    const ordersPanel = content.querySelector('#settings-category-orders');
    if (nodes.orders) ordersPanel.appendChild(nodes.orders);
    const orderFuture = document.createElement('div');
    orderFuture.className = 'settings-future-note';
    orderFuture.textContent = 'La numeración actual utiliza el prefijo ORD-. La edición de prefijos personalizados queda pendiente para una futura mejora.';
    ordersPanel.appendChild(orderFuture);

    const securityPanel = content.querySelector('#settings-category-security');
    if (nodes.security) securityPanel.appendChild(nodes.security);
    const securityFuture = document.createElement('div');
    securityFuture.className = 'settings-future-note';
    securityFuture.textContent = 'El cierre remoto de sesiones, historial de accesos y bloqueo por inactividad no están habilitados todavía.';
    securityPanel.appendChild(securityFuture);
    const employeesShortcut = document.createElement('button');
    employeesShortcut.type = 'button';
    employeesShortcut.dataset.adminOnly = 'true';
    employeesShortcut.className = 'settings-employees-shortcut';
    employeesShortcut.innerHTML = '<i data-lucide="users-round"></i><span><b>Administrar trabajadores</b><small>Crear cuentas, editar datos, cédulas y especialidades.</small></span><span aria-hidden="true">›</span>';
    employeesShortcut.addEventListener('click', () => this.showSettingsCategory('employees'));
    securityPanel.appendChild(employeesShortcut);
    const employeesPanel = content.querySelector('#settings-category-employees');
    if (nodes.team) {
      const teamHeading = nodes.team.querySelector('h4 span');
      if (teamHeading) teamHeading.textContent = 'Administrar trabajadores';
      employeesPanel.appendChild(nodes.team);
    }
    const chatPanel = content.querySelector('#settings-category-chat');
    const chatPreferenceControls = document.createElement('div');
    chatPreferenceControls.className = 'settings-chat-preferences';
    chatPreferenceControls.innerHTML = '<h5>Preferencias rápidas</h5><div class="settings-chat-preferences-grid"></div>';
    const chatPreferenceGrid = chatPreferenceControls.querySelector('.settings-chat-preferences-grid');
    [['sound','pref-sound'],['popup','pref-popup'],['chatBadge','pref-chat-badge']].forEach(([key, sourceId]) => {
      const source = document.getElementById(sourceId)?.closest('label');
      if (!source) return;
      const control = source.cloneNode(true);
      const input = control.querySelector('input');
      input.id = 'chat-pref-' + key;
      input.dataset.chatPreference = key;
      input.setAttribute('onchange', `app.updatePref('${key}', this.checked)`);
      chatPreferenceGrid.appendChild(control);
    });
    chatPanel.appendChild(chatPreferenceControls);
    chatPanel.insertAdjacentHTML('beforeend', '<div class="settings-info-card settings-info-wide"><b>Funciones disponibles</b><p>Conversaciones privadas, estados de entrega y lectura, reacciones con emojis y contador de mensajes por conversación.</p><small id="settings-chat-storage-note">La carga de adjuntos depende de Firebase Storage.</small></div>');
    const applicationPanel = content.querySelector('#settings-category-application');
    applicationPanel.insertAdjacentHTML('beforeend', '<div class="settings-info-grid"><div class="settings-info-card"><span>Conexión del dispositivo</span><b id="settings-app-network">—</b></div><div class="settings-info-card"><span>Firestore</span><b id="settings-app-firestore">—</b></div><div class="settings-info-card"><span>Firebase Storage</span><b id="settings-app-storage">—</b></div><div class="settings-info-card"><span>Aplicación</span><b>HTML independiente</b></div></div><div class="settings-info-card settings-info-wide"><b>Mantenimiento local</b><p>Elimina únicamente la caché web temporal de este sitio. No borra la sesión, las órdenes ni los datos guardados en Firestore.</p><button type="button" class="settings-action-button" onclick="app.clearTemporaryAppCache()">Limpiar caché temporal</button></div>');

    const systemPanel = content.querySelector('#settings-category-system');
    systemPanel.insertAdjacentHTML('beforeend', '<div class="settings-info-grid"><div class="settings-info-card"><span>Órdenes cargadas</span><b id="settings-system-orders">0</b></div><div class="settings-info-card"><span>Órdenes activas</span><b id="settings-system-active-orders">0</b></div><div class="settings-info-card"><span>Completadas</span><b id="settings-system-completed">0</b></div><div class="settings-info-card"><span>Archivadas</span><b id="settings-system-archived">0</b></div><div class="settings-info-card"><span>Trabajadores</span><b id="settings-system-workers">0</b></div><div class="settings-info-card"><span>Conversaciones conocidas</span><b id="settings-system-chats">0</b></div><div class="settings-info-card"><span>Evidencias y facturas asociadas</span><b id="settings-system-files">0</b></div><div class="settings-info-card"><span>Sincronización de red</span><b id="settings-system-sync">—</b></div></div><p class="settings-info-footnote">Los valores reflejan los datos cargados en esta sesión; los archivos externos no se descargan para calcular espacio usado.</p>');

    const backupsPanel = content.querySelector('#settings-category-backups');
    backupsPanel.insertAdjacentHTML('beforeend', '<div class="settings-info-card settings-info-wide"><b>Respaldo local</b><p>Descarga un archivo JSON con las órdenes cargadas, perfiles básicos de trabajadores (sin contraseñas), preferencias, tema y consecutivo actual.</p><button type="button" class="settings-action-button" onclick="app.downloadLocalSettingsBackup()">Descargar respaldo JSON</button><small>Es una copia de los datos disponibles en esta sesión. No incluye el historial completo del chat ni los archivos binarios y no reemplaza una copia integral de Firestore.</small></div><div class="settings-info-card settings-info-wide"><b>Restauración</b><p>La restauración automática aún no está habilitada para evitar sobrescribir información de producción por accidente.</p><span class="settings-status-pill">Preparada para una mejora futura</span></div>');
    const layout = document.createElement('div');
    layout.className = 'settings-workspace-layout';
    layout.append(nav, content);
    shell.append(adminQuick, layout);
    body.replaceChildren(shell);
    body.classList.remove('p-4','space-y-3.5','overflow-y-auto');
    body.classList.add('settings-workspace-body');
    const modalCard = modal.querySelector(':scope > div');
    modalCard?.classList.remove('max-w-lg');
    modalCard?.classList.add('max-w-5xl');
    nav.addEventListener('click', event => {
      const button = event.target.closest('[data-settings-category]');
      if (!button || button.disabled) return;
      this.showSettingsCategory(button.dataset.settingsCategory);
    });
  };

  PortonProApp.prototype.refreshSettingsOverview = function () {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    [['sound',this.prefs?.sound],['popup',this.prefs?.popup],['chatBadge',this.prefs?.chatBadge]].forEach(([key,value]) => { const input = document.getElementById('chat-pref-' + key); if (input) input.checked = Boolean(value); });
    set('settings-chat-sound', yesNo(this.prefs?.sound));
    set('settings-chat-popup', yesNo(this.prefs?.popup));
    set('settings-chat-badge', yesNo(this.prefs?.chatBadge));
    set('settings-chat-storage-note', typeof window.firebase?.storage === 'function' ? 'Firebase Storage SDK cargado; la disponibilidad del proyecto se confirma al subir un archivo.' : 'Firebase Storage SDK no está cargado en esta página.');
    set('settings-app-network', navigator.onLine ? 'Con conexión' : 'Sin conexión');
    set('settings-app-firestore', window.db ? 'Cliente inicializado; conexión remota no comprobada' : 'Cliente no disponible');
    set('settings-app-storage', typeof window.firebase?.storage === 'function' ? 'SDK disponible; bucket no verificado' : 'SDK no disponible');

    const tasks = Array.isArray(this.tasks) ? this.tasks : [];
    const archived = tasks.filter(task => !!task?.archivedAt).length;
    const completed = tasks.filter(task => task?.status === 'REALIZADA' && !task?.archivedAt).length;
    const active = tasks.filter(task => !task?.archivedAt && task?.status !== 'REALIZADA' && task?.status !== 'NO_REALIZADA').length;
    const attachedFiles = tasks.reduce((sum, task) => {
      const evidence = Array.isArray(task?.evidence) ? task.evidence.length : 0;
      const invoice = task?.invoice?.url || task?.invoiceUrl || task?.facturaUrl ? 1 : 0;
      return sum + evidence + invoice;
    }, 0);
    set('settings-system-orders', String(tasks.length));
    set('settings-system-active-orders', String(active));
    set('settings-system-completed', String(completed));
    set('settings-system-archived', String(archived));
    set('settings-system-workers', String(Array.isArray(this.workers) ? this.workers.length : 0));
    set('settings-system-chats', String(Object.keys(this.conversations || {}).length));
    set('settings-system-files', String(attachedFiles));
    set('settings-system-sync', navigator.onLine ? 'Dispositivo en línea' : 'Dispositivo sin conexión');
  };

  PortonProApp.prototype.clearTemporaryAppCache = async function () {
    if (!('caches' in window)) return this.showToast('Este navegador no ofrece caché web borrable desde la aplicación.', 'info');
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      this.showToast(cacheNames.length ? 'Caché temporal eliminada. La sesión y los datos siguen intactos.' : 'No había caché temporal para limpiar.', 'success');
    } catch (error) {
      console.warn('[SETTINGS] No se pudo limpiar la caché web', error);
      this.showToast('No se pudo limpiar la caché temporal de este navegador.', 'error');
    }
  };

  PortonProApp.prototype.downloadLocalSettingsBackup = function () {
    if (this.currentUser?.role !== 'admin') return this.showToast('Solo el administrador puede descargar respaldos.', 'error');
    const workers = (Array.isArray(this.workers) ? this.workers : []).map(worker => ({
      id: worker.id, fullName: worker.fullName || '', username: worker.username || '',
      phone: worker.phone || '', nationalId: worker.nationalId || '', specialty: worker.specialty || '',
      role: worker.role || 'worker', active: worker.active !== false, photo: worker.photo || ''
    }));
    const backup = {
      product: 'ServiPortones', kind: 'respaldo-local-de-datos-cargados', generatedAt: new Date().toISOString(),
      scope: 'Datos disponibles en esta sesión. No contiene historial completo de chats ni archivos binarios.',
      orders: Array.isArray(this.tasks) ? this.tasks : [], workers,
      preferences: this.prefs || {}, seasonalTheme: this.seasonalTheme || 'classic',
      nextOrderNumber: this.orderSequenceNext || null
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `serviportones-respaldo-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.showToast('Respaldo local descargado.', 'success');
  };
  PortonProApp.prototype.showSettingsCategory = function (category) {
    const isAdmin = this.currentUser?.role === 'admin';
    const button = document.querySelector('[data-settings-category="' + category + '"]');
    if (!button || (button.dataset.adminOnly === 'true' && !isAdmin)) category = 'account';
    this.settingsActiveCategory = category;
    document.querySelectorAll('#settings-workspace [data-settings-category]').forEach(item => {
      const active = item.dataset.settingsCategory === category;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current','page'); else item.removeAttribute('aria-current');
    });
    document.querySelectorAll('#settings-category-content .settings-category-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== 'settings-category-' + category));
    this.refreshSettingsOverview();
    if (window.lucide) lucide.createIcons();
  };

  const originalOpen = PortonProApp.prototype.openSettingsModal;
  const originalClose = PortonProApp.prototype.closeSettingsModal;
  PortonProApp.prototype.openSettingsModal = function () {
    this.ensureSettingsWorkspace();
    if (!this.settingsScrollLockState) {
      this.settingsScrollLockState = { bodyOverflow: document.body.style.overflow, rootOverflow: document.documentElement.style.overflow };
      document.body.classList.add('settings-modal-open');
      document.documentElement.classList.add('settings-modal-open');
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    originalOpen.call(this);
    const isAdmin = this.currentUser?.role === 'admin';
    document.getElementById('settings-admin-quick')?.classList.toggle('hidden', !isAdmin);
    document.querySelectorAll('#settings-workspace [data-admin-only="true"]').forEach(button => button.classList.toggle('hidden', !isAdmin));
    const name = this.getCurrentDisplayName?.() || this.currentUser?.fullName || this.currentUser?.username || 'Usuario';
    document.getElementById('settings-account-name').textContent = name;
    document.getElementById('settings-account-username').textContent = '@' + (this.currentUser?.username || 'cuenta');
    document.getElementById('settings-account-role').textContent = isAdmin ? 'Administrador' : 'Trabajador';
    this.showSettingsCategory(this.settingsActiveCategory || 'account');
  };

  PortonProApp.prototype.closeSettingsModal = function () {
    originalClose.call(this);
    if (!this.settingsScrollLockState) return;
    document.body.style.overflow = this.settingsScrollLockState.bodyOverflow;
    document.documentElement.style.overflow = this.settingsScrollLockState.rootOverflow;
    document.body.classList.remove('settings-modal-open');
    document.documentElement.classList.remove('settings-modal-open');
    this.settingsScrollLockState = null;
  };})();
