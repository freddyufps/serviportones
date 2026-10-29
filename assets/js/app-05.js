
    const SafeStorage = {
      memStore: {},
      setItem(key, value) {
        try { localStorage.setItem(key, value); }
        catch (e) {
          try { sessionStorage.setItem(key, value); }
          catch (e2) { this.memStore[key] = String(value); }
        }
      },
      getItem(key) {
        try {
          const item = localStorage.getItem(key);
          if (item !== null) return item;
        } catch (e) {}
        try {
          const itemSession = sessionStorage.getItem(key);
          if (itemSession !== null) return itemSession;
        } catch (e2) {}
        return this.memStore[key] || null;
      },
      removeItem(key) {
        try { localStorage.removeItem(key); } catch (e) {}
        try { sessionStorage.removeItem(key); } catch (e2) {}
        delete this.memStore[key];
      }
    };

    const SoundEngine = {
      ctx: null,
      pendingWorkerConnectedSound: false,
      async unlock() {
        try {
          const ctx = this.getCtx();
          if (ctx && ctx.state === 'suspended') await ctx.resume();
          console.info('[ORDER] Audio habilitado por interacción', { state: ctx?.state || 'unavailable' });
          if (ctx?.state === 'running' && this.pendingWorkerConnectedSound) {
            this.pendingWorkerConnectedSound = false;
            this.playWorkerConnectedSound();
          }
        } catch (error) {
          console.warn('[ORDER] No se pudo habilitar el audio:', error);
        }
      },
      getCtx() {
        if (!this.ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        return this.ctx;
      },

      async playMessageSound() {
        try {
          const ctx = this.getCtx();
          if (!ctx) return;
          if (ctx.state === 'suspended') await ctx.resume();
          const now = ctx.currentTime;

          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc2.type = 'sine';

          osc1.frequency.setValueAtTime(587.33, now);
          osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);

          osc2.frequency.setValueAtTime(880, now);
          osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.5);
          osc2.stop(now + 0.5);
        } catch (e) {
          console.warn("Audio Context bloqueado:", e);
        }
      },

      async playWorkerConnectedSound() {
        try {
          const ctx = this.getCtx();
          if (!ctx) return;
          if (ctx.state === 'suspended') await ctx.resume();
          if (ctx.state !== 'running') {
            this.pendingWorkerConnectedSound = true;
            console.info('[PRESENCE] Sonido de conexión en espera de interacción para habilitar audio');
            return;
          }
          const now = ctx.currentTime;
          console.info('[PRESENCE] Reproduciendo sonido de conexión de trabajador');
          [783.99, 987.77, 1318.51].forEach((frequency, index) => {
            const start = now + index * 0.14;
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, start);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.linearRampToValueAtTime(0.24, start + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(start);
            oscillator.stop(start + 0.44);
          });
        } catch (error) {
          console.warn('[PRESENCE] No se pudo reproducir el sonido de conexión:', error);
        }
      },
      async playOrderCompletedSound() {
        try {
          const ctx = this.getCtx();
          if (!ctx) { console.warn('[ORDER] Web Audio no está disponible'); return; }
          if (ctx.state === 'suspended') await ctx.resume();
          if (ctx.state !== 'running') { console.warn('[ORDER] AudioContext sigue suspendido; aviso no reproducido', { state: ctx.state }); return; }
          const now = ctx.currentTime;
          console.info('[ORDER] Reproduciendo sonido de orden completada');
          [659.25, 783.99, 1046.5].forEach((frequency, index) => {
            const start = now + index * 0.13;
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, start);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.linearRampToValueAtTime(0.42, start + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(start);
            oscillator.stop(start + 0.4);
          });
        } catch (error) {
          console.warn('[ORDER] No se pudo reproducir el sonido de orden completada:', error);
        }
      },
      playOrderSound() {
        try {
          const ctx = this.getCtx();
          if (!ctx) return;
          const now = ctx.currentTime;

          [0, 0.14].forEach((delay, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';

            const freq = idx === 0 ? 523.25 : 783.99;
            osc.frequency.setValueAtTime(freq, now + delay);

            gain.gain.setValueAtTime(0.001, now + delay);
            gain.gain.linearRampToValueAtTime(0.3, now + delay + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.45);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + delay);
            osc.stop(now + delay + 0.5);
          });
        } catch (e) {
          console.warn("Audio Context bloqueado:", e);
        }
      },

      playGeneralNotificationSound() {
        try {
          const ctx = this.getCtx();
          if (!ctx) return;
          const now = ctx.currentTime;

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';

          osc.frequency.setValueAtTime(659.25, now);
          osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.18);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.45);
        } catch (e) {
          console.warn("Audio Context bloqueado:", e);
        }
      },

      async playCallAlertSound() {
        try {
          const ctx = this.getCtx();
          if (!ctx) return;
          if (ctx.state === 'suspended') await ctx.resume();
          const now = ctx.currentTime;

          [0, 0.15, 0.3].forEach(delay => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';

            osc.frequency.setValueAtTime(750, now + delay);
            osc.frequency.linearRampToValueAtTime(1050, now + delay + 0.09);

            gain.gain.setValueAtTime(0.001, now + delay);
            gain.gain.linearRampToValueAtTime(0.95, now + delay + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.17);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + delay);
            osc.stop(now + delay + 0.18);
          });
        } catch (e) {
          console.warn("Audio Context bloqueado:", e);
        }
      }
    };

    const unlockNotificationAudio = () => {
      const context = SoundEngine.getCtx();
      if (context && context.state === 'running') {
        window.removeEventListener('pointerdown', unlockNotificationAudio);
        window.removeEventListener('touchstart', unlockNotificationAudio);
        window.removeEventListener('click', unlockNotificationAudio);
      }
    };
    window.addEventListener('pointerdown', unlockNotificationAudio, { passive: true });
    window.addEventListener('touchstart', unlockNotificationAudio, { passive: true });
    window.addEventListener('click', unlockNotificationAudio, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && SoundEngine.ctx?.state === 'suspended') SoundEngine.ctx.resume().catch(error => console.warn('No se pudo reactivar el sonido:', error));
    });

    const INITIAL_TASKS = [
      {
        id: 'ORD-101',
        client: 'Condominio Campestre El Peñón',
        phone: '315 889 4521',
        address: 'Km 3 Vía Silvania, Portería Principal',
        serviceType: 'Mantenimiento Preventivo General',
        equipment: 'Portón Corredizo BFT ICARO 2000',
        assignedTo: 'Jeampaul',
        priority: 'ALTA',
        date: '2026-10-25',
        instructions: 'Revisión periódica. Verificar tensión de cremallera y finales de carrera.',
        status: 'PENDIENTE',
        checklist: [],
        observations: '',
        evidence: [],
        completedAt: null
      }
    ];

    class PortonProApp {
      constructor() {
        this.currentUser = null;
        this.users = [];
        this.workers = [];
        this.tasks = INITIAL_TASKS;
        this.orderSequenceNext = 101;
        this.taskClientMode = 'new';
        this.showArchivedTasks = false;
        this.invoiceUploadTaskId = null;
        this.notifications = [];
        this.selectedTask = null;
        this.activeReportStatus = null;
        this.heartbeatTimer = null;
        this.presenceRecords = {};
        this.presenceRefreshTimer = null;
        this.adminIdentityNames = ['Lisbeth', 'Gabriela'];
        this.adminIdentityPhotos = {};
        this.activeAdminName = '';
        try { const cache = JSON.parse(SafeStorage.getItem('portonpro_admin_identity_cache_v1') || '{}'); if (Array.isArray(cache.names) && cache.names.length === 2) this.adminIdentityNames = cache.names; if (cache.photos && typeof cache.photos === 'object') this.adminIdentityPhotos = { ...cache.photos }; if (cache.activeName) this.activeAdminName = String(cache.activeName); } catch (_) {}
        this.adminIdentityEditingIndex = null;

        this.adminIdentityPhotoDraft = null;
        this.currentReportEvidence = [];
        this.pendingEvidenceReads = [];
        this.removedEvidenceStoragePaths = [];
        this.checklistTemplate = this.readStoredList('portonpro_checklist_template_v1', ['Engrase de cremallera', 'Fotocélulas', 'Calibración finales de carrera', 'Verificar batería de respaldo']);
        this.activeChecklistDraft = [];
        this.checklistDraftDirty = false;
        this.serviceTypeEditingIndex = null;
        this.serviceMenuOpenIndex = null;
        this.managedItemMode = null;
        this.managedItemIndex = null;
        this.serviceTypes = this.readStoredList('portonpro_service_types_v1', ['Mantenimiento Preventivo', 'Instalación', 'Reparación', 'Programación']);

        // Estado del Chat y Conversaciones
        this.chatMessages = [];
        this.activeChatWorker = 'Jeampaul';
        this.openChatTabs = [];
        this.chatConversationHtmlCache = {};
        this.chatScrollPositions = {};
        this.chatWasNearBottom = {};
        this.minimizedChatWindows = {};
        this.messengerDrafts = {};
        this.chatTypingByWorker = {};
        this.chatDockUnreadByWorker = new Set();
        this.chatUnsubscribe = null;
        this.chatThreadUnsubscribe = null;
        this.chatThreadsUnsubscribe = null;
        this.conversations = {};
        this.chatThreadSummaries = {};
        this.chatActivityRanks = {};
        this.chatActivitySequence = 0;
        this.workerUnreadCount = null;
        this.typingTimeout = null;
        this.showArchived = false;

        // Listeners Globales dedicados por técnico
        this.dedicatedWorkerUnsubscribes = {};

        // Estado del GPS
        this.gpsWatchId = null;
        this.gpsConnectedAt = null;
        this.isGpsSharing = false;
        this.adminMap = null;
        this.adminMapMarkers = {};
        this.gpsLocationsUnsubscribe = null;
        this.locationsData = {};

        // Estado WebRTC (Llamadas de Voz)
        this.peerConnection = null;
        this.localStream = null;
        this.callUnsubscribe = null;
        this.callSignalingUnsubscribes = [];
        this.pendingIceCandidates = [];
        this.currentCallData = null;
        this.callTimerInterval = null;
        this.callRingtoneInterval = null;
        this.callSeconds = 0;
        this.callIceCounters = { generated: 0, received: 0, added: 0 };
        this.isMuted = false;
        this.lastIncomingCallId = null;
        this.notifiedChatMessageIds = new Set();

        // Preferencias de Notificación
        this.prefs = {
          sound: true,
          popup: true,
          chatBadge: true,
        };

        this.processedEventIds = new Set();
        this.lastObservedTaskStatuses = null;
        this.isTasksInitialLoad = true;
        this.isNotifsInitialLoad = true;

        this.seasonalTheme = this.readSeasonalTheme();
        this.sharedSeasonalTheme = null;
        const syncMobileViewport = () => {
          const visualHeight = window.visualViewport?.height || window.innerHeight;
          document.documentElement.style.setProperty('--app-visual-viewport-height', `${visualHeight}px`);
          const keyboardOpen = window.matchMedia('(max-width: 640px)').matches && window.innerHeight - visualHeight > 120;
          document.body.classList.toggle('mobile-keyboard-open', keyboardOpen);
        };
        syncMobileViewport();
        window.visualViewport?.addEventListener('resize', syncMobileViewport, { passive: true });
        window.visualViewport?.addEventListener('scroll', syncMobileViewport, { passive: true });
        window.addEventListener('resize', syncMobileViewport, { passive: true });
        document.addEventListener('focusin', event => {
          if (!window.matchMedia('(max-width: 640px)').matches || !event.target.matches?.('input, textarea, select')) return;
          if (!event.target.closest('#modal-task-form, #modal-report')) return;
          window.setTimeout(() => event.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 180);
        });
        document.addEventListener('input', event => {
          if (event.target.id !== 'rep-observations' || !this.selectedTask) return;
          const card = [...document.querySelectorAll('.order-card[data-task-id]')].find(item => item.dataset.taskId === String(this.selectedTask.id));
          const preview = card?.querySelector('.order-observations-text');
          if (preview) preview.textContent = event.target.value.trim() || 'Pendiente de registrar.';
        });

        this.init();
      }

      loadPreferences() {
        const saved = SafeStorage.getItem('portonpro_preferences');
        if (saved) {
          try {
            this.prefs = { ...this.prefs, ...JSON.parse(saved) };
          } catch (e) {}
        }
        document.getElementById('pref-sound').checked = this.prefs.sound;
        document.getElementById('pref-popup').checked = this.prefs.popup;
        document.getElementById('pref-chat-badge').checked = this.prefs.chatBadge;
      }

      updatePref(key, value) {
        this.prefs[key] = value;
        const preferenceIds = { sound: ['pref-sound','chat-pref-sound'], popup: ['pref-popup','chat-pref-popup'], chatBadge: ['pref-chat-badge','chat-pref-chatBadge'] };
        (preferenceIds[key] || []).forEach(id => { const input = document.getElementById(id); if (input) input.checked = Boolean(value); });
        SafeStorage.setItem('portonpro_preferences', JSON.stringify(this.prefs));
        if (key === 'chatBadge') {
          if (this.currentUser?.role === 'admin') this.renderConversationsSidebar();
          else {
            const threadId = this.getCurrentDisplayName();
            const summary = this.chatThreadSummaries[threadId];
            const count = summary?.hasMessages ? summary.unreadCount : Number(this.workerUnreadCount || 0);
            this.updateChatLauncherUnread(value ? count : 0);
          }
        }
        this.showToast('Preferencia guardada', 'info');
      }

      showPopupNotification({ title, subtitle, details, type, icon, onClick, force = false }) {
        if (!force && !this.prefs.popup) return;

        const stack = document.getElementById('toast-notification-stack');
        if (!stack) return;

        const toastId = 'pop_' + Date.now() + Math.random().toString(36).substring(2, 6);
        const card = document.createElement('div');
        card.id = toastId;
        card.className = "pointer-events-auto bg-slate-900/95 text-white border border-slate-700/80 rounded-2xl shadow-2xl p-3.5 popup-slide-in backdrop-blur-md flex items-start gap-3 relative overflow-hidden transition cursor-pointer hover:border-brand-lime";

        let badgeBg = "bg-brand-lime/20 text-brand-lime border border-brand-lime/40";
        if (type === 'chat') badgeBg = "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40";
        if (type === 'order') badgeBg = "bg-amber-500/20 text-amber-400 border border-amber-500/40";

        card.innerHTML = `
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${badgeBg} font-black text-sm">
            ${icon || '📣'}
          </div>
          <div class="flex-1 min-w-0 pr-4">
            <div class="flex items-center justify-between gap-1">
              <h5 class="text-xs font-black uppercase tracking-wider text-slate-100 truncate">${this.escapeHtml(title)}</h5>
              <span class="text-[9px] text-slate-400 font-mono">Ahora</span>
            </div>
            ${subtitle ? `<p class="text-xs font-extrabold text-brand-lime truncate mt-0.5">${this.escapeHtml(subtitle)}</p>` : ''}
            ${details ? `<p class="text-[11px] text-slate-300 line-clamp-2 mt-0.5 italic">"${this.escapeHtml(details)}"</p>` : ''}
          </div>
          <button type="button" class="absolute top-2 right-2 text-slate-400 hover:text-white p-1 rounded-lg" onclick="event.stopPropagation(); app.closePopup('${toastId}')">
            ✕
          </button>
          <div class="absolute bottom-0 left-0 h-1 bg-brand-lime transition-all duration-[6500ms] w-full" id="${toastId}_bar"></div>
        `;

        if (onClick) {
          card.onclick = () => {
            onClick();
            this.closePopup(toastId);
          };
        }

        stack.appendChild(card);

        setTimeout(() => {
          const bar = document.getElementById(`${toastId}_bar`);
          if (bar) bar.style.width = '0%';
        }, 50);

        setTimeout(() => {
          this.closePopup(toastId);
        }, 6500);
      }

      closePopup(toastId) {
        const elem = document.getElementById(toastId);
        if (elem) {
          elem.classList.remove('popup-slide-in');
          elem.classList.add('popup-slide-out');
          setTimeout(() => elem.remove(), 320);
        }
      }

      showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const text = document.getElementById('toast-message');
        const icon = document.getElementById('toast-icon');
        if (!toast || !text || !icon) return;

        const icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
        icon.textContent = icons[type] || icons.info;
        text.textContent = String(message ?? '');
        toast.classList.remove('translate-y-20', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
          toast.classList.remove('translate-y-0', 'opacity-100');
          toast.classList.add('translate-y-20', 'opacity-0');
        }, 2800);
      }

      normalizeInput(val) {
        if (!val && val !== 0) return '';
        return String(val).trim().normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '');
      }

      formatTime(dateObj = new Date()) {
        return dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
      }

      formatFullDateTime(dateObj = new Date()) {
        const time = this.formatTime(dateObj);
        const day = dateObj.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${day} ${time}`;
      }

      openWazeNavigation(address) {
        if (!address) return this.showToast('No hay una dirección registrada', 'error');
        window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank');
      }

      openGoogleMapsNavigation(address) {
        if (!address) return this.showToast('No hay una dirección registrada', 'error');
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
      }

      initTechTheme() {
        // El tema Clásico conserva la interfaz limpia y sin partículas heredadas.
        document.getElementById('tech-particles-container')?.remove();
      }

      async init() {
        const unlockOrderAudio = () => SoundEngine.unlock();
        window.addEventListener('pointerdown', unlockOrderAudio, { once: true, capture: true });
        window.addEventListener('touchstart', unlockOrderAudio, { once: true, passive: true, capture: true });
        window.addEventListener('keydown', unlockOrderAudio, { once: true, capture: true });
        this.applyDarkMode();
        this.applySeasonalTheme(this.seasonalTheme);
        this.renderSeasonalThemeSelector();
        this.initTechTheme();
        this.loadPreferences();

        SafeStorage.removeItem('portonpro_admin_v4');
        SafeStorage.removeItem('portonpro_users_v4');

        const savedTasks = SafeStorage.getItem('portonpro_tasks_v4');
        if (savedTasks) {
          try { this.tasks = JSON.parse(savedTasks); } catch(e) { this.tasks = INITIAL_TASKS; }
        }
        const savedOrderSequence = Number(SafeStorage.getItem('portonpro_order_sequence_next'));
        this.orderSequenceNext = Number.isSafeInteger(savedOrderSequence) && savedOrderSequence > 0 ? savedOrderSequence : this.getDefaultNextOrderNumber();

        const remembered = SafeStorage.getItem('portonpro_remembered');
        if (remembered) {
          try {
            const remObj = JSON.parse(remembered);
            document.getElementById('login-username').value = remObj.u || '';
            document.getElementById('login-password').value = remObj.p || '';
            document.getElementById('login-remember').checked = true;
          } catch(e) {}
        }

        if (window.db) {
          db.collection('users').onSnapshot((snapshot) => {
            const list = [];
            snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            this.users = list;
            this.applySharedSeasonalTheme();
            this.workers = list.filter(u => String(u.role).toLowerCase() === 'worker');
            if (this.currentUser) this.renderAdminPresence();

            this.renderTechOptionsInSelects();
            this.renderUsersTable();

            if (this.currentUser && this.currentUser.role === 'admin') {
              this.renderTechniciansMonitor();
              this.renderConversationsSidebar();
              this.renderTasks();
              this.setupMultiWorkerChatListeners();
              this.listenIncomingVoiceCalls();
            } else if (this.currentUser && this.currentUser.role === 'worker') {
              const myUpdated = list.find(u => String(u.username || '').toLowerCase() === this.currentUser.username.toLowerCase());
              if (myUpdated && myUpdated.photo !== this.currentUser.photo) {
                this.currentUser.photo = myUpdated.photo;
                SafeStorage.setItem('portonpro_session_v4', JSON.stringify(this.currentUser));
                this.setupDashboardUI();
              }
            }
          }, err => console.error("Snapshot users error:", err));

          db.collection('ordenes').doc('todas').onSnapshot((doc) => {
            if (doc.exists && Array.isArray(doc.data().tasks)) {
              const orderDocument = doc.data();
              const incomingTasks = orderDocument.tasks;
              const remoteSequence = Number(orderDocument.nextOrderNumber);
              this.orderSequenceNext = Number.isSafeInteger(remoteSequence) && remoteSequence > 0 ? remoteSequence : this.getDefaultNextOrderNumber(incomingTasks);
              SafeStorage.setItem('portonpro_order_sequence_next', String(this.orderSequenceNext));
              incomingTasks.forEach(task => {
                const evidenceList = Array.isArray(task?.evidence) ? task.evidence : [];
                const evidenceUrls = evidenceList.map(item => typeof item === 'string' ? item : item?.url || item?.src || null);
                console.info('[ORDER] Evidencias leídas desde Firestore', { taskId: task?.id, cantidad: evidenceList.length, urls: evidenceUrls });
                if (evidenceUrls.filter(Boolean).length) console.info('[ORDER] URL leída de Firestore', { taskId: task.id, cantidad: evidenceUrls.filter(Boolean).length, urls: evidenceUrls.filter(Boolean) });
                const invoiceUrl = task?.invoice?.url || task?.invoiceUrl || task?.facturaUrl;
                if (invoiceUrl) console.info('[ORDER] Factura cargada', { taskId: task.id, url: invoiceUrl, origen: 'Firestore' });
              });
              if (this.isTasksInitialLoad) {
                const cachedTasks = Array.isArray(this.tasks) ? this.tasks : [];
                incomingTasks.forEach(remoteTask => {
                  const cachedTask = cachedTasks.find(item => item?.id === remoteTask?.id);
                  if (!cachedTask) return;
                  const remoteEvidence = [remoteTask.evidence, remoteTask.report?.evidence, remoteTask.workEvidence, remoteTask.evidences, remoteTask.attachments].find(items => Array.isArray(items) && items.length) || [];
                  const cachedEvidence = [cachedTask.evidence, cachedTask.report?.evidence, cachedTask.workEvidence, cachedTask.evidences, cachedTask.attachments].find(items => Array.isArray(items) && items.length) || [];
                  if (!remoteEvidence.length && cachedEvidence.length) {
                    remoteTask.evidence = cachedEvidence;
                    console.warn('[EVIDENCIA] Se recuperó evidencia local pendiente de sincronizar', { taskId: remoteTask.id, cantidad: cachedEvidence.length });
                  }
                });
              }

              if (!this.isTasksInitialLoad && this.currentUser?.role === 'admin') {
                const previousTasksById = this.lastObservedTaskStatuses || new Map((this.tasks || []).map(task => [String(task?.id), task?.status]));
                incomingTasks.forEach(task => {
                  const taskId = String(task?.id || '');
                  const previousTask = previousTasksById.get(taskId);
                  if (!taskId || task?.status !== 'REALIZADA' || previousTask === 'REALIZADA' || task?.archivedAt) return;



                  console.info('[ORDER] Orden pasó a REALIZADA', { taskId, previousStatus: previousTask || 'sin estado anterior' });
                  if (this.prefs.sound) SoundEngine.playOrderCompletedSound();
                  else console.info('[ORDER] Sonido omitido: la preferencia está desactivada');
                });
              }
              if (!this.isTasksInitialLoad && incomingTasks.length > this.tasks.length) {
                const latestTask = incomingTasks[0];
                if (latestTask && !this.processedEventIds.has(latestTask.id)) {
                  this.processedEventIds.add(latestTask.id);

                  if (this.prefs.sound) SoundEngine.playOrderSound();
                  this.showPopupNotification({
                    title: '📋 Nueva Orden de Trabajo',
                    subtitle: `${latestTask.client} &bull; ${latestTask.serviceType}`,
                    details: `Equipo: ${latestTask.equipment} | Técnico: ${latestTask.assignedTo}`,
                    type: 'order',
                    icon: '📋',
                    onClick: () => this.viewOrderDetails(latestTask.id)
                  });
                }
              }

              this.lastObservedTaskStatuses = new Map(incomingTasks.filter(task => task?.id != null).map(task => [String(task.id), task.status]));
              this.isTasksInitialLoad = false;
              this.tasks = incomingTasks;
              SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));
              if (this.currentUser) {
                this.updateStats();
                this.renderTasks();
                if (this.currentUser.role === 'admin') {
                  this.renderTechniciansMonitor();
                  this.renderAdminAuditLog();
                }
              }
            }
          }, e => console.error("Snapshot órdenes:", e));

          db.collection('presencia').onSnapshot((snapshot) => {
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              const presenceId = doc.id.toLowerCase();
              const existingPresenceUser = this.users.find(x => String(x.username || '').toLowerCase() === presenceId) || (Array.isArray(this.workers) ? this.workers.find(x => String(x.username || '').toLowerCase() === presenceId) : null);
              const previousRecord = this.presenceRecords[presenceId];
              const previousStatus = previousRecord ? this.getPresenceStatus(existingPresenceUser || { username: presenceId }) : 'disconnected';
              this.presenceRecords[presenceId] = data;
              if (String(data.role || '').toLowerCase() === 'admin') this.applyAdminIdentityPresence(data);
              if (this.currentUser?.role === 'admin' && presenceId === String(this.currentUser.username || '').toLowerCase()) {
                if (Array.isArray(data.adminIdentityNames) && data.adminIdentityNames.length === 2) this.adminIdentityNames = data.adminIdentityNames.map(name => String(name || '').trim()).filter(Boolean).length === 2 ? data.adminIdentityNames.map(name => String(name || '').trim()) : this.adminIdentityNames;
                if (data.activeAdminName) this.activeAdminName = String(data.activeAdminName);
                if (data.adminIdentityPhotos && typeof data.adminIdentityPhotos === 'object') this.adminIdentityPhotos = { ...data.adminIdentityPhotos };
              }
              const u = this.users.find(x => String(x.username || '').toLowerCase() === presenceId);
              if (u) {
                if (data.lastHeartbeat !== undefined) u.lastHeartbeat = data.lastHeartbeat;
                if (data.photo) u.photo = data.photo;
                if (data.lastLogin) u.lastLogin = data.lastLogin;
              }
              const presenceUser = u || existingPresenceUser || { username: presenceId, ...data };
              const isWorkerPresence = ['worker', 'trabajador'].includes(String(data.role || presenceUser.role || '').toLowerCase().trim());
              const becameAvailable = this.getPresenceStatus(presenceUser) === 'available';
              if (this.presenceSnapshotInitialized && this.currentUser?.role === 'admin' && isWorkerPresence && previousStatus !== 'available' && becameAvailable && this.prefs?.sound !== false) {
                console.info('[PRESENCE] Transición de trabajador a disponible', { username: presenceId });
                SoundEngine.playWorkerConnectedSound();
              }
            });
            this.presenceSnapshotInitialized = true;
            this.applySharedSeasonalTheme();
            if (this.currentUser) {
              this.renderTasks();
              this.renderAdminPresence();
            }
            if (this.currentUser && this.currentUser.role === 'admin') {
              this.renderTechniciansMonitor();
              this.renderConversationsSidebar();
            }
          });


        }

        document.addEventListener('pointerdown', event => {
          const menu = document.getElementById('admin-presence-menu');
          const toggle = document.getElementById('admin-presence-toggle');
          if (!menu || menu.classList.contains('hidden') || menu.contains(event.target) || toggle?.contains(event.target)) return;
          menu.classList.add('hidden');
          toggle?.setAttribute('aria-expanded', 'false');
        }, true);


        document.addEventListener('click', event => {
          const menu = document.getElementById('admin-presence-menu');
          const toggle = document.getElementById('admin-presence-toggle');
          if (!menu || menu.classList.contains('hidden') || menu.contains(event.target) || toggle?.contains(event.target)) return;
          menu.classList.add('hidden');
          toggle?.setAttribute('aria-expanded', 'false');
        });
        document.addEventListener('keydown', event => {
          if (event.key !== 'Escape') return;
          const menu = document.getElementById('admin-presence-menu');
          const toggle = document.getElementById('admin-presence-toggle');
          if (!menu || menu.classList.contains('hidden')) return;
          menu.classList.add('hidden');
          toggle?.setAttribute('aria-expanded', 'false');
        });

        // Los chats se minimizan o cierran solo desde sus controles individuales.



        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && this.currentUser) {
            this.sendHeartbeat();
          }
        });

        const savedSession = SafeStorage.getItem('portonpro_session_v4');
        if (savedSession) {
          try {
            const user = JSON.parse(savedSession);
            await this.loginSuccess(user, false);
          } catch(e) {
            this.showLoginView();
          }
        } else {
          this.showLoginView();
        }

        if (window.lucide) lucide.createIcons();
      }

      getOrderNumberFromId(id) {
        const match = String(id || '').match(/^ORD-(\d+)$/i);
        return match ? Number(match[1]) : null;
      }

      getDefaultNextOrderNumber(tasks = this.tasks) {
        const numbers = (Array.isArray(tasks) ? tasks : []).map(task => this.getOrderNumberFromId(task?.id)).filter(Number.isSafeInteger);
        return Math.max(101, ...numbers.map(number => number + 1));
      }

      getNextAvailableOrderNumber(start = this.orderSequenceNext, tasks = this.tasks, excludedId = null) {
        const used = new Set((Array.isArray(tasks) ? tasks : []).filter(task => task?.id !== excludedId).map(task => this.getOrderNumberFromId(task?.id)).filter(Number.isSafeInteger));
        let candidate = Number(start);
        if (!Number.isSafeInteger(candidate) || candidate < 1) candidate = this.getDefaultNextOrderNumber(tasks);
        while (used.has(candidate)) candidate += 1;
        return candidate;
      }

      renderOrderSequenceSetting() {
        const input = document.getElementById('settings-order-sequence-input');
        if (input) input.value = this.getNextAvailableOrderNumber();
      }

      async saveOrderSequence() {
        if (this.currentUser?.role !== 'admin') return;
        const input = document.getElementById('settings-order-sequence-input');
        const requested = Number(input?.value);
        if (!Number.isSafeInteger(requested) || requested < 1) return this.showToast('Escribe un número de orden válido.', 'error');
        if (this.tasks.some(task => this.getOrderNumberFromId(task?.id) === requested)) {
          return this.showToast(`El número ORD-${requested} ya está en uso. Elige un consecutivo libre.`, 'error');
        }
        const previous = this.orderSequenceNext;
        this.orderSequenceNext = requested;
        const result = await this.saveTasks(true);
        if (!result.ok) { this.orderSequenceNext = previous; SafeStorage.setItem('portonpro_order_sequence_next', String(previous)); }
        this.renderOrderSequenceSetting();
        if (result.ok) this.showToast(`La próxima orden comenzará en ORD-${requested}.`, 'success');
      }

      async resetOrderSequence() {
        if (this.currentUser?.role !== 'admin') return;
        const previous = this.orderSequenceNext;
        this.orderSequenceNext = this.getNextAvailableOrderNumber(101);
        const result = await this.saveTasks(true);
        if (!result.ok) { this.orderSequenceNext = previous; SafeStorage.setItem('portonpro_order_sequence_next', String(previous)); }
        this.renderOrderSequenceSetting();
        if (result.ok) this.showToast(`Consecutivo reiniciado. La próxima orden será ORD-${this.orderSequenceNext}.`, 'success');
      }

      saveTasks(reportError = false) {
        SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));
        SafeStorage.setItem('portonpro_order_sequence_next', String(this.orderSequenceNext));
        if (!window.db) return Promise.resolve({ ok: true, localOnly: true });
        try {
          return db.collection('ordenes').doc('todas').set({ tasks: this.tasks, nextOrderNumber: this.orderSequenceNext }, { merge: true })
            .then(() => ({ ok: true }))
            .catch(error => {
              console.error('[ORDEN] Falló la escritura de órdenes:', error);
              if (reportError) this.showToast(`No se guardó en la nube: ${error.message || error}`, 'error');
              return { ok: false, error };
            });
        } catch (error) {
          console.error('[ORDEN] No se pudo iniciar la escritura de órdenes:', error);
          if (reportError) this.showToast(`No se pudo guardar: ${error.message || error}`, 'error');
          return Promise.resolve({ ok: false, error });
        }
      }
      async addActivityNotification(techName, taskId, actionType, details, type = 'order') {
        const notifData = {
          techName: techName,
          taskId: taskId || '',
          actionType: actionType,
          details: details || '',
          type: type,
          time: this.formatTime(new Date()),
          timestamp: Date.now(),
          read: false
        };

        if (window.db) {
          db.collection('notificaciones').add(notifData).catch(e => console.error("Error notificación:", e));
        } else {
          this.showPopupNotification({ title: 'Actualización (' + actionType + ')', subtitle: techName, details: details || '', type: type || 'general', icon: '📣' });
        }
      }

      showLoginView() {
        document.documentElement.classList.remove('auth-session-pending');
        document.body.classList.add('seasonal-login-visible');
        document.getElementById('view-login').classList.remove('hidden');
        window.resumeLoginBrandVideo?.();
        document.getElementById('view-dashboard').classList.add('hidden');
        this.updateSeasonalEffects(this.seasonalTheme);
        document.getElementById('chat-floating-button-container').classList.add('hidden');
        document.getElementById('chat-window-modal').classList.add('hidden');
        document.getElementById('chat-desktop-windows')?.classList.add('hidden');
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        if (this.chatUnsubscribe) { this.chatUnsubscribe(); this.chatUnsubscribe = null; }
        if (this.chatThreadUnsubscribe) { this.chatThreadUnsubscribe(); this.chatThreadUnsubscribe = null; }
        if (this.chatThreadsUnsubscribe) { this.chatThreadsUnsubscribe(); this.chatThreadsUnsubscribe = null; }
        if (this.callUnsubscribe) { this.callUnsubscribe(); this.callUnsubscribe = null; }
        if (this.gpsLocationsUnsubscribe) { this.gpsLocationsUnsubscribe(); this.gpsLocationsUnsubscribe = null; }
        this.clearDedicatedWorkerChatListeners();
        this.stopGpsSharing(true);
        this.endVoiceCall();
      }

      async handleLogin(e) {
        e.preventDefault();
        const rawUser = document.getElementById('login-username').value;
        const rawPass = document.getElementById('login-password').value;
        const rememberChecked = document.getElementById('login-remember').checked;
        const errorAlert = document.getElementById('login-error-alert');
        const errorText = document.getElementById('login-error-text');
        const btnSubmit = document.getElementById('btn-submit-login');
        const btnText = document.getElementById('btn-submit-text');

        const userVal = String(rawUser || '').trim().toLowerCase();
        const passVal = String(rawPass || '').trim();

        if (!userVal || !passVal) {
          errorText.textContent = "Por favor ingresa usuario y contraseña.";
          errorAlert.classList.remove('hidden');
          return;
        }

        if (btnSubmit) {
          btnSubmit.disabled = true;
          if (btnText) btnText.textContent = "Verificando en Firestore...";
        }

        if (rememberChecked) {
          SafeStorage.setItem('portonpro_remembered', JSON.stringify({ u: userVal, p: passVal }));
        } else {
          SafeStorage.removeItem('portonpro_remembered');
        }

        let authenticatedUser = null;

        if (window.db) {
          try {
            const snapshot = await db.collection('users').get();
            snapshot.forEach(doc => {
              const uData = doc.data() || {};
              const dbUser = String(uData.username !== undefined ? uData.username : '').trim().toLowerCase();
              const dbPass = String(uData.password !== undefined ? uData.password : '').trim();

              if (dbUser === userVal && dbPass === passVal) {
                const isActive = (uData.active !== false);
                authenticatedUser = {
                  id: doc.id,
                  username: uData.username || userVal,
                  fullName: uData.fullName || uData.username || userVal,
                  role: String(uData.role || 'worker').toLowerCase().trim(),
                  phone: uData.phone || '',
                  photo: uData.photo || '',
                  active: isActive
                };
              }
            });
          } catch (err) {
            console.error("Error al consultar Firestore:", err);
            errorText.textContent = "Error de conexión con Firestore: " + (err.message || "Fallo de red");
            errorAlert.classList.remove('hidden');
            if (btnSubmit) { btnSubmit.disabled = false; if (btnText) btnText.textContent = "Iniciar Sesión"; }
            return;
          }
        }

        if (btnSubmit) {
          btnSubmit.disabled = false;
          if (btnText) btnText.textContent = "Iniciar Sesión";
        }

        if (authenticatedUser) {
          if (authenticatedUser.active === false) {
            errorText.textContent = 'Esta cuenta está desactivada. Consulta al Administrador.';
            errorAlert.classList.remove('hidden');
            return;
          }

          errorAlert.classList.add('hidden');
          const now = new Date();
          const formattedTime = this.formatTime(now);

          if (window.db) {
            db.collection('presencia').doc(authenticatedUser.username.toLowerCase()).set({
              username: authenticatedUser.username,
              fullName: authenticatedUser.fullName,
              lastHeartbeat: Date.now(),
              photo: authenticatedUser.photo || '',
              lastLogin: `${formattedTime} (En línea)`,
              ...(String(authenticatedUser.role || '').toLowerCase() === 'admin' ? { availabilityStatus: 'available' } : {})
            }, { merge: true }).catch(e => console.error(e));
          }

          await this.loginSuccess(authenticatedUser, true);
          return;
        }

        errorText.textContent = 'Usuario o contraseña incorrectos en Firestore.';
        errorAlert.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
      }

      async loginSuccess(user, notify = true) {
        this.currentUser = user;
        if (window.db) { try { if (String(user.role || '').toLowerCase() === 'admin') { const snap = await db.collection('presencia').doc(String(user.username || '').toLowerCase()).get(); if (snap.exists) this.applyAdminIdentityPresence(snap.data() || {}); } else { const snap = await db.collection('presencia').get(); const adminRecord = snap.docs.map(doc => doc.data() || {}).find(record => String(record.role || '').toLowerCase() === 'admin'); if (adminRecord) this.applyAdminIdentityPresence(adminRecord); } } catch (error) { console.warn('[IDENTIDAD] Usando identidad local hasta sincronizar:', error?.message || error); } }
        if (String(user.role || '').toLowerCase() === 'admin' && !this.activeAdminName) this.activeAdminName = String(user.activeAdminName || '');
        user.activeAdminName = this.activeAdminName || user.activeAdminName || '';

        // Toda sesión válida del administrador vuelve a mostrarse disponible,
        // incluso al restaurar la sesión guardada después de una recarga.
        if (String(user.role || '').toLowerCase() === 'admin') {
          const adminUsername = String(user.username || '').toLowerCase();
          const heartbeat = Date.now();
          const activePresence = {
            username: user.username,
            fullName: this.getCurrentDisplayName(),
            role: 'admin',
            photo: this.getCurrentDisplayPhoto() || user.photo || '',
            lastHeartbeat: heartbeat,
            lastLogin: `${this.formatTime(new Date())} (En línea)`,
            availabilityStatus: 'available'
          };
          this.presenceRecords[adminUsername] = { ...(this.presenceRecords[adminUsername] || {}), ...activePresence };
          if (window.db) {
            try {
              await window.db.collection('presencia').doc(adminUsername).set(activePresence, { merge: true });
            } catch (error) {
              console.warn('[PRESENCE] No se pudo restablecer el estado al iniciar sesión:', error?.message || error);
            }
          }
        }
        this.applySharedSeasonalTheme();
        SafeStorage.setItem('portonpro_session_v4', JSON.stringify(user));

        window.stopLoginBrandVideo?.();
        document.getElementById('view-login').classList.add('hidden');
        document.body.classList.remove('seasonal-login-visible');
        document.getElementById('view-dashboard').classList.remove('hidden');
        this.updateSeasonalEffects(this.seasonalTheme);
        document.documentElement.classList.remove('auth-session-pending');
        this.applyDarkMode();
        document.getElementById('chat-floating-button-container').classList.remove('hidden');
        document.getElementById('chat-desktop-windows')?.classList.remove('hidden');

        this.sendHeartbeat();
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 6000);
        if (this.presenceRefreshTimer) clearInterval(this.presenceRefreshTimer);
        this.presenceRefreshTimer = setInterval(() => this.renderAdminPresence(), 10000);

        this.setupDashboardUI();
        this.renderTechOptionsInSelects();
        this.updateStats();
        this.renderTasks();

        if (this.currentUser.role === 'admin') {
          this.renderTechniciansMonitor();
          this.renderAdminAuditLog();
        }

        this.initChatModule();
        this.listenIncomingVoiceCalls();

      }

      logout() {
        const now = new Date();
        const formattedLogout = `${this.formatTime(now)} (Desconectado)`;

        if (this.currentUser && window.db) {
          db.collection('presencia').doc(this.currentUser.username.toLowerCase()).set({
            lastHeartbeat: 0,
            lastLogin: formattedLogout,
            ...(this.currentUser.role === 'admin' ? { availabilityStatus: 'disconnected' } : {})
          }, { merge: true }).catch(e => console.error(e));
        }

        this.currentUser = null;
        this.applyDarkMode();
        SafeStorage.removeItem('portonpro_session_v4');
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        if (this.presenceRefreshTimer) clearInterval(this.presenceRefreshTimer);
        this.showLoginView();
      }

      sendHeartbeat() {
        if (!this.currentUser) return;
        const now = Date.now();
        if (window.db) {
          db.collection('presencia').doc(this.currentUser.username.toLowerCase()).set({
            username: this.currentUser.username,
            fullName: this.getCurrentDisplayName(),
            lastHeartbeat: now,
            photo: this.currentUser.photo || '',
            role: this.currentUser.role
          }, { merge: true }).catch(e => console.error(e));
        }
        if (this.currentUser.role === 'admin') this.renderTechniciansMonitor();
      }

      togglePasswordVisibility(fieldId) {
        const input = document.getElementById(fieldId);
        input.type = input.type === 'password' ? 'text' : 'password';
      }

      setupDashboardUI() {
        const isAdmin = this.currentUser.role === 'admin';

        document.getElementById('header-user-name').textContent = this.getCurrentDisplayName();
        document.getElementById('header-role-badge').textContent = isAdmin ? 'Admin' : 'Técnico';
        const headerRoleSubtitle = document.getElementById('header-role-subtitle');
        if (headerRoleSubtitle) { headerRoleSubtitle.textContent = isAdmin ? 'Administrador' : 'Trabajador'; headerRoleSubtitle.classList.remove('hidden'); }
        document.getElementById('admin-presence-control')?.classList.toggle('hidden', !isAdmin);

        const headerPhoto = document.getElementById('header-user-photo');
        const headerInit = document.getElementById('header-avatar-initial');
        const headerDisplayPhoto = this.getCurrentDisplayPhoto();
        if (headerDisplayPhoto) {
          headerPhoto.src = headerDisplayPhoto;
          headerPhoto.classList.remove('hidden');
          headerInit.classList.add('hidden');
        } else {
          headerPhoto.classList.add('hidden');
          headerInit.classList.remove('hidden');
          headerInit.textContent = (this.getCurrentDisplayName() || 'A').charAt(0);
        }

        const monitorSection = document.getElementById('section-technicians-monitor');
        const filterTech = document.getElementById('filter-tech');
        const filterTechControl = document.getElementById('filter-tech-control');
        const auditLogSection = document.getElementById('section-admin-audit-log');
        const roleHint = document.getElementById('role-hint-text');
        this.installOrderFilterDismissHandlers();

        const btnResetPending = document.getElementById('btn-reset-pending');
        const btnResetDone = document.getElementById('btn-reset-done');
        const btnResetFailed = document.getElementById('btn-reset-failed');
        const btnAssignOrderFilter = document.getElementById('btn-assign-order-filter');
        const ordersToolbar = document.getElementById('orders-toolbar');

        roleHint?.classList.toggle('hidden', !isAdmin);
        if (isAdmin) {
          ordersToolbar?.classList.remove('hidden');
          btnAssignOrderFilter?.classList.remove('hidden');
          monitorSection.classList.remove('hidden');
          filterTech.classList.remove('hidden');
          filterTechControl?.classList.remove('hidden');
          filterTech.disabled = false;
          auditLogSection.classList.remove('hidden');
          roleHint.textContent = 'Supervisión en vivo, GPS y control total';

          if (btnResetPending) btnResetPending.classList.remove('hidden');
          if (btnResetDone) btnResetDone.classList.remove('hidden');
          if (btnResetFailed) btnResetFailed.classList.remove('hidden');
        } else {
          ordersToolbar?.classList.add('hidden');
          btnAssignOrderFilter?.classList.add('hidden');
          monitorSection.classList.add('hidden');
          filterTech.classList.add('hidden');
          filterTechControl?.classList.add('hidden');
          filterTech.disabled = true;
          auditLogSection.classList.add('hidden');
          roleHint.textContent = '';

          if (btnResetPending) btnResetPending.classList.add('hidden');
          if (btnResetDone) btnResetDone.classList.add('hidden');
          if (btnResetFailed) btnResetFailed.classList.add('hidden');
        }

        this.renderOrderFilterMenus();
        const banner = document.getElementById('dashboard-banner');
        if (isAdmin) {
          banner.className = 'mb-4 sm:mb-5 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between border shadow-sm bg-gradient-to-r from-slate-950 via-brand-dark to-slate-900 text-white border-brand-lime/40';
          banner.innerHTML = `
            <div>
              <h3 class="font-extrabold text-xs sm:text-sm text-white">Panel Central de Operaciones</h3>
              <p class="text-[11px] sm:text-xs text-slate-300 mt-0.5">Asigna órdenes, supervisa técnicos en mapa GPS y comunícate por chat y voz.</p>
            </div>
            <div class="mt-2 sm:mt-0 flex items-center justify-center sm:justify-end gap-2 self-center sm:self-auto">
              <button type="button" aria-label="Ver mapa GPS" title="Ver mapa GPS" onclick="app.openAdminGpsModal()" class="group shrink-0 cursor-pointer rounded-2xl border-0 bg-transparent p-0 shadow-none transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                <img src="assets/media/boton-ver-mapa-gps.png" alt="Ver mapa GPS" class="block h-20 w-20 object-contain sm:h-24 sm:w-24 md:h-28 md:w-28">
              </button>
            </div>
          `;
        } else {
          banner.className = 'mb-4 sm:mb-5 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between border shadow-sm bg-gradient-to-r from-slate-900 via-brand-dark to-slate-950 text-white border-brand-lime/40';
          banner.innerHTML = `
            <div>
              <h3 class="font-extrabold text-xs sm:text-sm text-white">Bienvenido, ${this.getCurrentDisplayName()}</h3>
              <p class="text-[11px] sm:text-xs text-slate-300 mt-0.5">Revisa tus visitas asignadas, comparte posición o llama al administrador.</p>
              <div id="worker-admin-presence-dashboard" class="mt-2"></div>
            </div>
            <div class="mt-2 sm:mt-0 flex items-center gap-2">
              <button onclick="app.startVoiceCall()" class="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow transition active:scale-95">
                <i data-lucide="phone" class="w-3.5 h-3.5"></i> Llamar Admin
              </button>
              <button id="btn-worker-toggle-gps" onclick="app.toggleWorkerGps()" class="text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 shadow transition active:scale-95 bg-slate-800 text-slate-200 border-slate-700 hover:border-cyan-400">
                <span class="w-2 h-2 rounded-full bg-slate-400" id="worker-gps-dot"></span>
                <span id="worker-gps-label">📍 Activar GPS</span>
              </button>
            </div>
          `;
        }

        this.renderAdminPresence();
        if (window.lucide) lucide.createIcons();
      }

      getCurrentDisplayPhoto(user = this.currentUser) {
        if (!user) return '';
        if (String(user.role || '').toLowerCase() === 'admin') return this.adminIdentityPhotos[this.activeAdminName] || user.photo || '';
        return user.photo || '';
      }

      applyAdminIdentityPresence(record = {}) {
        if (Array.isArray(record.adminIdentityNames) && record.adminIdentityNames.length === 2) { const names = record.adminIdentityNames.map(name => String(name || '').trim()); if (names.every(Boolean)) this.adminIdentityNames = names; }
        if (record.adminIdentityPhotos && typeof record.adminIdentityPhotos === 'object') this.adminIdentityPhotos = { ...record.adminIdentityPhotos };
        if (record.activeAdminName) this.activeAdminName = String(record.activeAdminName);
        if (this.currentUser?.role === 'admin' && record.activeAdminName) { this.currentUser.activeAdminName = this.activeAdminName; SafeStorage.setItem('portonpro_session_v4', JSON.stringify(this.currentUser)); }
        if (this.activeAdminName) SafeStorage.setItem('portonpro_admin_identity_cache_v1', JSON.stringify({ names: this.adminIdentityNames, photos: this.adminIdentityPhotos, activeName: this.activeAdminName }));
      }

      getChatMessageSender(message) {
        const senderName = String(message?.senderName || '').trim();
        const senderRole = String(message?.senderRole || '').toLowerCase();
        if (senderRole === 'admin') {
          const adminInfo = this.getAdminPresenceInfo();
          const name = senderName || adminInfo.name || 'Administrador';
          const photo = this.adminIdentityPhotos[name] || (name === this.getCurrentDisplayName() ? this.getCurrentDisplayPhoto() : '') || adminInfo.photo || '';
          return { name, photo };
        }
        const worker = this.workers.find(item => [item.fullName, item.username].some(value => String(value || '').toLocaleLowerCase() === senderName.toLocaleLowerCase()));
        return { name: senderName || worker?.fullName || worker?.username || 'Técnico', photo: worker?.photo || '' };
      }
      getCurrentDisplayName(user = this.currentUser) {
        if (!user) return '';
        if (String(user.role || '').toLowerCase() === 'admin') return this.activeAdminName || user.activeAdminName || user.fullName || user.username || 'Administrador';
        return user.fullName || user.username || '';
      }

      renderAdminIdentities() {
        const list = document.getElementById('admin-identities-list');
        if (!list || this.currentUser?.role !== 'admin') return;
        const active = this.activeAdminName;
        list.innerHTML = this.adminIdentityNames.map((name, index) => {
          const photo = this.adminIdentityPhotos[name] || '';
          const avatar = photo
            ? `<img src="${this.escapeHtml(photo)}" alt="Foto de ${this.escapeHtml(name)}" class="h-full w-full object-cover">`
            : this.escapeHtml(name.charAt(0).toUpperCase());
          return `
            <div class="flex items-center gap-2 rounded-lg border ${active === name ? 'border-brand-lime bg-lime-50' : 'border-slate-200 bg-white'} px-2.5 py-2">
              <button type="button" onclick="app.selectAdminIdentity(${index})" class="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span class="seasonal-worker-avatar relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-black text-slate-600">${avatar}</span>
                <span class="h-4 w-4 shrink-0 rounded-full border ${active === name ? 'border-brand-lime bg-brand-lime ring-2 ring-lime-200' : 'border-slate-300 bg-white'}"></span>
                <span class="truncate text-xs font-bold text-slate-800">${this.escapeHtml(name)}</span>
                ${active === name ? '<span class="ml-auto text-[9px] font-bold uppercase text-emerald-700">En uso</span>' : ''}
              </button>
              <button type="button" onclick="app.beginAdminIdentityEdit(${index})" class="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-dark" title="Editar ${this.escapeHtml(name)}" aria-label="Editar ${this.escapeHtml(name)}"><i data-lucide="pencil" class="h-3.5 w-3.5"></i></button>
            </div>
          `;
        }).join('');
        if (window.lucide) lucide.createIcons();
      }
      async saveAdminIdentitySettings(names, activeName, photos = this.adminIdentityPhotos) {
        if (!window.db || this.currentUser?.role !== 'admin') throw new Error('No hay sesión de administrador conectada');
        const username = String(this.currentUser.username || '').toLowerCase();
        await db.collection('presencia').doc(username).set({
          username: this.currentUser.username,
          fullName: activeName || this.currentUser.fullName || this.currentUser.username,
          role: 'admin',
          photo: this.currentUser.photo || '',
          adminIdentityNames: names,
          adminIdentityPhotos: photos,
          activeAdminName: activeName || ''
        }, { merge: true });
        this.adminIdentityNames = names;
        this.adminIdentityPhotos = { ...photos };
        this.activeAdminName = activeName || '';
        this.currentUser.activeAdminName = this.activeAdminName;
        SafeStorage.setItem('portonpro_session_v4', JSON.stringify(this.currentUser));
        SafeStorage.setItem('portonpro_admin_identity_cache_v1', JSON.stringify({ names, photos: this.adminIdentityPhotos, activeName: this.activeAdminName }));
        this.presenceRecords[username] = { ...(this.presenceRecords[username] || {}), adminIdentityNames: names, adminIdentityPhotos: { ...photos }, activeAdminName: activeName || '', fullName: activeName || this.currentUser.fullName || this.currentUser.username, photo: this.currentUser.photo || '' };
        this.setupDashboardUI();
        this.renderAdminIdentities();
        this.renderAdminPresence();
        this.renderMySettingsPhotoPreview();
        if (this.activeChatWorker) this.renderConversationsSidebar();
      }

      async selectAdminIdentity(index) {
        if (this.currentUser?.role !== 'admin' || !this.adminIdentityNames[index]) return;
        try {
          await this.saveAdminIdentitySettings([...this.adminIdentityNames], this.adminIdentityNames[index], this.adminIdentityPhotos);
          this.showToast(`Ahora apareces como ${this.adminIdentityNames[index]}`, 'success');
        } catch (error) {
          console.error('[IDENTIDAD] No se pudo seleccionar el nombre:', error);
          this.showToast('No se pudo guardar el nombre elegido', 'error');
        }
      }

      beginAdminIdentityEdit(index) {
        if (this.currentUser?.role !== 'admin' || !this.adminIdentityNames[index]) return;
        this.adminIdentityEditingIndex = index;
        this.adminIdentityPhotoDraft = null;
        const editor = document.getElementById('admin-identity-editor');
        const input = document.getElementById('admin-identity-name-input');
        const photoInput = document.getElementById('admin-identity-photo-file');
        if (photoInput) photoInput.value = '';
        if (!editor || !input) return;
        input.value = this.adminIdentityNames[index];
        this.updateAdminIdentityPhotoPreview(this.adminIdentityPhotos[this.adminIdentityNames[index]] || '');
        editor.classList.remove('hidden');
        input.focus();
        input.select();
      }

      cancelAdminIdentityEdit() {
        this.adminIdentityEditingIndex = null;

        this.adminIdentityPhotoDraft = null;
        document.getElementById('admin-identity-editor')?.classList.add('hidden');
      }

      async saveAdminIdentityEdit() {
        const index = this.adminIdentityEditingIndex;
        const input = document.getElementById('admin-identity-name-input');
        const photoInput = document.getElementById('admin-identity-photo-file');
        if (photoInput) photoInput.value = '';
        const newName = String(input?.value || '').trim();
        if (index === null || !this.adminIdentityNames[index]) return;
        if (!newName) return this.showToast('Escribe un nombre válido', 'error');
        if (this.adminIdentityNames.some((name, otherIndex) => otherIndex !== index && name.toLocaleLowerCase() === newName.toLocaleLowerCase())) return this.showToast('Los dos nombres deben ser diferentes', 'error');
        const oldName = this.adminIdentityNames[index];
        const names = [...this.adminIdentityNames];
        names[index] = newName;
        const activeName = this.activeAdminName === oldName ? newName : this.activeAdminName;
        const photos = { ...this.adminIdentityPhotos };
        const oldPhoto = photos[oldName] || '';
        delete photos[oldName];
        photos[newName] = this.adminIdentityPhotoDraft === null ? oldPhoto : this.adminIdentityPhotoDraft;
        try {
          await this.saveAdminIdentitySettings(names, activeName, photos);
          this.cancelAdminIdentityEdit();
          this.showToast('Nombre actualizado', 'success');
        } catch (error) {
          console.error('[IDENTIDAD] No se pudo editar el nombre:', error);
          this.showToast('No se pudo guardar el nombre', 'error');
        }
      }
      updateAdminIdentityPhotoPreview(photoData) {
        const preview = document.getElementById('admin-identity-photo-preview');
        if (!preview) return;
        if (photoData) preview.innerHTML = `<img src="${this.escapeHtml(photoData)}" alt="Vista previa de la foto" class="h-full w-full object-cover">`;
        else {
          const name = this.adminIdentityNames[this.adminIdentityEditingIndex] || '?';
          preview.textContent = name.charAt(0).toUpperCase();
        }
      }

      async handleAdminIdentityPhoto(event) {
        const file = event.target.files?.[0];
        if (!file || this.adminIdentityEditingIndex === null) return;
        if (!file.type.startsWith('image/')) { this.showToast('Selecciona un archivo de imagen', 'error'); event.target.value = ''; return; }
        if (file.size > 10 * 1024 * 1024) { this.showToast('La imagen debe pesar menos de 10 MB', 'error'); event.target.value = ''; return; }
        try {
          const source = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
            reader.readAsDataURL(file);
          });
          const image = await new Promise((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = () => reject(new Error('La imagen no es válida'));
            element.src = source;
          });
          const maxSide = 480;
          const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          this.adminIdentityPhotoDraft = canvas.toDataURL('image/jpeg', 0.78);
          this.updateAdminIdentityPhotoPreview(this.adminIdentityPhotoDraft);
          this.showToast('Foto lista. Pulsa Guardar cambios para compartirla.', 'success');
        } catch (error) {
          console.error('[IDENTIDAD] No se pudo preparar la foto:', error);
          this.showToast('No se pudo procesar la imagen', 'error');
        }
      }

      removeAdminIdentityPhoto() {
        if (this.adminIdentityEditingIndex === null) return;
        this.adminIdentityPhotoDraft = '';
        this.updateAdminIdentityPhotoPreview('');
        const input = document.getElementById('admin-identity-photo-file');
        if (input) input.value = '';
      }
      getPresenceStatus(user) {
        if (!user) return 'disconnected';
        const username = String(user.username || '').toLowerCase();
        const record = this.presenceRecords[username] || {};
        const heartbeat = Number(record.lastHeartbeat ?? user.lastHeartbeat ?? 0);
        const savedStatus = record.availabilityStatus;
        if (savedStatus === 'absent') return 'absent';
        if (savedStatus === 'disconnected') return 'disconnected';
        const isActiveAdminSession = String(this.currentUser?.role || '').toLowerCase() === 'admin' && username === String(this.currentUser?.username || '').toLowerCase();
        if (savedStatus === 'available' && isActiveAdminSession) return 'available';
        return heartbeat > 0 && Date.now() - heartbeat < 60000 ? 'available' : 'disconnected';
      }

      getPresenceLabel(status) {
        return ({ available: 'Disponible', absent: 'Ausente', disconnected: 'Desconectado' })[status] || 'Desconectado';
      }

      getAdminPresenceInfo() {
        const admin = this.users.find(user => String(user.role || '').toLowerCase() === 'admin');
        const presenceAdminEntry = Object.entries(this.presenceRecords).find(([, record]) => String(record?.role || '').toLowerCase() === 'admin');
        const isAdminSession = String(this.currentUser?.role || '').toLowerCase() === 'admin';
        const adminUser = isAdminSession ? this.currentUser : (admin || null);
        const username = String(adminUser?.username || presenceAdminEntry?.[0] || '').toLowerCase();
        const record = username ? (this.presenceRecords[username] || {}) : {};
        const presenceUser = adminUser || (username ? { username, ...record } : null);
        const status = this.getPresenceStatus(presenceUser);
        return {
          name: record.activeAdminName || adminUser?.activeAdminName || this.activeAdminName || adminUser?.fullName || record.fullName || 'Administrador',
          photo: record.adminIdentityPhotos?.[record.activeAdminName || this.activeAdminName] || this.adminIdentityPhotos[record.activeAdminName || this.activeAdminName] || record.photo || adminUser?.photo || '',
          identityReady: !!(record.activeAdminName || adminUser?.activeAdminName || this.activeAdminName),
          status,
          isHeartbeatFresh: status !== 'disconnected'
        };
      }

      renderAdminPresence() {
        const info = this.getAdminPresenceInfo();
        const label = this.getPresenceLabel(info.status);
        const stateClass = `presence-label is-${info.status}`;
        const statusLabel = document.getElementById('admin-presence-label');
        const profileIndicator = document.getElementById('header-presence-profile');
        const profileStatus = this.currentUser?.role === 'admin' ? info.status : this.getPresenceStatus(this.currentUser);
        profileIndicator?.classList.toggle('presence-card-connected', profileStatus === 'available');
        profileIndicator?.classList.toggle('presence-card-absent', profileStatus === 'absent');
        const mobileProfileStatus = document.getElementById('header-user-status');
        if (mobileProfileStatus) {
          const isAdmin = this.currentUser?.role === 'admin';
          mobileProfileStatus.textContent = this.getPresenceLabel(profileStatus);
          mobileProfileStatus.className = `text-[8px] font-semibold ${profileStatus === 'available' ? 'text-emerald-300' : profileStatus === 'absent' ? 'text-amber-300' : 'text-slate-300'}${isAdmin ? ' hidden' : ''}`;
        }
        if (statusLabel) { statusLabel.textContent = label; statusLabel.className = `${stateClass} text-[9px]`; }
        if (this.currentUser?.role === 'admin') {
          const headerName = document.getElementById('header-user-name');
          const headerInitial = document.getElementById('header-avatar-initial');
          const headerPhoto = document.getElementById('header-user-photo');
          const displayPhoto = this.getCurrentDisplayPhoto();
          if (headerName) headerName.textContent = this.getCurrentDisplayName();
          const headerRole = document.getElementById('header-role-subtitle');
          if (headerRole) { headerRole.textContent = 'Administrador'; headerRole.classList.remove('hidden'); }
          if (headerInitial) headerInitial.textContent = (this.getCurrentDisplayName() || 'A').charAt(0);
          if (headerPhoto && displayPhoto) { headerPhoto.src = displayPhoto; headerPhoto.classList.remove('hidden'); headerInitial?.classList.add('hidden'); }
          else if (headerPhoto) { headerPhoto.classList.add('hidden'); headerInitial?.classList.remove('hidden'); }
          if (!document.getElementById('settings-admin-identities-section')?.classList.contains('hidden')) this.renderAdminIdentities();
        }

        const dashboard = document.getElementById('worker-admin-presence-dashboard');
        if (dashboard) {
          dashboard.style.display = info.identityReady ? '' : 'none';
          dashboard.innerHTML = `<div id="worker-admin-presence-card" class="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1.5 ${info.status === 'available' ? 'presence-card-connected' : info.status === 'absent' ? 'presence-card-absent' : ''}"><div class="seasonal-worker-avatar relative w-8 h-8 rounded-full border border-white/40 bg-slate-700 overflow-hidden flex items-center justify-center text-xs font-bold">${info.photo ? `<img src="${this.escapeHtml(info.photo)}" alt="Foto del Administrador" class="w-full h-full object-cover">` : this.escapeHtml(info.name.charAt(0))}</div><div class="leading-tight"><p class="text-[10px] font-bold text-white">${this.escapeHtml(info.name)}</p><p class="text-[8px] uppercase tracking-wide text-slate-300">Administrador</p><span class="${stateClass}">${label}</span></div></div>`;
        }

        if (this.currentUser?.role === 'worker') {
          const chatTitle = document.getElementById('chat-header-title');
          if (chatTitle) chatTitle.textContent = `Chat: ${info.name}`;
        }
        const chatCard = document.getElementById('chat-admin-presence');
        if (chatCard) {
          const shouldShow = this.currentUser?.role === 'worker';
          chatCard.classList.toggle('hidden', !shouldShow || !info.identityReady);
          chatCard.classList.toggle('flex', shouldShow && info.identityReady);
          const avatar = document.getElementById('chat-admin-presence-avatar');
          if (avatar) avatar.innerHTML = info.photo ? `<img src="${this.escapeHtml(info.photo)}" alt="Foto del Administrador" class="w-full h-full object-cover">` : this.escapeHtml(info.name.charAt(0));
          const chatName = document.getElementById('chat-admin-presence-name');
          if (chatName) chatName.textContent = info.name;
          const chatRole = document.getElementById('chat-admin-presence-role');
          if (chatRole) chatRole.textContent = 'Administrador';
          const chatLabel = document.getElementById('chat-admin-presence-label');
          if (chatLabel) { chatLabel.textContent = label; chatLabel.className = `${stateClass} text-[9px]`; }
        }
        this.renderActiveChatHeader();
      }

      toggleAdminPresenceMenu() {
        if (String(this.currentUser?.role || '').toLowerCase() !== 'admin') return;
        const menu = document.getElementById('admin-presence-menu');
        const toggle = document.getElementById('admin-presence-toggle');
        if (!menu || !toggle) return;
        const opening = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !opening);
        if (opening) {
          const rect = toggle.getBoundingClientRect();
          menu.style.setProperty('position', 'fixed', 'important');
          menu.style.setProperty('left', Math.max(8, Math.min(rect.left, window.innerWidth - 188)) + 'px', 'important');
          menu.style.setProperty('top', Math.min(rect.bottom + 8, window.innerHeight - 150) + 'px', 'important');
          menu.style.setProperty('right', 'auto', 'important');
          menu.style.setProperty('z-index', '2147483647', 'important');
        } else {
          menu.style.removeProperty('position');
          menu.style.removeProperty('left');
          menu.style.removeProperty('top');
          menu.style.removeProperty('right');
          menu.style.removeProperty('z-index');
        }
        toggle.setAttribute('aria-expanded', String(opening));
      }

      async setAdminAvailability(status) {
        const allowed = ['available', 'absent', 'disconnected'];
        if (String(this.currentUser?.role || '').toLowerCase() !== 'admin' || !allowed.includes(status)) return;
        const menu = document.getElementById('admin-presence-menu');
        menu?.classList.add('hidden');
        if (menu) ['position','left','top','right','z-index'].forEach(property => menu.style.removeProperty(property));
        document.getElementById('admin-presence-toggle')?.setAttribute('aria-expanded', 'false');
        if (!window.db) return this.showToast('No hay conexión para guardar tu estado', 'error');
        const username = String(this.currentUser.username || '').toLowerCase();
        const previousRecord = { ...(this.presenceRecords[username] || {}) };
        const lastHeartbeat = Date.now();
        this.presenceRecords[username] = { ...previousRecord, username: this.currentUser.username, fullName: this.getCurrentDisplayName(), role: 'admin', photo: this.currentUser.photo || '', lastHeartbeat, availabilityStatus: status };
        this.renderAdminPresence();
        try {
          await db.collection('presencia').doc(username).set({
            username: this.currentUser.username,
            fullName: this.getCurrentDisplayName(),
            role: 'admin',
            photo: this.currentUser.photo || '',
            lastHeartbeat,
            availabilityStatus: status
          }, { merge: true });
          console.info('[PRESENCE] Estado del administrador guardado', { username, status });
          this.showToast('Estado actualizado: ' + this.getPresenceLabel(status), 'success');
        } catch (error) {
          this.presenceRecords[username] = previousRecord;
          this.renderAdminPresence();
          console.error('[PRESENCE] No se pudo actualizar el estado del administrador:', error);
          this.showToast('No se pudo guardar el estado. Revisa la conexión y permisos de Firestore.', 'error');
        }
      }

      zoomWorkerPhoto(photoUrl, name) {
        const modal = document.getElementById('modal-photo-zoom');
        const img = document.getElementById('zoom-modal-img');
        const initial = document.getElementById('zoom-modal-initial');
        const nameElem = document.getElementById('zoom-modal-name');

        nameElem.textContent = name || 'Trabajador';

        if (photoUrl) {
          img.src = photoUrl;
          img.classList.remove('hidden');
          initial.classList.add('hidden');
        } else {
          img.classList.add('hidden');
          initial.classList.remove('hidden');
          initial.textContent = (name || 'A').charAt(0);
        }

        modal.classList.remove('hidden');
      }

      closePhotoZoom() {
        document.getElementById('modal-photo-zoom').classList.add('hidden');
      }

      toggleWorkerGps() {
        if (this.isGpsSharing) {
          this.stopGpsSharing();
        } else {
          this.startGpsSharing();
        }
      }

      startGpsSharing() {
        if (!navigator.geolocation) {
          this.showToast("Tu navegador no soporta geolocalización", "error");
          return;
        }

        const myName = this.getCurrentDisplayName();
        this.gpsConnectedAt = Date.now();
        const btnLabel = document.getElementById('worker-gps-label');
        const btnDot = document.getElementById('worker-gps-dot');

        this.gpsWatchId = navigator.geolocation.watchPosition(
          pos => {
            const coords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              workerName: myName,
              active: true,
              updatedAt: this.formatTime(new Date()),
              timestamp: Date.now(),
              connectedAt: this.gpsConnectedAt || Date.now()
            };

            if (window.db) {
              db.collection('gps_locations').doc(myName).set(coords, { merge: true }).catch(() => {});
            }

            this.isGpsSharing = true;
            if (btnLabel) btnLabel.textContent = "📍 Desactivar GPS";
            if (btnDot) btnDot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
          },
          err => {
            console.warn("Error GPS:", err);
            this.showToast("Permiso de GPS denegado", "error");
            this.stopGpsSharing();
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );

        this.showToast("GPS Activado: compartiendo posición", "success");
      }

      stopGpsSharing(silent = false) {
        if (this.gpsWatchId !== null) {
          navigator.geolocation.clearWatch(this.gpsWatchId);
          this.gpsWatchId = null;
        }
        this.isGpsSharing = false;
        this.gpsConnectedAt = null;

        const myName = this.getCurrentDisplayName();
        if (window.db && myName) {
          db.collection('gps_locations').doc(myName).set({
            active: false,
            timestamp: Date.now(),
            updatedAt: this.formatTime(new Date())
          }, { merge: true }).catch(() => {});
        }

        const btnLabel = document.getElementById('worker-gps-label');
        const btnDot = document.getElementById('worker-gps-dot');
        if (btnLabel) btnLabel.textContent = "📍 Activar GPS";
        if (btnDot) btnDot.className = "w-2 h-2 rounded-full bg-slate-400";

        if (!silent) this.showToast("GPS Desactivado", "info");
      }

      openAdminGpsModal() {
        document.getElementById('modal-admin-gps').classList.remove('hidden');
        if (!this.adminMap) {
          setTimeout(() => this.initAdminMap(), 150);
        } else {
          setTimeout(() => this.adminMap.invalidateSize(), 200);
        }
        this.subscribeGpsLocations();
      }

      closeAdminGpsModal() {
        document.getElementById('modal-admin-gps').classList.add('hidden');
      }

      initAdminMap() {
        const mapContainer = document.getElementById('gps-map-container');
        if (!mapContainer || this.adminMap) return;

        this.adminMap = L.map('gps-map-container').setView([4.6097, -74.0817], 12);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          referrerPolicy: 'strict-origin-when-cross-origin',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
        }).addTo(this.adminMap);
      }

      subscribeGpsLocations() {
        if (!window.db || this.gpsLocationsUnsubscribe) return;

        this.gpsLocationsUnsubscribe = db.collection('gps_locations').onSnapshot(snap => {
          const locs = {};
          let activeCount = 0;

          snap.forEach(doc => {
            const data = doc.data();
            locs[doc.id] = data;
            const lastSignal = Number(data.timestamp || 0);
            if (data.active && lastSignal && Date.now() - lastSignal < 180000) activeCount++;
          });

          this.locationsData = locs;
          document.getElementById('gps-active-count').textContent = `${activeCount} Activos`;
          this.renderGpsWorkersList();
          this.updateGpsMarkersOnMap();
        }, e => console.error("Snapshot GPS:", e));
      }

      renderGpsWorkersList() {
        const listElem = document.getElementById('gps-workers-list');
        if (!listElem) return;

        const workers = this.workers;
        if (workers.length === 0) {
          listElem.innerHTML = `<p class="text-center py-4 text-slate-400 italic">No hay trabajadores registrados.</p>`;
          return;
        }

        const now = Date.now();
        const orderedWorkers = workers.map((worker, index) => {
          const name = worker.fullName || worker.username;
          const location = this.locationsData[name];
          const timestamp = Number(location?.timestamp || 0);
          const isGpsActive = Boolean(location?.active && timestamp && now - timestamp < 180000);
          return { worker, index, name, location, isGpsActive };
        }).sort((a, b) => {
          if (a.isGpsActive !== b.isGpsActive) return Number(b.isGpsActive) - Number(a.isGpsActive);
          if (a.isGpsActive) {
            const aConnectedAt = Number(a.location.connectedAt || a.location.timestamp || 0);
            const bConnectedAt = Number(b.location.connectedAt || b.location.timestamp || 0);
            if (aConnectedAt !== bConnectedAt) return bConnectedAt - aConnectedAt;
          }
          return a.index - b.index;
        });

        listElem.innerHTML = orderedWorkers.map(({ worker: w, name: wName, location: loc, isGpsActive }) => {
          const safeName = this.escapeHtml(wName);
          const photo = w.photo ? this.escapeHtml(w.photo) : '';
          const avatar = photo
            ? `<img src="${photo}" alt="Foto de ${safeName}" loading="lazy">`
            : `<span>${this.escapeHtml(String(wName).charAt(0).toUpperCase())}</span>`;
          const lastUpdate = this.escapeHtml(loc?.updatedAt || 'Sin señal');

          return `
            <article class="gps-worker-card ${isGpsActive ? 'is-active' : ''}">
              <div class="gps-worker-card-main">
                <span class="gps-worker-avatar seasonal-worker-avatar" aria-hidden="true"><span class="gps-worker-photo-crop">${avatar}</span></span>
                <span class="gps-worker-card-identity">
                  <span class="gps-worker-card-name"><span class="gps-worker-state-dot ${isGpsActive ? 'is-active' : ''}"></span>${safeName}</span>
                  <span class="gps-worker-card-status ${isGpsActive ? 'is-active' : ''}">${isGpsActive ? 'Transmitiendo GPS' : 'GPS inactivo'}</span>
                </span>
                <span class="gps-worker-card-time">${lastUpdate}</span>
              </div>
              ${isGpsActive ? `
                <div class="gps-worker-card-actions">
                  <button type="button" onclick="app.focusWorkerOnMap('${encodeURIComponent(wName)}')" class="gps-worker-action">📍 Ver en mapa</button>
                  <button type="button" onclick="app.openExternalRoute(${loc.latitude}, ${loc.longitude})" class="gps-worker-action is-route">🧭 Trazar ruta</button>
                </div>
              ` : ''}
            </article>
          `;
        }).join('');
      }

      updateGpsMarkersOnMap() {
        if (!this.adminMap) return;

        Object.keys(this.locationsData).forEach(wName => {
          const loc = this.locationsData[wName];
          if (loc.active && loc.latitude && loc.longitude) {
            const popupHtml = `
              <div class="p-1 text-xs">
                <b class="text-slate-900 block">${wName}</b>
                <span class="text-slate-500 text-[10px] block">Actualizado: ${loc.updatedAt}</span>
                <div class="flex gap-1 mt-2">
                  <a href="https://waze.com/ul?ll=${loc.latitude},${loc.longitude}&navigate=yes" target="_blank" class="px-2 py-0.5 bg-cyan-600 text-white rounded text-[10px] font-bold inline-flex items-center gap-1"><img src="assets/media/media-1.png" alt="" aria-hidden="true" class="w-4 h-4 object-contain">Waze</a>
                  <a href="https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}" target="_blank" class="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold inline-flex items-center gap-1"><img src="assets/media/media-2.png" alt="" aria-hidden="true" class="w-4 h-4 object-contain">Maps</a>
                </div>
              </div>
            `;

            if (this.adminMapMarkers[wName]) {
              this.adminMapMarkers[wName].setLatLng([loc.latitude, loc.longitude]).bindPopup(popupHtml);
            } else {
              const marker = L.marker([loc.latitude, loc.longitude]).addTo(this.adminMap).bindPopup(popupHtml);
              this.adminMapMarkers[wName] = marker;
            }
          } else if (this.adminMapMarkers[wName]) {
            this.adminMap.removeLayer(this.adminMapMarkers[wName]);
            delete this.adminMapMarkers[wName];
          }
        });
      }

      focusWorkerOnMap(wName) {
        const marker = this.adminMapMarkers[wName];
        if (marker && this.adminMap) {
          this.adminMap.setView(marker.getLatLng(), 15);
          marker.openPopup();
        }
      }

      openExternalRoute(lat, lng) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
      }

      async startVoiceCall() {
        const targetWorker = this.currentUser.role === 'admin' ? this.activeChatWorker : (this.getCurrentDisplayName());
        const callSessionId = window.crypto?.randomUUID?.() || `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        console.info('[CALL] Iniciando llamada', { sessionId: callSessionId, role: this.currentUser.role, caller: this.getCurrentDisplayName(), documentId: targetWorker });
        let callStage = 'getUserMedia';

        try {
          console.log('[CALL] getUserMedia iniciado', { sessionId: callSessionId, role: this.currentUser.role });
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
          callStage = 'configurar stream local';
          this.localStream = stream;
          console.log('[CALL] Micrófono obtenido');
          console.log('[CALL] Stream local obtenido', { active: stream.active });
          console.log('[CALL] Cantidad audio tracks:', stream.getAudioTracks().length);
          console.log('[CALL] Detalle audio tracks', stream.getAudioTracks().map(track => ({ label: track.label, enabled: track.enabled, muted: track.muted, readyState: track.readyState })));
          this.pendingIceCandidates = [];
          this.callIceCounters = { generated: 0, received: 0, added: 0 };
          this.callSignalingUnsubscribes = [];

          this.openVoiceCallModal({
            name: this.currentUser.role === 'admin' ? targetWorker : this.getAdminPresenceInfo().name,
            status: 'Llamando...',
            isIncoming: false
          });


          callStage = 'crear RTCPeerConnection';
          this.peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          });

          console.log('[CALL] Cantidad de pistas locales:', this.localStream.getAudioTracks().length);
          this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
            console.log('[CALL] Track agregado', { kind: track.kind, enabled: track.enabled, muted: track.muted, readyState: track.readyState });
          });
          console.log('[CALL] Cantidad de tracks agregados:', this.peerConnection.getSenders().filter(sender => sender.track?.kind === 'audio').length);
          this.configureRemoteAudio();

          const callDoc = db.collection('webrtc_calls').doc(targetWorker);
          this.currentCallData = { id: targetWorker, threadId: targetWorker, sessionId: callSessionId, callSessionId, caller: this.getCurrentDisplayName(), callerRole: this.currentUser.role, recipient: this.currentUser.role === 'admin' ? targetWorker : this.getAdminPresenceInfo().name, wasAnswered: false, connectedAt: null };
          console.info('[CALL] Sesión de llamada', { sessionId: callSessionId, role: this.currentUser.role, side: 'caller' });
          const callerCandidates = callDoc.collection('callerCandidates');

          this.peerConnection.onicecandidate = event => {
            if (event.candidate) {
              const candidateData = event.candidate.toJSON();
              if (callSessionId) candidateData.callSessionId = callSessionId;
              this.callIceCounters.generated++;
              console.info('[CALL] ICE generado', { callSessionId: this.currentCallData?.callSessionId || this.currentCallData?.sessionId || null, currentSessionId: this.currentCallData?.sessionId || null, count: this.callIceCounters.generated, role: this.currentUser.role, type: event.candidate.type, protocol: event.candidate.protocol, usernameFragment: event.candidate.usernameFragment || null, sdpMid: event.candidate.sdpMid });
              callerCandidates.add(candidateData).then(() => console.info('[CALL] ICE enviado al canal de señalización', { count: this.callIceCounters.generated, side: 'caller' })).catch(error => console.error('[CALL] Error enviando ICE del llamante:', error));
            } else { console.info('[CALL] ICE gathering completado', { role: this.currentUser.role, generatedCount: this.callIceCounters.generated }); }
          };

          callStage = 'createOffer';
          console.info('[CALL] createOffer iniciado');
          console.info('[CALL] audio tracks locales antes de createOffer:', this.localStream.getAudioTracks().length);
          const offer = await this.peerConnection.createOffer();
          console.log('[CALL] Oferta creada', { type: offer.type, hasSdp: !!offer.sdp, audioLines: (offer.sdp || '').split(/\r?\n/).filter(line => /^m=audio|^a=(sendrecv|sendonly|recvonly|inactive)$/.test(line)) });
          callStage = 'setLocalDescription oferta';
          await this.peerConnection.setLocalDescription(offer);
          console.log('[CALL] setLocalDescription OK', { side: 'caller', type: this.peerConnection.localDescription?.type });

          callStage = 'guardar oferta';
          await callDoc.set({
            caller: this.getCurrentDisplayName(),
            callerRole: this.currentUser.role,
            recipient: this.currentUser.role === 'admin' ? targetWorker : this.getAdminPresenceInfo().name,
            status: 'calling',
            callSessionId,
            offer: { type: offer.type, sdp: offer.sdp },
            timestamp: Date.now()
          });
          console.log('[CALL] Oferta enviada');
          this.callSignalingUnsubscribes.push(callDoc.onSnapshot(async doc => {
            if (doc.exists) {
              const data = doc.data();
              if (data.callSessionId && this.currentCallData?.sessionId && data.callSessionId !== this.currentCallData.sessionId) return;
              if (data.status === 'answered' && data.answer && !this.peerConnection.currentRemoteDescription) {
                if (this.currentCallData) this.currentCallData.wasAnswered = true;
                const answerDesc = new RTCSessionDescription(data.answer);
                try {
                  await this.peerConnection.setRemoteDescription(answerDesc);
                  console.log('[CALL] setRemoteDescription OK', { side: 'caller', type: this.peerConnection.remoteDescription?.type, audioTransceivers: this.peerConnection.getTransceivers().filter(item => item.receiver?.track?.kind === 'audio').map(item => ({ mid: item.mid, direction: item.direction, currentDirection: item.currentDirection, trackState: item.receiver.track.readyState, trackMuted: item.receiver.track.muted })) });
                } catch (error) {
                  console.error('[CALL] setRemoteDescription error', { name: error?.name, message: error?.message }, error);
                  throw error;
                }
                console.log('[CALL] Respuesta recibida');
                await this.flushPendingIceCandidates();
                const label = document.getElementById('call-status-label');
                if (label) label.textContent = 'Conectando audio...';
              } else if (data.status === 'rejected' || data.status === 'ended') {
                this.endVoiceCall(false);
              }
            }
          }, error => console.error('[CALL] Error de señalización:', error)));

          this.callSignalingUnsubscribes.push(callDoc.collection('calleeCandidates').where('callSessionId', '==', callSessionId).onSnapshot(snap => {
            snap.docChanges().forEach(change => {
              if (change.type === 'added') {
                const candidate = change.doc.data();
                this.callIceCounters.received++;
                const candidateUfrag = candidate.usernameFragment || candidate.candidate?.match(/(?:^|\s)ufrag\s+([^\s]+)/)?.[1] || null;
                const sessionMatches = !!candidate.callSessionId && candidate.callSessionId === this.currentCallData?.sessionId;
                console.info('[CALL] ICE recibido', { callSessionId: this.currentCallData?.callSessionId || this.currentCallData?.sessionId || null, candidateSessionId: candidate.callSessionId || null, currentSessionId: this.currentCallData?.sessionId || null, count: this.callIceCounters.received, type: candidate.candidate ? new RTCIceCandidate(candidate).type : null, protocol: candidate.candidate ? new RTCIceCandidate(candidate).protocol : null, usernameFragment: candidateUfrag, sessionMatches });
                this.addRemoteIceCandidate(candidate);
              }
            });
          }, error => console.error('[CALL] Error recibiendo candidatos ICE:', error)));

        } catch (err) {
          console.error('[CALL] Fallo en etapa', callStage, { name: err?.name, message: err?.message }, err);
          console.error('[CALL] getUserMedia o inicio de llamada falló', { name: err?.name, message: err?.message }, err);
          console.error("Error al iniciar llamada WebRTC:", err);
          this.showToast(`No se pudo iniciar la llamada: ${err.message || err}`, "error");
          this.endVoiceCall(false);
        }
      }

      listenIncomingVoiceCalls() {
        if (!window.db) return;
        if (this.callUnsubscribe) { this.callUnsubscribe(); this.callUnsubscribe = null; }
        const myName = this.getCurrentDisplayName();
        const isAdmin = this.currentUser.role === 'admin';
        const calls = db.collection('webrtc_calls');
        const onCall = (id, data) => {
          if (this.currentCallData?.id === id && (data.status === 'ended' || data.status === 'rejected')) {
            console.info('[CALL] Finalización recibida por el otro extremo', { status: data.status, callSessionId: data.callSessionId });
            this.lastIncomingCallId = null;
            this.endVoiceCall(false);
            return;
          }
          if (this.lastIncomingCallId === id && (data.status === 'ended' || data.status === 'rejected')) {
            console.info('[CALL] Finalización recibida por el otro extremo', { status: data.status, callSessionId: data.callSessionId });
            this.lastIncomingCallId = null;
            this.endVoiceCall(false);
            return;
          }
          const timestamp = Number(data.timestamp || 0);
          const ageMs = timestamp ? Date.now() - timestamp : 0;
          const recentEnough = !timestamp || (Number.isFinite(ageMs) && Math.abs(ageMs) <= 10 * 60 * 1000);
          const callerRole = String(data.callerRole || '').trim().toLowerCase();
          const normalizedId = String(id || '').trim().toLowerCase();
          const normalizedMyName = String(myName || '').trim().toLowerCase();
          const workerCaller = callerRole === 'worker' || (callerRole !== 'admin' && this.workers.some(worker =>
            [worker.fullName, worker.username].some(name => String(name || '').trim().toLowerCase() === normalizedId)
          ));
          const isForMe = isAdmin
            ? workerCaller
            : normalizedId === normalizedMyName && callerRole === 'admin';
          if (data.status !== 'calling' || !isForMe || !recentEnough || this.lastIncomingCallId === id) return;
          console.info('[CALL] Llamada entrante detectada', { id, caller: data.caller, callerRole, recipient: data.recipient });
          const callSessionId = data.callSessionId || data.sessionId || null;
          this.currentCallData = { id, ...data, callSessionId, sessionId: callSessionId };
          console.info('[CALL] Sesión entrante normalizada', { callSessionId, currentSessionId: this.currentCallData.sessionId, hasSessionId: !!callSessionId });
          if (!callSessionId) console.error('[CALL] La llamada entrante no tiene callSessionId; no se puede verificar de forma segura la pertenencia de sus ICE candidates.');
          this.lastIncomingCallId = id;
          this.triggerIncomingCallAlert(isAdmin ? (data.caller || 'Trabajador') : this.getAdminPresenceInfo().name);
        };
        if (isAdmin) {
          // Escucha documentos conocidos de técnicos, sin requerir permiso de listar toda la colección.
          const workerDocumentIds = [...new Set(this.workers.flatMap(worker => [worker.fullName, worker.username])
            .map(name => String(name || '').trim()).filter(Boolean))];
          const unsubscribers = workerDocumentIds.map(workerId =>
            calls.doc(workerId).onSnapshot(doc => {
              if (doc.exists) onCall(doc.id, doc.data());
            }, error => console.error(`[CALL] Error escuchando llamada de ${workerId}:`, error))
          );
          try {
            unsubscribers.push(calls.onSnapshot(snapshot => {
              snapshot.docChanges().forEach(change => {
                if (change.type === 'added' || change.type === 'modified') onCall(change.doc.id, change.doc.data());
              });
            }, error => console.warn('[CALL] La escucha global no está permitida; se mantienen las escuchas por técnico:', error)));
          } catch (error) {
            console.warn('[CALL] No se pudo iniciar la escucha global de llamadas:', error);
          }
          this.callUnsubscribe = () => unsubscribers.forEach(unsubscribe => { try { unsubscribe(); } catch (_) {} });
        } else {
          this.callUnsubscribe = calls.doc(myName).onSnapshot(doc => {
            if (doc.exists) onCall(doc.id, doc.data());
          }, error => console.error('[CALL] Error escuchando llamada entrante:', error));
        }
      }

      triggerIncomingCallAlert(callerName) {
        this.openVoiceCallModal({
          name: callerName,
          status: 'Llamada Entrante...',
          isIncoming: true
        });
        this.stopIncomingCallRingtone();
        SoundEngine.playCallAlertSound();
        this.callRingtoneInterval = setInterval(() => SoundEngine.playCallAlertSound(), 1800);
      }

      stopIncomingCallRingtone() {
        clearInterval(this.callRingtoneInterval);
        this.callRingtoneInterval = null;
      }

      async acceptIncomingCall() {
        if (!this.currentCallData) return;
        console.info('[CALL] Sesión de llamada', { sessionId: this.currentCallData.sessionId, role: this.currentUser.role, side: 'callee' });
        this.stopIncomingCallRingtone();
        const acceptButton = document.getElementById('btn-accept-call');
        if (acceptButton) acceptButton.disabled = true;
        const callStatusLabel = document.getElementById('call-status-label');
        if (callStatusLabel) callStatusLabel.textContent = 'Conectando audio...';
        let callStage = 'getUserMedia';

        try {
          console.log('[CALL] getUserMedia iniciado', { sessionId: this.currentCallData.sessionId, role: this.currentUser.role, direction: 'incoming' });
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
          console.log('[CALL] Micrófono obtenido');
          console.log('[CALL] Stream local obtenido', { active: stream.active });
          console.log('[CALL] Cantidad audio tracks:', stream.getAudioTracks().length);
          console.log('[CALL] Detalle audio tracks', stream.getAudioTracks().map(track => ({ label: track.label, enabled: track.enabled, muted: track.muted, readyState: track.readyState })));
          if (!this.currentCallData) { stream.getTracks().forEach(track => track.stop()); console.info('[CALL] Stream liberado: la llamada terminó antes de completar getUserMedia'); return; }
          callStage = 'configurar stream local';
          this.localStream = stream;
          this.pendingIceCandidates = [];
          this.callIceCounters = { generated: 0, received: 0, added: 0 };
          this.callSignalingUnsubscribes = [];

          callStage = 'crear RTCPeerConnection';
          this.peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          });

          console.log('[CALL] Cantidad de pistas locales:', this.localStream.getAudioTracks().length);
          this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
            console.log('[CALL] Track agregado', { kind: track.kind, enabled: track.enabled, muted: track.muted, readyState: track.readyState });
          });
          console.log('[CALL] Cantidad de tracks agregados:', this.peerConnection.getSenders().filter(sender => sender.track?.kind === 'audio').length);
          this.configureRemoteAudio();

          const callDoc = db.collection('webrtc_calls').doc(this.currentCallData.id);
          this.callSignalingUnsubscribes.push(callDoc.onSnapshot(doc => {
            if (!doc.exists) return;
            const call = doc.data();
            if (call.callSessionId && this.currentCallData?.sessionId && call.callSessionId !== this.currentCallData.sessionId) return;
            if (call.status === 'ended' || call.status === 'rejected') {
              console.info('[CALL] Finalización recibida por el otro extremo', { status: call.status, callSessionId: call.callSessionId });
              this.endVoiceCall(false);
            }
          }, error => console.error('[CALL] Error siguiendo el estado de la llamada:', error)));
          const calleeCandidates = callDoc.collection('calleeCandidates');

          this.peerConnection.onicecandidate = event => {
            if (event.candidate) {
              const candidateData = event.candidate.toJSON();
              if (this.currentCallData?.sessionId) candidateData.callSessionId = this.currentCallData.sessionId;
              this.callIceCounters.generated++;
              console.info('[CALL] ICE generado', { callSessionId: this.currentCallData?.callSessionId || this.currentCallData?.sessionId || null, currentSessionId: this.currentCallData?.sessionId || null, count: this.callIceCounters.generated, role: this.currentUser.role, type: event.candidate.type, protocol: event.candidate.protocol, usernameFragment: event.candidate.usernameFragment || null, sdpMid: event.candidate.sdpMid });
              calleeCandidates.add(candidateData).then(() => console.info('[CALL] ICE enviado al canal de señalización', { count: this.callIceCounters.generated, side: 'callee' })).catch(error => console.error('[CALL] Error enviando ICE del receptor:', error));
            } else { console.info('[CALL] ICE gathering completado', { role: this.currentUser.role, generatedCount: this.callIceCounters.generated }); }
          };

          callStage = 'setRemoteDescription oferta';
          console.info('[CALL] Oferta remota recibida; aplicando');
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.currentCallData.offer));
          console.log('[CALL] setRemoteDescription OK', { side: 'callee', type: this.peerConnection.remoteDescription?.type, audioTransceivers: this.peerConnection.getTransceivers().filter(item => item.receiver?.track?.kind === 'audio').map(item => ({ mid: item.mid, direction: item.direction, currentDirection: item.currentDirection, trackState: item.receiver.track.readyState, trackMuted: item.receiver.track.muted })) });
          console.info('[CALL] Oferta remota aplicada');
          callStage = 'createAnswer';
          console.info('[CALL] createAnswer iniciado');
          const answer = await this.peerConnection.createAnswer();
          console.log('[CALL] Respuesta creada', { type: answer.type, hasSdp: !!answer.sdp, audioLines: (answer.sdp || '').split(/\r?\n/).filter(line => /^m=audio|^a=(sendrecv|sendonly|recvonly|inactive)$/.test(line)) });
          callStage = 'setLocalDescription respuesta';
          await this.peerConnection.setLocalDescription(answer);
          console.log('[CALL] setLocalDescription OK', { side: 'callee', type: this.peerConnection.localDescription?.type });

          callStage = 'guardar respuesta';
          await callDoc.update({
            status: 'answered',
            answer: { type: answer.type, sdp: answer.sdp }
          });
          if (this.currentCallData) this.currentCallData.wasAnswered = true;
          console.log('[CALL] Respuesta enviada');
          document.getElementById('btn-accept-call')?.classList.add('hidden');
          await this.flushPendingIceCandidates();
          const callStatus = document.getElementById('call-status-label');
          if (callStatus) callStatus.textContent = 'Conectando audio...';

          this.callSignalingUnsubscribes.push(callDoc.collection('callerCandidates').where('callSessionId', '==', this.currentCallData.sessionId).onSnapshot(snap => {
            snap.docChanges().forEach(change => {
              if (change.type === 'added') {
                const candidate = change.doc.data();
                this.callIceCounters.received++;
                const candidateUfrag = candidate.usernameFragment || candidate.candidate?.match(/(?:^|\s)ufrag\s+([^\s]+)/)?.[1] || null;
                const sessionMatches = !!candidate.callSessionId && candidate.callSessionId === this.currentCallData?.sessionId;
                console.info('[CALL] ICE recibido', { callSessionId: this.currentCallData?.callSessionId || this.currentCallData?.sessionId || null, candidateSessionId: candidate.callSessionId || null, currentSessionId: this.currentCallData?.sessionId || null, count: this.callIceCounters.received, type: candidate.candidate ? new RTCIceCandidate(candidate).type : null, protocol: candidate.candidate ? new RTCIceCandidate(candidate).protocol : null, usernameFragment: candidateUfrag, sessionMatches });
                this.addRemoteIceCandidate(candidate);
              }
            });
          }, error => console.error('[CALL] Error recibiendo candidatos ICE:', error)));


        } catch (err) {
          console.error('[CALL] Fallo en etapa', callStage, { name: err?.name, message: err?.message }, err);
          console.error('[CALL] getUserMedia o aceptación falló', { name: err?.name, message: err?.message }, err);
          console.error("Error al aceptar llamada:", err);
          this.endVoiceCall();
        }
      }

      configureRemoteAudio() {
        const audio = document.getElementById('remote-audio-stream'); if (!audio) { console.error('[CALL] Elemento de audio remoto no encontrado'); return; }
        const peerConnection = this.peerConnection;
        audio.autoplay = true; audio.playsInline = true; audio.volume = 1;
        const audioStyle = getComputedStyle(audio);
        console.info('[CALL] Elemento audio verificado', { display: audioStyle.display, visibility: audioStyle.visibility, muted: audio.muted, playsInline: audio.playsInline });
        this.peerConnection.ontrack = async event => {
          console.log('[CALL] ontrack ejecutado', { sessionId: this.currentCallData?.sessionId, kind: event.track?.kind, readyState: event.track?.readyState, streamCount: event.streams?.length || 0 });
          if (event.streams && event.streams[0]) audio.srcObject = event.streams[0];
          else if (event.track) { const stream = new MediaStream(); stream.addTrack(event.track); audio.srcObject = stream; }
          const remoteTracks = audio.srcObject?.getAudioTracks?.() || [];
          console.log('[CALL] Audio remoto conectado');
          console.log('[CALL] Stream remoto recibido', { active: audio.srcObject?.active, streamCount: event.streams?.length || 0 });
          console.log('[CALL] Cantidad tracks remotos:', (event.streams?.[0] || audio.srcObject)?.getTracks?.().length || 0, { audioTracks: remoteTracks.length, tracks: remoteTracks.map(track => ({ kind: track.kind, enabled: track.enabled, muted: track.muted, readyState: track.readyState })) });
          console.info('[CALL] srcObject asignado', !!audio.srcObject);
          console.info('[CALL] muted:', audio.muted);
          console.info('[CALL] playsInline:', audio.playsInline);
          const remoteAudioStyle = getComputedStyle(audio);
          console.info('[CALL] Estilo calculado del audio', { display: remoteAudioStyle.display, visibility: remoteAudioStyle.visibility });
          try {
            console.log('[CALL] audio.play ejecutado');
            await audio.play();
            document.getElementById('btn-enable-remote-audio')?.classList.add('hidden');
            console.log('[CALL] Audio reproduciéndose');
          } catch (e) {
            document.getElementById('btn-enable-remote-audio')?.classList.remove('hidden');
            console.error('[CALL] Error reproduciendo audio', e);
            console.warn('[CALL] Autoplay bloqueado; toca Activar audio para habilitar la salida.', e);
          }
        };
        console.info('[CALL] ontrack registrado antes de recibir descripción remota', { registered: typeof this.peerConnection.ontrack === 'function', signalingState: this.peerConnection.signalingState });
        this.peerConnection.oniceconnectionstatechange = () => {
          const state = peerConnection?.iceConnectionState;
          console.log('[CALL] iceConnectionState', state, { sessionId: this.currentCallData?.sessionId, connectionState: peerConnection.connectionState, signalingState: peerConnection.signalingState });
          this.logIceDiagnostics(peerConnection, 'iceConnectionState');
          if (state === 'connected' || state === 'completed') console.info('[CALL] ICE alcanzó estado', state);
          if (state === 'connected' || state === 'completed') this.onCallConnected();
          else if (state === 'failed') {
            const label = document.getElementById('call-status-label');
            if (label) label.textContent = 'Sin ruta de audio';
            console.error('[CALL] ICE alcanzó estado failed; revisar candidatos generados, recibidos y agregados en ambos extremos.');
          }
        };
        peerConnection.onconnectionstatechange = () => {
          console.log('[CALL] connectionState', peerConnection.connectionState, { sessionId: this.currentCallData?.sessionId, signalingState: peerConnection.signalingState, iceConnectionState: peerConnection.iceConnectionState });
          this.logIceDiagnostics(peerConnection, 'connectionState');
        };
        peerConnection.onsignalingstatechange = () => {
          console.log('[CALL] signalingState', peerConnection.signalingState, { sessionId: this.currentCallData?.sessionId });
          this.logIceDiagnostics(peerConnection, 'signalingState');
        };
        peerConnection.onicegatheringstatechange = () => console.log('[CALL] Estado ICE gathering', peerConnection.iceGatheringState, { sessionId: this.currentCallData?.sessionId });
        this.peerConnection.onicecandidateerror = event => console.warn('[CALL] Error ICE:', event.errorCode, event.errorText);
        clearInterval(peerConnection._callStatsInterval);
        this.logIceDiagnostics(peerConnection, 'diagnóstico inicial');
        peerConnection._callStatsInterval = setInterval(() => {
          if (peerConnection.connectionState === 'connected' || peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'closed') {
            clearInterval(peerConnection._callStatsInterval);
            peerConnection._callStatsInterval = null;
            if (peerConnection.connectionState !== 'connected') this.logIceDiagnostics(peerConnection, 'estado terminal');
            return;
          }
          this.logIceDiagnostics(peerConnection, 'seguimiento');
        }, 2500);
      }

      async logIceDiagnostics(peerConnection, trigger) {
        if (!peerConnection || typeof peerConnection.getStats !== 'function') return;
        try {
          const report = await peerConnection.getStats();
          const stats = Array.from(report.values());
          const transports = stats.filter(item => item.type === 'transport' && item.selectedCandidatePairId);
          const candidatePairs = stats.filter(item => item.type === 'candidate-pair');
          const candidateById = new Map(stats.filter(item => item.type === 'local-candidate' || item.type === 'remote-candidate').map(item => [item.id, item]));
          let selectedPair = null;
          for (const transport of transports) {
            const pair = report.get(transport.selectedCandidatePairId);
            if (pair) { selectedPair = pair; break; }
          }
          if (!selectedPair) selectedPair = candidatePairs.find(pair => pair.selected === true) || null;
          const describePair = pair => {
            const local = candidateById.get(pair.localCandidateId);
            const remote = candidateById.get(pair.remoteCandidateId);
            return {
              id: pair.id, state: pair.state, nominated: pair.nominated, selected: pair.selected === true,
              local: local ? { type: local.candidateType, protocol: local.protocol, relayProtocol: local.relayProtocol || null } : null,
              remote: remote ? { type: remote.candidateType, protocol: remote.protocol, relayProtocol: remote.relayProtocol || null } : null,
              currentRoundTripTime: pair.currentRoundTripTime ?? null,
              bytesSent: pair.bytesSent ?? 0, bytesReceived: pair.bytesReceived ?? 0
            };
          };
          const state = { trigger, sessionId: this.currentCallData?.sessionId || null, connectionState: peerConnection.connectionState, iceConnectionState: peerConnection.iceConnectionState, signalingState: peerConnection.signalingState, generated: this.callIceCounters?.generated ?? null, received: this.callIceCounters?.received ?? null, added: this.callIceCounters?.added ?? null };
          if (selectedPair) console.info('[CALL] selectedCandidatePair ' + JSON.stringify({ ...state, pair: describePair(selectedPair) }));
          else console.info('[CALL] no selectedCandidatePair ' + JSON.stringify({ ...state, candidatePairCount: candidatePairs.length, pairs: candidatePairs.map(describePair) }));
        } catch (error) {
          console.error('[CALL] getStats failed', { trigger, sessionId: this.currentCallData?.sessionId || null, name: error?.name, message: error?.message }, error);
        }
      }

      async resumeRemoteAudio() {
        const audio = document.getElementById('remote-audio-stream');
        if (!audio?.srcObject) return;
        try {
          await audio.play();
          document.getElementById('btn-enable-remote-audio')?.classList.add('hidden');
          console.log('[CALL] Audio reproduciéndose');
        } catch (error) { console.warn('[CALL] No se pudo iniciar el audio remoto:', error); }
      }

      async addRemoteIceCandidate(candidateData) {
        const currentSessionId = this.currentCallData?.sessionId || null;
        const callSessionId = this.currentCallData?.callSessionId || currentSessionId;
        const candidateSessionId = candidateData?.callSessionId || null;
        const correlation = { callSessionId, candidateSessionId, currentSessionId };
        if (!this.peerConnection || !candidateData) { console.warn('[CALL] ICE recibido pero no agregado: falta PeerConnection o candidato', correlation); return; }
        if (!currentSessionId || !candidateSessionId || candidateSessionId !== currentSessionId) {
          console.warn('[CALL] ICE descartado: candidato sin sessionId verificable o de otra llamada', { ...correlation, reason: !currentSessionId ? 'no hay sesión activa identificada' : !candidateSessionId ? 'candidateSessionId ausente' : 'sesión distinta' });
          return;
        }
        if (!this.peerConnection.remoteDescription) {
          this.pendingIceCandidates.push(candidateData);
          console.info('[CALL] ICE en cola hasta aplicar descripción remota', { ...correlation, queued: this.pendingIceCandidates.length, remoteDescription: false, iceConnectionState: this.peerConnection.iceConnectionState });
          return;
        }
        const { callSessionId: _candidateSessionId, ...iceCandidate } = candidateData;
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
          this.callIceCounters.added++;
          const parsedCandidate = iceCandidate.candidate ? new RTCIceCandidate(iceCandidate) : null;
          console.info('[CALL] ICE agregado', { callSessionId, candidateSessionId, currentSessionId, count: this.callIceCounters.added, type: parsedCandidate?.type || null, protocol: parsedCandidate?.protocol || null, usernameFragment: iceCandidate.usernameFragment || iceCandidate.candidate?.match(/(?:^|\s)ufrag\s+([^\s]+)/)?.[1] || null, sdpMid: iceCandidate.sdpMid });
        } catch (error) { console.warn('[CALL] Error al agregar ICE', { name: error?.name, message: error?.message, sdpMid: iceCandidate.sdpMid }, error); }
      }

      async flushPendingIceCandidates() {
        const queued = this.pendingIceCandidates.splice(0);
        const before = this.callIceCounters?.added || 0;
        console.info('[CALL] Vaciando cola ICE', { callSessionId: this.currentCallData?.callSessionId || this.currentCallData?.sessionId || null, currentSessionId: this.currentCallData?.sessionId || null, queued: queued.length, remoteDescription: !!this.peerConnection?.remoteDescription });
        for (const candidate of queued) await this.addRemoteIceCandidate(candidate);
        console.info('[CALL] Cola ICE procesada', { queued: queued.length, added: (this.callIceCounters?.added || 0) - before, remaining: this.pendingIceCandidates.length, iceConnectionState: this.peerConnection?.iceConnectionState });
      }

      openVoiceCallModal({ name, status, isIncoming }) {
        document.getElementById('call-user-name').textContent = name;
        document.getElementById('call-status-label').textContent = status;
        document.getElementById('modal-voice-call').classList.remove('hidden');

        const btnAccept = document.getElementById('btn-accept-call');
        if (isIncoming) {
          btnAccept.disabled = false;
          btnAccept.classList.remove('hidden');
        } else {
          btnAccept.classList.add('hidden');
        }
      }

      onCallConnected() {
        if (this.callTimerInterval) return;
        if (this.currentCallData) this.currentCallData.connectedAt = Date.now();
        document.getElementById('call-status-label').textContent = 'Conectado';
        document.getElementById('btn-accept-call').classList.add('hidden');
        const timerElem = document.getElementById('call-duration-timer');
        timerElem.classList.remove('hidden');

        this.callSeconds = 0;
        clearInterval(this.callTimerInterval);
        this.callTimerInterval = setInterval(() => {
          this.callSeconds++;
          const mins = String(Math.floor(this.callSeconds / 60)).padStart(2, '0');
          const secs = String(this.callSeconds % 60).padStart(2, '0');
          timerElem.textContent = `${mins}:${secs}`;
        }, 1000);
      }

      toggleMuteCall() {
        if (!this.localStream) return;
        this.isMuted = !this.isMuted;
        this.localStream.getAudioTracks().forEach(t => t.enabled = !this.isMuted);

        const icon = document.getElementById('btn-mute-icon');
        const btn = document.getElementById('btn-mute-call');
        if (this.isMuted) {
          btn.className = "p-3.5 bg-rose-800 text-white rounded-full transition";
          icon.setAttribute('data-lucide', 'mic-off');
        } else {
          btn.className = "p-3.5 bg-slate-800 text-slate-200 rounded-full transition";
          icon.setAttribute('data-lucide', 'mic');
        }
        if (window.lucide) lucide.createIcons();
      }

      async saveCallHistory(callData, durationSeconds) {
        if (!window.db || !callData?.id) return;
        const threadId = callData.threadId || callData.id;
        const callerName = callData.caller || callData.callerName || 'Usuario';
        const callerRole = callData.callerRole || 'worker';
        const callDate = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const callTime = this.formatTime(new Date());
        const callOutcome = callData.connectedAt ? 'completed' : callData.wasAnswered ? 'failed' : 'missed';
        const summary = callOutcome === 'completed' ? `📞 Llamada • ${durationSeconds}s` : callOutcome === 'missed' ? '📞 Llamada perdida' : '📞 Llamada sin conexión';
        const record = {
          type: 'call',
          text: summary,
          callId: callData.sessionId || `call-${callData.id}-${Date.now()}`,
          callerName, callerRole, callOutcome, durationSeconds: Math.max(0, Number(durationSeconds || 0)),
          callDate, senderName: callerName, senderRole: callerRole, recipient: callData.recipient || '',
          time: callTime, timestamp: Date.now(), status: 'read'
        };
        try {
          await db.collection('chats_internos').doc(threadId).collection('mensajes').doc(`call_${record.callId}`).set(record, { merge: true });
          await db.collection('chats_internos').doc(threadId).set({ lastMessage: summary, lastTime: callTime, lastTimestamp: record.timestamp, workerName: threadId }, { merge: true });
          console.info('[CALL] Registro guardado en conversación', { threadId, callId: record.callId, callOutcome });
        } catch (error) { console.error('[CALL] No se pudo guardar el historial de llamada:', error); }
      }

      endVoiceCall(notifyServer = true) {
        console.info('[CALL] Finalizando llamada', { notifyServer, callId: this.currentCallData?.id, sessionId: this.currentCallData?.sessionId });
        console.info('[CALL] Conteo ICE al finalizar', { ...(this.callIceCounters || {}) });
        const endedCallData = this.currentCallData ? { ...this.currentCallData } : null;
        const endedDurationSeconds = endedCallData?.connectedAt ? Math.max(this.callSeconds, Math.round((Date.now() - endedCallData.connectedAt) / 1000)) : 0;
        if (notifyServer && endedCallData?.id) this.saveCallHistory(endedCallData, endedDurationSeconds);
        this.stopIncomingCallRingtone();
        clearInterval(this.callTimerInterval);
        this.callTimerInterval = null;
        this.callSeconds = 0;

        if (this.localStream) {
          this.localStream.getTracks().forEach(t => t.stop());
          this.localStream = null;
        }

        if (this.peerConnection) {
          clearInterval(this.peerConnection._callStatsInterval);
          this.peerConnection._callStatsInterval = null;
          this.peerConnection.close();
          this.peerConnection = null;
        }
        this.callSignalingUnsubscribes.forEach(unsubscribe => { try { unsubscribe(); } catch (_) {} });
        this.callSignalingUnsubscribes = [];
        this.pendingIceCandidates = [];

        if (notifyServer && window.db && this.currentCallData?.id) {
          const endedCallId = this.currentCallData.id;
          db.collection('webrtc_calls').doc(endedCallId).update({
            status: 'ended'
          }).then(() => console.info('[CALL] Finalización enviada al otro extremo', { callId: endedCallId }))
            .catch(error => console.error('[CALL] No se pudo avisar que la llamada terminó:', error));
        }

        document.getElementById('modal-voice-call').classList.add('hidden');
        document.getElementById('call-duration-timer').classList.add('hidden');
        const remoteAudio = document.getElementById('remote-audio-stream');
        if (remoteAudio) { remoteAudio.pause(); remoteAudio.srcObject = null; }
        document.getElementById('btn-enable-remote-audio')?.classList.add('hidden');
        if (this.lastIncomingCallId === endedCallData?.id) this.lastIncomingCallId = null;
        this.currentCallData = null;
      }

      initChatModule() {
        const isAdmin = this.currentUser.role === 'admin';
        const sidebar = document.getElementById('chat-sidebar');
        const backBar = document.getElementById('chat-mobile-back-bar');
        document.getElementById('chat-window-modal')?.classList.toggle('worker-chat-mode', !isAdmin);

        const options = document.getElementById('chat-conversation-options-dropdown');
        if (options?.parentElement) options.parentElement.classList.toggle('hidden', !isAdmin);
        const archivedButton = document.getElementById('btn-toggle-archived');
        if (archivedButton) archivedButton.classList.toggle('hidden', !isAdmin);
        if (isAdmin) {
          sidebar.classList.remove('hidden');
          if (backBar) backBar.classList.remove('hidden');
          const firstWorker = this.workers[0]?.fullName || this.workers[0]?.username || 'Jeampaul';
          this.activeChatWorker = firstWorker;
          this.openChatTabs = [];
          this.subscribeAllChatThreads();
          this.renderChatTabs();
          this.renderActiveChatHeader();
        } else {
          sidebar.classList.add('hidden');
          if (backBar) backBar.classList.add('hidden');
          this.activeChatWorker = this.getCurrentDisplayName();
          this.renderActiveChatHeader();
        }

        this.subscribeChatMessages();
        this.setupMultiWorkerChatListeners();
      }

      setupMultiWorkerChatListeners() {
        if (!window.db || !this.currentUser) return;
        const isAdmin = this.currentUser.role === 'admin';
        const names = isAdmin ? this.workers.map(w => w.fullName || w.username) : [this.getCurrentDisplayName()];
        names.forEach(wName => {
          if (this.dedicatedWorkerUnsubscribes[wName]) return;
          const query = db.collection('chats_internos').doc(wName).collection('mensajes').orderBy('timestamp', 'asc');
          let cancelled = false, unsubscribe = null, unsubscribeThreadDoc = null, baselineIds = new Set(), firstSnapshot = true;
          this.dedicatedWorkerUnsubscribes[wName] = () => { cancelled = true; if (unsubscribe) unsubscribe(); if (unsubscribeThreadDoc) unsubscribeThreadDoc(); };
          unsubscribeThreadDoc = db.collection('chats_internos').doc(wName).onSnapshot(threadDoc => {
            const threadData = threadDoc.exists ? threadDoc.data() : {};
            const otherRole = isAdmin ? 'worker' : 'admin';
            const isOtherTyping = Boolean(threadData.typing && threadData.typing[otherRole]);
            if (this.chatTypingByWorker[wName] === isOtherTyping) return;
            this.chatTypingByWorker[wName] = isOtherTyping;
            if (isAdmin) this.renderConversationsSidebar();
            this.updateMessengerWindowTyping(wName);
            this.renderChatTypingIndicators();
          }, error => console.error('[CHAT] Error escuchando escritura de ' + wName + ':', error));
          const attach = () => {
            if (cancelled) return;
            unsubscribe = query.onSnapshot(snap => {
              this.refreshChatThreadSummary(wName, snap, isAdmin);
              snap.docChanges().forEach(change => {
                if (change.type !== 'added') return;
                const msgId = change.doc.id;
                if (baselineIds.has(msgId)) return;
                const data = change.doc.data();
                if (data.type === 'call') return;
                const fromOther = isAdmin ? data.senderRole === 'worker' : data.senderRole === 'admin';
                if (!fromOther) return;
                this.notifyIncomingChatMessage(wName, msgId, data);
              });
              if (firstSnapshot) { firstSnapshot = false; baselineIds.clear(); }
            }, error => console.error('[CHAT] Error escuchando mensajes de ' + wName + ':', error));
          };
          query.get().then(snapshot => {
            if (cancelled) return;
            snapshot.forEach(doc => baselineIds.add(doc.id));
            attach();
          }).catch(error => {
            console.warn('[CHAT] No se pudo cargar la línea base de mensajes; se omitirá solo la primera lectura:', error);
            if (cancelled) return;
            let ignoreFirstSnapshot = true;
            unsubscribe = query.onSnapshot(snap => {
              this.refreshChatThreadSummary(wName, snap, isAdmin);
              if (ignoreFirstSnapshot) {
                snap.docChanges().forEach(change => { if (change.type === 'added') baselineIds.add(change.doc.id); });
                ignoreFirstSnapshot = false;
                baselineIds.clear();
                return;
              }
              snap.docChanges().forEach(change => {
                if (change.type !== 'added' || baselineIds.has(change.doc.id)) return;
                const data = change.doc.data();
                if (data.type === 'call') return;
                const fromOther = isAdmin ? data.senderRole === 'worker' : data.senderRole === 'admin';
                if (!fromOther) return;
                this.notifyIncomingChatMessage(wName, change.doc.id, data);
              });
            }, listenError => console.error('[CHAT] Error escuchando mensajes de ' + wName + ':', listenError));
          });
        });
      }

      refreshChatThreadSummary(wName, snapshot, isAdmin) {
        const docs = snapshot?.docs || [];
        const myRole = this.currentUser?.role;
        let latest = null;
        let unreadCount = 0;
        docs.forEach(doc => {
          const data = doc.data();
          const timestamp = Number(data.timestamp || 0);
          if (!latest || timestamp >= latest.timestamp) latest = { data, timestamp };
          const isIncoming = isAdmin ? data.senderRole === 'worker' : data.senderRole === 'admin';
          if (isIncoming && data.status !== 'read' && !data[`hiddenFor_${myRole}`]) unreadCount++;
        });
        const summary = {
          hasMessages: docs.length > 0,
          lastMessage: latest?.data.text || '',
          lastTime: latest?.data.time || '',
          lastTimestamp: latest?.timestamp || 0,
          unreadCount
        };
        this.chatThreadSummaries[wName] = summary;
        if (latest && this.chatActivityRanks[wName] === undefined) {
          this.chatActivityRanks[wName] = ++this.chatActivitySequence;
        }
        if (isAdmin) this.renderConversationsSidebar();
        else if (wName === this.getCurrentDisplayName()) {
          const count = summary.hasMessages ? summary.unreadCount : Number(this.workerUnreadCount || 0);
          this.updateChatLauncherUnread(count);
        }
      }

      ensureIncomingWorkerWindow(wName) {
        if (this.currentUser?.role !== 'admin' || window.innerWidth < 640) return;
        if (!Array.isArray(this.openChatTabs)) this.openChatTabs = [];
        const alreadyOpen = this.openChatTabs.includes(wName);
        if (!alreadyOpen) {
          this.openChatTabs.push(wName);
          this.minimizedChatWindows[wName] = true;
        }
        if (!alreadyOpen || this.minimizedChatWindows[wName]) this.chatDockUnreadByWorker.add(wName);
        this.renderMessengerWindows();
      }

      notifyIncomingChatMessage(wName, msgId, data) {
        const uniqueId = `${wName}:${msgId}`;
        if (this.notifiedChatMessageIds.has(uniqueId)) return;
        this.notifiedChatMessageIds.add(uniqueId);
        if (this.notifiedChatMessageIds.size > 500) {
          const oldestId = this.notifiedChatMessageIds.values().next().value;
          this.notifiedChatMessageIds.delete(oldestId);
        }
        this.chatActivityRanks[wName] = ++this.chatActivitySequence;
        this.ensureIncomingWorkerWindow(wName);
        if (this.prefs.sound) SoundEngine.playMessageSound();
        this.showPopupNotification({
          title: `${data.senderName || wName} te envió un mensaje`,
          details: data.text || '', type: 'chat', icon: '💬',
          onClick: () => this.openDirectWorkerChat(wName)
        });
        if (this.currentUser?.role === 'admin') this.renderConversationsSidebar();
      }

      clearDedicatedWorkerChatListeners() {
        Object.keys(this.dedicatedWorkerUnsubscribes).forEach(k => {
          this.dedicatedWorkerUnsubscribes[k]();
        });
        this.dedicatedWorkerUnsubscribes = {};
      }

      subscribeAllChatThreads() {
        if (!window.db || this.chatThreadsUnsubscribe) return;

        this.chatThreadsUnsubscribe = db.collection('chats_internos')
          .orderBy('lastTimestamp', 'desc')
          .onSnapshot(snap => {
            const convs = {};
            snap.forEach(doc => {
              const data = doc.data();
              const previous = this.conversations[doc.id];
              if (previous && (previous.lastTimestamp !== data.lastTimestamp || previous.lastMessage !== data.lastMessage)) {
                this.chatActivityRanks[doc.id] = ++this.chatActivitySequence;
              }
              convs[doc.id] = data;
            });
            this.conversations = convs;
            this.renderConversationsSidebar();
          });
      }

      formatChatLastActivity(timestamp, online) {
        if (online) return 'Ahora';
        const elapsed = Date.now() - Number(timestamp || 0);
        if (!timestamp || elapsed < 0) return 'Sin registro';
        const minutes = Math.floor(elapsed / 60000);
        if (minutes < 1) return 'Hace un momento';
        if (minutes < 60) return `Hace ${minutes} min`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Hace ${hours} h`;
        const days = Math.floor(hours / 24);
        return `Hace ${days} día${days === 1 ? '' : 's'}`;
      }

      filterChatContacts(query) {
        const normalized = String(query || '').trim().toLocaleLowerCase();
        document.querySelectorAll('#chat-conversations-list .chat-contact-row').forEach(row => {
          row.style.display = normalized && !row.dataset.chatContact?.includes(normalized) ? 'none' : 'flex';
        });
      }

      updateChatLauncherUnread(count) {
        const visibleCount = this.prefs.chatBadge ? Math.max(0, Number(count) || 0) : 0;
        const badge = document.getElementById('chat-unread-badge');
        const launcher = document.getElementById('chat-floating-button-container');
        if (badge) {
          badge.textContent = visibleCount > 99 ? '99+' : String(visibleCount);
          badge.classList.toggle('hidden', !visibleCount);
        }
        launcher?.classList.toggle('has-unread', Boolean(visibleCount));
      }

      renderConversationsSidebar() {
        const listElem = document.getElementById('chat-conversations-list');
        if (!listElem) return;

        const ONLINE_THRESHOLD_MS = 60 * 1000;
        const now = Date.now();
        const sortedWorkers = [...this.workers].sort((a, b) => {
          const nameA = a.fullName || a.username;
          const nameB = b.fullName || b.username;
          const rankA = this.chatActivityRanks[nameA] || 0;
          const rankB = this.chatActivityRanks[nameB] || 0;
          if (rankA !== rankB) return rankB - rankA;
          const timeA = Math.max(Number(this.conversations[nameA]?.lastTimestamp || 0), Number(this.chatThreadSummaries[nameA]?.lastTimestamp || 0));
          const timeB = Math.max(Number(this.conversations[nameB]?.lastTimestamp || 0), Number(this.chatThreadSummaries[nameB]?.lastTimestamp || 0));
          return timeB - timeA;
        });

        const unreadTotal = sortedWorkers.reduce((sum, worker) => {
          const name = worker.fullName || worker.username;
          const summary = this.chatThreadSummaries[name];
          const count = summary?.hasMessages ? summary.unreadCount : Number(this.conversations[name]?.unreadByAdmin || 0);
          return sum + count;
        }, 0);
        this.updateChatLauncherUnread(unreadTotal);

        const filtered = sortedWorkers.filter(worker => {
          const name = worker.fullName || worker.username;
          const thread = this.conversations[name];
          if (this.showArchived) return thread && thread.archived;
          return !(thread && thread.archived);
        });

        if (filtered.length === 0) {
          listElem.innerHTML = `<p class="p-4 text-center text-slate-400 italic text-[11px]">No hay conversaciones ${this.showArchived ? 'archivadas' : ''}.</p>`;
          return;
        }

        listElem.innerHTML = filtered.map(worker => {
          const workerName = worker.fullName || worker.username;
          const safeName = this.escapeHtml(workerName);
          const thread = this.conversations[workerName] || {};
          const summary = this.chatThreadSummaries[workerName];
          const presenceStatus = this.getPresenceStatus(worker);
          const isOnline = presenceStatus === 'available';
          const presenceLabel = this.getPresenceLabel(presenceStatus);
          const unread = this.prefs.chatBadge ? (summary?.hasMessages ? summary.unreadCount : Number(thread.unreadByAdmin || 0)) : 0;
          const preview = summary?.hasMessages ? summary.lastMessage : (thread.lastMessage || 'Sin mensajes');
          const previewTime = summary?.hasMessages ? summary.lastTime : (thread.lastTime || '');
          const activity = this.formatChatLastActivity(worker.lastHeartbeat, isOnline);
          const isTyping = Boolean(this.chatTypingByWorker[workerName]);
          return `
            <button type="button" data-chat-contact="${safeName.toLocaleLowerCase()}" onclick="app.selectChatConversation(decodeURIComponent('${encodeURIComponent(workerName)}'))" class="chat-contact-row ${isOnline ? 'is-online' : ''} ${unread > 0 ? 'has-unread' : ''}">
              <span class="chat-contact-avatar seasonal-worker-avatar">${worker.photo ? `<img src="${this.escapeHtml(worker.photo)}" alt="Foto de ${safeName}">` : this.escapeHtml(String(workerName).charAt(0).toUpperCase())}${isOnline ? '<span class="chat-online-ring"></span>' : ''}</span>
              <span class="chat-contact-copy">
                <span class="chat-contact-topline"><span class="chat-contact-name-status"><span class="chat-contact-name">${safeName}</span><span class="presence-label is-${presenceStatus}">${presenceLabel}</span></span><span class="chat-contact-time">${this.escapeHtml(previewTime)}</span></span>
                <span class="chat-contact-preview">${this.escapeHtml(preview || 'Sin mensajes')}</span>
                ${isTyping ? '<span class="chat-contact-typing">Escribiendo<span class="chat-typing-dots" aria-label="Escribiendo"><i></i><i></i><i></i></span></span>' : ''}
                <span class="chat-contact-activity">Última actividad: ${activity}</span>
              </span>
              ${unread > 0 ? `<span class="chat-unread-pill">${unread > 99 ? '99+' : unread} ${unread === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}</span>` : ''}
            </button>
          `;
        }).join('');
        const search = document.getElementById('chat-contact-search');
        if (search?.value) this.filterChatContacts(search.value);
        this.renderMessengerWindows();
      }
      toggleShowArchivedChats() {
        this.showArchived = !this.showArchived;
        const btn = document.getElementById('btn-toggle-archived');
        if (btn) btn.textContent = this.showArchived ? 'Ver Activas' : 'Ver Archivadas';
        this.renderConversationsSidebar();
      }

      selectChatConversation(wName) {
        const previousWorker = this.activeChatWorker;
        const previousMessages = document.getElementById('chat-messages-container');
        if (previousWorker && previousMessages) this.chatConversationHtmlCache[previousWorker] = previousMessages.innerHTML;
        this.activeChatWorker = wName;
        this.chatDockUnreadByWorker?.delete(wName);
        if (this.currentUser?.role === 'admin') {
          if (!Array.isArray(this.openChatTabs)) this.openChatTabs = [];
          const isNewTab = !this.openChatTabs.includes(wName);
          if (isNewTab) this.openChatTabs.push(wName);
          this.minimizedChatWindows[wName] = false;
          if (window.innerWidth >= 640) {
            document.getElementById('chat-window-modal')?.classList.remove('hidden');
            document.getElementById('chat-desktop-windows')?.classList.remove('hidden');
          }
        }
        document.getElementById('chat-header-title').textContent = 'ServiPortones';
        document.getElementById('chat-mobile-active-name').textContent = wName;

        if (window.innerWidth < 640) {
          document.getElementById('chat-sidebar').classList.add('mobile-conversation-open');
          document.getElementById('chat-conversation-area').classList.remove('mobile-list-open');
        }

        this.subscribeChatMessages();
        this.renderConversationsSidebar();
        this.renderChatTabs();
        this.renderActiveChatHeader();
        this.renderMessengerWindows();
      }

      renderActiveChatHeader() {
        const header = document.getElementById('chat-active-contact-header');
        if (!header || !this.currentUser) return;
        let name = '';
        let photo = '';
        let status = 'disconnected';
        if (this.currentUser.role === 'admin') {
          name = this.activeChatWorker || '';
          const worker = this.workers.find(item => (item.fullName || item.username) === name);
          if (!worker) { header.innerHTML = ''; return; }
          photo = worker.photo || '';
          status = this.getPresenceStatus(worker);
        } else {
          const admin = this.getAdminPresenceInfo();
          name = admin.name;
          photo = admin.photo;
          status = admin.status;
        }
        const safeName = this.escapeHtml(name);
        const avatar = photo ? `<img src="${this.escapeHtml(photo)}" alt="Foto de ${safeName}">` : `<span>${this.escapeHtml(String(name).charAt(0).toUpperCase())}</span>`;
        const title = document.getElementById('chat-header-title');
        if (title) title.textContent = 'ServiPortones';
        header.innerHTML = `<span class="chat-active-avatar seasonal-worker-avatar">${avatar}</span><div class="chat-active-contact-copy"><span class="chat-active-contact-name truncate">${safeName}</span><span class="presence-label is-${status}">${this.getPresenceLabel(status)}</span></div>`;
        const mobileAvatar = document.getElementById('chat-mobile-contact-avatar');
        if (mobileAvatar) mobileAvatar.innerHTML = avatar;
        const mobileName = document.getElementById('chat-mobile-active-name');
        if (mobileName) mobileName.textContent = name;
        const mobileStatus = document.getElementById('chat-mobile-active-status');
        if (mobileStatus) { mobileStatus.textContent = this.getPresenceLabel(status); mobileStatus.className = `presence-label is-${status}`; }
      }
      renderChatTypingIndicators() {
        document.querySelectorAll('.chat-inline-typing-indicator').forEach(indicator => indicator.remove());
        const targets = [];
        const activeThread = this.currentUser?.role === 'admin' ? this.activeChatWorker : this.getCurrentDisplayName();
        const mainMessages = document.getElementById('chat-messages-container');
        const mainHost = document.getElementById('chat-conversation-area');
        if (mainMessages && mainHost && activeThread) targets.push({ host: mainHost, scroller: mainMessages, threadId: activeThread });
        document.querySelectorAll('#chat-desktop-chat-cells [data-messenger-window]').forEach(windowEl => {
          const scroller = windowEl.querySelector('.messenger-window-messages');
          if (scroller) targets.push({ host: windowEl, scroller, threadId: windowEl.dataset.messengerWindow });
        });
        targets.forEach(({ host, scroller, threadId }) => {
          if (!this.chatTypingByWorker[threadId]) return;
          const wasNearBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 80;
          let name = threadId;
          let photo = '';
          if (this.currentUser?.role === 'admin') {
            const worker = this.workers.find(item => (item.fullName || item.username) === threadId);
            photo = worker?.photo || '';
          } else {
            const admin = this.getAdminPresenceInfo();
            name = admin.name;
            photo = admin.photo || '';
          }
          const safeName = this.escapeHtml(name);
          const indicator = document.createElement('div');
          indicator.className = 'chat-inline-typing-indicator chat-typing-overlay';
          indicator.innerHTML = `${photo ? `<span class="chat-inline-typing-avatar seasonal-worker-avatar"><img src="${this.escapeHtml(photo)}" alt="Foto de ${safeName}"></span>` : `<span class="chat-inline-typing-avatar seasonal-worker-avatar">${this.escapeHtml(String(name).charAt(0).toUpperCase())}</span>`}<span class="chat-inline-typing-copy"><span>Escribiendo</span><span class="chat-typing-dots" aria-label="Escribiendo"><i></i><i></i><i></i></span></span>`;
          const composer = host.querySelector(this.currentUser?.role === 'admin' && host !== mainHost ? '.messenger-window-form' : 'form[onsubmit*="handleSendMessage"]');
          if (composer) host.insertBefore(indicator, composer);
          else host.appendChild(indicator);
          if (wasNearBottom) scroller.scrollTop = scroller.scrollHeight;
        });
      }
      renderChatTabs() {
        const tray = document.getElementById('chat-open-tabs');
        if (!tray || this.currentUser?.role !== 'admin') return;
        const tabs = Array.isArray(this.openChatTabs) ? this.openChatTabs : [];
        tray.innerHTML = tabs.map(name => {
          const worker = this.workers.find(item => (item.fullName || item.username) === name);
          const avatar = worker?.photo ? `<img src="${this.escapeHtml(worker.photo)}" alt="">` : this.escapeHtml(String(name).charAt(0).toUpperCase());
          return `<span class="chat-open-tab ${this.activeChatWorker === name ? 'is-active' : ''}"><button type="button" class="flex min-w-0 items-center truncate" onclick="app.selectChatConversation(decodeURIComponent('${encodeURIComponent(name)}'))"><span class="chat-open-tab-avatar seasonal-worker-avatar">${avatar}</span><span class="truncate">${this.escapeHtml(name)}</span></button><button type="button" class="chat-tab-close" title="Cerrar conversación" aria-label="Cerrar ${this.escapeHtml(name)}" onclick="event.stopPropagation();app.closeChatTab(decodeURIComponent('${encodeURIComponent(name)}'))">×</button></span>`;
        }).join('');
        tray.classList.toggle('hidden', tabs.length === 0);
      }

      renderMessengerWindows() {
        const dock = document.getElementById('chat-desktop-chat-cells');
        const dockRoot = document.getElementById('chat-desktop-windows');
        const minimizedDock = document.getElementById('chat-minimized-windows');
        if (!dock || !dockRoot) return;
        if (window.innerWidth < 640 || this.currentUser?.role !== 'admin') {
          dock.innerHTML = '';
          if (minimizedDock) { minimizedDock.innerHTML = ''; minimizedDock.classList.add('hidden'); }
          this.renderChatTypingIndicators();
          return;
        }
        const focusedInput = document.activeElement?.matches('.messenger-window-form input') ? document.activeElement : null;
        const focusedWindow = focusedInput?.closest('[data-messenger-window]')?.dataset.messengerWindow || '';
        const cursorStart = focusedInput?.selectionStart;
        const cursorEnd = focusedInput?.selectionEnd;
        const existingWindows = document.querySelectorAll('#chat-desktop-chat-cells [data-messenger-window], #chat-minimized-windows [data-messenger-window]');
        existingWindows.forEach(windowEl => {
          const name = windowEl.dataset.messengerWindow;
          const input = windowEl.querySelector('.messenger-window-form input');
          if (input) this.messengerDrafts[name] = input.value;
          const messages = windowEl.querySelector('.messenger-window-messages');
          if (messages) {
            this.chatScrollPositions[name] = messages.scrollTop;
            this.chatWasNearBottom[name] = messages.scrollHeight - messages.clientHeight - messages.scrollTop < 80;
          }
        });
        const names = Array.isArray(this.openChatTabs) ? this.openChatTabs : [];
        const visibleCount = names.filter(name => !this.minimizedChatWindows[name]).length;
        const cellCount = visibleCount + 1;
        const availableWidth = window.innerWidth - 44 - 11 * Math.max(0, cellCount - 1);
        const cellWidth = Math.min(300, Math.max(96, Math.floor(availableWidth / Math.max(cellCount, 1))));
        dockRoot.style.setProperty('--chat-cell-width', cellWidth + 'px');
        document.getElementById('chat-floating-button-container')?.style.setProperty('--chat-cell-width', cellWidth + 'px');
        document.getElementById('chat-window-modal')?.style.setProperty('--chat-cell-width', cellWidth + 'px');
        const renderedWindows = names.map(name => {
          const worker = this.workers.find(item => (item.fullName || item.username) === name);
          const avatar = worker?.photo ? '<img src="' + this.escapeHtml(worker.photo) + '" alt="">' : this.escapeHtml(String(name).charAt(0).toUpperCase());
          const isMinimized = Boolean(this.minimizedChatWindows[name]);
          const presenceStatus = this.getPresenceStatus(worker);
          const presenceLabel = this.getPresenceLabel(presenceStatus);
          const typing = Boolean(this.chatTypingByWorker[name]);
          const threadSummary = this.chatThreadSummaries[name];
          const threadData = this.conversations[name] || {};
          const unreadCount = Math.max(threadSummary?.hasMessages ? Number(threadSummary.unreadCount || 0) : Number(threadData.unreadByAdmin || 0), this.chatDockUnreadByWorker?.has(name) ? 1 : 0);
          const presenceText = typing ? 'Escribiendo...' : presenceLabel;
          const presenceClass = typing ? 'is-typing' : 'presence-label is-' + presenceStatus;
          const cached = this.chatConversationHtmlCache[name] || (name === this.activeChatWorker ? (document.getElementById('chat-messages-container')?.innerHTML || '') : '<div class="text-center py-8 text-xs italic">Abre la conversación para cargar los mensajes.</div>');
          return '<section class="messenger-chat-window ' + (isMinimized ? 'is-minimized ' : '') + (unreadCount > 0 && this.prefs.chatBadge ? 'has-unread' : '') + '" data-messenger-window="' + this.escapeHtml(name) + '" style="--chat-cell-width:' + cellWidth + 'px">' +
            '<header class="messenger-window-header" onclick="' + (isMinimized ? 'app.toggleMessengerWindow(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))' : 'app.selectChatConversation(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))') + '"' + (isMinimized ? ' role="button" tabindex="0" title="Restaurar conversación" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();app.toggleMessengerWindow(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))}"' : '') + '>' +
              '<span class="messenger-window-avatar seasonal-worker-avatar">' + avatar + '</span><span class="messenger-window-identity"><span class="messenger-window-title">' + this.escapeHtml(name) + '</span><span class="messenger-window-activity ' + presenceClass + '">' + this.escapeHtml(presenceText) + '</span></span>' +
              (unreadCount > 0 && this.prefs.chatBadge ? '<span class="messenger-window-unread-badge">' + (unreadCount > 99 ? '99+' : String(unreadCount)) + '</span>' : '') +
              '<span class="messenger-window-controls">' +
                (isMinimized ? '' : '<button class="messenger-window-minimize" type="button" title="Minimizar" aria-label="Minimizar ' + this.escapeHtml(name) + '" onclick="event.stopPropagation();app.toggleMessengerWindow(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))">−</button>')' +
                '<button class="messenger-window-close" type="button" title="Cerrar" aria-label="Cerrar ' + this.escapeHtml(name) + '" onclick="event.stopPropagation();app.closeChatTab(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))">×</button>' +
              '</span></header>' +
            (isMinimized ? '' : '<div class="messenger-window-messages">' + cached + '</div><form class="messenger-window-form" onsubmit="app.handleMessengerWindowSend(event,decodeURIComponent(\'' + encodeURIComponent(name) + '\'))"><input type="text" autocomplete="off" placeholder="Escribe un mensaje..." aria-label="Mensaje para ' + this.escapeHtml(name) + '"><button type="submit" title="Enviar" aria-label="Enviar">➤</button></form>') +
          '</section>';
        });
        dock.innerHTML = renderedWindows.filter((_, index) => !this.minimizedChatWindows[names[index]]).join('');
        if (minimizedDock) {
          minimizedDock.innerHTML = names.map(name => {
            const worker = this.workers.find(item => (item.fullName || item.username) === name);
            const avatar = worker?.photo ? '<img src="' + this.escapeHtml(worker.photo) + '" alt="">' : this.escapeHtml(String(name).charAt(0).toUpperCase());
            const isMinimized = Boolean(this.minimizedChatWindows[name]);
            const presenceStatus = this.getPresenceStatus(worker);
            const presenceLabel = this.getPresenceLabel(presenceStatus);
            const typing = Boolean(this.chatTypingByWorker[name]);
            const threadSummary = this.chatThreadSummaries[name];
            const threadData = this.conversations[name] || {};
            const unreadCount = Math.max(threadSummary?.hasMessages ? Number(threadSummary.unreadCount || 0) : Number(threadData.unreadByAdmin || 0), this.chatDockUnreadByWorker?.has(name) ? 1 : 0);
            const presenceText = typing ? 'Escribiendo...' : presenceLabel;
            const presenceClass = typing ? 'is-typing' : 'presence-label is-' + presenceStatus;
            return '<section class="messenger-chat-window is-minimized chat-persistent-tab ' + (unreadCount > 0 && this.prefs.chatBadge ? 'has-unread' : '') + '" data-messenger-window="' + this.escapeHtml(name) + '" style="--chat-cell-width:' + cellWidth + 'px">' +
              '<header class="messenger-window-header" onclick="app.selectChatConversation(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))">' +
                '<span class="messenger-window-avatar seasonal-worker-avatar">' + avatar + '</span><span class="messenger-window-identity"><span class="messenger-window-title">' + this.escapeHtml(name) + '</span><span class="messenger-window-activity ' + presenceClass + '">' + this.escapeHtml(presenceText) + '</span></span>' +
                (unreadCount > 0 && this.prefs.chatBadge ? '<span class="messenger-window-unread-badge">' + (unreadCount > 99 ? '99+' : String(unreadCount)) + '</span>' : '') +
                '<span class="messenger-window-controls">' +
                  '<button class="messenger-window-minimize" type="button" title="' + (isMinimized ? 'Restaurar' : 'Minimizar') + '" aria-label="' + (isMinimized ? 'Restaurar' : 'Minimizar') + ' ' + this.escapeHtml(name) + '" onclick="event.stopPropagation();app.toggleMessengerWindow(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))">' + (isMinimized ? '+' : '−') + '</button>' +
                  '<button class="messenger-window-close" type="button" title="Cerrar" aria-label="Cerrar ' + this.escapeHtml(name) + '" onclick="event.stopPropagation();app.closeChatTab(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))">×</button>' +
                '</span></header></section>';
          }).join('');
          minimizedDock.classList.toggle('hidden', names.length === 0);
        }
        [dock, minimizedDock].filter(Boolean).forEach(container => container.querySelectorAll('[data-messenger-window]').forEach(windowEl => {
          const name = windowEl.dataset.messengerWindow;
          const messages = windowEl.querySelector('.messenger-window-messages');
          if (messages) {
            if (!Object.prototype.hasOwnProperty.call(this.chatScrollPositions, name) || this.chatWasNearBottom[name]) messages.scrollTop = messages.scrollHeight;
            else messages.scrollTop = this.chatScrollPositions[name];
            messages.addEventListener('scroll', () => {
              this.chatScrollPositions[name] = messages.scrollTop;
              this.chatWasNearBottom[name] = messages.scrollHeight - messages.clientHeight - messages.scrollTop < 80;
            }, { passive: true });
          }
          const input = windowEl.querySelector('.messenger-window-form input');
          if (input) {
            input.value = this.messengerDrafts[name] || '';
            input.addEventListener('input', event => this.handleMessengerWindowTyping(event, name));
          }
        }));
        if (focusedWindow) {
          const restoredInput = dock.querySelector('[data-messenger-window="' + CSS.escape(focusedWindow) + '"] .messenger-window-form input');
          if (restoredInput) {
            restoredInput.focus({ preventScroll: true });
            if (Number.isInteger(cursorStart) && Number.isInteger(cursorEnd)) restoredInput.setSelectionRange(cursorStart, cursorEnd);
          }
        }
        this.renderChatTypingIndicators();
      }

updateMessengerWindowTyping(workerName) {
        const windowEl = document.querySelector('#chat-desktop-chat-cells [data-messenger-window="' + CSS.escape(workerName) + '"]');
        if (!windowEl) return;
        const activity = windowEl.querySelector('.messenger-window-activity');
        if (!activity) return;
        const typing = Boolean(this.chatTypingByWorker[workerName]);
        const worker = this.workers.find(item => (item.fullName || item.username) === workerName);
        const status = this.getPresenceStatus(worker);
        activity.textContent = typing ? 'Escribiendo...' : this.getPresenceLabel(status);
        activity.className = 'messenger-window-activity ' + (typing ? 'is-typing' : 'presence-label is-' + status);
      }

      toggleMessengerWindow(workerName) {
        const restoring = Boolean(this.minimizedChatWindows[workerName]);
        this.minimizedChatWindows[workerName] = !restoring;
        if (restoring && this.currentUser?.role === 'admin' && window.innerWidth >= 640) {
          document.getElementById('chat-desktop-windows')?.classList.remove('hidden');
        }
        this.renderMessengerWindows();
      }

      handleMessengerWindowTyping(event, workerName) {
        if (this.activeChatWorker !== workerName) this.selectChatConversation(workerName);
        this.handleTypingInput();
      }

      async handleMessengerWindowSend(event, workerName) {
        event.preventDefault();
        const input = event.currentTarget?.querySelector('input');
        const sharedInput = document.getElementById('chat-input-text');
        if (!input || !sharedInput || !input.value.trim()) return;
        if (this.activeChatWorker !== workerName) this.selectChatConversation(workerName);
        sharedInput.value = input.value;
        input.value = '';
        this.messengerDrafts[workerName] = '';
        await this.handleSendMessage({ preventDefault() {} });
      }

      closeChatTab(workerName) {
        if (this.currentUser?.role !== 'admin') return;
        this.openChatTabs = (this.openChatTabs || []).filter(name => name !== workerName);
        delete this.minimizedChatWindows[workerName];
        if (this.activeChatWorker === workerName) {
          const next = this.openChatTabs[0];
          if (next) return this.selectChatConversation(next);
          this.activeChatWorker = '';
        }
        this.renderChatTabs();
        this.renderMessengerWindows();
      }
      showMobileChatSidebar() {
        document.getElementById('chat-sidebar').classList.remove('mobile-conversation-open');
        document.getElementById('chat-conversation-area').classList.add('mobile-list-open');
      }

      openDirectWorkerChat(workerName) {
        this.activeChatWorker = workerName;
        const chatModal = document.getElementById('chat-window-modal');
        chatModal.classList.remove('hidden');
        this.selectChatConversation(workerName);
      }

      toggleChatWindow() {
        const chatModal = document.getElementById('chat-window-modal');
        if (!chatModal) return;
        const opening = chatModal.classList.contains('hidden');
        chatModal.classList.toggle('hidden', !opening);
        document.getElementById('chat-launcher-button')?.setAttribute('aria-expanded', String(opening));
        const isDesktopAdminContacts = this.currentUser?.role === 'admin' && window.innerWidth >= 640;
        if (opening) {
          this.scrollToChatBottom();
          if (isDesktopAdminContacts) {
            document.getElementById('chat-desktop-windows')?.classList.remove('hidden');
            this.renderMessengerWindows();
          } else {
            this.markMessagesAsRead();
            document.getElementById('chat-input-text')?.focus({ preventScroll: true });
          }
        }
      }

      toggleChatOptionsMenu() {
        const menu = document.getElementById('chat-conversation-options-dropdown');
        if (menu) menu.classList.toggle('hidden');
      }

      async archiveCurrentConversation() {
        if (this.currentUser?.role !== 'admin') return;
        const threadId = this.currentUser.role === 'admin' ? this.activeChatWorker : (this.getCurrentDisplayName());
        this.toggleChatOptionsMenu();

        if (window.db && threadId) {
          await db.collection('chats_internos').doc(threadId).set({ archived: true }, { merge: true });
          this.showToast("Conversación archivada", "info");
        }
      }

      async clearCurrentConversation() {
        if (this.currentUser?.role !== 'admin') return;
        this.toggleChatOptionsMenu();
        if (!confirm("¿Deseas vaciar todos los mensajes de esta conversación?")) return;

        const threadId = this.currentUser.role === 'admin' ? this.activeChatWorker : (this.getCurrentDisplayName());
        if (window.db && threadId) {
          const snap = await db.collection('chats_internos').doc(threadId).collection('mensajes').get();
          snap.forEach(d => d.ref.delete());
          await db.collection('chats_internos').doc(threadId).update({ lastMessage: 'Conversación vaciada' });
          this.showToast("Conversación vaciada", "success");
        }
      }

      async deleteCurrentConversation() {
        if (this.currentUser?.role !== 'admin') return;
        this.toggleChatOptionsMenu();
        if (!confirm("¿Deseas eliminar completamente esta conversación y su historial?")) return;

        const threadId = this.currentUser.role === 'admin' ? this.activeChatWorker : (this.getCurrentDisplayName());
        if (window.db && threadId) {
          const snap = await db.collection('chats_internos').doc(threadId).collection('mensajes').get();
          snap.forEach(d => d.ref.delete());
          await db.collection('chats_internos').doc(threadId).delete();
          this.showToast("Conversación eliminada", "info");
        }
      }

      async deleteMessageForEveryone(msgId) {
        const threadId = this.currentUser.role === 'admin' ? this.activeChatWorker : (this.getCurrentDisplayName());
        const message = this.chatMessages.find(m => m.id === msgId);
        if (this.currentUser.role !== 'admin' && (!message || message.senderRole !== 'worker' || message.senderName !== (this.getCurrentDisplayName()))) return;
        if (!confirm("¿Eliminar este mensaje para todos?")) return;
        if (window.db && threadId && msgId) {
          await db.collection('chats_internos').doc(threadId).collection('mensajes').doc(msgId).delete();
          this.showToast("Mensaje eliminado para todos", "info");
        }
      }

      copyMessageText(text) {
        navigator.clipboard.writeText(text);
        this.showToast("Mensaje copiado al portapapeles", "success");
      }

      handleTypingInput() {
        const threadId = this.currentUser.role === 'admin' ? this.activeChatWorker : (this.getCurrentDisplayName());
        const myRole = this.currentUser.role;

        if (window.db && threadId) {
          db.collection('chats_internos').doc(threadId).set({
            typing: { [myRole]: true }
          }, { merge: true }).catch(() => {});

          clearTimeout(this.typingTimeout);
          this.typingTimeout = setTimeout(() => {
            db.collection('chats_internos').doc(threadId).set({
              typing: { [myRole]: false }
            }, { merge: true }).catch(() => {});
          }, 2000);
        }
      }

      subscribeChatMessages() {
        if (!window.db) return;
        this.chatMessageInitialRenderDone = false;
        if (this.chatUnsubscribe) { this.chatUnsubscribe(); }

        const threadId = this.currentUser.role === 'admin' ? this.activeChatWorker : (this.getCurrentDisplayName());

        if (this.chatThreadUnsubscribe) this.chatThreadUnsubscribe();
        this.chatThreadUnsubscribe = db.collection('chats_internos').doc(threadId).onSnapshot(doc => {
          if (doc.exists) {
            const data = doc.data();
            const otherRole = this.currentUser.role === 'admin' ? 'worker' : 'admin';
            const isOtherTyping = data.typing && data.typing[otherRole];
            this.chatTypingByWorker[threadId] = Boolean(isOtherTyping);
            if (this.currentUser.role === 'worker') {
              this.workerUnreadCount = Number(data.unreadByWorker || 0);
              const summary = this.chatThreadSummaries[threadId];
              const count = summary?.hasMessages ? summary.unreadCount : this.workerUnreadCount;
              this.updateChatLauncherUnread(count);
            }

            this.renderChatTypingIndicators();
          }
        });

        this.chatUnsubscribe = db.collection('chats_internos')
          .doc(threadId)
          .collection('mensajes')
          .orderBy('timestamp', 'desc')
          .limit(80)
          .onSnapshot(snapshot => {
            const msgs = [];
            let unreadCount = 0;

            // La consulta trae los mensajes más nuevos; invertirlos conserva el orden cronológico en pantalla.
            snapshot.docs.slice().reverse().forEach(doc => {
              const data = doc.data();
              const msgId = doc.id;

              const myHiddenKey = `hiddenFor_${this.currentUser.role}`;
              if (!data[myHiddenKey]) {
                msgs.push({ id: msgId, ...data });
              }

              const isFromOther = data.senderRole !== this.currentUser.role;
              if (isFromOther && data.status !== 'read') {
                unreadCount++;
                if (data.status === 'sent') {
                  db.collection('chats_internos').doc(threadId).collection('mensajes').doc(msgId).update({
                    status: 'delivered'
                  }).catch(() => {});
                }
              }
            });

            this.chatMessages = msgs;
            this.renderChatMessages();

            const threadSummary = this.chatThreadSummaries[threadId];
            const badgeCount = threadSummary?.hasMessages ? threadSummary.unreadCount : (this.currentUser.role === 'worker' && this.workerUnreadCount !== null ? this.workerUnreadCount : unreadCount);
            this.updateChatLauncherUnread(badgeCount);
            const chatWindow = document.getElementById('chat-window-modal');
            const desktopConversationOpen = this.currentUser.role === 'admin' && window.innerWidth >= 640 && this.openChatTabs.includes(threadId) && !this.minimizedChatWindows[threadId];
            const mobileOrWorkerConversationOpen = chatWindow && !chatWindow.classList.contains('hidden') && (this.currentUser.role !== 'admin' || window.innerWidth < 640);
            if ((desktopConversationOpen || mobileOrWorkerConversationOpen) && !document.hidden) this.markMessagesAsRead();
          }, err => console.error("Error chat snapshot:", err));
      }

      renderChatMessages() {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;
        const wasNearBottom = this.chatMessageInitialRenderDone && container.scrollHeight - container.clientHeight - container.scrollTop < 80;
        const previousScrollTop = container.scrollTop;
        if (this.chatMessages.length === 0) {
          container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs italic">Inicia una conversación privada segura.</div>`;
          if (this.activeChatWorker) this.chatConversationHtmlCache[this.activeChatWorker] = container.innerHTML;
          this.renderMessengerWindows();
          this.chatMessageInitialRenderDone = true;
          return;
        }
        const myName = this.getCurrentDisplayName();
        container.innerHTML = this.chatMessages.map((m, index) => {
          const previousMessage = this.chatMessages[index - 1];
          const getTimestampMs = message => {
            const value = message?.timestamp;
            if (value && typeof value.toMillis === 'function') return value.toMillis();
            if (value instanceof Date) return value.getTime();
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric > 0) return numeric;
            const parsed = Date.parse(value || '');
            return Number.isFinite(parsed) ? parsed : NaN;
          };
          const currentTimestamp = getTimestampMs(m);
          const previousTimestamp = getTimestampMs(previousMessage);
          const sameSender = previousMessage && previousMessage.senderRole === m.senderRole && previousMessage.senderName === m.senderName;
          const isGroupStart = !previousMessage || !sameSender || !Number.isFinite(currentTimestamp) || !Number.isFinite(previousTimestamp) || currentTimestamp < previousTimestamp || currentTimestamp - previousTimestamp > 5 * 60 * 1000;
          const isMine = this.currentUser.role === 'admin' ? m.senderRole === 'admin' : m.senderName === myName;
          let messageText = m.text || '';
          if (m.type === 'call') {
            const isCaller = this.currentUser.role === 'admin' ? m.callerRole === 'admin' : m.callerName === myName && m.callerRole === this.currentUser.role;
            const title = m.callOutcome === 'missed' ? '📞 Llamada perdida' : m.callOutcome === 'failed' ? '📞 Llamada sin conexión' : (isCaller ? '📞 Llamada saliente' : '📞 Llamada recibida');
            const seconds = Math.max(0, Number(m.durationSeconds || 0));
            const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
            messageText = `${title}${m.callOutcome === 'completed' ? `\nDuración: ${duration}` : ''}\nFecha: ${m.callDate || '—'}`;
          }
          const sender = this.getChatMessageSender(m);
          let statusTick = '';
          if (isMine) {
            if (m.status === 'read') statusTick = '<span class="text-emerald-500 font-black ml-1 select-none" title="Leído">✓✓</span>';
            else if (m.status === 'delivered') statusTick = '<span class="text-amber-500 font-bold ml-1 select-none" title="Entregado">✓✓</span>';
            else statusTick = '<span class="text-slate-400 font-bold ml-1 select-none" title="Enviado">✓</span>';
          }
          const safeName = this.escapeHtml(sender.name);
          const avatar = sender.photo ? `<img src="${this.escapeHtml(sender.photo)}" alt="Foto de ${safeName}">` : this.escapeHtml(String(sender.name).charAt(0).toUpperCase());
          return `
            <div class="chat-message-row ${isMine ? 'is-mine' : 'is-received'} ${isGroupStart ? 'chat-message-group-start' : 'chat-message-group-continuation'}">
              ${isGroupStart ? `<div class="chat-message-identity ${isMine ? 'is-mine' : ''}"><span class="chat-message-avatar seasonal-worker-avatar">${avatar}</span><span>${safeName}</span></div>` : ''}
              <div class="chat-message-bubble ${isMine ? 'bg-brand-dark text-white rounded-br-md' : 'bg-white text-slate-800 rounded-bl-md'}">
                <p class="chat-message-text">${this.escapeHtml(messageText)}</p>
                <div class="chat-message-meta"><span>${this.escapeHtml(m.time || '')}</span>${isMine ? statusTick : ''}</div>
              </div>
            </div>
          `;
        }).join('');
        if (this.activeChatWorker) this.chatConversationHtmlCache[this.activeChatWorker] = container.innerHTML;
        this.renderMessengerWindows();
        if (!this.chatMessageInitialRenderDone || wasNearBottom) this.scrollToChatBottom();
        else container.scrollTop = previousScrollTop;
        this.chatMessageInitialRenderDone = true;
      }
      scrollToChatBottom() {
        const container = document.getElementById('chat-messages-container');
        if (container) container.scrollTop = container.scrollHeight;
      }

      async handleSendMessage(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input-text');
        const text = input.value.trim();
        if (!text) return;

        const myName = this.getCurrentDisplayName();
        const threadId = this.currentUser.role === 'admin' ? this.activeChatWorker : myName;

        const msgObj = {
          threadId: threadId,
          text: text,
          senderName: myName,
          senderRole: this.currentUser.role,
          recipient: this.currentUser.role === 'admin' ? this.activeChatWorker : this.getAdminPresenceInfo().name,
          time: this.formatTime(new Date()),
          timestamp: Date.now(),
          status: 'sent'
        };

        input.value = '';

        if (window.db) {
          try {
            await db.collection('chats_internos').doc(threadId).collection('mensajes').add(msgObj);

            const updatePayload = {
              lastMessage: text,
              lastTime: this.formatTime(new Date()),
              lastTimestamp: Date.now(),
              workerName: threadId,
              archived: false,
              typing: { [this.currentUser.role]: false }
            };

            if (this.currentUser.role === 'admin') {
              updatePayload.unreadByWorker = firebase.firestore.FieldValue.increment(1);
            } else {
              updatePayload.unreadByAdmin = firebase.firestore.FieldValue.increment(1);
            }

            await db.collection('chats_internos').doc(threadId).set(updatePayload, { merge: true });
          } catch(err) {
            console.error("Error al enviar mensaje:", err);
          }
        }
      }

      markMessagesAsRead() {
        if (!window.db || this.chatMessages.length === 0) return;
        const threadId = this.currentUser.role === 'admin' ? this.activeChatWorker : (this.getCurrentDisplayName());

        this.chatMessages.forEach(m => {
          if (m.senderRole !== this.currentUser.role && m.status !== 'read' && m.id) {
            db.collection('chats_internos').doc(threadId).collection('mensajes').doc(m.id).update({ status: 'read' }).catch(() => {});
          }
        });

        const resetField = this.currentUser.role === 'admin' ? 'unreadByAdmin' : 'unreadByWorker';
        db.collection('chats_internos').doc(threadId).set({ [resetField]: 0 }, { merge: true }).catch(() => {});
      }

      renderTechniciansMonitor() {
        const grid = document.getElementById('technicians-status-grid');
        const counter = document.getElementById('techs-online-counter');
        if (!grid) return;

        const workerSources = [
          ...(Array.isArray(this.workers) ? this.workers : []),
          ...(Array.isArray(this.users) ? this.users.filter(user => ['worker', 'trabajador'].includes(String(user.role || '').toLowerCase().trim())) : [])
        ];
        const workerById = new Map(workerSources.map(user => [String(user.id || user.username || user.fullName || '').toLowerCase(), user]));
        const currentStatuses = new Map([...workerById].map(([id, user]) => [id, this.getPresenceStatus(user)]));
        const hadMonitorOrder = Array.isArray(this.techniciansMonitorOrder) && this.techniciansMonitorOrder.length > 0;
        let monitorOrder = hadMonitorOrder ? this.techniciansMonitorOrder.filter(id => workerById.has(id)) : [];
        for (const id of workerById.keys()) if (!monitorOrder.includes(id)) monitorOrder.push(id);

        if (!hadMonitorOrder) {
          monitorOrder.sort((a, b) => Number(currentStatuses.get(b) === 'available') - Number(currentStatuses.get(a) === 'available'));
        } else {
          for (const [id, status] of currentStatuses) {
            const previousStatus = this.techniciansMonitorPresence?.get(id);
            if (status === 'available' && previousStatus !== 'available') {
              monitorOrder = monitorOrder.filter(item => item !== id);
              monitorOrder.unshift(id);
            } else if (previousStatus === 'available' && status !== 'available') {
              const onlineRemain = monitorOrder.filter(item => item !== id && currentStatuses.get(item) === 'available').length;
              if (onlineRemain > 0) {
                monitorOrder = monitorOrder.filter(item => item !== id);
                monitorOrder.splice(onlineRemain, 0, id);
              }
            }
          }
        }
        this.techniciansMonitorOrder = monitorOrder;
        this.techniciansMonitorPresence = currentStatuses;
        const monitorWorkers = monitorOrder.map(id => workerById.get(id)).filter(Boolean);
        const taskList = Array.isArray(this.tasks) ? this.tasks : [];
        let onlineCount = 0;

        if (!monitorWorkers.length) {
          grid.innerHTML = '<p class="col-span-full py-3 text-center text-xs text-slate-500">No hay empleados disponibles para mostrar.</p>';
          if (counter) counter.textContent = '0 En Línea';
          return;
        }

        grid.innerHTML = monitorWorkers.map(u => {
          const presenceStatus = this.getPresenceStatus(u);
          const isOnline = presenceStatus === 'available';
          const presenceCardClass = presenceStatus === 'available'
            ? 'bg-brand-limeLight border-brand-limeBorder shadow-sm presence-card-connected'
            : presenceStatus === 'absent'
              ? 'bg-amber-50 border-amber-200 shadow-sm presence-card-absent'
              : 'bg-slate-50 border-slate-200';
          const presenceLabel = this.getPresenceLabel(presenceStatus);
          if (isOnline) onlineCount++;

          const uName = u.fullName || u.username;
          const assignedPending = taskList.filter(t => t.assignedTo === uName && (t.status === 'PENDIENTE' || t.status === 'EN_PROCESO')).length;

          return `
            <div class="p-3 rounded-2xl border ${presenceCardClass} flex flex-col justify-between">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  <div onclick="app.zoomWorkerPhoto('${u.photo || ''}', '${uName}')" class="seasonal-worker-avatar cursor-pointer relative w-10 h-10 rounded-full overflow-hidden border-2 border-slate-300 bg-slate-200 shrink-0 flex items-center justify-center hover:opacity-90 transition" title="Haz clic para ampliar">
                    ${u.photo ? `<img src="${u.photo}" class="w-full h-full object-cover">` : `<span class="font-bold text-xs text-slate-700">${uName.charAt(0)}</span>`}
                  </div>
                  <div class="min-w-0 flex flex-col items-start leading-tight">
                    <h4 class="text-xs font-black text-slate-900 truncate">${uName}</h4>
                    <span class="presence-label is-${presenceStatus}">${presenceLabel}</span>
                  </div>
                </div>
                <span class="text-[10px] px-2 py-0.5 rounded-md font-extrabold ${assignedPending > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'} shrink-0">
                  ${assignedPending} ptes
                </span>
              </div>

              <div class="bg-white/80 rounded-xl p-2 border border-slate-200/70 text-[10px] space-y-0.5">
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Última Actividad:</span>
                  <span class="font-bold ${presenceStatus === 'available' ? 'text-emerald-600' : presenceStatus === 'absent' ? 'text-amber-600' : 'text-slate-700'}">${this.escapeHtml(u.lastLogin || 'No registrado')}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');

        counter.textContent = `${onlineCount} En Línea`;
        if (window.lucide) lucide.createIcons();
      }

      readSeasonalTheme() {
        const allowed = ['classic', 'christmas', 'easter', 'holy-week', 'halloween'];
        try { const saved = localStorage.getItem('serviportones_visual_theme'); return allowed.includes(saved) ? saved : 'classic'; }
        catch (_) { return 'classic'; }
      }

      applySharedSeasonalTheme() {
        const adminUser = this.currentUser?.role === 'admin' ? this.currentUser : this.users.find(user => String(user.role || '').toLowerCase() === 'admin');
        if (!adminUser?.username) return;
        const record = this.presenceRecords[String(adminUser.username).toLowerCase()];
        const theme = record?.visualTheme;
        const allowed = ['classic', 'christmas', 'easter', 'holy-week', 'halloween'];
        if (!allowed.includes(theme)) return;
        this.sharedSeasonalTheme = theme;
        if (this.seasonalTheme === theme) return;
        this.seasonalTheme = theme;
        try { localStorage.setItem('serviportones_visual_theme', theme); } catch (_) {}
        this.applySeasonalTheme(theme);
        this.renderSeasonalThemeSelector();
      }

      setSeasonalTheme(theme) {
        const allowed = ['classic', 'christmas', 'easter', 'holy-week', 'halloween'];
        if (this.currentUser?.role !== 'admin' || !allowed.includes(theme)) return;
        this.seasonalTheme = theme;
        this.sharedSeasonalTheme = theme;
        try { localStorage.setItem('serviportones_visual_theme', theme); }
        catch (error) { console.warn('No se pudo guardar el tema en este dispositivo:', error); }
        this.applySeasonalTheme(theme);
        this.renderSeasonalThemeSelector();
        const username = String(this.currentUser.username || '').toLowerCase();
        if (window.db && username) {
          db.collection('presencia').doc(username).set({ visualTheme: theme }, { merge: true })
            .catch(error => console.error('[THEME] No se pudo sincronizar el tema:', error));
        }
        const themeNames = { classic: 'Clásico', christmas: 'Navidad', easter: 'Pascua', 'holy-week': 'Semana Santa', halloween: 'Halloween' };
        this.showToast(`Tema ${themeNames[theme]} aplicado a todos`, 'success');
      }

      toggleThemePicker() {
        const options = document.getElementById('seasonal-theme-options');
        const button = document.getElementById('btn-toggle-seasonal-themes');
        if (!options || !button) return;
        const opening = !options.classList.contains('is-open');
        options.classList.toggle('is-open', opening);
        options.setAttribute('aria-hidden', String(!opening));
        button.setAttribute('aria-expanded', String(opening));
        button.innerHTML = '<i data-lucide="' + (opening ? 'chevron-up' : 'palette') + '" aria-hidden="true"></i><span>' + (opening ? 'Ocultar temas' : 'Mostrar temas') + '</span>';
        if (window.lucide) lucide.createIcons();
      }

      applySeasonalTheme(theme) {
        const loginMark = document.querySelector('.login-santa-hat');
        const loginMarks = { christmas: 'assets/media/santa-hat-3d.svg?v=20261028-hat-svg-mirror-11', halloween: 'assets/media/halloween-avatar.svg?v=20261028-halloween-glow-1', easter: 'assets/media/easter-login-mark.svg?v=20261028-theme-mark-1', 'holy-week': 'assets/media/holy-week-login-mark.svg?v=20261028-theme-mark-1' };
        if (loginMark) { const source = loginMarks[theme]; if (source) loginMark.src = source; loginMark.alt = ''; loginMark.setAttribute('aria-hidden', 'true'); }
        const classes = ['theme-classic', 'theme-christmas', 'theme-easter', 'theme-holy-week', 'theme-halloween'];
        document.body.classList.remove(...classes);
        if (theme === 'classic') document.body.classList.add('theme-classic');
        if (theme === 'christmas') document.body.classList.add('theme-christmas');
        if (theme === 'easter') document.body.classList.add('theme-easter');
        if (theme === 'holy-week') document.body.classList.add('theme-holy-week');
        if (theme === 'halloween') document.body.classList.add('theme-halloween');
        const decorations = {
          classic: '',
          halloween: "<svg viewBox=\"0 0 180 110\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\"><defs><radialGradient id=\"season-haunt-glow\"><stop stop-color=\"#ff9b42\" stop-opacity=\".35\"/><stop offset=\"1\" stop-color=\"#ff9b42\" stop-opacity=\"0\"/></radialGradient></defs><circle cx=\"92\" cy=\"56\" r=\"54\" fill=\"url(#season-haunt-glow)\"/><g fill=\"none\" stroke=\"#b8a8c9\" stroke-width=\"1.8\" opacity=\".9\"><path d=\"M118 4v48M118 4L84 52M118 4l34 48M118 4L70 28M118 4l48 24M118 4L58 4M118 4h60M118 4l-42 67M118 4l42 67\"/><path d=\"M92 28q26 12 52 0M82 42q36 18 72 0M72 56q46 21 92 0\"/></g><g fill=\"#21162c\" stroke=\"#f5a24b\" stroke-width=\"1\"><ellipse cx=\"118\" cy=\"61\" rx=\"6\" ry=\"9\"/><circle cx=\"118\" cy=\"52\" r=\"5\"/><path d=\"M114 50l-5-5 1 8m12-3 5-5-1 8M112 62l-8 7m13-6-4 10m8-10 7 7m-4-10 8 3\" fill=\"none\" stroke-linecap=\"round\" stroke-width=\"2\"/></g><circle cx=\"116\" cy=\"52\" r=\"1\" fill=\"#ffbd57\"/><circle cx=\"120\" cy=\"52\" r=\"1\" fill=\"#ffbd57\"/><path d=\"M31 81q12-13 24 0 12-13 24 0-12-4-24 9-12-13-24-9Z\" fill=\"#2c1c3b\" stroke=\"#f29a49\" stroke-width=\"1.5\"/></svg>",
          christmas: `<svg viewBox="0 0 180 110" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="season-hat" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c94743"/><stop offset="1" stop-color="#7f2529"/></linearGradient><linearGradient id="season-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4e1a0"/><stop offset="1" stop-color="#b8913e"/></linearGradient></defs><path class="seasonal-hat" d="M28 44 Q39 8 83 11 Q67 23 59 47Z" fill="url(#season-hat)"/><path d="M25 44 Q44 38 63 45 L61 53 Q42 49 24 53Z" fill="#f5f0e6"/><circle cx="81" cy="10" r="7" fill="#f5f0e6"/><path d="M116 42 Q111 30 115 20 M118 29 Q109 24 107 15 M118 28 Q127 20 125 11 M118 32 Q131 31 136 22" fill="none" stroke="url(#season-gold)" stroke-width="3" stroke-linecap="round"/><path d="M111 40 Q124 31 133 42 L130 54 Q123 61 115 53Z" fill="#825c43"/><circle cx="124" cy="44" r="1.6" fill="#f7f1e7"/><path d="M131 47l8 2-8 3" fill="#b8913e"/><path d="M20 74l3 5 5 1-5 2-2 5-2-5-5-2 5-1zM91 67l2 4 4 1-4 2-2 4-2-4-4-2 4-1zM157 72l2 4 4 1-4 2-2 4-2-4-4-2 4-1z" fill="#d7e6ec" opacity=".9"/><g class="seasonal-logo-lights"><circle cx="88" cy="57" r="3" fill="#cb514e"/><circle cx="101" cy="59" r="3" fill="#e5c86e"/><circle cx="114" cy="59" r="3" fill="#4e916b"/><circle cx="127" cy="58" r="3" fill="#cb514e"/></g><circle cx="99" cy="24" r="2" fill="#fff"/><circle cx="148" cy="59" r="1.5" fill="#fff"/></svg>`,
          easter: `<svg viewBox="0 0 180 110" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="season-egg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f3e6e8"/><stop offset="1" stop-color="#c9a8bb"/></linearGradient><linearGradient id="season-leaf" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b9c9a7"/><stop offset="1" stop-color="#708d68"/></linearGradient></defs><path class="seasonal-egg" d="M40 18 C25 20 20 47 25 63 C30 80 55 82 62 65 C69 48 56 16 40 18Z" fill="url(#season-egg)" stroke="#b895a9" stroke-width="1.5"/><path d="M27 43 Q43 36 61 44 M27 54 Q43 48 64 55" fill="none" stroke="#f8f1e8" stroke-width="3"/><path d="M88 75 Q112 49 137 35" fill="none" stroke="url(#season-leaf)" stroke-width="3" stroke-linecap="round"/><path d="M103 62 Q88 51 88 42 Q104 43 108 56 M119 49 Q117 34 124 26 Q134 37 126 48 M93 72 Q78 68 72 59 Q87 55 98 66" fill="url(#season-leaf)"/><g fill="#e6c9d6" stroke="#c29bac" stroke-width="1"><ellipse cx="143" cy="27" rx="5" ry="9"/><ellipse cx="143" cy="45" rx="5" ry="9"/><ellipse cx="134" cy="36" rx="8" ry="5"/><ellipse cx="152" cy="36" rx="8" ry="5"/></g><circle cx="143" cy="36" r="4" fill="#d7b66f"/><circle cx="76" cy="24" r="2" fill="#d9c487"/><circle cx="158" cy="65" r="1.8" fill="#d9c487"/></svg>`,
          'holy-week': `<svg viewBox="0 0 180 110" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="season-cross" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ead89d"/><stop offset="1" stop-color="#a88c55"/></linearGradient><radialGradient id="season-glow"><stop stop-color="#f4e7c6" stop-opacity=".78"/><stop offset="1" stop-color="#f4e7c6" stop-opacity="0"/></radialGradient></defs><circle cx="77" cy="44" r="38" fill="url(#season-glow)"/><path class="seasonal-cross-art" d="M76 16 V72 M58 34 H94" stroke="url(#season-cross)" stroke-width="6" stroke-linecap="round"/><path d="M76 79 Q104 68 127 79" fill="none" stroke="#9c8aaa" stroke-width="2" opacity=".75"/><path d="M126 24v17m-6-11h12" stroke="#c7b27a" stroke-width="2" stroke-linecap="round"/><circle cx="127" cy="51" r="2" fill="#d8c58d"/><path d="M42 23l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#d8c58d" opacity=".8"/></svg>`
        };
        ['seasonal-logo-decoration-header', 'seasonal-logo-decoration-chat', 'seasonal-logo-decoration-restore'].forEach(id => {
          const element = document.getElementById(id);
          if (!element) return;
          const svg = decorations[theme] || '';
          element.innerHTML = svg.replace(/season-(hat|gold|egg|leaf|cross|glow)/g, token => token + '-' + id);
          element.style.display = theme === 'classic' ? 'none' : 'block';
        });
        this.updateSeasonalEffects(theme);
      }

      updateSeasonalEffects(theme) {
        const layer = document.getElementById('seasonal-effects-layer');
        if (!layer) return;
        const loginView = document.getElementById('view-login');
        const loginScene = document.getElementById('login-seasonal-scene');
        const loginBatLayer = document.getElementById('login-halloween-bat-layer');
        const isLogin = Boolean(loginView && !loginView.classList.contains('hidden'));
        const setRandomFlightPath = (flight, loginOnly = false) => {
          const choosePath = () => {
            const fromLeft = Math.random() < 0.5;
            flight.querySelector('.christmas-sleigh-art')?.classList.toggle('is-reversed', !fromLeft);
            const startY = loginOnly ? 2 + Math.random() * 5 : 24 + Math.random() * 42;
            const endY = loginOnly ? 4 + Math.random() * 7 : 32 + Math.random() * 48;
            flight.style.setProperty('--flight-start-x', fromLeft ? '-125vw' : '125vw');
            flight.style.setProperty('--flight-end-x', fromLeft ? '130vw' : '-130vw');
            flight.style.setProperty('--flight-start-y', `${startY}%`);
            flight.style.setProperty('--flight-end-y', `${endY}%`);
          };
          const restart = () => {
            if (!flight.isConnected) return;
            flight.style.animation = 'none';
            choosePath();
            void flight.offsetWidth;
            flight.style.animation = '';
            flight.addEventListener('animationend', restart, { once: true });
          };
          choosePath();
          flight.addEventListener('animationend', restart, { once: true });
        };        loginScene?.classList.remove('theme-christmas');
        loginScene?.querySelectorAll('.seasonal-login-snow, .login-christmas-flight, .login-halloween-bat').forEach(element => element.remove());
        loginBatLayer?.replaceChildren();
        if (isLogin) {
          layer.innerHTML = '';
          layer.className = 'seasonal-effects-layer hidden';
          if (theme === 'christmas' && loginScene) {
            loginScene.classList.add('theme-christmas');
            for (let index = 0; index < 38; index++) {
              const particle = document.createElement('i');
              particle.className = 'seasonal-particle seasonal-login-snow';
              particle.style.setProperty('--particle-x', `${Math.random() * 100}%`);
              particle.style.setProperty('--particle-size', `${12 + Math.random() * 10}px`);
              particle.style.setProperty('--particle-opacity', `${.58 + Math.random() * .38}`);
              particle.style.setProperty('--particle-duration', `${10 + Math.random() * 8}s`);
              particle.style.setProperty('--particle-delay', `${-Math.random() * 20}s`);
              particle.style.setProperty('--particle-drift', `${-35 + Math.random() * 70}px`);
              loginScene.appendChild(particle);
            }
            const flight = document.createElement('div');
            flight.className = 'login-christmas-flight';
            const art = document.createElement('img');
            art.src = 'assets/media/santa-sleigh.svg?v=20261028-santa-hat-pompon-4';
            art.alt = 'Santa Claus y sus renos vuelan sobre la escena navideña';
            art.className = 'christmas-sleigh-art';
            flight.appendChild(art);
            loginScene.appendChild(flight);
            setRandomFlightPath(flight, true);
          } else if (theme === 'halloween' && loginScene) {
            for (let index = 0; index < 6; index++) { const bat=document.createElement('img'); bat.src='assets/media/halloween-bat-flight.svg?v=20261028-flock-1'; bat.className='login-halloween-bat'+(Math.random()<.5?' is-reversed':''); bat.alt=''; bat.setAttribute('aria-hidden','true'); bat.style.setProperty('--bat-y',(8+Math.random()*82)+'%'); bat.style.setProperty('--bat-scale',(0.62+Math.random()*0.58).toFixed(2)); bat.style.setProperty('--bat-duration',(15+Math.random()*13)+'s'); bat.style.setProperty('--bat-delay',(-Math.random()*28)+'s'); loginBatLayer?.appendChild(bat); }
          }
          return;
        }
        layer.innerHTML = '';
        layer.className = 'seasonal-effects-layer';
        if (theme === 'classic') { layer.classList.add('hidden'); return; }
        layer.classList.add(`theme-${theme}`);
        const count = theme === 'christmas' ? 38 : theme === 'halloween' ? 0 : theme === 'easter' ? 18 : 16;
        for (let index = 0; index < count; index++) {
          const particle = document.createElement('i');
          particle.className = 'seasonal-particle';
          particle.style.setProperty('--particle-x', `${Math.random() * 100}%`);
          particle.style.setProperty('--particle-size', `${theme === 'christmas' ? 12 + Math.random() * 10 : theme === 'halloween' ? 16 + Math.random() * 12 : 10 + Math.random() * 9}px`);
          particle.style.setProperty('--particle-opacity', `${.58 + Math.random() * .38}`);
          particle.style.setProperty('--particle-duration', `${theme === 'christmas' ? 10 + Math.random() * 8 : theme === 'halloween' ? 16 + Math.random() * 12 : 12 + Math.random() * 9}s`);
          particle.style.setProperty('--particle-delay', `${-Math.random() * 20}s`);
          particle.style.setProperty('--particle-drift', `${-35 + Math.random() * 70}px`);
          layer.appendChild(particle);
        }
        if (theme === 'halloween') {
          for (let index = 0; index < 12; index++) {
            const bat = document.createElement('img');
            bat.src = 'assets/media/halloween-bat-flight.svg?v=20261028-flock-1';
            bat.alt = '';
            bat.setAttribute('aria-hidden', 'true');
            bat.className = 'halloween-flight-bat' + (Math.random() < .5 ? ' is-reversed' : '');
            bat.style.setProperty('--bat-y', `${Math.random() * 88}%`);
            bat.style.setProperty('--bat-scale', (0.52 + Math.random() * .62).toFixed(2));
            bat.style.setProperty('--bat-duration', `${15 + Math.random() * 17}s`);
            bat.style.setProperty('--bat-delay', `${-Math.random() * 30}s`);
            layer.appendChild(bat);
          }
        }        if (theme === 'christmas') {
          const sleigh = document.createElement('div');
          sleigh.className = 'christmas-sleigh-flight';
          const art = document.createElement('img');
          art.src = 'assets/media/santa-sleigh.svg?v=20261028-santa-hat-pompon-4';
          art.alt = 'Santa Claus volando en su trineo con sus renos';
          art.className = 'christmas-sleigh-art';
          sleigh.appendChild(art);
          layer.appendChild(sleigh);
          setRandomFlightPath(sleigh);
        }
      }
      renderSeasonalThemeSelector() {
        document.querySelectorAll('[data-seasonal-theme]').forEach(button => {
          const selected = button.dataset.seasonalTheme === this.seasonalTheme;
          button.setAttribute('aria-pressed', String(selected));
          button.classList.toggle('border-brand-lime', selected);
          button.classList.toggle('ring-2', selected);
          button.classList.toggle('ring-brand-lime/30', selected);
          button.classList.toggle('bg-brand-limeLight', selected);
          button.classList.toggle('border-slate-200', !selected);
        });
      }
      collapseThemePicker() {
        const options = document.getElementById('seasonal-theme-options');
        const button = document.getElementById('btn-toggle-seasonal-themes');
        options?.classList.remove('is-open');
        options?.setAttribute('aria-hidden', 'true');
        button?.setAttribute('aria-expanded', 'false');
        if (button) button.innerHTML = '<i data-lucide="palette" aria-hidden="true"></i><span>Mostrar temas</span>';
        if (window.lucide) lucide.createIcons();
      }
      openSettingsModal() {
        const isAdmin = this.currentUser.role === 'admin';
        document.getElementById('settings-theme-section')?.classList.toggle('hidden', !isAdmin);
        document.getElementById('settings-order-sequence-section')?.classList.toggle('hidden', !isAdmin);
        this.renderOrderSequenceSetting();
        this.collapseThemePicker();
        this.renderSeasonalThemeSelector();
        this.renderMySettingsPhotoPreview();

        document.getElementById('set-own-current-pass').value = '';
        document.getElementById('set-own-new-pass').value = '';
        document.getElementById('set-own-confirm-pass').value = '';

        const adminUsersSection = document.getElementById('settings-admin-users-section');
        const adminIdentitiesSection = document.getElementById('settings-admin-identities-section');
        const subtitle = document.getElementById('settings-modal-subtitle');

        if (isAdmin) {
          subtitle.textContent = 'Gestión integral de personal en Firestore';
          adminIdentitiesSection?.classList.remove('hidden');
          this.renderAdminIdentities();
          adminUsersSection.classList.remove('hidden');
          this.resetUserForm();
          this.renderUsersTable();
        } else {
          subtitle.textContent = `Ajustes personales de tu cuenta (${this.getCurrentDisplayName()})`;
          adminIdentitiesSection?.classList.add('hidden');
          adminUsersSection.classList.add('hidden');
        }

        document.getElementById('modal-settings').classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
      }

      closeSettingsModal() {
        document.getElementById('modal-settings').classList.add('hidden');
      }

      renderMySettingsPhotoPreview() {
        const img = document.getElementById('settings-my-photo-preview');
        const init = document.getElementById('settings-my-initial-preview');
        const name = this.getCurrentDisplayName() || 'A';
        const photo = this.getCurrentDisplayPhoto();
        const summaryPhoto = document.getElementById('settings-account-summary-photo');
        const summaryFallback = document.getElementById('settings-account-summary-fallback');
        if (summaryPhoto && summaryFallback) {
          if (photo) { summaryPhoto.src = photo; summaryPhoto.classList.remove('hidden'); summaryFallback.classList.add('hidden'); }
          else { summaryPhoto.removeAttribute('src'); summaryPhoto.classList.add('hidden'); summaryFallback.classList.remove('hidden'); }
        }
        const accountName = document.getElementById('settings-account-name');
        if (accountName) accountName.textContent = name;
        if (photo) {
          img.src = photo;
          img.classList.remove('hidden');
          init.classList.add('hidden');
        } else {
          img.classList.add('hidden');
          init.classList.remove('hidden');
          init.textContent = name.charAt(0);
        }
      }

      handleUploadOwnPhoto(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          this.showToast('La imagen debe pesar menos de 2MB', 'error');
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Data = event.target.result;
          this.currentUser.photo = base64Data;
          SafeStorage.setItem('portonpro_session_v4', JSON.stringify(this.currentUser));

          if (window.db && this.currentUser.id) {
            db.collection('users').doc(this.currentUser.id).update({ photo: base64Data }).catch(e => console.error(e));
            db.collection('presencia').doc(this.currentUser.username.toLowerCase()).set({ photo: base64Data }, { merge: true }).catch(() => {});
          }

          this.renderMySettingsPhotoPreview();
          this.setupDashboardUI();
          this.renderTasks();
          if (this.currentUser.role === 'admin') this.renderTechniciansMonitor();
          this.showToast('Foto actualizada en Firestore', 'success');
        };
        reader.readAsDataURL(file);
      }

      removeOwnPhoto() {
        this.currentUser.photo = '';
        SafeStorage.setItem('portonpro_session_v4', JSON.stringify(this.currentUser));

        if (window.db && this.currentUser.id) {
          db.collection('users').doc(this.currentUser.id).update({ photo: '' }).catch(e => console.error(e));
          db.collection('presencia').doc(this.currentUser.username.toLowerCase()).set({ photo: '' }, { merge: true }).catch(() => {});
        }

        this.renderMySettingsPhotoPreview();
        this.setupDashboardUI();
        this.renderTasks();
        if (this.currentUser.role === 'admin') this.renderTechniciansMonitor();
        this.showToast('Foto eliminada', 'info');
      }

      async handleChangeOwnPassword(e) {
        e.preventDefault();
        const currentPass = document.getElementById('set-own-current-pass').value.trim();
        const newPass = document.getElementById('set-own-new-pass').value.trim();
        const confirmPass = document.getElementById('set-own-confirm-pass').value.trim();

        if (newPass !== confirmPass) {
          this.showToast('Las contraseñas no coinciden', 'error');
          return;
        }

        if (window.db && this.currentUser.id) {
          try {
            const userDoc = await db.collection('users').doc(this.currentUser.id).get();
            if (userDoc.exists && String(userDoc.data().password).trim() === currentPass) {
              await db.collection('users').doc(this.currentUser.id).update({ password: newPass });
              this.currentUser.password = newPass;
              SafeStorage.setItem('portonpro_session_v4', JSON.stringify(this.currentUser));
              this.showToast('Contraseña actualizada en Firestore', 'success');
              this.closeSettingsModal();
              return;
            } else {
              this.showToast('Contraseña actual incorrecta', 'error');
            }
          } catch(err) {
            this.showToast('Error al conectar con Firestore', 'error');
          }
        }
      }

      openEmployeeEditBubble(worker) {
        const sourceForm = document.getElementById('manage-user-form');
        if (!sourceForm || !worker) return;
        const scrollContainers = [...document.querySelectorAll('*')].filter(el => {
          const style = getComputedStyle(el);
          return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
        });
        const returnState = {
          activeElement: document.activeElement,
          scrollPositions: scrollContainers.map(el => [el, el.scrollTop, el.scrollLeft]),
          windowX: window.scrollX,
          windowY: window.scrollY
        };
        document.getElementById('employee-edit-bubble')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'employee-edit-bubble';
        overlay.className = 'employee-edit-bubble-overlay';
        overlay.setAttribute('role','dialog');
        overlay.setAttribute('aria-modal','true');
        overlay.setAttribute('aria-labelledby','employee-edit-bubble-title');
        overlay.innerHTML = '<div class="employee-edit-bubble-card"><div class="employee-edit-bubble-header"><div><h3 id="employee-edit-bubble-title">Editar trabajador</h3><p>Actualiza sus datos y guarda los cambios.</p></div><button type="button" onclick="app.cancelUserForm()" aria-label="Cerrar">×</button></div><div class="employee-edit-bubble-content" data-employee-edit-form></div></div>';
        overlay.addEventListener('click', event => { if (event.target === overlay) this.cancelUserForm(); });
        const form = sourceForm.cloneNode(true);
        form.classList.remove('hidden');
        form.id = 'manage-user-edit-form';
        form.dataset.editingWorker = 'true';
        form.querySelectorAll('[id]').forEach(field => {
          const sourceId = field.id;
          field.dataset.userField = sourceId.replace('manage-', '').replace('btn-save-user', 'save');
          field.id = `edit-${sourceId}`;
        });
        const field = name => form.querySelector(`[data-user-field="${name}"]`);
        field('user-id').value = worker.id;
        field('fullname').value = worker.fullName || worker.username || '';
        field('username').value = worker.username || '';
        field('password').value = worker.password || '';
        field('phone').value = worker.phone || '';
        field('national-id').value = worker.nationalId || '';
        field('specialty').value = worker.specialty || '';
        const photoPreview = form.querySelector('[data-worker-photo-preview]');
        if (photoPreview && worker.photo) { photoPreview.src = worker.photo; photoPreview.classList.remove('hidden'); }
        field('save').textContent = 'Actualizar en Firestore';
        overlay.querySelector('[data-employee-edit-form]').appendChild(form);
        document.body.appendChild(overlay);
        overlay.__returnState = returnState;
        overlay.querySelector('.employee-edit-bubble-header button')?.focus({ preventScroll: true });
        if (window.lucide) lucide.createIcons();
      }

      closeEmployeeEditBubble() {
        const overlay = document.getElementById('employee-edit-bubble');
        if (!overlay) return;
        const returnState = overlay.__returnState;
        overlay.remove();
        if (returnState) {
          const restoreView = () => {
            returnState.scrollPositions.forEach(([el, top, left]) => {
              if (el.isConnected) { el.scrollTop = top; el.scrollLeft = left; }
            });
            window.scrollTo(returnState.windowX, returnState.windowY);
            if (returnState.activeElement?.isConnected) returnState.activeElement.focus({ preventScroll: true });
          };
          requestAnimationFrame(() => { restoreView(); requestAnimationFrame(restoreView); });
        }
      }
      cancelUserForm() {
        if (document.getElementById('employee-edit-bubble')) this.closeEmployeeEditBubble();
        else this.resetUserForm();
      }
      toggleCreateWorkerForm() {
        const form = document.getElementById('manage-user-form');
        const button = document.getElementById('btn-toggle-create-worker');
        if (!form || !button) return;
        const opening = form.classList.contains('hidden');
        if (opening) form.classList.remove('hidden'); else this.resetUserForm();
        button.setAttribute('aria-expanded', String(opening));
        if (opening) document.getElementById('manage-fullname')?.focus({ preventScroll: true });
      }

      resetUserForm() {
        document.getElementById('manage-user-id').value = '';
        const form = document.getElementById('manage-user-form');
        form.reset();
        form.classList.add('hidden');
        document.getElementById('btn-toggle-create-worker')?.setAttribute('aria-expanded', 'false');
        document.querySelector('#manage-user-form [data-worker-photo-preview]')?.removeAttribute('src');
        document.querySelector('#manage-user-form [data-worker-photo-preview]')?.classList.add('hidden');
        document.getElementById('btn-save-user').textContent = 'Guardar en Firestore';
        if (window.lucide) lucide.createIcons();
      }

      previewManagedWorkerPhoto(event) {
        const file = event.target.files?.[0];
        const preview = event.currentTarget.form?.querySelector("[data-worker-photo-preview]");
        if (!file || !preview) return;
        if (!file.type.startsWith("image/")) { this.showToast("Selecciona un archivo de imagen.", "error"); event.target.value = ""; return; }
        if (file.size > 8 * 1024 * 1024) { this.showToast("La foto debe pesar menos de 8 MB.", "error"); event.target.value = ""; return; }
        const reader = new FileReader();
        reader.onload = () => { preview.src = String(reader.result || ""); preview.classList.remove("hidden"); };
        reader.onerror = () => this.showToast("No se pudo leer la foto seleccionada.", "error");
        reader.readAsDataURL(file);
      }

      async encodeManagedWorkerPhoto(file) {
        if (!file) return "";
        const source = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("No se pudo leer la foto."));
          reader.readAsDataURL(file);
        });
        const image = await new Promise((resolve, reject) => {
          const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("La imagen seleccionada no se pudo abrir.")); img.src = source;
        });
        const scale = Math.min(1, 640 / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("No se pudo procesar la foto.");
        context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.78);
      }

      async handleSaveUser(e) {
        e.preventDefault();
        if (this.currentUser.role !== 'admin') return;

        const form = e.currentTarget;
        const getField = name => form.querySelector(`[data-user-field="${name}"]`) || document.getElementById(`manage-${name}`);
        const id = getField('user-id').value;
        const fullName = this.normalizeInput(getField('fullname').value);
        const username = this.normalizeInput(getField('username').value);
        const password = this.normalizeInput(getField('password').value);
        const phone = this.normalizeInput(getField('phone').value);
        const nationalId = this.normalizeInput(getField('national-id').value);
        const specialty = this.normalizeInput(getField('specialty').value);
        const photoFile = getField('photo')?.files?.[0] || null;
        let photo = this.users.find(user => String(user.id) === String(id))?.photo || '';

        if (username.toLowerCase() === 'administrador' && id !== 'admin') {
          this.showToast('El usuario no puede llamarse administrador', 'error');
          return;
        }

        if (photoFile) {
          try { photo = await this.encodeManagedWorkerPhoto(photoFile); }
          catch (error) { this.showToast(error.message || 'No se pudo procesar la foto.', 'error'); return; }
        }

        const userData = {
          fullName,
          username,
          password,
          phone,
          nationalId,
          specialty: specialty || 'Técnico de Portones',
          photo,
          role: 'worker',
          active: true
        };

        if (window.db) {
          try {
            if (id) {
              await db.collection('users').doc(id).set(userData, { merge: true });
              this.showToast(`Trabajador ${fullName} actualizado en Firestore`, 'success');
            } else {
              const docId = 'tech-' + Date.now();
              await db.collection('users').doc(docId).set({ ...userData, lastHeartbeat: 0, lastLogin: 'Nunca' });
              this.showToast(`Trabajador ${fullName} registrado en Firestore`, 'success');
            }
            if (id) this.closeEmployeeEditBubble();
            this.resetUserForm();
          } catch(err) {
            console.error("Error guardando trabajador en Firestore:", err);
            this.showToast('Error guardando en Firestore', 'error');
          }
        }
      }

      renderUsersTable() {
        const tbody = document.getElementById('table-users-body');
        if (!tbody) return;
        document.getElementById('settings-users-count-badge').textContent = `${this.workers.length} Trabajadores`;

        tbody.innerHTML = this.workers.map(u => {
          const uName = u.fullName || u.username;
          return `
            <tr class="hover:bg-slate-50 transition">
              <td class="p-1.5">
                <div class="flex items-center gap-1.5">
                  <div onclick="app.zoomWorkerPhoto('${u.photo || ''}', '${uName}')" class="cursor-pointer w-10 h-10 rounded-full border-2 border-brand-lime overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center">
                    ${u.photo ? `<img src="${u.photo}" class="w-full h-full object-cover">` : `<span class="font-bold text-xs">${this.escapeHtml(String(uName).charAt(0))}</span>`}
                  </div>
                  <span class="font-bold text-slate-800 truncate max-w-[140px]">${this.escapeHtml(uName)}</span>
                </div>
              </td>
              <td class="p-1.5 font-mono text-[10px] text-slate-600">
                <span>@${this.escapeHtml(u.username || '')}</span>${u.nationalId ? `<br><span class="text-slate-500">C.C. ${this.escapeHtml(u.nationalId)}</span>` : ''}
              </td>
              <td class="p-1.5 text-right space-x-1">
                <button onclick="app.editUser('${u.id}')" class="p-1 text-slate-600 hover:text-brand-limeHover" title="Editar"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
                <button onclick="app.deleteUser('${u.id}')" class="p-1 text-slate-600 hover:text-rose-600" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
              </td>
            </tr>
          `;
        }).join('');

        if (window.lucide) lucide.createIcons();
      }

      editUser(id) {
        const worker = this.users.find(x => x.id === id);
        if (!worker) return;
        this.openEmployeeEditBubble(worker);
      }
      async deleteUser(id) {
        if (!confirm(`¿Eliminar trabajador de Firestore?`)) return;
        if (window.db) {
          try {
            await db.collection('users').doc(id).delete();
            this.showToast('Trabajador eliminado de Firestore', 'info');
          } catch(err) {
            this.showToast('Error al eliminar de Firestore', 'error');
          }
        }
      }

      installOrderFilterDismissHandlers() {
        if (this.orderFilterDismissHandlersInstalled) return;
        document.addEventListener('click', event => {
          const target = event.target;
          if (target instanceof Element && target.closest('.order-filter-dropdown')) return;
          document.querySelectorAll('.order-filter-dropdown[open]').forEach(menu => { menu.open = false; });
        });
        document.addEventListener('keydown', event => {
          if (event.key === 'Escape') document.querySelectorAll('.order-filter-dropdown[open]').forEach(menu => { menu.open = false; });
        });
        this.orderFilterDismissHandlersInstalled = true;
      }

      renderOrderFilterMenus() {
        const renderMenu = (selectId, labelId, menuId, fallbackLabel) => {
          const select = document.getElementById(selectId);
          const label = document.getElementById(labelId);
          const menu = document.getElementById(menuId);
          if (!select || !menu) return;
          const selected = select.options[select.selectedIndex];
          if (label) label.textContent = select.value === 'ALL' ? fallbackLabel : (selected?.textContent || fallbackLabel).trim();
          menu.replaceChildren();
          Array.from(select.options).forEach(option => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'order-filter-option';
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(option.value === select.value));
            item.textContent = option.textContent.trim();
            item.addEventListener('click', () => {
              select.value = option.value;
              document.getElementById(selectId === 'filter-status' ? 'filter-status-dropdown' : 'filter-tech-control')?.removeAttribute('open');
              this.renderOrderFilterMenus();
              this.renderTasks();
            });
            menu.appendChild(item);
          });
        };
        renderMenu('filter-status', 'filter-status-label', 'filter-status-options', 'Estados');
        renderMenu('filter-tech', 'filter-tech-label', 'filter-tech-options', 'Todos los Técnicos');
      }
      renderTechOptionsInSelects() {
        const taskAssignedSelect = document.getElementById('task-assigned-to');
        const filterTechSelect = document.getElementById('filter-tech');
        const previousAssigned = taskAssignedSelect?.value || '';
        const opts = this.workers.map(u => `<option value="${u.fullName || u.username}">${u.fullName || u.username}</option>`).join('');
        if (taskAssignedSelect) {
          taskAssignedSelect.innerHTML = `<option value="LIBRE">🟠 LIBRE</option>${opts}`;
          if ([...taskAssignedSelect.options].some(option => option.value === previousAssigned)) taskAssignedSelect.value = previousAssigned;
        }
        if (filterTechSelect) filterTechSelect.innerHTML = `<option value="ALL">Todos los Técnicos</option><option value="LIBRE">🟠 LIBRE</option>` + opts;
        this.renderTaskTechnicianMenu();
        this.renderOrderFilterMenus();
      }

      renderTaskTechnicianMenu() {
        const select = document.getElementById('task-assigned-to');
        const menu = document.getElementById('task-assigned-menu');
        const label = document.getElementById('task-assigned-label');
        if (!select || !menu || !label) return;
        const selected = select.options[select.selectedIndex];
        label.textContent = selected?.textContent.trim() || 'Selecciona un técnico';
        menu.replaceChildren();
        Array.from(select.options).forEach(option => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'task-technician-option';
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', String(option.value === select.value));
          item.textContent = option.textContent.trim();
          item.addEventListener('click', () => this.selectTaskTechnician(option.value));
          menu.appendChild(item);
        });
      }

      toggleTaskTechnicianMenu() {
        const menu = document.getElementById('task-assigned-menu');
        const trigger = document.getElementById('task-assigned-trigger');
        if (!menu || !trigger) return;
        const opening = menu.classList.contains('hidden');
        if (opening) {
          if (menu.parentElement !== document.body) document.body.appendChild(menu);
          menu.classList.remove('hidden');
          this.positionTaskTechnicianMenu();
        } else {
          menu.classList.add('hidden');
        }
        trigger.setAttribute('aria-expanded', String(opening));
        if (!this.taskTechnicianDismissInstalled) {
          document.addEventListener('pointerdown', event => {
            if (!event.target.closest?.('#task-technician-picker, #task-assigned-menu')) this.closeTaskTechnicianMenu();
          });
          document.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.closeTaskTechnicianMenu();
          });
          window.addEventListener('resize', () => this.positionTaskTechnicianMenu());
          document.addEventListener('scroll', () => this.positionTaskTechnicianMenu(), true);
          this.taskTechnicianDismissInstalled = true;
        }
      }

      positionTaskTechnicianMenu() {
        const menu = document.getElementById('task-assigned-menu');
        const trigger = document.getElementById('task-assigned-trigger');
        if (!menu || !trigger || menu.classList.contains('hidden')) return;
        const rect = trigger.getBoundingClientRect();
        const gap = 6;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
        const availableBelow = Math.max(0, viewportHeight - rect.bottom - gap - 8);
        const availableAbove = Math.max(0, rect.top - gap - 8);
        const openAbove = availableBelow < 170 && availableAbove > availableBelow;
        const available = openAbove ? availableAbove : availableBelow;
        const maxHeight = Math.max(90, Math.min(280, available));
        menu.style.position = 'fixed';
        menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)) + 'px';
        menu.style.width = Math.min(rect.width, window.innerWidth - 16) + 'px';
        menu.style.maxHeight = maxHeight + 'px';
        menu.style.bottom = 'auto';
        menu.style.top = '0px';
        const visibleHeight = Math.min(menu.scrollHeight, maxHeight);
        const top = openAbove ? Math.max(8, rect.top - gap - visibleHeight) : Math.max(8, Math.min(rect.bottom + gap, viewportHeight - visibleHeight - 8));
        menu.style.top = top + 'px';
      }
      closeTaskTechnicianMenu() {
        document.getElementById('task-assigned-menu')?.classList.add('hidden');
        document.getElementById('task-assigned-trigger')?.setAttribute('aria-expanded', 'false');
      }

      toggleTaskDatePicker() {
        const input = document.getElementById('task-date');
        if (!input) return;
        if (this.taskDatePickerOpen) {
          input.blur();
          this.taskDatePickerOpen = false;
          return;
        }
        if (!this.taskDateDismissInstalled) {
          document.addEventListener('pointerdown', event => {
            if (!event.target.closest?.('.task-date-control')) this.taskDatePickerOpen = false;
          });
          document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
              input.blur();
              this.taskDatePickerOpen = false;
            }
          });
          this.taskDateDismissInstalled = true;
        }
        try {
          input.focus({ preventScroll: true });
          input.showPicker();
          this.taskDatePickerOpen = true;
        } catch (error) {
          input.click();
          this.taskDatePickerOpen = true;
        }
      }

      selectTaskTechnician(value) {
        const select = document.getElementById('task-assigned-to');
        if (!select) return;
        select.value = value;
        this.renderTaskTechnicianMenu();
        this.closeTaskTechnicianMenu();
      }

      isTaskFree(task) {
        const assignedTo = String(task?.assignedTo || '').trim();
        return !assignedTo || assignedTo.toUpperCase() === 'LIBRE';
      }

      updateStats() {
        const isAdmin = this.currentUser.role === 'admin';
        const myName = this.getCurrentDisplayName();
        const relevantTasks = (isAdmin ? this.tasks : this.tasks.filter(t => this.isTaskFree(t) || t.assignedTo === myName)).filter(t => !t.archivedAt);
        document.getElementById('stat-total').textContent = relevantTasks.length;
        document.getElementById('stat-pending').textContent = relevantTasks.filter(t => t.status === 'PENDIENTE' || t.status === 'EN_PROCESO').length;
        document.getElementById('stat-done').textContent = relevantTasks.filter(t => t.status === 'REALIZADA').length;
        document.getElementById('stat-failed').textContent = relevantTasks.filter(t => t.status === 'NO_REALIZADA').length;
      }

      resetFilters() {
        document.getElementById('filter-search').value = '';
        document.getElementById('filter-status').value = 'ALL';
        if (this.currentUser.role === 'admin') document.getElementById('filter-tech').value = 'ALL';
        this.renderOrderFilterMenus();
        this.renderTasks();
      }

      async resetCategoryTasks(category) {
        if (this.currentUser.role !== 'admin') {
          this.showToast('Acción reservada al Administrador', 'error');
          return;
        }

        let targets = [];
        let label = '';

        if (category === 'REALIZADA') {
          targets = this.tasks.filter(t => t.status === 'REALIZADA' && !t.archivedAt);
          label = 'REALIZADAS';
        } else if (category === 'NO_REALIZADA') {
          targets = this.tasks.filter(t => t.status === 'NO_REALIZADA' && !t.archivedAt);
          label = 'NO REALIZADAS';
        } else if (category === 'PENDIENTE_GRUPO') {
          targets = this.tasks.filter(t => t.status === 'EN_PROCESO' && !t.archivedAt);
          label = 'EN PROCESO';
        }

        if (targets.length === 0) return this.showToast(`No hay órdenes para reiniciar`, 'info');
        if (!confirm(`¿Deseas reiniciar ${targets.length} orden(es) de ${label}?`)) return;

        targets.forEach(t => {
          t.status = 'PENDIENTE';
          t.observations = '';
          t.evidence = [];
          t.completedAt = null;
        });

        this.saveTasks();
        this.updateStats();
        this.renderTasks();
        this.showToast(`Órdenes reiniciadas correctamente`, 'success');
      }

      renderAdminAuditLog() {
        const section = document.getElementById('section-admin-audit-log');
        const body = document.getElementById('audit-log-tbody');
        const counter = document.getElementById('audit-log-counter');
        if (!section || !body || !counter || this.currentUser?.role !== 'admin') return;

        const reportStatuses = new Set(['REALIZADA', 'NO_REALIZADA', 'EN_PROCESO']);
        const reports = (Array.isArray(this.tasks) ? this.tasks : []).filter(task =>
          task && (task.completedAt || reportStatuses.has(String(task.status || '').toUpperCase()))
        );
        counter.textContent = `${reports.length} Informes`;
        body.replaceChildren();

        if (reports.length === 0) {
          const row = document.createElement('tr');
          const cell = document.createElement('td');
          cell.colSpan = 6;
          cell.className = 'p-4 text-center text-slate-400';
          cell.textContent = 'No hay informes registrados.';
          row.appendChild(cell);
          body.appendChild(row);
          return;
        }

        reports.forEach(task => {
          const row = document.createElement('tr');
          const evidenceCount = Array.isArray(task.evidence) ? task.evidence.length : 0;
          const values = [
            task.completedAt || task.date || '—',
            task.assignedTo || '—',
            task.client || '—',
            task.status || '—',
            task.observations || '—',
            evidenceCount ? `${evidenceCount} archivo(s)` : '—'
          ];
          values.forEach(value => {
            const cell = document.createElement('td');
            cell.className = 'p-2 align-top';
            cell.textContent = String(value);
            row.appendChild(cell);
          });
          body.appendChild(row);
        });
      }

      renderTasks() {
        const search = document.getElementById('filter-search').value.toLowerCase();
        const statusFilter = document.getElementById('filter-status').value;
        const techFilter = document.getElementById('filter-tech').value;
        const container = document.getElementById('tasks-container');
        const emptyState = document.getElementById('empty-state');
        const countTag = document.getElementById('filtered-count');
        const isAdmin = this.currentUser.role === 'admin';
        const archiveButton = document.getElementById('btn-toggle-archived-orders');
        const archivedDocumentsButton = document.getElementById('btn-archived-document-control');
        if (archivedDocumentsButton) { archivedDocumentsButton.classList.toggle('hidden', !isAdmin || !this.showArchivedTasks); archivedDocumentsButton.classList.toggle('inline-flex', isAdmin && this.showArchivedTasks); }
        const archivedCount = this.tasks.filter(task => !!task.archivedAt).length;
        if (archiveButton) archiveButton.classList.toggle('hidden', !isAdmin);
        const archiveLabel = document.getElementById('archived-orders-button-label');
        const archiveCount = document.getElementById('archived-orders-count');
        if (archiveLabel) archiveLabel.textContent = this.showArchivedTasks ? '↩ Volver a órdenes' : '📦 Órdenes Archivadas';
        if (archiveCount) archiveCount.textContent = String(archivedCount);
        const myName = this.getCurrentDisplayName();
        this.ensurePaymentNotificationScheduler?.();
        const documentsPanel = document.getElementById('archived-documents-panel');
        if (this.showDocumentControl && isAdmin) {
          container.classList.add('hidden');
          emptyState.classList.add('hidden');
          documentsPanel?.classList.remove('hidden');
          this.renderDocumentControlRecords?.();
          return;
        }
        container.classList.remove('hidden');
        documentsPanel?.classList.add('hidden');

        let filtered = this.tasks.filter(t => {
          if (this.showArchivedTasks ? (!isAdmin || !t.archivedAt) : !!t.archivedAt) return false;
          if (!isAdmin && !this.isTaskFree(t) && t.assignedTo !== myName) return false;

          const matchText = !search ||
            t.client.toLowerCase().includes(search) ||
            t.address.toLowerCase().includes(search) ||
            t.equipment.toLowerCase().includes(search) ||
            t.serviceType.toLowerCase().includes(search) ||
            t.id.toLowerCase().includes(search);

          const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
          const matchTech = !isAdmin || techFilter === 'ALL' || (techFilter === 'LIBRE' ? this.isTaskFree(t) : t.assignedTo === techFilter);

          return matchText && matchStatus && matchTech;
        });

        const statusPriority = { REALIZADA: 0, EN_PROCESO: 1, PENDIENTE: 2, NO_REALIZADA: 3 };
        filtered.sort((a, b) => (statusPriority[a.status] ?? 4) - (statusPriority[b.status] ?? 4));

        countTag.textContent = filtered.length;

        if (filtered.length === 0) {
          container.innerHTML = '';
          emptyState.classList.remove('hidden');
          return;
        }

        emptyState.classList.add('hidden');

        container.innerHTML = filtered.map(t => {
          let statusBadge = '<span class="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">⏳ Pendiente</span>';
          let borderClass = 'border-amber-200';

          if (t.status === 'EN_PROCESO') {
            statusBadge = '<span class="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">⚙️ En Proceso</span>';
            borderClass = 'border-blue-300';
          } else if (t.status === 'REALIZADA') {
            statusBadge = '<span class="bg-brand-limeLight text-brand-limeHover border border-brand-limeBorder text-[10px] px-2 py-0.5 rounded-full font-bold">✅ Realizada</span>';
            borderClass = 'border-brand-lime/40';
          } else if (t.status === 'NO_REALIZADA') {
            statusBadge = '<span class="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold">❌ No Realizada</span>';
            borderClass = 'border-rose-200';
          }

          const taskIsFree = this.isTaskFree(t);
          const rawWorkDate = String(t.date || '');
          const workDate = /^\d{4}-\d{2}-\d{2}$/.test(rawWorkDate) ? rawWorkDate.split('-').reverse().join('/') : rawWorkDate;
          const adminLine = t.administrator ? `<p class="order-administrator mt-1 text-xs text-slate-600"><span class="font-semibold">Administrador / contacto:</span> ${this.escapeHtml(t.administrator)}</p>` : '';
          const phoneLine = t.phone ? `<p class="order-phone mt-0.5 text-xs text-slate-600"><span class="font-semibold">Teléfono:</span> ${this.escapeHtml(t.phone)}</p>` : '';
          const workValueLine = isAdmin && t.workValue !== null && t.workValue !== undefined && t.workValue !== '' ? `<p class="order-work-value mt-1 text-xs font-bold text-emerald-800"><span class="font-semibold">Valor del trabajo:</span> ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(t.workValue) || 0)}</p>` : '';
          const orderInstructions = String(t.instructions || '').trim();
          const orderObservations = String(t.observations || '').trim();
          const techObj = taskIsFree ? null : this.users.find(u => (u.fullName || u.username) === t.assignedTo);
          const techPhoto = techObj && techObj.photo ? techObj.photo : '';
          const techPresenceStatus = this.getPresenceStatus(techObj);
          const techPresenceLabel = this.getPresenceLabel(techPresenceStatus);
          const techIsOnline = techPresenceStatus === 'available';
          const techDetails = [
            techObj?.phone ? `📞 ${this.escapeHtml(techObj.phone)}` : '',
            techObj?.nationalId ? `🪪 C.C. ${this.escapeHtml(techObj.nationalId)}` : '',
            techObj?.specialty ? `🛠️ ${this.escapeHtml(techObj.specialty)}` : ''
          ].filter(Boolean);

          return `
            <div data-task-id="${this.escapeHtml(t.id)}" class="order-card bg-white rounded-2xl p-3.5 sm:p-4 border ${borderClass} shadow-sm flex flex-col justify-between min-w-0 overflow-hidden transition-all duration-200 hover:shadow-md ${isAdmin && t.status === 'REALIZADA' && !t.archivedAt ? 'completed-order-alert' : ''}">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-mono font-black text-slate-500">${t.id}</span>
                  <div>${statusBadge}</div>
                </div>

                <h3 class="font-extrabold text-slate-900 text-sm sm:text-base leading-snug break-words">${this.escapeHtml(t.client || 'Cliente')}</h3>
                <p class="order-service-line text-xs font-semibold text-slate-700 mt-0.5">${this.escapeHtml(t.serviceType || 'Servicio sin especificar')}</p>
                <p class="order-date-line mt-1 text-[11px] text-slate-500"><span class="font-semibold">Fecha de realización:</span> ${this.escapeHtml(workDate || 'Sin fecha')}</p>
                ${adminLine}
                ${phoneLine}
                ${workValueLine}

                <div class="order-client-panel mt-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 space-y-1.5 text-xs min-w-0">
                  <p class="text-slate-600 flex items-start gap-1.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5"></i><span class="line-clamp-2 break-words">${this.escapeHtml(t.address || "Sin dirección")}</span></p>
                  <div class="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Abrir ruta</span>
                    <div class="flex items-center gap-1.5"><button type="button" onclick="app.openWazeNavigation('${t.address.replace(/'/g, "\\'")}')" class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-slate-200 bg-white hover:border-brand-lime hover:bg-brand-limeLight active:scale-95 transition flex items-center justify-center" aria-label="Abrir ruta en Waze" title="Abrir ruta en Waze"><img src="assets/media/media-1.png" alt="" aria-hidden="true" class="w-6 h-6 sm:w-7 sm:h-7 object-contain"></button><button type="button" onclick="app.openGoogleMapsNavigation('${t.address.replace(/'/g, "\\'")}')" class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-slate-200 bg-white hover:border-brand-lime hover:bg-brand-limeLight active:scale-95 transition flex items-center justify-center" aria-label="Abrir ruta en Google Maps" title="Abrir ruta en Google Maps"><img src="assets/media/media-2.png" alt="" aria-hidden="true" class="w-6 h-6 sm:w-7 sm:h-7 object-contain"></button></div>
                  </div>
                </div>

                <div class="order-observations order-instructions mt-2 p-2 rounded-xl text-xs bg-slate-50 border text-slate-700 text-[11px]">
                  <span class="block mb-0.5 font-bold not-italic">Por hacer</span><span class="line-clamp-3 whitespace-pre-line">${this.escapeHtml(orderInstructions || 'Sin instrucciones registradas.')}</span>
                </div>
                ${this.showArchivedTasks ? '<details class="archived-order-extra mt-2"><summary><span>Ver informe y técnico</span><i data-lucide="chevron-down"></i></summary><div class="archived-order-extra-content">' : ''}
                <div class="order-observations order-completed-notes mt-1.5 p-2 rounded-xl text-xs bg-emerald-50 border border-emerald-100 text-slate-700 text-[11px]">
                  <span class="block mb-0.5 font-bold not-italic text-emerald-800">Realizado</span><span class="order-observations-text line-clamp-3 whitespace-pre-line">${this.escapeHtml(orderObservations || 'Pendiente de registrar.')}</span>
                </div>

                <div class="order-tech-section mt-2.5 pt-2 border-t text-xs">
                  <span class="text-slate-500 text-[11px] block mb-1.5">Técnico:</span>
                  ${taskIsFree
                    ? '<span class="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-700">🟠 LIBRE · Disponible</span>'
                    : `<div class="flex items-center gap-2"><div onclick="app.zoomWorkerPhoto('${techPhoto}', '${t.assignedTo}')" class="seasonal-worker-avatar cursor-pointer w-9 h-9 rounded-full overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center border-2 border-brand-lime" title="Ampliar foto">${techPhoto ? `<img src="${this.escapeHtml(techPhoto)}" alt="Foto de ${this.escapeHtml(t.assignedTo)}" class="w-full h-full object-cover">` : `<span class="text-xs font-bold">${this.escapeHtml(String(t.assignedTo || '?').charAt(0).toUpperCase())}</span>`}</div><div class="min-w-0"><div class="font-bold text-slate-800 text-[11px]">${this.escapeHtml(t.assignedTo)}</div><span class="presence-label is-${techPresenceStatus}">${techPresenceLabel}</span>${techDetails.length ? `<div class="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-slate-500">${techDetails.map(detail => `<span>${detail}</span>`).join('')}</div>` : ''}</div></div>`}
                </div>

                ${this.showArchivedTasks ? '</div></details>' : ''}
              </div>

              <div class="mt-3 pt-2 border-t flex items-center justify-between gap-1">
                <button type="button" onclick="app.viewOrderDetails('${this.escapeHtml(t.id)}')" class="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-brand-dark hover:border-brand-lime flex items-center justify-center" title="Ver orden" aria-label="Ver orden"><i data-lucide="eye" class="w-4 h-4"></i></button>

                <div class="flex items-center gap-1">
                  ${!isAdmin && this.currentUser.role === 'worker' && taskIsFree
                    ? `<button type="button" onclick="app.takeFreeOrder('${t.id}')" class="text-xs font-black py-1.5 px-3 rounded-xl shadow-sm transition active:scale-95 bg-orange-500 hover:bg-orange-600 text-white">✅ Tomar Orden</button>`
                    : `<button onclick="app.openReportModal('${t.id}')" class="text-xs font-bold py-1 px-2.5 rounded-xl shadow-sm transition active:scale-95 ${
                      t.status === 'REALIZADA'
                        ? 'bg-brand-lime hover:bg-brand-limeHover text-white'
                        : t.status === 'NO_REALIZADA'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-brand-dark hover:bg-black text-white'
                    }">${t.status === 'REALIZADA' || t.status === 'NO_REALIZADA' ? 'Editar Informe' : 'Registrar Informe'}</button>`}

                  ${isAdmin ? `
                    ${isAdmin && t.status === 'REALIZADA' ? `<button type="button" class="order-invoice-shortcut" onclick="app.openOrderInvoiceNumber('${t.id}')" title="Gestionar factura FE y valor"><i data-lucide="receipt-text" class="w-3.5 h-3.5"></i><span>Gestión FE</span></button>` : ''}
                    ${this.showArchivedTasks ? `<button type="button" onclick="app.unarchiveCompletedTask('${t.id}')" class="p-1 text-slate-400 hover:text-emerald-700 rounded-lg" title="Desarchivar orden" aria-label="Desarchivar orden"><i data-lucide="archive-restore" class="w-3.5 h-3.5"></i></button>` : ''}
                    <button onclick="app.openEditTaskModal('${t.id}')" class="p-1 text-slate-400 hover:text-brand-dark rounded-lg" title="Editar"><i data-lucide="file-edit" class="w-3.5 h-3.5"></i></button>
                    <button onclick="app.deleteTask('${t.id}')" class="p-1 text-slate-400 hover:text-rose-600 rounded-lg" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');

        if (window.lucide) lucide.createIcons();
      }

      readStoredList(key, fallback) {
        try { const value = JSON.parse(SafeStorage.getItem(key) || 'null'); return Array.isArray(value) && value.length ? value : fallback; } catch (_) { return fallback; }
      }
      escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
      renderChecklistAdminEditor() {
        const section = document.getElementById('task-checklist-admin-section');
        const list = document.getElementById('task-checklist-admin-list');
        if (!section || !list) return;
        section.classList.toggle('hidden', this.currentUser?.role !== 'admin');
        const items = Array.isArray(this.activeChecklistDraft) ? this.activeChecklistDraft : [];
        list.innerHTML = items.map((entry, index) => {
          const item = typeof entry === 'string' ? { label: entry, done: false } : entry;
          return `<div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"><span class="text-emerald-600">☑</span><span class="min-w-0 flex-1 text-[11px] font-medium text-slate-700">${this.escapeHtml(item.label)}</span><button type="button" onclick="app.editChecklistItem(${index})" class="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Editar punto" aria-label="Editar punto">✏️</button><button type="button" onclick="app.deleteChecklistItem(${index})" class="rounded-md p-1 text-rose-600 hover:bg-rose-50" title="Eliminar punto" aria-label="Eliminar punto">🗑️</button></div>`;
        }).join('') || '<p class="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-[11px] text-slate-400">Aún no hay puntos en este checklist.</p>';
      }

      openServiceManager() {
        if (this.currentUser?.role !== 'admin') return;
        this.serviceTypeEditingIndex = null;
        this.serviceMenuOpenIndex = null;
        const input = document.getElementById('service-type-manager-input');
        input.value = '';
        document.getElementById('service-type-manager-submit').textContent = 'Agregar';
        document.getElementById('service-type-cancel-edit').classList.add('hidden');
        this.renderServiceTypeManager();
        const modal = document.getElementById('modal-service-manager');
        modal.classList.remove('hidden'); modal.classList.add('flex');
        setTimeout(() => input.focus(), 40);
      }

      closeServiceManager() {
        const modal = document.getElementById('modal-service-manager');
        modal.classList.add('hidden'); modal.classList.remove('flex');
        this.serviceTypeEditingIndex = null; this.serviceMenuOpenIndex = null;
      }

      renderServiceTypeManager() {
        const list = document.getElementById('service-type-manager-list');
        if (!list) return;
        list.innerHTML = this.serviceTypes.map((type, index) => `<div class="relative flex items-center gap-2 px-3 py-2.5"><span class="min-w-0 flex-1 text-xs font-semibold text-slate-700">${this.escapeHtml(type)}</span><button type="button" onclick="app.toggleServiceTypeMenu(${index})" class="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Opciones de ${this.escapeHtml(type)}">⋮</button>${this.serviceMenuOpenIndex === index ? `<div class="absolute right-2 top-10 z-10 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"><button type="button" onclick="app.editServiceTypeModal(${index})" class="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">✏️ Editar</button><button type="button" onclick="app.deleteServiceTypeModal(${index})" class="block w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50">🗑️ Eliminar</button></div>` : ''}</div>`).join('') || '<p class="p-4 text-center text-xs text-slate-400">No hay tipos de servicio.</p>';
      }

      toggleServiceTypeMenu(index) {
        if (this.currentUser?.role !== 'admin') return;
        this.serviceMenuOpenIndex = this.serviceMenuOpenIndex === index ? null : index;
        this.renderServiceTypeManager();
      }

      editServiceTypeModal(index) {
        if (this.currentUser?.role !== 'admin' || !this.serviceTypes[index]) return;
        this.serviceTypeEditingIndex = index;
        this.serviceMenuOpenIndex = null;
        const input = document.getElementById('service-type-manager-input');
        input.value = this.serviceTypes[index];
        document.getElementById('service-type-manager-submit').textContent = 'Guardar cambio';
        document.getElementById('service-type-cancel-edit').classList.remove('hidden');
        this.renderServiceTypeManager();
        input.focus();
      }

      cancelServiceTypeEdit() {
        this.serviceTypeEditingIndex = null;
        document.getElementById('service-type-manager-input').value = '';
        document.getElementById('service-type-manager-submit').textContent = 'Agregar';
        document.getElementById('service-type-cancel-edit').classList.add('hidden');
      }

      saveServiceTypeModal(event) {
        event.preventDefault();
        if (this.currentUser?.role !== 'admin') return;
        const value = document.getElementById('service-type-manager-input').value.trim();
        if (!value) return;
        const editing = this.serviceTypeEditingIndex;
        if (this.serviceTypes.some((type, index) => type.toLocaleLowerCase() === value.toLocaleLowerCase() && index !== editing)) {
          return this.showToast('Ese tipo de servicio ya existe', 'info');
        }
        if (editing === null) this.serviceTypes.push(value);
        else this.serviceTypes[editing] = value;
        SafeStorage.setItem('portonpro_service_types_v1', JSON.stringify(this.serviceTypes));
        this.renderServiceTypeOptions(value);
        this.cancelServiceTypeEdit();
        this.renderServiceTypeManager();
        this.showToast(editing === null ? 'Tipo de servicio agregado' : 'Tipo de servicio actualizado', 'success');
      }

      deleteServiceTypeModal(index) {
        if (this.currentUser?.role !== 'admin' || index < 0 || index >= this.serviceTypes.length) return;
        const removed = this.serviceTypes[index];
        this.serviceTypes.splice(index, 1);
        if (!this.serviceTypes.length) this.serviceTypes.push('Mantenimiento Preventivo');
        const selected = document.getElementById('task-service-type')?.value;
        const next = selected === removed ? this.serviceTypes[0] : selected;
        SafeStorage.setItem('portonpro_service_types_v1', JSON.stringify(this.serviceTypes));
        this.renderServiceTypeOptions(next);
        this.serviceMenuOpenIndex = null;
        this.renderServiceTypeManager();
        this.showToast('Opción eliminada; las órdenes guardadas no cambian', 'info');
      }

      renderServiceTypeOptions(selected) {
        const select = document.getElementById('task-service-type');
        const manageButton = document.getElementById('btn-manage-service-types');
        if (!select) return;
        if (select.tagName === 'INPUT') {
          select.value = selected || '';
          manageButton?.classList.add('hidden');
          return;
        }
        const values = [...new Set([...this.serviceTypes, ...(selected && !this.serviceTypes.includes(selected) ? [selected] : [])])];
        select.innerHTML = values.map(value => `<option value="${this.escapeHtml(value)}">${this.escapeHtml(value)}</option>`).join('');
        if (selected) select.value = selected;
        if (manageButton) manageButton.classList.toggle('hidden', this.currentUser?.role !== 'admin');
      }

      openManagedItemModal(mode, index = null) {
        if (mode === 'finding' && index !== null) return;
        if (mode === 'checklist' && this.currentUser?.role !== 'admin') return;
        if (mode === 'finding' && this.currentUser?.role !== 'worker') return;
        this.managedItemMode = mode; this.managedItemIndex = index;
        const title = document.getElementById('managed-item-title');
        const label = document.getElementById('managed-item-label');
        const input = document.getElementById('managed-item-input');
        const existing = index === null ? null : mode === 'checklist' ? this.activeChecklistDraft[index] : this.selectedTask?.fieldFindings?.[index];
        const value = typeof existing === 'string' ? existing : existing?.label || existing?.text || '';
        title.textContent = mode === 'finding' ? (index === null ? 'Agregar novedad' : 'Editar novedad') : (index === null ? 'Agregar punto al checklist' : 'Editar punto del checklist');
        label.textContent = mode === 'finding' ? 'Describe el hallazgo técnico' : 'Nombre del punto';
        input.value = value;
        input.placeholder = mode === 'finding' ? 'Ej.: Cable deteriorado, cliente ausente...' : 'Ej.: Verificar batería de respaldo';
        const modal = document.getElementById('modal-managed-item');
        modal.classList.remove('hidden'); modal.classList.add('flex');
        setTimeout(() => input.focus(), 40);
      }

      closeManagedItemModal() {
        const modal = document.getElementById('modal-managed-item');
        modal.classList.add('hidden'); modal.classList.remove('flex');
        this.managedItemMode = null; this.managedItemIndex = null;
      }

      saveManagedItem(event) {
        event.preventDefault();
        const value = document.getElementById('managed-item-input').value.trim();
        if (!value) return;
        if (this.managedItemMode === 'checklist' && this.currentUser?.role === 'admin') {
          const index = this.managedItemIndex;
          if (index === null) this.activeChecklistDraft.push({ label: value, done: false });
          else {
            const old = this.activeChecklistDraft[index];
            this.activeChecklistDraft[index] = typeof old === 'string' ? { label: value, done: false } : { ...old, label: value };
          }
          this.checklistDraftDirty = true;
          this.renderChecklistAdminEditor();
        } else if (this.managedItemMode === 'finding' && this.currentUser?.role === 'worker' && this.selectedTask) {
          if (!Array.isArray(this.selectedTask.fieldFindings)) this.selectedTask.fieldFindings = [];
          const index = this.managedItemIndex;
          const finding = { text: value, authorName: this.getCurrentDisplayName(), authorRole: 'worker', createdAt: Date.now() };
          if (index !== null) return;
          this.selectedTask.fieldFindings.push(finding);
          this.saveTasks(); this.renderFieldFindings();
        }
        this.closeManagedItemModal();
      }

      addChecklistItem() { if (this.currentUser?.role === 'admin') this.openManagedItemModal('checklist'); }
      editChecklistItem(index) { if (this.currentUser?.role === 'admin') this.openManagedItemModal('checklist', index); }
      deleteChecklistItem(index) {
        if (this.currentUser?.role !== 'admin' || !Array.isArray(this.activeChecklistDraft)) return;
        if (index < 0 || index >= this.activeChecklistDraft.length) return;
        this.activeChecklistDraft.splice(index, 1); this.checklistDraftDirty = true; this.renderChecklistAdminEditor();
      }

      renderReportChecklist() {
        const items = Array.isArray(this.selectedTask?.checklist) ? this.selectedTask.checklist : [];
        const section = document.getElementById('report-checklist-section');
        const list = document.getElementById('report-checklist-list');
        if (section) section.classList.toggle('hidden', !items.length);
        if (!list) return;
        list.innerHTML = items.map((entry, index) => {
          const item = typeof entry === 'string' ? { label: entry, done: false } : entry;
          return `<label class="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs"><input type="checkbox" ${item.done ? 'checked' : ''} ${this.currentUser?.role === 'admin' ? 'disabled' : ''} onchange="app.setChecklistItem(${index},this.checked)" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"><span class="leading-relaxed text-slate-800">${this.escapeHtml(item.label)}</span></label>`;
        }).join('');
      }

      setChecklistItem(index, checked) {
        if (!this.selectedTask || this.currentUser?.role !== 'worker') return;
        const item = this.selectedTask.checklist?.[index];
        if (typeof item === 'string') this.selectedTask.checklist[index] = { label: item, done: checked };
        else if (item) item.done = checked;
        this.saveTasks();
      }

      renderFieldFindings() {
        const addButton = document.getElementById('btn-add-field-finding');
        if (addButton) addButton.classList.toggle('hidden', this.currentUser?.role !== 'worker');
        const list = document.getElementById('report-findings-list');
        if (!list) return;
        const entries = Array.isArray(this.selectedTask?.fieldFindings) ? this.selectedTask.fieldFindings : [];
        const myName = this.getCurrentDisplayName();
        list.innerHTML = entries.map((item, index) => {
          const canDelete = this.currentUser?.role === 'admin' || (item.authorRole === 'worker' && item.authorName === myName);
          return `<div class="flex items-start gap-2 rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs"><span class="min-w-0 flex-1 leading-relaxed text-slate-700">${this.escapeHtml(item.text)} <span class="text-slate-400">— ${this.escapeHtml(item.authorName || 'Técnico')}</span></span>${canDelete ? `<button type="button" onclick="app.deleteFieldFinding(${index})" class="rounded-md p-1 text-rose-600 hover:bg-rose-50" title="Eliminar novedad" aria-label="Eliminar novedad">🗑️</button>` : ''}</div>`;
        }).join('') || '<p class="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-[11px] text-slate-400">Sin novedades registradas.</p>';
      }

      addFieldFinding() { if (this.currentUser?.role === 'worker' && this.selectedTask) this.openManagedItemModal('finding'); }
      deleteFieldFinding(index) {
        const item = this.selectedTask?.fieldFindings?.[index];
        const name = this.getCurrentDisplayName();
        if (this.currentUser?.role !== 'worker' || !item || item.authorRole !== 'worker' || item.authorName !== name) return;
        this.selectedTask.fieldFindings.splice(index, 1); this.saveTasks(); this.renderFieldFindings();
      }

      async takeFreeOrder(id) {
        if (this.currentUser?.role !== 'worker') return;
        const myName = this.getCurrentDisplayName();
        if (!myName || !window.db) {
          this.showToast('No se pudo conectar para tomar la orden. Intenta de nuevo.', 'error');
          return;
        }
        this.showToast('Verificando disponibilidad de la orden…', 'info');
        const orderRef = db.collection('ordenes').doc('todas');
        try {
          const result = await db.runTransaction(async transaction => {
            const snapshot = await transaction.get(orderRef);
            if (!snapshot.exists || !Array.isArray(snapshot.data()?.tasks)) return { state: 'missing' };
            const documentData = snapshot.data() || {};
            const storedTasks = Array.isArray(documentData.tasks) ? documentData.tasks : [];
            const task = storedTasks.find(item => String(item?.id) === String(id));
            if (!task) return { state: 'missing' };
            if (task.archivedAt) return { state: 'archived', tasks: storedTasks };
            if (!this.isTaskFree(task)) {
              return { state: task.assignedTo === myName ? 'already-mine' : 'already-assigned', tasks: storedTasks };
            }
            const updatedTasks = storedTasks.map(item => String(item?.id) === String(id) ? { ...item, assignedTo: myName } : item);
            transaction.set(orderRef, { ...documentData, tasks: updatedTasks }, { merge: true });
            return { state: 'claimed', tasks: updatedTasks };
          });

          if (result?.tasks) {
            this.tasks = result.tasks;
            SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));
            this.updateStats();
            this.renderTasks();
          }
          if (result?.state === 'claimed' || result?.state === 'already-mine') {
            this.showToast(result.state === 'claimed' ? `Orden asignada a ${myName}` : 'Esta orden ya está asignada a tu usuario', 'success');
          } else if (result?.state === 'already-assigned') {
            this.showToast('Esta orden ya fue asignada a otro técnico.', 'error');
          } else if (result?.state === 'archived') {
            this.showToast('Esta orden ya fue archivada por el Administrador.', 'info');
          } else {
            this.showToast('No se encontró la orden. Actualiza la lista e intenta otra vez.', 'error');
          }
        } catch (error) {
          console.error('[ORDEN] No se pudo tomar la orden:', error);
          this.showToast(`No se pudo tomar la orden: ${error.message || error}`, 'error');
        }
      }

      getRegisteredTaskClients() {
        const clients = new Map();
        (Array.isArray(this.tasks) ? this.tasks : []).forEach(task => {
          const name = String(task?.client || '').trim();
          if (!name) return;
          const key = name.toLocaleLowerCase();
          if (clients.has(key)) return;
          clients.set(key, {
            name,
            phone: String(task?.phone || ''),
            address: String(task?.address || ''),
            administrator: String(task?.administrator || task?.contact || '')
          });
        });
        return [...clients.values()].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      }

      renderSavedTaskClients() {
        const list = document.getElementById('task-client-options');
        if (!list) return;
        list.replaceChildren();
        this.getRegisteredTaskClients().forEach(client => list.appendChild(new Option(client.name, client.name)));
      }
      setTaskClientMode(mode) {
        const saved = mode === 'saved';
        this.taskClientMode = saved ? 'saved' : 'new';
        const newTab = document.getElementById('task-client-tab-new');
        const savedTab = document.getElementById('task-client-tab-saved');
        const newPanel = document.getElementById('task-client-new-panel');
        const savedPanel = document.getElementById('task-client-saved-panel');
        const hint = document.getElementById('task-client-mode-hint');
        const search = document.getElementById('task-client-search');
        const savedDetails = document.getElementById('task-client-saved-details');
        newTab?.classList.toggle('active', !saved);
        savedTab?.classList.toggle('active', saved);
        newTab?.setAttribute('aria-selected', String(!saved));
        savedTab?.setAttribute('aria-selected', String(saved));
        newPanel?.classList.toggle('hidden', saved);
        savedPanel?.classList.toggle('hidden', !saved);
        if (hint) hint.textContent = saved
          ? 'Escribe el nombre y elige una coincidencia para completar los datos guardados.'
          : 'Ingresa los datos del cliente. Al guardar, estarán disponibles para próximas órdenes.';
        ['task-client', 'task-address'].forEach(id => {
          const input = document.getElementById(id);
          if (input) input.required = !saved;
        });
        if (search) search.required = saved;
        if (saved) {
          this.renderSavedTaskClients();
          const exact = this.getRegisteredTaskClients().find(client => client.name.toLocaleLowerCase() === String(search?.value || '').trim().toLocaleLowerCase());
          savedDetails?.classList.toggle('hidden', !exact);
          if (exact) this.selectSavedTaskClient(exact.name);
        } else {
          savedDetails?.classList.add('hidden');
        }
      }

      searchSavedTaskClients(query) {
        const value = String(query || '').trim();
        const exact = this.getRegisteredTaskClients().find(client => client.name.toLocaleLowerCase() === value.toLocaleLowerCase());
        if (exact) {
          this.selectSavedTaskClient(exact.name);
          return;
        }
        document.getElementById('task-client-saved-details')?.classList.add('hidden');
        document.getElementById('task-client').value = '';
        document.getElementById('task-phone').value = '';
        document.getElementById('task-address').value = '';
        document.getElementById('task-administrator').value = '';
      }

      selectSavedTaskClient(name) {
        const client = this.getRegisteredTaskClients().find(item => item.name.toLocaleLowerCase() === String(name || '').trim().toLocaleLowerCase());
        if (!client) {
          document.getElementById('task-client-saved-details')?.classList.add('hidden');
          return;
        }
        const search = document.getElementById('task-client-search');
        if (search) search.value = client.name;
        document.getElementById('task-client').value = client.name;
        document.getElementById('task-phone').value = client.phone;
        document.getElementById('task-address').value = client.address;
        document.getElementById('task-administrator').value = client.administrator;
        document.getElementById('task-client-saved-name').textContent = client.name;
        document.getElementById('task-client-saved-address').textContent = client.address || 'Sin dirección guardada';
        document.getElementById('task-client-saved-administrator').textContent = client.administrator || 'Sin contacto guardado';
        document.getElementById('task-client-saved-phone').textContent = client.phone || 'Sin teléfono guardado';
        document.getElementById('task-client-saved-details').classList.remove('hidden');
      }
      openNewTaskModal() {
        if (this.currentUser.role !== 'admin') return;
        document.getElementById('form-modal-title').textContent = 'Nueva Orden de Trabajo';
        document.getElementById('task-id').value = '';
        document.getElementById('task-form').reset();
        document.getElementById('task-order-number-field').classList.remove('hidden');
        document.getElementById('task-order-number').disabled = false;
        document.getElementById('task-order-number').required = true;
        document.getElementById('task-order-number').value = this.getNextAvailableOrderNumber();
        document.getElementById('task-administrator').value = '';
        this.renderSavedTaskClients();
        this.setTaskClientMode('new');
        this.renderServiceTypeOptions('');
        this.renderTaskTechnicianMenu();
        this.activeChecklistDraft = [];
        this.checklistDraftDirty = false;
        this.renderChecklistAdminEditor();

        document.getElementById('modal-task-form').classList.remove('hidden');
      }

      openEditTaskModal(id) {
        if (this.currentUser.role !== 'admin') return;
        const t = this.tasks.find(x => x.id === id);
        if (!t) return;

        document.getElementById('form-modal-title').textContent = `Editar Orden ${t.id}`;
        document.getElementById('task-id').value = t.id;
        const orderNumberInput = document.getElementById('task-order-number');
        const orderNumber = this.getOrderNumberFromId(t.id);
        document.getElementById('task-order-number-field').classList.remove('hidden');
        orderNumberInput.disabled = false;
        orderNumberInput.required = true;
        orderNumberInput.value = orderNumber || this.getNextAvailableOrderNumber();
        document.getElementById('task-client').value = t.client;
        document.getElementById('task-phone').value = t.phone || '';
        document.getElementById('task-address').value = t.address;
        document.getElementById('task-administrator').value = t.administrator || t.contact || '';
        this.setTaskClientMode('new');
        this.renderServiceTypeOptions(t.serviceType);
        document.getElementById('task-equipment').value = t.equipment;
        document.getElementById('task-assigned-to').value = this.isTaskFree(t) ? 'LIBRE' : t.assignedTo;
        this.renderTaskTechnicianMenu();
        document.getElementById('task-priority').value = t.priority;
        document.getElementById('task-date').value = t.date;
        document.getElementById('task-instructions').value = t.instructions || '';
        this.activeChecklistDraft = Array.isArray(t.checklist) ? t.checklist.map(entry => typeof entry === 'string' ? { label: entry, done: false } : { ...entry }) : [];
        this.checklistDraftDirty = false;
        this.renderChecklistAdminEditor();
        document.getElementById('modal-task-form').classList.remove('hidden');
      }

      closeTaskModal() {
        document.getElementById('modal-task-form').classList.add('hidden');
      }

      handleTaskFormKeydown(e) {
        if (e.key !== 'Enter' || e.isComposing || e.shiftKey || e.ctrlKey || e.altKey || e.target?.tagName === 'TEXTAREA' || e.target?.closest?.('button,[role=option]')) return;
        e.preventDefault();
        this.submitTaskForm();
      }

      async submitTaskForm(e) {
        e?.preventDefault();
        const form = document.getElementById('task-form');
        if (!form) {
          this.showToast('No se encontró el formulario de la orden.', 'error');
          return;
        }
        if (this.taskClientMode === 'saved') {
          const searchValue = String(document.getElementById('task-client-search')?.value || '').trim();
          const client = this.getRegisteredTaskClients().find(item => item.name.toLocaleLowerCase() === searchValue.toLocaleLowerCase());
          if (!client) {
            this.showToast('Escribe y selecciona un cliente registrado de las sugerencias.', 'error');
            document.getElementById('task-client-search')?.focus();
            return;
          }
          this.selectSavedTaskClient(client.name);
        }
        if (!form.checkValidity()) {
          const invalidControls = [...form.elements].filter(control => control.willValidate && !control.validity.valid);
          const names = invalidControls.map(control => {
            const label = control.labels?.[0]?.textContent || control.closest('div')?.querySelector('label')?.textContent;
            return (label || control.id || 'Campo obligatorio').replace('*', '').trim();
          });
          form.reportValidity();
          if (names.length) this.showToast(`Revisa: ${names.join(', ')}`, 'error');
          invalidControls[0]?.focus();
          return;
        }
        if (this.currentUser?.role !== 'admin') {
          this.showToast('Solo el administrador puede guardar órdenes.', 'error');
          return;
        }
        try {
          await this.handleSaveTask({ preventDefault() {} });
        } catch (error) {
          console.error('[ORDEN] Error al guardar:', error);
          this.showToast(`No se pudo guardar la orden: ${error.message || error}`, 'error');
        }
      }

      async handleSaveTask(e) {
        e.preventDefault();
        if (this.currentUser?.role !== 'admin') return;
        const id = document.getElementById('task-id').value;
        const previousTasks = this.tasks.map(task => ({ ...task }));
        const previousChecklistTemplate = [...this.checklistTemplate];
        const previousOrderSequence = this.orderSequenceNext;
        const requestedOrderNumber = Number(document.getElementById('task-order-number').value);
        const newOrderId = Number.isSafeInteger(requestedOrderNumber) && requestedOrderNumber > 0 ? `ORD-${requestedOrderNumber}` : '';
        if (!newOrderId) return this.showToast('Escribe un consecutivo de orden válido.', 'error');
        if (newOrderId && this.tasks.some(task => task.id !== id && String(task.id).toUpperCase() === newOrderId.toUpperCase())) {
          return this.showToast(`El número ${newOrderId} ya está en uso. Elige otro consecutivo.`, 'error');
        }

        if (id) {
          const index = this.tasks.findIndex(t => t.id === id);
          if (index !== -1) {
            this.tasks[index].id = newOrderId;
            this.tasks[index].client = document.getElementById('task-client').value;
            this.tasks[index].phone = document.getElementById('task-phone').value;
            this.tasks[index].address = document.getElementById('task-address').value;
            this.tasks[index].administrator = document.getElementById('task-administrator').value.trim();
            this.tasks[index].serviceType = document.getElementById('task-service-type').value;
            this.tasks[index].equipment = document.getElementById('task-equipment').value;
            this.tasks[index].assignedTo = document.getElementById('task-assigned-to').value;
            this.tasks[index].priority = document.getElementById('task-priority').value;
            this.tasks[index].date = document.getElementById('task-date').value;
            this.tasks[index].instructions = document.getElementById('task-instructions').value;
            if (this.checklistDraftDirty) this.tasks[index].checklist = this.activeChecklistDraft.map(item => ({ ...item }));
            if (requestedOrderNumber >= this.orderSequenceNext) this.orderSequenceNext = this.getNextAvailableOrderNumber(requestedOrderNumber + 1, this.tasks);
          }
        } else {
          const num = requestedOrderNumber;
          this.orderSequenceNext = num + 1;
          const newTask = {
            id: `ORD-${num}`,
            client: document.getElementById('task-client').value,
            phone: document.getElementById('task-phone').value,
            address: document.getElementById('task-address').value,
            administrator: document.getElementById('task-administrator').value.trim(),
            serviceType: document.getElementById('task-service-type').value,
            equipment: document.getElementById('task-equipment').value,
            assignedTo: document.getElementById('task-assigned-to').value,
            priority: document.getElementById('task-priority').value,
            date: document.getElementById('task-date').value,
            instructions: document.getElementById('task-instructions').value,
            fieldFindings: [],
            status: 'PENDIENTE',
            observations: '',
            evidence: [],
            completedAt: null
          };
          this.tasks.unshift(newTask);
          this.orderSequenceNext = this.getNextAvailableOrderNumber(num + 1, this.tasks);


        }

        const saveResult = await this.saveTasks(true);
        if (!saveResult.ok) {
          this.tasks = previousTasks;
          this.orderSequenceNext = previousOrderSequence;
          SafeStorage.setItem('portonpro_order_sequence_next', String(previousOrderSequence));
          this.checklistTemplate = previousChecklistTemplate;
          SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));

          this.updateStats();
          this.renderTasks();
          return;
        }

        this.closeTaskModal();
        this.updateStats();
        this.renderTasks();
        this.showToast(id ? 'Orden modificada correctamente' : `Nueva orden ${this.tasks[0]?.id || ''} guardada`, 'success');
      }

      deleteTask(id) {
        if (this.currentUser.role !== 'admin') return;
        if (!confirm(`¿Eliminar la orden ${id}?`)) return;
        this.tasks = this.tasks.filter(x => x.id !== id);
        this.saveTasks();
        this.updateStats();
        this.renderTasks();
        this.showToast(`Orden eliminada`, 'info');
      }

      toggleArchivedOrders() {
        if (this.currentUser?.role !== 'admin') return;
        this.showArchivedTasks = !this.showArchivedTasks;
        this.showDocumentControl = false;
        this.renderTasks();
      }

      async archiveCompletedTask(id) {
        if (this.currentUser?.role !== 'admin') return;
        const task = this.tasks.find(item => item.id === id);
        if (!task || task.status !== 'REALIZADA' || task.archivedAt) return;
        const previousArchive = { archivedAt: task.archivedAt, archivedBy: task.archivedBy };
        task.archivedAt = Date.now();
        task.archivedBy = this.getCurrentDisplayName() || 'Administrador';
        const result = await this.saveTasks(true);
        if (!result?.ok) {
          delete task.archivedAt;
          delete task.archivedBy;
          if (previousArchive.archivedAt) Object.assign(task, previousArchive);
          SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));
          return;
        }
        this.updateStats();
        this.renderTasks();
        this.showToast(`Orden ${id} archivada`, 'success');
      }

      async unarchiveCompletedTask(id) {
        if (this.currentUser?.role !== 'admin') return;
        const task = this.tasks.find(item => item.id === id);
        if (!task?.archivedAt) return;
        const archivedAt = task.archivedAt;
        const archivedBy = task.archivedBy;
        delete task.archivedAt;
        delete task.archivedBy;
        const result = await this.saveTasks(true);
        if (!result?.ok) {
          task.archivedAt = archivedAt;
          if (archivedBy) task.archivedBy = archivedBy;
          SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));
          return;
        }
        this.updateStats();
        this.renderTasks();
        this.showToast(`Orden ${id} desarchivada`, 'success');
      }

      openInvoiceAction(id) {
        if (this.currentUser?.role !== 'admin') return;
        const task = this.tasks.find(item => item.id === id);
        if (!task || task.status !== 'REALIZADA') return this.showToast('La factura se habilita cuando la orden está completada', 'info');
        if (task.invoice?.url) return this.viewOrderDetails(id);
        this.selectInvoiceFile(id);
      }

      selectInvoiceFile(id) {
        if (this.currentUser?.role !== 'admin') return;
        const task = this.tasks.find(item => item.id === id);
        if (!task || task.status !== 'REALIZADA') return;
        this.invoiceUploadTaskId = id;
        const input = document.getElementById('task-invoice-file');
        if (input) { input.value = ''; input.click(); }
      }

      async handleInvoiceUpload(event) {
        const file = event.target.files?.[0];
        const taskId = this.invoiceUploadTaskId;
        this.invoiceUploadTaskId = null;
        if (!file || !taskId) return;
        if (this.currentUser?.role !== 'admin') return;
        const task = this.tasks.find(item => item.id === taskId);
        if (!task || task.status !== 'REALIZADA') return this.showToast('Solo puedes adjuntar factura a una orden completada', 'error');
        const extension = (file.name.split('.').pop() || '').toLowerCase();
        const supportedExtensions = new Set(['pdf','doc','docx','xls','xlsx','csv','odt','ods','rtf','png','jpg','jpeg','webp','gif','bmp','heic']);
        if (!supportedExtensions.has(extension)) return this.showToast('Formato no compatible. Usa PDF, Word, Excel, CSV o una imagen (PNG/JPG y similares).', 'error');
        if (!window.firebase?.storage) return this.showToast('El almacenamiento de facturas no está disponible', 'error');

        const contentTypes = { pdf:'application/pdf', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv:'text/csv', odt:'application/vnd.oasis.opendocument.text', ods:'application/vnd.oasis.opendocument.spreadsheet', rtf:'application/rtf', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', bmp:'image/bmp', heic:'image/heic' };
        const contentType = file.type || contentTypes[extension] || 'application/octet-stream';
        const previousInvoice = task.invoice || null;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'factura';
        const storagePath = `ordenes_facturas/${encodeURIComponent(taskId)}/${Date.now()}_${safeName}`;
        this.showToast('Subiendo factura…', 'info');
        try {
          const storageRef = firebase.storage().ref().child(storagePath);
          await storageRef.put(file, { contentType });
          const url = await storageRef.getDownloadURL();
          console.info('[ORDER] Factura subida a Storage', { taskId, storagePath, url });
          task.invoice = {
            url, storagePath, name: file.name, contentType,
            size: file.size, uploadedAt: Date.now(), uploadedBy: this.getCurrentDisplayName() || 'Administrador'
          };
          const saved = await this.saveTasks(true);
          if (!saved?.ok) {
            if (previousInvoice) task.invoice = previousInvoice; else delete task.invoice;
            SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));
            try { await storageRef.delete(); } catch (_) {}
            return;
          }
          console.info('[ORDER] URL guardada en Firestore', { taskId, invoiceUrl: task.invoice.url });
          this.renderTasks();
          this.showToast('Factura subida y guardada', 'success');
          this.viewOrderDetails(taskId);
        } catch (error) {
          console.error('[FACTURA] Error subiendo archivo:', error);
          this.showToast(`No se pudo subir la factura: ${error.message || error}`, 'error');
        } finally {
          event.target.value = '';
        }
      }

      openReportModal(id) {
        const t = this.tasks.find(x => x.id === id);
        if (!t) return;
        this.selectedTask = t;

        document.getElementById('report-order-subtitle').textContent = `Orden #${t.id} - ${t.client}`;
        document.getElementById('rep-service').textContent = t.serviceType;
        document.getElementById('rep-equipment').textContent = t.equipment;
        document.getElementById('rep-address').textContent = t.address;
        document.getElementById('rep-observations').value = t.observations || '';

        document.getElementById('rep-btn-waze').onclick = () => this.openWazeNavigation(t.address);
        document.getElementById('rep-btn-maps').onclick = () => this.openGoogleMapsNavigation(t.address);

        const reportEvidence = [t.evidence, t.report?.evidence, t.workEvidence, t.evidences, t.attachments].find(items => Array.isArray(items) && items.length) || [];
        this.currentReportEvidence = [...reportEvidence];
        this.removedEvidenceStoragePaths = [];
        this.renderEvidenceGallery();
        this.renderReportChecklist();
        this.renderFieldFindings();
        this.setReportStatus(null);
        document.getElementById('modal-report').classList.remove('hidden');
      }

      closeReportModal() {
        document.getElementById('modal-report').classList.add('hidden');
      }

      setReportStatus(status) {
        const allowed = new Set(['REALIZADA', 'NO_REALIZADA', 'EN_PROCESO']);
        this.activeReportStatus = allowed.has(status) ? status : null;
        const btnDone = document.getElementById('btn-choice-done');
        const btnFailed = document.getElementById('btn-choice-failed');
        const btnProgress = document.getElementById('btn-choice-progress');
        const base = 'py-2 px-2.5 rounded-xl border-2 flex items-center justify-center gap-1 font-bold text-xs transition';
        btnDone.className = `${base} ${this.activeReportStatus === 'REALIZADA' ? 'bg-brand-limeLight text-brand-limeHover border-brand-lime shadow-sm' : 'text-slate-600 border-slate-200 bg-white'}`;
        btnFailed.className = `${base} ${this.activeReportStatus === 'NO_REALIZADA' ? 'bg-rose-50 text-rose-800 border-rose-500 shadow-sm' : 'text-slate-600 border-slate-200 bg-white'}`;
        btnProgress.className = `${base} ${this.activeReportStatus === 'EN_PROCESO' ? 'bg-amber-50 text-amber-800 border-amber-400 shadow-sm' : 'text-slate-600 border-slate-200 bg-white'}`;
        btnDone.setAttribute('aria-pressed', String(this.activeReportStatus === 'REALIZADA'));
        btnFailed.setAttribute('aria-pressed', String(this.activeReportStatus === 'NO_REALIZADA'));
        btnProgress.setAttribute('aria-pressed', String(this.activeReportStatus === 'EN_PROCESO'));
      }

      async waitForEvidenceReads() {
        let allSucceeded = true;
        while (this.pendingEvidenceReads.length) {
          const pending = this.pendingEvidenceReads.splice(0);
          const results = await Promise.all(pending);
          if (results.some(result => !result)) allSucceeded = false;
        }
        return allSucceeded;
      }

      async persistLegacyEvidence(taskId) {
        const storage = window.firebase?.storage ? firebase.storage() : null;
        const evidenceArrays = new Set([this.currentReportEvidence]);
        (this.tasks || []).forEach(task => {
          [task.evidence, task.report?.evidence, task.workEvidence, task.evidences, task.attachments, task.report?.attachments].forEach(value => {
            if (Array.isArray(value)) evidenceArrays.add(value);
            else if (value && typeof value === 'object') [value.items, value.photos, value.videos].forEach(list => { if (Array.isArray(list)) evidenceArrays.add(list); });
          });
        });
        const legacyCount = Array.from(evidenceArrays).reduce((count, items) => count + items.filter(item => {
          const src = typeof item === 'string' ? item : (item?.src || item?.dataUrl || item?.data || '');
          return typeof src === 'string' && src.startsWith('data:');
        }).length, 0);
        if (!legacyCount) return true;
        if (!storage) {
          this.showToast('No está disponible el almacenamiento para sincronizar las evidencias. No se guardó el informe.', 'error');
          return false;
        }
        try {
          for (const items of evidenceArrays) {
            for (let index = 0; index < items.length; index++) {
              const item = items[index];
              const src = typeof item === 'string' ? item : (item?.src || item?.dataUrl || item?.data || '');
              if (typeof src !== 'string' || !src.startsWith('data:')) continue;
              const response = await fetch(src);
              const blob = await response.blob();
              const itemName = typeof item === 'string' ? '' : item?.name || item?.fileName || '';
              const extension = itemName.includes('.') ? itemName.split('.').pop() : (blob.type.split('/')[1] || 'bin');
              const safeName = String(itemName || `evidencia.${extension}`).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
              const ownerTask = (this.tasks || []).find(task => [task.evidence, task.report?.evidence, task.workEvidence, task.evidences, task.attachments].includes(items));
              const ownerId = ownerTask?.id || taskId;
              const storagePath = `ordenes_evidencias/${encodeURIComponent(ownerId)}/${Date.now()}_${index}_${safeName}`;
              const storageRef = storage.ref().child(storagePath);
              await storageRef.put(blob, { contentType: (typeof item === 'string' ? '' : item?.contentType || item?.mimeType) || blob.type || 'application/octet-stream' });
              const url = await storageRef.getDownloadURL();
              items[index] = {
                type: (typeof item === 'string' ? '' : item?.type) || (String(blob.type).startsWith('video/') ? 'video' : 'image'),
                name: itemName || safeName,
                contentType: (typeof item === 'string' ? '' : item?.contentType || item?.mimeType) || blob.type,
                url, storagePath, size: blob.size, uploadedAt: (typeof item === 'string' ? null : item?.uploadedAt) || Date.now()
              };
            }
          }
          this.renderEvidenceGallery();
          console.info('[EVIDENCIA] Evidencias anteriores migradas a Storage', { taskId, cantidad: legacyCount });
          return true;
        } catch (error) {
          console.error('[EVIDENCIA] No se pudo migrar evidencia anterior a Storage:', error);
          this.showToast(`No se pudieron sincronizar las evidencias: ${error.message || error}`, 'error');
          return false;
        }
      }

      async deleteRemovedEvidenceFiles() {
        if (!window.firebase?.storage) return;
        const paths = this.removedEvidenceStoragePaths.splice(0);
        for (const path of paths) {
          try { await firebase.storage().ref().child(path).delete(); }
          catch (error) { console.warn('[EVIDENCIA] No se pudo eliminar el archivo retirado:', error); }
        }
      }

      async removeReportEvidence(index) {
        const item = this.currentReportEvidence[index];
        if (!item) return;
        if (item.storagePath) this.removedEvidenceStoragePaths.push(item.storagePath);
        this.currentReportEvidence.splice(index, 1);
        this.renderEvidenceGallery();
      }

      async submitReport() {
        if (!this.selectedTask) return;
        if (!this.activeReportStatus) return this.showToast('Selecciona Realizada, No Realizada o En Proceso antes de guardar', 'error');
        const taskId = this.selectedTask.id;
        if (!await this.waitForEvidenceReads() || this.selectedTask?.id !== taskId || !await this.persistLegacyEvidence(taskId)) return;
        const observations = document.getElementById('rep-observations').value.trim();

        if (this.activeReportStatus === 'NO_REALIZADA' && !observations) {
          this.showToast('Indica el motivo de no realización', 'error');
          return;
        }

        const taskIndex = this.tasks.findIndex(t => t.id === this.selectedTask.id);
        if (taskIndex !== -1) {
          const wasCompleted = this.tasks[taskIndex].status === 'REALIZADA';
          this.tasks[taskIndex].status = this.activeReportStatus;
          this.tasks[taskIndex].observations = observations;
          this.tasks[taskIndex].evidence = this.currentReportEvidence;
          this.tasks[taskIndex].completedAt = this.formatFullDateTime(new Date());
          if (this.activeReportStatus === 'REALIZADA') {
            if (!wasCompleted || !this.tasks[taskIndex].completedAtMs) this.tasks[taskIndex].completedAtMs = Date.now();
            this.tasks[taskIndex].paymentDueAt = this.tasks[taskIndex].completedAtMs + 30 * 86400000;
          } else if (wasCompleted) {
            this.tasks[taskIndex].completedAtMs = null;
            this.tasks[taskIndex].paymentDueAt = null;
          }

          const myName = this.getCurrentDisplayName();
          this.addActivityNotification(myName, this.selectedTask.id, this.activeReportStatus, observations, 'order');

          console.info('[ORDER] URL guardada: enviando a Firestore', { taskId, cantidad: this.currentReportEvidence.length, urls: this.currentReportEvidence.map(item => item?.url || item?.src || null) });
          const saved = await this.saveTasks(true);
          if (!saved?.ok) return;
          console.info('[ORDER] URL guardada en Firestore', { taskId, cantidad: this.tasks[taskIndex].evidence?.length || 0, urls: (this.tasks[taskIndex].evidence || []).map(item => item?.url || item?.src || null), persistencia: saved.localOnly ? 'solo-local' : 'Firestore' });
          await this.deleteRemovedEvidenceFiles();
          this.updateStats();
          this.renderTasks();
          this.closeReportModal();
          this.showToast(`Informe guardado con éxito`, 'success');
        }
      }

      setTaskInProgress() {
        this.setReportStatus('EN_PROCESO');
      }

      handleUploadEvidence(e) {
        const files = Array.from(e.target.files || []);
        const taskId = this.selectedTask?.id;
        if (!files.length || !taskId) return;
        if (!window.firebase?.storage) {
          this.showToast('El almacenamiento de evidencias no está disponible', 'error');
          e.target.value = '';
          return;
        }
        this.showToast(`Subiendo ${files.length} evidencia(s)…`, 'info');
        files.forEach((file, index) => {
          console.info('[ORDER] Archivo seleccionado', { taskId, name: file.name, type: file.type, size: file.size });
          console.info('[EVIDENCIA] Subida iniciada', { taskId, name: file.name, type: file.type, size: file.size });
          const pending = (async () => {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || `evidencia_${index + 1}`;
            const storagePath = `ordenes_evidencias/${encodeURIComponent(taskId)}/${Date.now()}_${index}_${safeName}`;
            const storageRef = firebase.storage().ref().child(storagePath);
            console.info('[ORDER] Subiendo a Firebase Storage', { taskId, storagePath });
            await storageRef.put(file, { contentType: file.type || 'application/octet-stream' });
            console.info('[ORDER] Upload completado', { taskId, storagePath });
            const url = await storageRef.getDownloadURL();
            console.info('[ORDER] URL obtenida', { taskId, storagePath, url });
            console.info('[ORDER] Evidencia subida', { taskId, storagePath, url });
            if (this.selectedTask?.id !== taskId) {
              try { await storageRef.delete(); } catch (_) {}
              return false;
            }
            this.currentReportEvidence.push({
              type: file.type.startsWith('video/') ? 'video' : 'image',
              name: file.name, contentType: file.type, url, storagePath,
              size: file.size, uploadedAt: Date.now()
            });
            this.renderEvidenceGallery();
            console.info('[ORDER] Evidencia subida al formulario', { taskId, cantidad: this.currentReportEvidence.length, url });
            return true;
          })().catch(error => {
            console.error('[EVIDENCIA] Error subiendo archivo:', error);
            this.showToast(`No se pudo subir ${file.name}: ${error.message || error}`, 'error');
            return false;
          });
          this.pendingEvidenceReads.push(pending);
        });
        e.target.value = '';
      }

      renderEvidenceGallery() {
        const container = document.getElementById('rep-evidence-gallery');
        if (!container) return;
        container.innerHTML = this.currentReportEvidence.map((item, index) => {
          const src = item?.src || item?.url || '';
          return `
            <div class="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video flex items-center justify-center">
              ${item.type === 'video' ? `<video src="${this.escapeHtml(src)}" class="w-full h-full object-contain" controls playsinline preload="metadata"></video>` : `<img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(item.name || 'Evidencia') }" class="w-full h-full object-contain">`}
              <button type="button" onclick="app.removeReportEvidence(${index})" class="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full text-xs shadow" aria-label="Quitar evidencia">✕</button>
            </div>`;
        }).join('');
      }

      viewOrderDetails(id) {
        const t = this.tasks.find(x => x.id === id);
        if (!t) return;
        const myName = this.getCurrentDisplayName();
        if (this.currentUser?.role !== 'admin' && !this.isTaskFree(t) && t.assignedTo !== myName) return;
        this.selectedTask = t;

        document.getElementById('view-order-number').textContent = t.id;
        document.getElementById('view-order-subtitle').textContent = `${t.client || 'Cliente'} · ${t.serviceType || 'Servicio'}`;
        document.getElementById('view-client').textContent = t.client || '—';
        document.getElementById('view-phone').textContent = t.phone || '—';
        const workValueRow = document.getElementById('view-work-value-row');
        const canSeeWorkValue = this.currentUser?.role === 'admin' && t.workValue !== null && t.workValue !== undefined && t.workValue !== '';
        workValueRow?.classList.toggle('hidden', !canSeeWorkValue);
        if (canSeeWorkValue) document.getElementById('view-work-value').textContent = new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(t.workValue) || 0);
        document.getElementById('view-address').textContent = t.address || '—';
        document.getElementById('view-service-line').textContent = t.serviceType || 'Servicio sin especificar';
        document.getElementById('view-equipment-line').textContent = `Equipo: ${t.equipment || 'No especificado'}`;
        document.getElementById('view-instructions').textContent = t.instructions || 'No se registraron instrucciones adicionales.';
        document.getElementById('view-technician').textContent = t.assignedTo || '—';
        document.getElementById('view-completed-at').textContent = `Fecha del trabajo: ${t.date || '—'}` + (t.completedAt ? ` · Realizada: ${t.completedAt}` : '');
        document.getElementById('view-observations').textContent = t.observations || 'No se registraron observaciones del trabajo realizado.';

        const badge = document.getElementById('view-order-badge');
        const statusLabels = { PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', REALIZADA: 'Realizada', NO_REALIZADA: 'No realizada' };
        badge.textContent = statusLabels[t.status] || t.status || 'Pendiente';
        const badgeStyles = { PENDIENTE: 'bg-amber-100 text-amber-800', EN_PROCESO: 'bg-blue-100 text-blue-800', REALIZADA: 'bg-emerald-100 text-emerald-800', NO_REALIZADA: 'bg-rose-100 text-rose-800' };
        badge.className = `px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${badgeStyles[t.status] || 'bg-slate-100 text-slate-700'}`;

        const technician = this.users.find(user => (user.fullName || user.username) === t.assignedTo);
        const avatar = document.getElementById('view-technician-avatar');
        avatar.innerHTML = technician?.photo ? `<img src="${this.escapeHtml(technician.photo)}" alt="" class="w-full h-full object-cover">` : this.escapeHtml((t.assignedTo || '?').charAt(0).toUpperCase());

        // Se conserva el checklist existente en los datos, pero se retiró de la vista de órdenes.

        const findings = Array.isArray(t.fieldFindings) ? t.fieldFindings : [];
        const findingsSection = document.getElementById('view-findings-section');
        const findingsList = document.getElementById('view-findings-list');
        findingsSection.classList.toggle('hidden', findings.length === 0);
        findingsList.innerHTML = findings.map(finding => `<div class="rounded-lg border border-amber-100 bg-white px-3 py-2"><p class="text-xs text-slate-700">${this.escapeHtml(finding.text || '')}</p><p class="text-[10px] text-slate-400 mt-1">${this.escapeHtml(finding.authorName || 'Técnico')}</p></div>`).join('');

        const evidenceSources = [t.evidence, t.report?.evidence, t.workEvidence, t.evidences, t.attachments, t.report?.attachments];
        const evidenceCandidates = evidenceSources.flatMap(value => {
          if (Array.isArray(value)) return [value];
          if (value && typeof value === 'object') return [value.items, value.photos, value.videos].filter(Array.isArray);
          return [];
        });
        const evidence = evidenceCandidates.find(items => items.length > 0) || evidenceCandidates[0] || [];
        console.info('[ORDER] Evidencia cargada', { taskId: id, cantidad: evidence.length, urls: evidence.map(item => typeof item === 'string' ? item : item?.url || item?.src || null), campos: evidenceSources.map((value, index) => ({ index, tipo: Array.isArray(value) ? 'array' : typeof value, cantidad: Array.isArray(value) ? value.length : null })) });
        const evSection = document.getElementById('view-evidence-section');
        const evGallery = document.getElementById('view-evidence-gallery');
        const evEmpty = document.getElementById('view-evidence-empty');
        document.getElementById('view-evidence-count').textContent = `${evidence.length} archivo(s)`;
        evSection.classList.remove('hidden');
        evEmpty.classList.toggle('hidden', evidence.length > 0);
        evGallery.innerHTML = evidence.map((item, index) => {
          const src = typeof item === 'string' ? item : (item?.src || item?.url || item?.downloadURL || item?.dataUrl || item?.data || item?.fileUrl || '');
          const declaredType = String(typeof item === 'string' ? '' : (item?.type || item?.contentType || item?.mimeType || '')).toLowerCase();
          const fileName = String(typeof item === 'string' ? '' : (item?.name || item?.fileName || '') );
          const srcPath = String(src).split(/[?#]/)[0];
          const isVideo = declaredType.includes('video') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(fileName) || /\.(mp4|webm|mov|m4v|ogg)$/i.test(srcPath) || String(src).startsWith('data:video/');
          const label = `${isVideo ? 'Video' : 'Fotografía'} ${index + 1}`;
          const escapedSrc = this.escapeHtml(src);
          const media = !src
            ? '<div class="flex min-h-48 items-center justify-center bg-slate-100 p-5 text-center text-xs text-slate-500">El archivo está registrado, pero no contiene una dirección de visualización.</div>'
            : isVideo
              ? `<video src="${escapedSrc}" class="w-full max-h-[72vh] bg-black object-contain" controls playsinline preload="metadata" onloadeddata="console.info('[ORDER] Evidencia mostrada', { taskId: '${this.escapeHtml(id)}', url: this.currentSrc })" onerror="console.error('[ORDER] Error mostrando evidencia', { taskId: '${this.escapeHtml(id)}', url: this.currentSrc }); this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden')"></video><p class="hidden p-4 text-center text-xs text-rose-300">No se pudo cargar este video.</p>`
              : `<a href="${escapedSrc}" target="_blank" rel="noopener noreferrer" class="block bg-slate-950"><img src="${escapedSrc}" alt="${label}" class="mx-auto max-h-[72vh] w-full object-contain" loading="lazy" onload="console.info('[ORDER] Evidencia mostrada', { taskId: '${this.escapeHtml(id)}', url: this.currentSrc })" onerror="console.error('[ORDER] Error mostrando evidencia', { taskId: '${this.escapeHtml(id)}', url: this.currentSrc }); this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden')"><span class="hidden block p-5 text-center text-xs text-rose-300">No se pudo cargar esta fotografía.</span></a>`;
          return `<article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div class="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div class="flex items-center gap-2"><span class="flex h-8 w-8 items-center justify-center rounded-lg ${isVideo ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}">${isVideo ? '▶' : '▧'}</span><div><p class="text-[10px] font-black uppercase tracking-wider text-slate-700">${label}</p><p class="max-w-[18rem] truncate text-[10px] text-slate-400">${this.escapeHtml(fileName || 'Evidencia del servicio')}</p></div></div><span class="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">${isVideo ? 'VIDEO' : 'FOTO'}</span></div><div class="bg-slate-950">${media}</div></article>`;
        }).join('');
        console.info('[ORDER] Evidencias renderizadas en visor', { taskId: id, cantidad: evidence.length, urls: evidence.map(item => typeof item === 'string' ? item : item?.url || item?.src || null) });

        const invoiceSection = document.getElementById('view-invoice-section');
        const isAdmin = this.currentUser?.role === 'admin';
        document.getElementById('btn-view-order-worker-edit')?.classList.toggle('hidden', isAdmin);
        document.getElementById('btn-view-order-print')?.classList.toggle('hidden', !isAdmin);
        invoiceSection.classList.toggle('hidden', !isAdmin);
        if (isAdmin) this.renderOrderInvoice(t);

        const modal = document.getElementById('modal-view-order');
        modal.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
      }

      editCompletedOrderReport() {
        const task = this.selectedTask;
        if (this.currentUser?.role !== 'worker' || !task) return;
        const taskId = task.id;
        const status = task.status;
        this.closeViewModal();
        this.openReportModal(taskId);
        this.setReportStatus(status);
      }

      renderOrderInvoice(task) {
        const invoice = typeof task?.invoice === 'string'
          ? { url: task.invoice }
          : task?.invoice || (task?.invoiceUrl || task?.facturaUrl ? { url: task.invoiceUrl || task.facturaUrl, name: task.invoiceName || task.facturaName } : null);
        const hasInvoice = !!invoice?.url;
        const name = String(invoice?.name || task?.invoiceName || task?.facturaName || 'Factura adjunta');
        const extension = (name.split('.').pop() || '').toLowerCase();
        const contentType = String(invoice?.contentType || '').toLowerCase();
        const imageExtensions = new Set(['png','jpg','jpeg','webp','gif','bmp','heic']);
        const officeExtensions = new Set(['doc','docx','xls','xlsx','csv','odt','ods','rtf']);
        const isPdf = hasInvoice && (contentType.includes('pdf') || extension === 'pdf');
        const isImage = hasInvoice && (contentType.startsWith('image/') || imageExtensions.has(extension));
        const isOffice = hasInvoice && officeExtensions.has(extension);
        const empty = document.getElementById('view-invoice-empty');
        const attachment = document.getElementById('view-invoice-attachment');
        const pdfFrame = document.getElementById('view-invoice-pdf');
        const image = document.getElementById('view-invoice-image');
        const imageError = document.getElementById('view-invoice-image-error');
        const officeFrame = document.getElementById('view-invoice-office');
        const fileCard = document.getElementById('view-invoice-file-card');
        const filename = document.getElementById('view-invoice-filename');
        const addButton = document.getElementById('btn-add-order-invoice');
        const viewButton = document.getElementById('btn-view-order-invoice');
        const openLinkWrap = document.getElementById('view-invoice-open-link-wrap');
        const openLink = document.getElementById('view-invoice-open-link');
        empty.classList.toggle('hidden', hasInvoice);
        attachment.classList.toggle('hidden', !hasInvoice);
        filename.textContent = hasInvoice ? name : '';
        addButton.textContent = hasInvoice ? '＋ Reemplazar Factura' : '📄 Subir Factura';
        viewButton.classList.toggle('hidden', !hasInvoice);
        pdfFrame.classList.toggle('hidden', !isPdf);
        image.classList.toggle('hidden', !isImage);
        imageError.classList.add('hidden');
        officeFrame.classList.toggle('hidden', !isOffice);
        fileCard.classList.toggle('hidden', !hasInvoice || isPdf || isImage || isOffice);
        openLinkWrap.classList.toggle('hidden', !hasInvoice);
        openLink.href = hasInvoice ? invoice.url : '#';
        openLink.setAttribute('download', name);
        document.getElementById('view-invoice-file-kind').textContent = `${extension.toUpperCase() || 'ARCHIVO'} · ${name}`;
        document.getElementById('view-invoice-file-icon').textContent = extension === 'xls' || extension === 'xlsx' || extension === 'csv' || extension === 'ods' ? '📊' : '📄';
        if (hasInvoice) console.info('[ORDER] Factura cargada', { taskId: task.id, url: invoice.url, name, contentType });
        if (isPdf) {
          image.removeAttribute('src'); officeFrame.removeAttribute('src');
          pdfFrame.onload = () => console.info('[ORDER] Factura mostrada', { taskId: task.id, url: invoice.url, format: 'PDF' });
          pdfFrame.src = invoice.url;
        } else if (isImage) {
          pdfFrame.removeAttribute('src'); officeFrame.removeAttribute('src');
          image.onload = () => console.info('[ORDER] Factura mostrada', { taskId: task.id, url: image.currentSrc, format: 'imagen' });
          image.onerror = () => { console.error('[ORDER] Error mostrando factura', { taskId: task.id, url: invoice.url }); image.classList.add('hidden'); imageError.classList.remove('hidden'); };
          image.src = invoice.url;
        } else if (isOffice) {
          pdfFrame.removeAttribute('src'); image.removeAttribute('src');
          officeFrame.onload = () => console.info('[ORDER] Factura mostrada', { taskId: task.id, url: invoice.url, format: extension });
          officeFrame.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(invoice.url)}`;
        } else {
          pdfFrame.removeAttribute('src'); image.removeAttribute('src'); officeFrame.removeAttribute('src');
        }
      }

      showOrderInvoice(id) {
        if (this.currentUser?.role !== 'admin') return;
        const task = this.tasks.find(item => item.id === id);
        if (!task?.invoice?.url) return this.showToast('Esta orden aún no tiene factura adjunta', 'info');
        this.renderOrderInvoice(task);
        document.getElementById('view-invoice-attachment').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      async removeOrderInvoice(id) {
        if (this.currentUser?.role !== 'admin') return;
        const task = this.tasks.find(item => item.id === id);
        if (!task?.invoice) return;
        const oldInvoice = task.invoice;
        delete task.invoice;
        const saved = await this.saveTasks(true);
        if (!saved?.ok) {
          task.invoice = oldInvoice;
          SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));
          return;
        }
        if (oldInvoice.storagePath && window.firebase?.storage) {
          try { await firebase.storage().ref().child(oldInvoice.storagePath).delete(); }
          catch (error) { console.warn('[FACTURA] No se pudo borrar el archivo anterior del bucket:', error); }
        }
        this.renderTasks();
        this.renderOrderInvoice(task);
        this.showToast('Factura retirada. Puedes anexar la nueva.', 'info');
      }

      closeViewModal() {
        document.querySelectorAll('#view-evidence-gallery video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
        document.getElementById('modal-view-order').classList.add('hidden');
      }
    }

    let app;
    window.addEventListener('DOMContentLoaded', () => {
      app = new PortonProApp();
    });
