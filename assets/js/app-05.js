
    // El indicador global de index.html es el interruptor reversible del módulo.
    const CHAT_FEATURE_ENABLED = window.SPEM_CHAT_ENABLED !== false;
    window.SPEM_CHAT_ENABLED = CHAT_FEATURE_ENABLED;
    const PRESENCE_AVAILABLE_WINDOW_MS = 5 * 60 * 1000;
    const PRESENCE_DISCONNECTED_WINDOW_MS = 15 * 60 * 1000;
    const PRESENCE_ACTIVITY_WRITE_INTERVAL_MS = 90 * 1000;

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

    const AuthSessionStore = {
      key: 'portonpro_session_v4',
      activeKey: 'portonpro_active_auth_session_v1',
      getItem() {
        let raw = null;
        try { raw = sessionStorage.getItem(this.key); } catch (_) {}
        if (raw) {
          try {
            const user = JSON.parse(raw);
            const activeId = localStorage.getItem(this.activeKey);
            if (activeId && activeId !== String(user?.authSessionId || '')) {
              sessionStorage.removeItem(this.key);
              return null;
            }
            if (user?.authSessionId && !activeId) localStorage.setItem(this.activeKey, String(user.authSessionId));
            return raw;
          } catch (_) {
            try { sessionStorage.removeItem(this.key); } catch (_) {}
            return null;
          }
        }

        // Never restore the legacy shared localStorage identity: it may belong to
        // a different role in another tab. Require a fresh login, then store it
        // in this tab's sessionStorage.
        try {
          localStorage.removeItem(this.key);
        } catch (_) { return null; }
        return null;
      },
      setItem(value) {
        try {
          const user = JSON.parse(value);
          if (!user?.authSessionId) return;
          sessionStorage.setItem(this.key, value);
          try { localStorage.setItem(this.activeKey, String(user.authSessionId)); } catch (_) {}
          // The shared user object is obsolete; never leave another tab's identity here.
          try { localStorage.removeItem(this.key); } catch (_) {}
        } catch (_) {}
      },
      removeIfMatches(expected) {
        let removed = false;
        const matches = raw => {
          if (typeof expected === 'string') return raw === expected;
          try {
            const stored = JSON.parse(raw);
            if (expected?.authSessionId) return String(stored.authSessionId || '') === String(expected.authSessionId);
            return String(stored.id || '') === String(expected?.id || '')
              && String(stored.username || '').trim().toLowerCase() === String(expected?.username || '').trim().toLowerCase();
          } catch (_) { return false; }
        };
        try {
          const tabRaw = sessionStorage.getItem(this.key);
          if (tabRaw && matches(tabRaw)) { sessionStorage.removeItem(this.key); removed = true; }
        } catch (_) {}
        try {
          const legacyRaw = localStorage.getItem(this.key);
          if (legacyRaw && matches(legacyRaw)) { localStorage.removeItem(this.key); removed = true; }
        } catch (_) {}
        return removed;
      },
      clearActiveIfMatches(sessionId) {
        if (!sessionId) return;
        try { if (localStorage.getItem(this.activeKey) === String(sessionId)) localStorage.setItem(this.activeKey, `signed_out_${Date.now().toString(36)}`); } catch (_) {}
      }
    };

    const SoundEngine = {
      ctx: null,
      pendingWorkerConnectedSound: false,
      pendingMessageSounds: 0,
      async unlock() {
        try {
          const ctx = this.getCtx();
          if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') await ctx.resume();
          console.info('[ORDER] Audio habilitado por interacción', { state: ctx?.state || 'unavailable' });
          if (ctx?.state === 'running' && this.pendingMessageSounds > 0) {
            const pending = this.pendingMessageSounds;
            this.pendingMessageSounds = 0;
            for (let i = 0; i < pending; i++) this.playMessageSound();
          }
          if (ctx?.state === 'running' && this.pendingWorkerConnectedSound) {
            this.pendingWorkerConnectedSound = false;
            this.playWorkerConnectedSound();
          }
        } catch (error) {
          console.warn('[ORDER] No se pudo habilitar el audio:', error);
        }
      },
      getCtx() {
        if (!this.ctx || this.ctx.state === 'closed') {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            this.ctx = new AudioContext();
            this.ctx.addEventListener?.('statechange', () => {
              if (this.ctx?.state !== 'running' && this.ctx?.state !== 'closed') armNotificationAudioUnlock();
            });
          }
        }
        if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
          this.ctx.resume().catch(error => console.warn('[CHAT] No se pudo reactivar el audio:', error?.message || error));
        }
        return this.ctx;
      },

      async playMessageSound() {
        let ctx = null;
        let soundScheduled = false;
        try {
          ctx = this.getCtx();
          if (!ctx) {
            console.warn('[CHAT] No hay Web Audio disponible para reproducir la alerta sonora.');
            return false;
          }
          if (ctx.state !== 'running' && ctx.state !== 'closed') await ctx.resume();
          if (ctx.state !== 'running') {
            this.pendingMessageSounds = Math.min(20, this.pendingMessageSounds + 1);
            console.info('[CHAT] Alerta sonora en espera de que el navegador habilite audio.', { state: ctx.state });
            return false;
          }
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
          soundScheduled = true;
          console.info('[CHAT] Alerta sonora programada para mensaje entrante.');
          return true;
        } catch (e) {
          if (!soundScheduled && ctx && ctx.state !== 'running') this.pendingMessageSounds = Math.min(20, this.pendingMessageSounds + 1);
          console.warn('[CHAT] No se pudo reproducir la alerta sonora:', e?.message || e);
          return false;
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

    const notificationAudioUnlockEvents = ['pointerdown', 'touchstart', 'click', 'keydown'];
    let notificationAudioUnlockArmed = false;
    const disarmNotificationAudioUnlock = () => {
      if (!notificationAudioUnlockArmed) return;
      notificationAudioUnlockEvents.forEach(type => window.removeEventListener(type, unlockNotificationAudio));
      notificationAudioUnlockArmed = false;
    };
    function armNotificationAudioUnlock() {
      if (notificationAudioUnlockArmed) return;
      notificationAudioUnlockEvents.forEach(type => window.addEventListener(type, unlockNotificationAudio, { passive: true }));
      notificationAudioUnlockArmed = true;
    }
    const unlockNotificationAudio = () => {
      SoundEngine.unlock().then(() => {
        if (SoundEngine.ctx?.state === 'running') disarmNotificationAudioUnlock();
      }).catch(() => {});
    };
    armNotificationAudioUnlock();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && SoundEngine.ctx?.state !== 'running' && SoundEngine.ctx?.state !== 'closed') {
        armNotificationAudioUnlock();
        SoundEngine.unlock().then(() => { if (SoundEngine.ctx?.state === 'running') disarmNotificationAudioUnlock(); }).catch(error => console.warn('No se pudo reactivar el sonido:', error));
      }
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

    const settleBeforeTimeout = (promise, timeoutMs) => new Promise(resolve => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ timeout: true });
      }, timeoutMs);
      Promise.resolve(promise).then(value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ value });
      }, error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ error });
      });
    });

    class PortonProApp {
      constructor() {
        this.currentUser = null;
        this.sessionInvalidating = false;
        this.presenceSessionId = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
        this.ownAvailabilityStatus = 'available';
        this.presenceLastActivityAt = 0;
        this.presenceLastActivityWriteAt = 0;
        this.presenceLastActivityAttemptAt = 0;
        this.presenceExpiryTimer = null;
        this.presenceBlurTimer = null;
        this.presenceSessionConnectedAt = 0;
        this.presenceLastSyncErrorToastAt = 0;
        window.addEventListener('pagehide', () => this.releasePresenceSession());
        window.addEventListener('pageshow', () => { if (this.currentUser && document.visibilityState !== 'hidden') this.markPresenceConnected(); });
        document.addEventListener('visibilitychange', () => {
          if (!this.currentUser) return;
          if (document.visibilityState === 'hidden') {
            clearTimeout(this.presenceExpiryTimer);
            this.presenceExpiryTimer = null;
            this.releasePresenceSession();
          }
          else this.markPresenceConnected();
        });
        window.addEventListener('blur', () => {
          clearTimeout(this.presenceBlurTimer);
          this.presenceBlurTimer = setTimeout(() => {
            if (this.currentUser?.role === 'worker' && document.visibilityState !== 'hidden' && !document.hasFocus()) this.releasePresenceSession();
          }, 1500);
        });
        window.addEventListener('focus', () => {
          clearTimeout(this.presenceBlurTimer);
          if (this.currentUser && document.visibilityState !== 'hidden' && !this.presenceIsConnected) this.markPresenceConnected();
        });
        window.addEventListener('online', () => {
          if (!this.currentUser || document.visibilityState === 'hidden') return;
          const isWorker = this.getChatRole(this.currentUser.role) !== 'admin';
          const recentActivity = this.presenceLastActivityAt && Date.now() - this.presenceLastActivityAt < PRESENCE_AVAILABLE_WINDOW_MS;
          if (!isWorker || recentActivity) this.markPresenceConnected();
        });
        window.addEventListener('offline', () => { if (this.currentUser) this.releasePresenceSession(); });
        const presenceActivityEvent = () => this.recordPresenceActivity();
        ['pointerdown', 'touchstart', 'keydown', 'input', 'change', 'click', 'submit', 'wheel', 'scroll'].forEach(type => {
          document.addEventListener(type, presenceActivityEvent, { passive: type !== 'submit', capture: type === 'scroll' });
        });
        window.addEventListener('storage', event => {
          if (event.key !== AuthSessionStore.activeKey || !this.currentUser) return;
          if (event.newValue && event.newValue === this.currentUser.authSessionId) return;
          this.logout({ preserveSharedSession: true });
          this.showToast('La sesión se cambió en otra pestaña. Inicia sesión nuevamente para continuar.', 'info');
        });
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
        this.activeReportUrgent = false;
        this.presenceIsConnected = false;
        this.usersUnsubscribe = null;
        this.ordersUnsubscribe = null;
        this.presenceUnsubscribe = null;
        this.presenceListenerTarget = null;
        this.presenceRecords = {};
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
        this.ownPresenceUnsubscribe = null;
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
        this.dedicatedWorkerRetryTimers = {};

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
        this.chatReadMessageCacheKey = null;
        this.chatReadMessageCache = {};

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
        this.sessionRestoreToken = 0;
        this.manualLoginStarted = false;

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

        this.init().catch(error => {
          console.error('[INICIO] No se pudo restaurar la sesión de forma automática:', error);
          if (this.manualLoginStarted) return;
          try { this.showLoginView(); }
          catch (recoveryError) {
            console.error('[INICIO] Se muestra la pantalla de acceso de respaldo:', recoveryError);
            document.documentElement.classList.remove('auth-session-pending');
            document.getElementById('view-login')?.classList.remove('hidden');
            document.getElementById('view-dashboard')?.classList.add('hidden');
          }
          this.showToast?.('No fue posible restaurar la sesión. Inicia sesión nuevamente.', 'info');
        });
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
        if (key === 'popup' && value && 'Notification' in window && Notification.permission === 'default') {
          // El permiso se pide desde el gesto del usuario al activar las alertas.
          Promise.resolve(Notification.requestPermission()).catch(() => {});
        }
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
        if (!CHAT_FEATURE_ENABLED && (type === 'chat' || type === 'call')) return;
        if (!force && !this.prefs.popup) return;

        let stack = document.getElementById('toast-notification-stack');
        if (!stack && document.body) {
          stack = document.createElement('div');
          stack.id = 'toast-notification-stack';
          stack.setAttribute('aria-live', 'polite');
          document.body.appendChild(stack);
        }
        if (!stack) return;
        // El dock de conversaciones de escritorio usa una capa superior; los avisos deben quedar por delante.
        stack.style.setProperty('position', 'fixed', 'important');
        stack.style.setProperty('top', '12px', 'important');
        stack.style.setProperty('right', '12px', 'important');
        stack.style.setProperty('left', 'auto', 'important');
        stack.style.setProperty('display', 'flex', 'important');
        stack.style.setProperty('visibility', 'visible', 'important');
        stack.style.setProperty('opacity', '1', 'important');
        stack.style.setProperty('pointer-events', 'none', 'important');
        stack.style.setProperty('width', 'min(92vw, 384px)', 'important');
        stack.style.setProperty('max-width', 'min(92vw, 384px)', 'important');
        stack.style.setProperty('flex-direction', 'column', 'important');
        stack.style.setProperty('gap', '10px', 'important');
        stack.style.setProperty('z-index', '2147483647', 'important');
        stack.style.setProperty('isolation', 'isolate');

        const toastId = 'pop_' + Date.now() + Math.random().toString(36).substring(2, 6);
        const isMobileViewport = window.matchMedia?.('(max-width: 639px)').matches ?? window.innerWidth < 640;
        const toastLifetime = isMobileViewport ? 4500 : type === 'chat' ? 15000 : 6500;
        const card = document.createElement('div');
        card.id = toastId;
        card.dataset.notificationType = type || 'general';
        card.setAttribute('role', 'status');
        card.className = "pointer-events-auto bg-slate-900/95 text-white border border-slate-700/80 rounded-2xl shadow-2xl p-3.5 popup-slide-in backdrop-blur-md flex items-start gap-3 relative overflow-hidden transition cursor-pointer hover:border-brand-lime";
        card.style.setProperty('width', '100%');
        card.style.setProperty('box-sizing', 'border-box');

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
          <div class="absolute bottom-0 left-0 h-1 bg-brand-lime transition-all w-full" id="${toastId}_bar" style="transition-duration:${toastLifetime}ms"></div>
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
        }, toastLifetime);
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

      startCoreFirestoreListeners() {
        if (!window.db || (this.usersUnsubscribe && this.ordersUnsubscribe)) return;
        const db = window.db;
        const sessionId = this.currentUser?.authSessionId;
        const isActiveSession = () => !!this.currentUser && this.currentUser.authSessionId === sessionId;
        if (window.db) {
          this.usersUnsubscribe = db.collection('users').onSnapshot((snapshot) => {
            if (!isActiveSession()) return;
            const list = [];
            snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            const previousUsersById = new Map((this.users || []).map(user => [String(user.id), user]));
            const workerPhotosChanged = list.some(user => this.getChatRole(user.role) === 'worker' && previousUsersById.has(String(user.id)) && (previousUsersById.get(String(user.id))?.photo || '') !== (user.photo || ''));
            this.users = list;
            this.workers = list.filter(u => this.getChatRole(u.role) === 'worker');
            this.startPresenceListenerForCurrentRole();
            // A cached snapshot may be empty or carry an old sessionVersion.
            // Only a server-confirmed snapshot can invalidate an active session.
            if (this.currentUser && snapshot.metadata?.fromCache !== true && !this.validateCurrentSessionRecord(list)) {
              this.expireActiveSession('Tu sesión venció porque la cuenta o su contraseña cambió. Inicia sesión nuevamente.');
              return;
            }
            this.applySharedSeasonalTheme();
            if (this.currentUser) this.renderAdminPresence();

            this.renderTechOptionsInSelects();
            this.renderUsersTable();

            if (this.currentUser && this.currentUser.role === 'admin') {
              this.renderTechniciansMonitor();
              if (CHAT_FEATURE_ENABLED) this.renderConversationsSidebar();
              this.renderTasks();
              if (CHAT_FEATURE_ENABLED && workerPhotosChanged) {
                this.renderActiveChatHeader?.();
                this.renderChatMessages?.();
              }
              if (CHAT_FEATURE_ENABLED) {
                this.setupMultiWorkerChatListeners();
                this.listenIncomingVoiceCalls();
              }
            } else if (this.currentUser && this.getChatRole(this.currentUser.role) === 'worker') {
              const currentIdentity = new Set([this.currentUser.id, this.currentUser.username].map(value => String(value || '').trim().toLocaleLowerCase()).filter(Boolean));
              const myUpdated = list.find(u => [u.id, u.username].some(value => currentIdentity.has(String(value || '').trim().toLocaleLowerCase())))
                || list.find(u => String(u.fullName || '').trim().toLocaleLowerCase() === String(this.currentUser.fullName || '').trim().toLocaleLowerCase());
              if (myUpdated && (myUpdated.photo !== this.currentUser.photo || myUpdated.fullName !== this.currentUser.fullName)) this.applyWorkerProfileUpdate(myUpdated);
            }
          }, err => console.error("Snapshot users error:", err));

          this.ordersUnsubscribe = db.collection('ordenes').doc('todas').onSnapshot((doc) => {
            if (!isActiveSession()) return;
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
                  if (!taskId || !previousTask || previousTask === task?.status || task?.archivedAt) return;
                  if (task.status === 'REALIZADA') {
                    console.info('[ORDER] Orden pasó a REALIZADA', { taskId, previousStatus: previousTask });
                    if (this.prefs.sound) SoundEngine.playOrderCompletedSound();
                    this.showPopupNotification({
                      title: '✅ Orden realizada',
                      subtitle: `${taskId} · ${task.client || 'Cliente'}`,
                      details: 'El trabajador registró la orden como realizada.',
                      type: 'order',
                      icon: '✅',
                      onClick: () => this.viewOrderDetails(task.id)
                    });
                  } else if (task.status === 'EN_PROCESO') {
                    console.info('[ORDER] Orden pasó a EN_PROCESO', { taskId, previousStatus: previousTask });
                    if (this.prefs.sound) SoundEngine.playGeneralNotificationSound();
                    this.showPopupNotification({
                      title: '🛠️ Trabajo iniciado',
                      subtitle: `${taskId} · ${task.client || 'Cliente'}`,
                      details: 'El trabajador inició labores en esta orden.',
                      type: 'order',
                      icon: '🛠️',
                      onClick: () => this.viewOrderDetails(task.id)
                    });
                  }
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
                this.normalizeReleasedFreeTaskStates?.();
                this.updateStats();
                this.renderTasks();
                if (this.currentUser.role === 'admin') {
                  this.renderTechniciansMonitor();
                  this.renderAdminAuditLog();
                }
              }
            }
          }, e => console.error("Snapshot órdenes:", e));

          this.startPresenceListenerForCurrentRole();
        }

      }

      startPresenceListenerForCurrentRole() {
        if (!window.db || !this.currentUser) return;
        const role = String(this.currentUser.role || '').toLowerCase();
        const isAdmin = role === 'admin';
        if (!isAdmin) {
          // El trabajador no necesita ni consulta la presencia del administrador.
          this.stopPresenceRealtimeListener();
          this.presenceRecords = {};
          this.presenceSnapshotInitialized = false;
          return;
        }
        if (this.presenceUnsubscribe || this.presenceListenerTarget === 'all') return;
        const reference = window.db.collection('presencia');
        this.presenceListenerTarget = 'all';
        const sessionId = this.currentUser.authSessionId;
        const isActiveSession = () => !!this.currentUser && this.currentUser.authSessionId === sessionId;
        const applyPresenceRecords = records => {
          if (!isActiveSession()) return;
          records.forEach(doc => {
              const data = doc.data() || {};
              const presenceId = String(doc.id || '').trim().toLowerCase();
              const existingPresenceUser = this.users.find(x => String(x.username || '').trim().toLowerCase() === presenceId) || (Array.isArray(this.workers) ? this.workers.find(x => String(x.username || '').trim().toLowerCase() === presenceId) : null);
              const previousRecord = this.presenceRecords[presenceId];
              const previousStatus = previousRecord ? this.getPresenceStatus(existingPresenceUser || { username: presenceId }) : 'disconnected';
              this.presenceRecords[presenceId] = data;
              if (String(data.role || '').toLowerCase() === 'admin') this.applyAdminIdentityPresence(data);
              if (this.currentUser?.role === 'admin' && presenceId === String(this.currentUser.username || '').toLowerCase()) {
                if (Array.isArray(data.adminIdentityNames) && data.adminIdentityNames.length === 2) this.adminIdentityNames = data.adminIdentityNames.map(name => String(name || '').trim()).filter(Boolean).length === 2 ? data.adminIdentityNames.map(name => String(name || '').trim()) : this.adminIdentityNames;
                if (data.activeAdminName) this.activeAdminName = String(data.activeAdminName);
                if (data.adminIdentityPhotos && typeof data.adminIdentityPhotos === 'object') this.adminIdentityPhotos = { ...data.adminIdentityPhotos };
              }
              const u = this.users.find(x => String(x.username || '').trim().toLowerCase() === presenceId);
              if (u) {
                if (data.lastHeartbeat !== undefined) u.lastHeartbeat = data.lastHeartbeat;
                if (data.lastLogin) u.lastLogin = data.lastLogin;
              }
              const presenceUser = u || existingPresenceUser || { username: presenceId, ...data };
              const isWorkerPresence = this.getChatRole(data.role || presenceUser.role) === 'worker';
              if (isWorkerPresence && this.getChatRole() === 'worker' && presenceId === String(this.currentUser?.username || '').trim().toLowerCase() && data.photo !== this.currentUser.photo) {
                this.applyWorkerProfileUpdate({ ...data, username: data.username || this.currentUser.username });
              }
              const becameAvailable = this.getPresenceStatus(presenceUser) === 'available';
              if (this.presenceSnapshotInitialized && this.currentUser?.role === 'admin' && isWorkerPresence && previousStatus !== 'available' && becameAvailable) {
                console.info('[PRESENCE] Transición de trabajador a disponible', { username: presenceId });
                if (this.prefs?.sound !== false) SoundEngine.playWorkerConnectedSound();
                this.showPopupNotification({
                  title: '🟢 Trabajador conectado',
                  subtitle: presenceUser.fullName || presenceUser.username || 'Trabajador',
                  details: 'El trabajador aparece disponible en el panel.',
                  type: 'presence',
                  icon: '🟢'
                });
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
        };
        // Only administrators subscribe to the team presence feed.
        this.presenceUnsubscribe = reference.onSnapshot(snapshot => {
          if (!isActiveSession()) return;
          const records = Array.isArray(snapshot.docs)
            ? snapshot.docs
            : (snapshot.exists ? [snapshot] : []);
          applyPresenceRecords(records);
        }, error => console.error('[PRESENCE] Error de escucha:', error));
      }

      stopCoreFirestoreListeners() {
        ['usersUnsubscribe', 'ordersUnsubscribe', 'presenceUnsubscribe'].forEach(key => {
          try { this[key]?.(); } catch (error) { console.warn('[FIRESTORE] No se pudo cerrar un listener:', key, error); }
          this[key] = null;
        });
        clearTimeout(this.presenceExpiryTimer);
        this.presenceExpiryTimer = null;
        this.presenceListenerTarget = null;
        this.presenceSnapshotInitialized = false;
        this.presenceRecords = {};
      }

      stopPresenceRealtimeListener() {
        // Order views need live presence. Other modules do not, so close either
        // the administrator's team feed or a worker's single-admin feed there.
        if (!this.presenceUnsubscribe) return;
        try { this.presenceUnsubscribe?.(); } catch (error) { console.warn('[PRESENCE] No se pudo cerrar la escucha:', error); }
        this.presenceUnsubscribe = null;
        clearTimeout(this.presenceExpiryTimer);
        this.presenceExpiryTimer = null;
        this.presenceListenerTarget = null;
        this.presenceSnapshotInitialized = false;
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



        const savedSession = AuthSessionStore.getItem();
        if (savedSession) {
          try {
            const user = JSON.parse(savedSession);
            const restoreToken = ++this.sessionRestoreToken;
            if (!user?.id || !Number.isSafeInteger(Number(user.sessionVersion)) || Number(user.sessionVersion) < 1) throw new Error('INVALID_SAVED_SESSION');
            // Restore the workspace immediately from the saved identity. A
            // slow/offline Firestore request must not freeze the app or erase
            // a valid local session. Revoke it only after the server confirms
            // that the account/version is no longer valid.
            await this.loginSuccess(user, false);
            this.validateStoredSession(user).then(valid => {
              if (restoreToken !== this.sessionRestoreToken || String(this.currentUser?.id) !== String(user.id)) return;
              if (!valid) this.expireActiveSession('Tu sesión venció porque la cuenta o su contraseña cambió. Inicia sesión nuevamente.');
            }).catch(error => {
              console.warn('[SESSION] No fue posible validar la sesión con el servidor; se conservará mientras se restablece la conexión.', error?.message || error);
            });
          } catch(e) {
            this.clearRememberedCredentials();
            this.clearStoredSessionIfMatches(savedSession);
            this.showLoginView();
          }
        } else {
          this.showLoginView();
        }

        if (window.lucide) lucide.createIcons();
      }

      clearRememberedCredentials() {
        SafeStorage.removeItem('portonpro_remembered');
        const username = document.getElementById('login-username');
        const password = document.getElementById('login-password');
        const remember = document.getElementById('login-remember');
        if (username) username.value = '';
        if (password) password.value = '';
        if (remember) remember.checked = false;
      }

      clearStoredSessionIfMatches(expected) {
        return AuthSessionStore.removeIfMatches(expected);
      }

      async validateStoredSession(user) {
        if (!user?.id || !window.db) return false;
        const snapshot = await window.db.collection('users').doc(String(user.id)).get({ source: 'server' });
        if (!snapshot.exists) return false;
        const record = snapshot.data() || {};
        const storedVersion = Number(user.sessionVersion);
        const remoteVersion = Number(record.sessionVersion);
        if (!Number.isSafeInteger(storedVersion) || storedVersion < 1 || !Number.isSafeInteger(remoteVersion) || remoteVersion < 1) return false;
        return record.active !== false && storedVersion === remoteVersion;
      }

      validateCurrentSessionRecord(users = this.users) {
        const current = this.currentUser;
        if (!current) return true;
        const record = (users || []).find(user => String(user.id || '') === String(current.id || ''))
          || (users || []).find(user => String(user.username || '').trim().toLowerCase() === String(current.username || '').trim().toLowerCase());
        if (!record || record.active === false) return false;
        const remoteVersion = Number(record.sessionVersion);
        const currentVersion = Number(current.sessionVersion);
        return Number.isSafeInteger(remoteVersion) && remoteVersion >= 1 && Number.isSafeInteger(currentVersion) && currentVersion >= 1 && remoteVersion === currentVersion;
      }

      expireActiveSession(message = 'Tu sesión venció. Inicia sesión nuevamente.') {
        if (this.sessionInvalidating || !this.currentUser) return;
        this.sessionInvalidating = true;
        this.clearRememberedCredentials();
        this.logout();
        this.showToast(message, 'info');
        this.sessionInvalidating = false;
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
              if (reportError) this.showToast('No se pudo guardar la información. Revisa tu conexión e inténtalo de nuevo.', 'error');
              return { ok: false, error };
            });
        } catch (error) {
          console.error('[ORDEN] No se pudo iniciar la escritura de órdenes:', error);
          if (reportError) this.showToast('No se pudo guardar la información. Inténtalo nuevamente.', 'error');
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
        this.stopCoreFirestoreListeners();
        this.stopClientDirectorySync?.();
        ['quotesUnsubscribe', 'technicalReportsUnsubscribe'].forEach(key => {
          try { this[key]?.(); } catch (error) { console.warn('[FIRESTORE] No se pudo cerrar un listener:', key, error); }
          this[key] = null;
        });
        this.stopPaymentInternalNotes?.();
        document.documentElement.classList.remove('auth-session-pending');
        document.body.classList.add('seasonal-login-visible');
        document.getElementById('view-login').classList.remove('hidden');
        const loginButton = document.getElementById('btn-submit-login');
        const loginButtonText = document.getElementById('btn-submit-text');
        if (loginButton) loginButton.disabled = false;
        if (loginButtonText) loginButtonText.textContent = 'Iniciar Sesión';
        document.getElementById('login-error-alert')?.classList.add('hidden');
        window.resumeLoginBrandVideo?.();
        document.getElementById('view-dashboard').classList.add('hidden');
        this.updateSeasonalEffects(this.seasonalTheme);
        document.getElementById('chat-floating-button-container').classList.add('hidden');
        document.getElementById('chat-window-modal').classList.add('hidden');
        document.getElementById('chat-desktop-windows')?.classList.add('hidden');
        if (this.ownPresenceUnsubscribe) { this.ownPresenceUnsubscribe(); this.ownPresenceUnsubscribe = null; }
        if (this.chatUnsubscribe) { this.chatUnsubscribe(); this.chatUnsubscribe = null; }
        if (this.chatThreadUnsubscribe) { this.chatThreadUnsubscribe(); this.chatThreadUnsubscribe = null; }
        if (this.chatThreadsUnsubscribe) { this.chatThreadsUnsubscribe(); this.chatThreadsUnsubscribe = null; }
        if (this.callUnsubscribe) { this.callUnsubscribe(); this.callUnsubscribe = null; }
        this.closeAdminGpsModal();
        this.clearDedicatedWorkerChatListeners();
        this.stopGpsSharing(true);
        this.endVoiceCall();
      }

      handleLoginSafely(e) {
        const recoverFromLoginError = error => {
          console.error('[LOGIN] Error no controlado durante el acceso:', error);
          const loginView = document.getElementById('view-login');
          const dashboard = document.getElementById('view-dashboard');
          if (dashboard && !dashboard.classList.contains('hidden')) return;

          this.currentUser = null;
          try { this.showLoginView(); }
          catch (recoveryError) { console.error('[LOGIN] No se pudo restaurar el formulario:', recoveryError); }

          const button = document.getElementById('btn-submit-login');
          const buttonText = document.getElementById('btn-submit-text');
          if (button) button.disabled = false;
          if (buttonText) buttonText.textContent = 'Iniciar Sesión';
          const alert = document.getElementById('login-error-alert');
          const message = document.getElementById('login-error-text');
          if (alert && message && alert.classList.contains('hidden')) {
            message.textContent = 'No fue posible completar el inicio de sesión. Inténtalo nuevamente.';
            alert.classList.remove('hidden');
          }
          loginView?.classList.remove('hidden');
        };

        try {
          return Promise.resolve(this.handleLogin(e)).catch(recoverFromLoginError);
        } catch (error) {
          e?.preventDefault?.();
          recoverFromLoginError(error);
          return false;
        }
      }

      async handleLogin(e) {
        e.preventDefault();
        this.manualLoginStarted = true;
        this.sessionRestoreToken += 1;
        const rawUser = document.getElementById('login-username').value;
        const rawPass = document.getElementById('login-password').value;
        const rememberChecked = document.getElementById('login-remember').checked;
        const errorAlert = document.getElementById('login-error-alert');
        const errorText = document.getElementById('login-error-text');
        const btnSubmit = document.getElementById('btn-submit-login');
        const btnText = document.getElementById('btn-submit-text');
        const resetLoginButton = () => {
          if (btnSubmit) btnSubmit.disabled = false;
          if (btnText) btnText.textContent = 'Iniciar Sesión';
        };
        errorAlert.classList.add('hidden');

        const userVal = String(rawUser || '').trim().toLowerCase();
        const passVal = String(rawPass || '').trim();

        if (!userVal || !passVal) {
          errorText.textContent = "Por favor ingresa usuario y contraseña.";
          errorAlert.classList.remove('hidden');
          return;
        }

        if (btnSubmit) {
          btnSubmit.disabled = true;
          if (btnText) btnText.textContent = "Verificando credenciales...";
        }

        if (!window.db) {
          resetLoginButton();
          errorText.textContent = 'No fue posible conectar con el servicio de acceso. Verifica tu conexión e inténtalo nuevamente.';
          errorAlert.classList.remove('hidden');
          return;
        }

        let authenticatedUser = null;

        if (window.db) {
          try {
            // Never report stale/empty offline cache as an incorrect password.
            const lookup = await settleBeforeTimeout(db.collection('users').get({ source: 'server' }), 15000);
            if (lookup.timeout) {
              const timeoutError = new Error('LOGIN_LOOKUP_TIMEOUT');
              timeoutError.loginTimeout = true;
              throw timeoutError;
            }
            if (lookup.error) throw lookup.error;
            const snapshot = lookup.value;
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
                  role: ['admin', 'administrator', 'administrador'].includes(String(uData.role || '').toLowerCase().trim()) ? 'admin' : 'worker',
                  phone: uData.phone || '',
                  photo: uData.photo || '',
                  sessionVersion: Math.max(1, Number(uData.sessionVersion) || 1),
                  _needsSessionVersionMigration: !Number.isSafeInteger(Number(uData.sessionVersion)) || Number(uData.sessionVersion) < 1,
                  active: isActive
                };
              }
            });
          } catch (err) {
            console.error("Error al consultar Firestore:", err);
            errorText.textContent = err?.loginTimeout
              ? 'La conexión está tardando demasiado. Verifica internet e inténtalo nuevamente.'
              : 'No fue posible iniciar sesión en este momento. Inténtalo nuevamente.';
            errorAlert.classList.remove('hidden');
            resetLoginButton();
            return;
          }
        }

        if (authenticatedUser) {
          if (authenticatedUser.active === false) {
            this.clearRememberedCredentials();
            resetLoginButton();
            errorText.textContent = 'Esta cuenta está desactivada. Consulta al Administrador.';
            errorAlert.classList.remove('hidden');
            return;
          }

          if (authenticatedUser._needsSessionVersionMigration) {
            if (btnText) btnText.textContent = 'Validando cuenta...';
            try {
              const migration = await settleBeforeTimeout(db.collection('users').doc(authenticatedUser.id).update({ sessionVersion: 1 }), 15000);
              if (migration.timeout) throw new Error('SESSION_VERSION_MIGRATION_TIMEOUT');
              if (migration.error) throw migration.error;
              authenticatedUser.sessionVersion = 1;
              delete authenticatedUser._needsSessionVersionMigration;
            } catch (migrationError) {
              console.error('[LOGIN] No se pudo validar la versión de sesión:', migrationError);
              resetLoginButton();
              errorText.textContent = 'No se pudieron validar los datos de la cuenta. Verifica la conexión e inténtalo nuevamente.';
              errorAlert.classList.remove('hidden');
              return;
            }
          }

          errorAlert.classList.add('hidden');
          if (rememberChecked) SafeStorage.setItem('portonpro_remembered', JSON.stringify({ u: userVal, p: passVal }));
          else SafeStorage.removeItem('portonpro_remembered');
          try {
            await this.loginSuccess(authenticatedUser, true);
          } catch (loginError) {
            console.error('[LOGIN] Error al preparar el panel después de validar la cuenta:', loginError);
            this.currentUser = null;
            this.clearStoredSessionIfMatches(authenticatedUser);
            try { this.showLoginView(); }
            catch (recoveryError) { console.error('[LOGIN] No se pudo restaurar la pantalla de acceso:', recoveryError); }
            resetLoginButton();
            errorText.textContent = 'La cuenta fue validada, pero no se pudo cargar el panel. Inténtalo nuevamente.';
            errorAlert.classList.remove('hidden');
            return;
          }
          return;
        }

        resetLoginButton();
        this.clearRememberedCredentials();
        errorText.textContent = 'Usuario o contraseña incorrectos.';
        errorAlert.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
      }

      async loginSuccess(user, notify = true) {
        user.role = this.getChatRole(user.role);
        user.sessionVersion = Math.max(1, Number(user.sessionVersion) || 1);
        if (!user.authSessionId) user.authSessionId = `auth_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
        // La conexión anterior no puede convertir al nuevo usuario en una
        // presencia local ya abierta ni heredar su límite de sincronización.
        this.presenceIsConnected = false;
        this.presenceSessionConnectedAt = 0;
        this.presenceLastActivityAt = 0;
        this.presenceLastActivityWriteAt = 0;
        this.presenceLastActivityAttemptAt = 0;
        this.presenceLastSyncErrorToastAt = 0;
        this.currentUser = user;
        this.startCoreFirestoreListeners();
        const loginAuthSessionId = user.authSessionId;
        this.ownAvailabilityStatus = 'available';
        // Mostrar el espacio de trabajo sin esperar a que Firestore responda.
        // Una conexión lenta no debe dejar el indicador de carga bloqueado.
        if (window.db) {
          const presence = window.db.collection('presencia');
          const applyIdentity = record => {
            if (record && this.currentUser?.authSessionId === loginAuthSessionId) this.applyAdminIdentityPresence(record);
          };
          if (String(user.role || '').toLowerCase() === 'admin') {
            presence.doc(String(user.username || '').toLowerCase()).get()
              .then(snap => { if (snap.exists) applyIdentity(snap.data() || {}); })
              .catch(error => console.warn('[IDENTIDAD] Usando identidad local hasta sincronizar:', error?.message || error));
          }
        }
        if (String(user.role || '').toLowerCase() === 'admin' && !this.activeAdminName) this.activeAdminName = String(user.activeAdminName || '');
        user.activeAdminName = this.activeAdminName || user.activeAdminName || '';

        // Registrar una sola conexión por inicio de sesión. La presencia se
        // cierra en logout/pagehide; no requiere escrituras periódicas.
        if (String(user.role || '').toLowerCase() === 'admin') {
          this.ownAvailabilityStatus = 'available';
        }
        this.applySharedSeasonalTheme();
        AuthSessionStore.setItem(JSON.stringify(user));

        window.stopLoginBrandVideo?.();
        document.getElementById('view-login').classList.add('hidden');
        document.body.classList.remove('seasonal-login-visible');
        document.getElementById('view-dashboard').classList.remove('hidden');
        this.updateSeasonalEffects(this.seasonalTheme);
        document.documentElement.classList.remove('auth-session-pending');
        this.applyDarkMode();
        if (CHAT_FEATURE_ENABLED) {
          document.getElementById('chat-floating-button-container')?.classList.remove('hidden');
          document.getElementById('chat-desktop-windows')?.classList.remove('hidden');
        } else {
          this.disableChatRuntime();
        }

        this.markPresenceConnected();

        this.setupDashboardUI();
        this.renderTechOptionsInSelects();
        this.updateStats();
        this.renderTasks();

        if (this.currentUser.role === 'admin') {
          this.renderTechniciansMonitor();
          this.renderAdminAuditLog();
        }

        if (CHAT_FEATURE_ENABLED) {
          this.initChatModule();
          this.listenIncomingVoiceCalls();
        }

      }

      logout(options = {}) {
        const current = this.currentUser;
        const preserveSharedSession = options?.preserveSharedSession === true;
        this.releasePresenceSession();

        this.currentUser = null;
        this.sessionRestoreToken += 1;
        this.applyDarkMode();
        if (current) {
          this.clearStoredSessionIfMatches(current);
          if (!preserveSharedSession) AuthSessionStore.clearActiveIfMatches(current.authSessionId);
        }
        this.showLoginView();
      }

      writePresenceActivity(now, connectionTransition = false) {
        if (!this.currentUser || !window.db || document.visibilityState === 'hidden') return Promise.resolve(false);
        const activeAuthSessionId = this.currentUser.authSessionId;
        const username = String(this.currentUser.username || '').trim().toLowerCase();
        if (!username) return Promise.resolve(false);
        const currentRecord = this.presenceRecords?.[username] || {};
        const role = String(this.currentUser.role || '').toLowerCase() === 'admin' ? 'admin' : 'worker';
        const sessionStatus = role === 'worker' ? 'available' : (this.ownAvailabilityStatus || 'available');
        if (!this.presenceIsConnected || !this.presenceSessionConnectedAt) this.presenceSessionConnectedAt = now;
        const connectedAt = this.presenceSessionConnectedAt;
        const session = { connected: true, connectedAt, lastHeartbeat: now, lastActivityAt: now, availabilityStatus: sessionStatus, visibilityState: 'visible' };
        const presenceData = {
          username: this.currentUser.username,
          fullName: this.getCurrentDisplayName(),
          lastActivityAt: now,
          lastHeartbeat: now,
          ...(role === 'admin' ? { photo: this.currentUser.photo || '' } : {}),
          role,
          availabilityStatus: sessionStatus,
          connected: true,
          connectedAt,
          sessions: { [this.presenceSessionId]: session },
          ...(connectionTransition ? { lastLogin: `${this.formatTime(new Date(now))} (En línea)` } : {})
        };
        this.presenceRecords = this.presenceRecords || {};
        this.presenceRecords[username] = { ...currentRecord, ...presenceData };
        this.presenceIsConnected = true;
        this.presenceLastActivityAt = now;
        this.presenceLastActivityAttemptAt = now;
        const save = window.db.collection('presencia').doc(username).set(presenceData, { mergeFields: Object.keys(presenceData) }).then(() => {
          if (this.currentUser?.authSessionId === activeAuthSessionId) this.presenceLastActivityWriteAt = now;
          if (connectionTransition) console.info('[PRESENCE] Actividad inicial sincronizada', { username, role, lastActivityAt: now });
          return true;
        }).catch(error => {
          const errorCode = String(error?.code || 'sin código');
          console.warn('[PRESENCE] No se pudo sincronizar la actividad:', { code: errorCode, message: error?.message || String(error) });
          if (this.currentUser?.authSessionId === activeAuthSessionId) {
            this.presenceIsConnected = false;
            const latestRecord = this.presenceRecords?.[username] || {};
            this.presenceRecords[username] = { ...latestRecord, sessions: {}, connected: false, availabilityStatus: 'disconnected' };
            if (this.currentUser?.role === 'admin') this.renderTechniciansMonitor();
            if (connectionTransition && now - this.presenceLastSyncErrorToastAt > 60 * 1000) {
              this.presenceLastSyncErrorToastAt = now;
              this.showToast(`No se pudo sincronizar la presencia (${errorCode}). Revisa la conexión o la cuota de Firestore.`, 'error');
            }
          }
          return false;
        });
        if (this.currentUser.role === 'admin') this.renderTechniciansMonitor();
        return save;
      }

      markPresenceConnected() {
        if (!this.currentUser || document.visibilityState === 'hidden') return;
        const now = Date.now();
        if (this.presenceIsConnected && this.presenceLastActivityAt && now - this.presenceLastActivityAt < 1500) return;
        return this.writePresenceActivity(now, !this.presenceIsConnected);
      }

      recordPresenceActivity() {
        if (!this.currentUser || this.getChatRole(this.currentUser.role) !== 'worker' || document.visibilityState === 'hidden') return;
        const now = Date.now();
        const username = String(this.currentUser.username || '').trim().toLowerCase();
        if (!username) return;
        const previousStatus = this.getPresenceStatus(this.currentUser);
        const currentRecord = this.presenceRecords?.[username] || {};
        const previousSession = currentRecord.sessions?.[this.presenceSessionId] || {};
        const connectedAt = this.presenceSessionConnectedAt || previousSession.connectedAt || now;
        this.presenceSessionConnectedAt = connectedAt;
        const session = { ...previousSession, connected: true, connectedAt, lastHeartbeat: now, lastActivityAt: now, availabilityStatus: 'available', visibilityState: 'visible' };
        this.presenceRecords[username] = { ...currentRecord, username: this.currentUser.username, role: 'worker', lastActivityAt: now, lastHeartbeat: now, connected: true, availabilityStatus: 'available', sessions: { [this.presenceSessionId]: session } };
        this.presenceLastActivityAt = now;
        const timeSinceLastAttempt = now - (this.presenceLastActivityAttemptAt || this.presenceLastActivityWriteAt || 0);
        const needsWrite = this.presenceIsConnected
          ? previousStatus !== 'available' || timeSinceLastAttempt >= PRESENCE_ACTIVITY_WRITE_INTERVAL_MS
          : timeSinceLastAttempt >= 20 * 1000;
        if (needsWrite) this.writePresenceActivity(now, !this.presenceIsConnected);
      }

      getPresenceActivityTimestamp(user) {
        if (!user) return 0;
        const username = String(user.username || user.id || '').trim().toLowerCase();
        const record = this.presenceRecords?.[username]
          || Object.values(this.presenceRecords || {}).find(item => String(item?.username || '').trim().toLowerCase() === username)
          || {};
        const toMillis = value => {
          if (typeof value?.toMillis === 'function') return value.toMillis();
          if (value instanceof Date) return value.getTime();
          if (typeof value === 'number' && Number.isFinite(value)) return value;
          if (typeof value === 'string' && value.trim()) {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric > 0) return numeric;
            const parsed = Date.parse(value);
            return Number.isFinite(parsed) ? parsed : 0;
          }
          return 0;
        };
        const sessionTimes = Object.values(record.sessions || {})
          .filter(session => session?.connected !== false && session?.visibilityState !== 'hidden')
          .map(session => toMillis(session?.lastActivityAt))
          .filter(timestamp => timestamp > 0);
        return Math.max(toMillis(record.lastActivityAt), toMillis(user.lastActivityAt), ...sessionTimes, 0);
      }

      releasePresenceSession() {
        if (!this.currentUser || !window.db || !this.presenceIsConnected) return Promise.resolve(false);
        const username = String(this.currentUser.username || '').trim().toLowerCase();
        const record = this.presenceRecords?.[username] || {};
        const now = Date.now();
        const payload = {
          sessions: {},
          lastHeartbeat: now,
          connected: false,
          availabilityStatus: 'disconnected',
          lastLogin: `${this.formatTime(new Date(now))} (Desconectado)`
        };
        this.presenceIsConnected = false;
        this.presenceSessionConnectedAt = 0;
        this.presenceRecords[username] = {
          ...record,
          sessions: {},
          lastHeartbeat: now,
          connected: false,
          availabilityStatus: 'disconnected',
          lastLogin: payload.lastLogin
        };
        return db.collection('presencia').doc(username).update(payload).then(() => true).catch(error => {
          console.warn('[PRESENCE] No se pudo registrar la desconexión:', error?.message || error);
          return false;
        });
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
        this.installOrderFilterDismissHandlers();

        const btnResetPending = document.getElementById('btn-reset-pending');
        const btnResetDone = document.getElementById('btn-reset-done');
        const btnResetFailed = document.getElementById('btn-reset-failed');
        const btnAssignOrderFilter = document.getElementById('btn-assign-order-filter');
        const ordersToolbar = document.getElementById('orders-toolbar');

        if (isAdmin) {
          ordersToolbar?.classList.remove('hidden');
          btnAssignOrderFilter?.classList.remove('hidden');
          monitorSection.classList.remove('hidden');
          filterTech.classList.remove('hidden');
          filterTechControl?.classList.remove('hidden');
          filterTech.disabled = false;
          auditLogSection.classList.remove('hidden');

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

          if (btnResetPending) btnResetPending.classList.add('hidden');
          if (btnResetDone) btnResetDone.classList.add('hidden');
          if (btnResetFailed) btnResetFailed.classList.add('hidden');
        }

        this.renderOrderFilterMenus();
        const banner = document.getElementById('dashboard-banner');
        if (banner) { banner.replaceChildren(); banner.classList.add('hidden'); banner.setAttribute('aria-hidden', 'true'); }

        this.renderAdminPresence();
        if (window.lucide) lucide.createIcons();
      }

      getCurrentDisplayPhoto(user = this.currentUser) {
        if (!user) return '';
        if (String(user.role || '').toLowerCase() === 'admin') return this.adminIdentityPhotos[this.activeAdminName] || user.photo || '';
        return user.photo || '';
      }

      subscribeOwnPresenceProfile() {
        if (this.ownPresenceUnsubscribe) { this.ownPresenceUnsubscribe(); this.ownPresenceUnsubscribe = null; }
        if (!window.db || this.getChatRole() !== 'worker' || !this.currentUser?.username) return;
        const username = String(this.currentUser.username).trim().toLowerCase();
        this.ownPresenceUnsubscribe = db.collection('presencia').doc(username).onSnapshot(snapshot => {
          if (!snapshot.exists) return;
          const record = snapshot.data() || {};
          if (record.photo !== undefined && record.photo !== this.currentUser?.photo) this.applyWorkerProfileUpdate({ ...record, username: record.username || this.currentUser.username });
        }, error => console.warn('[PERFIL] No se pudo sincronizar el perfil del trabajador:', error?.message || error));
      }

      applyWorkerProfileUpdate(profile = {}) {
        if (this.getChatRole() !== 'worker' || !this.currentUser) return;
        const username = String(profile.username || this.currentUser.username || '').trim().toLowerCase();
        const photo = profile.photo === undefined ? (this.currentUser.photo || '') : String(profile.photo || '');
        const fullName = String(profile.fullName || this.currentUser.fullName || this.currentUser.username || '');
        this.currentUser.username = profile.username || this.currentUser.username;
        this.currentUser.fullName = fullName;
        this.currentUser.photo = photo;
        if (profile.id) this.currentUser.id = profile.id;
        AuthSessionStore.setItem(JSON.stringify(this.currentUser));
        [this.users, this.workers].forEach(list => {
          if (!Array.isArray(list)) return;
          list.forEach(user => {
            if ([user.id, user.username].some(value => String(value || '').trim().toLowerCase() === username)) {
              user.photo = photo;
              user.fullName = fullName;
            }
          });
        });
        this.setupDashboardUI();
        this.renderMySettingsPhotoPreview?.();
        this.renderTasks();
        this.renderChatMessages?.();
        this.renderActiveChatHeader?.();
        this.renderConversationsSidebar?.();
        this.renderMessengerWindows?.();
      }

      applyAdminIdentityPresence(record = {}) {
        if (Array.isArray(record.adminIdentityNames) && record.adminIdentityNames.length === 2) { const names = record.adminIdentityNames.map(name => String(name || '').trim()); if (names.every(Boolean)) this.adminIdentityNames = names; }
        if (record.adminIdentityPhotos && typeof record.adminIdentityPhotos === 'object') this.adminIdentityPhotos = { ...record.adminIdentityPhotos };
        if (record.activeAdminName) this.activeAdminName = String(record.activeAdminName);
        if (this.currentUser?.role === 'admin' && record.activeAdminName) { this.currentUser.activeAdminName = this.activeAdminName; AuthSessionStore.setItem(JSON.stringify(this.currentUser)); }
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
      getTaskTechnician(task) {
        const users = Array.isArray(this.users) ? this.users : [];
        const workerId = String(task?.assignedWorkerId || '').trim();
        if (workerId) {
          const byId = users.find(user => String(user.id || '').trim() === workerId);
          if (byId) return byId;
        }
        const assignedName = String(task?.assignedTo || '').trim().toLocaleLowerCase();
        if (!assignedName) return null;
        return users.find(user => [user.fullName, user.username].some(value => String(value || '').trim().toLocaleLowerCase() === assignedName)) || null;
      }
      getCurrentDisplayName(user = this.currentUser) {
        if (!user) return '';
        if (String(user.role || '').toLowerCase() === 'admin') return this.activeAdminName || user.activeAdminName || user.fullName || user.username || 'Administrador';
        return user.fullName || user.username || '';
      }

      getChatRole(role = this.currentUser?.role) {
        const normalized = String(role || '').trim().toLowerCase();
        return normalized === 'admin' || normalized === 'administrator' || normalized === 'administrador' ? 'admin' : 'worker';
      }

      getChatThreadId(value) {
        const role = this.getChatRole();
        const source = value ?? (role === 'admin' ? this.activeChatWorker : this.currentUser);
        const identities = item => typeof item === 'object' && item
          ? [item.id, item.username, item.fullName, item.name]
          : [item];
        const keys = new Set(identities(source).map(value => String(value || '').trim().toLocaleLowerCase()).filter(Boolean));
        if (!keys.size) return '';
        const roster = [...(Array.isArray(this.workers) ? this.workers : []), ...(Array.isArray(this.users) ? this.users : [])];
        const person = roster.find(user => [user.id, user.username, user.fullName].some(value => keys.has(String(value || '').trim().toLocaleLowerCase())));
        const canonical = String(person?.fullName || person?.username || '').trim();
        if (canonical) return canonical;
        const fallback = typeof source === 'object' && source ? (source.fullName || source.username || source.name || source.id) : source;
        return String(fallback || '').trim();
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
        AuthSessionStore.setItem(JSON.stringify(this.currentUser));
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
        const username = String(user.username || user.id || '').trim().toLowerCase();
        const record = this.presenceRecords[username]
          || Object.values(this.presenceRecords || {}).find(item => String(item?.username || '').trim().toLowerCase() === username)
          || {};
        const savedStatus = String(record.availabilityStatus || '').trim().toLowerCase();
        const isAdminUser = this.getChatRole(user.role || record.role) === 'admin';
        if (isAdminUser) {
          const toMillis = value => typeof value?.toMillis === 'function' ? value.toMillis() : Number(value || 0);
          const heartbeat = toMillis(record.lastHeartbeat ?? user.lastHeartbeat ?? 0);
          if (Object.prototype.hasOwnProperty.call(record, 'sessions')) {
            const liveSessions = Object.values(record.sessions || {}).filter(session => {
              if (session?.connected === true) return true;
              if (session?.connected === false) return false;
              const sessionHeartbeat = toMillis(session?.lastHeartbeat);
              return sessionHeartbeat > 0 && Date.now() - sessionHeartbeat >= 0 && Date.now() - sessionHeartbeat < 45000;
            });
            if (!liveSessions.length) return 'disconnected';
            if (liveSessions.some(session => String(session.availabilityStatus || '').toLowerCase() === 'available')) return 'available';
            if (liveSessions.some(session => String(session.availabilityStatus || '').toLowerCase() === 'absent')) return 'absent';
            return 'disconnected';
          }
          if (record.connected === true) {
            if (savedStatus === 'absent') return 'absent';
            return savedStatus === 'disconnected' ? 'disconnected' : 'available';
          }
          const heartbeatFresh = heartbeat > 0 && Date.now() - heartbeat >= 0 && Date.now() - heartbeat < 45000;
          if (heartbeatFresh && savedStatus === 'absent') return 'absent';
          if (heartbeatFresh) return 'available';
          return 'disconnected';
        }

        const isCurrentWorker = this.getChatRole(this.currentUser?.role) === 'worker'
          && String(this.currentUser?.username || '').trim().toLowerCase() === username;
        if (isCurrentWorker && this.presenceIsConnected && document.visibilityState !== 'hidden' && this.presenceLastActivityAt) {
          const localAge = Math.max(0, Date.now() - this.presenceLastActivityAt);
          if (localAge < PRESENCE_AVAILABLE_WINDOW_MS) return 'available';
          if (localAge < PRESENCE_DISCONNECTED_WINDOW_MS) return 'inactive';
          return 'disconnected';
        }

        // En trabajadores, `connected` solo confirma que hubo una sesión; la
        // actividad reciente y la visibilidad determinan el estado actual.
        if (record.connected === false || savedStatus === 'disconnected') return 'disconnected';
        const sessions = Object.values(record.sessions || {});
        if (Object.prototype.hasOwnProperty.call(record, 'sessions') && !sessions.length) return 'disconnected';
        const eligibleSessions = sessions.filter(session => session?.connected !== false && session?.visibilityState !== 'hidden');
        if (Object.prototype.hasOwnProperty.call(record, 'sessions') && !eligibleSessions.length) return 'disconnected';
        const lastActivity = this.getPresenceActivityTimestamp(user);
        if (!lastActivity) return 'disconnected';
        const age = Math.max(0, Date.now() - lastActivity);
        if (age < PRESENCE_AVAILABLE_WINDOW_MS) return 'available';
        if (age < PRESENCE_DISCONNECTED_WINDOW_MS) return 'inactive';
        return 'disconnected';
      }

      getPresenceLabel(status) {
        return ({ available: 'Disponible', inactive: 'Inactivo', absent: 'Ausente', disconnected: 'Desconectado' })[status] || 'Desconectado';
      }

      schedulePresenceExpiryRender() {
        clearTimeout(this.presenceExpiryTimer);
        this.presenceExpiryTimer = null;
        if (String(this.currentUser?.role || '').toLowerCase() !== 'admin' || document.visibilityState === 'hidden') return;
        const workers = [
          ...(Array.isArray(this.workers) ? this.workers : []),
          ...(Array.isArray(this.users) ? this.users.filter(user => ['worker', 'trabajador', 'tecnico', 'técnico'].includes(String(user.role || '').toLowerCase().trim())) : [])
        ];
        const uniqueWorkers = new Map(workers.map(user => [String(user.username || user.id || user.fullName || '').trim().toLowerCase(), user]));
        const now = Date.now();
        let nextExpiry = Infinity;
        for (const worker of uniqueWorkers.values()) {
          const status = this.getPresenceStatus(worker);
          if (status === 'disconnected') continue;
          const lastActivity = this.getPresenceActivityTimestamp(worker);
          if (!lastActivity) continue;
          const boundaries = [lastActivity + PRESENCE_AVAILABLE_WINDOW_MS, lastActivity + PRESENCE_DISCONNECTED_WINDOW_MS];
          for (const boundary of boundaries) if (boundary > now && boundary < nextExpiry) nextExpiry = boundary;
        }
        if (!Number.isFinite(nextExpiry)) return;
        this.presenceExpiryTimer = setTimeout(() => {
          this.presenceExpiryTimer = null;
          if (this.currentUser?.role !== 'admin' || document.visibilityState === 'hidden') return;
          this.renderTechniciansMonitor();
        }, Math.max(50, nextExpiry - now + 50));
      }

      getAdminPresenceInfo() {
        const admin = this.users.find(user => String(user.role || '').toLowerCase() === 'admin');
        const presenceAdminEntry = Object.entries(this.presenceRecords).find(([, record]) => String(record?.role || '').toLowerCase() === 'admin');
        const isAdminSession = String(this.currentUser?.role || '').toLowerCase() === 'admin';
        const adminUser = isAdminSession ? this.currentUser : (admin || null);
        const username = String(adminUser?.username || presenceAdminEntry?.[0] || '').toLowerCase();
        const record = username ? (this.presenceRecords[username] || {}) : {};
        const presenceUser = adminUser || (username ? { username, ...record } : null);
        // El estado de presencia del administrador es privado del panel admin.
        const status = isAdminSession ? this.getPresenceStatus(presenceUser) : 'disconnected';
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
          dashboard.replaceChildren();
          dashboard.style.display = 'none';
        }

        if (this.currentUser?.role === 'worker') {
          const chatTitle = document.getElementById('chat-header-title');
          if (chatTitle) chatTitle.textContent = `Chat: ${info.name}`;
        }
        const chatCard = document.getElementById('chat-admin-presence');
        if (chatCard) {
          chatCard.classList.add('hidden');
          chatCard.classList.remove('flex');
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
        const connectedAt = Date.now();
        this.ownAvailabilityStatus = status;
        const sessions = { ...(previousRecord.sessions || {}), [this.presenceSessionId]: { connected: true, connectedAt, lastHeartbeat: connectedAt, availabilityStatus: status } };
        this.presenceRecords[username] = { ...previousRecord, username: this.currentUser.username, fullName: this.getCurrentDisplayName(), role: 'admin', photo: this.currentUser.photo || '', lastHeartbeat: connectedAt, connected: true, availabilityStatus: status, sessions };
        this.renderAdminPresence();
        try {
          await db.collection('presencia').doc(username).set({
            username: this.currentUser.username,
            fullName: this.getCurrentDisplayName(),
            role: 'admin',
            photo: this.currentUser.photo || '',
            lastHeartbeat: connectedAt,
            connected: true,
            availabilityStatus: status,
            sessions: { [this.presenceSessionId]: { connected: true, connectedAt, lastHeartbeat: connectedAt, availabilityStatus: status } }
          }, { merge: true });
          console.info('[PRESENCE] Estado del administrador guardado', { username, status });
          this.showToast('Estado actualizado: ' + this.getPresenceLabel(status), 'success');
        } catch (error) {
          this.presenceRecords[username] = previousRecord;
          this.renderAdminPresence();
          console.error('[PRESENCE] No se pudo actualizar el estado del administrador:', error);
          this.showToast('No se pudo guardar el estado. Revisa tu conexión e inténtalo de nuevo.', 'error');
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

      stopGpsSharing() {
        if (Number.isInteger(this.gpsWatchId) && navigator.geolocation) navigator.geolocation.clearWatch(this.gpsWatchId);
        this.gpsWatchId = null;
        this.isGpsSharing = false;
        this.gpsConnectedAt = null;
      }

      closeAdminGpsModal() {
        if (typeof this.gpsLocationsUnsubscribe === 'function') this.gpsLocationsUnsubscribe();
        this.gpsLocationsUnsubscribe = null;
        if (this.adminMap && typeof this.adminMap.remove === 'function') this.adminMap.remove();
        this.adminMap = null;
        this.adminMapMarkers = {};
        this.locationsData = {};
      }
      async startVoiceCall() {
        if (!CHAT_FEATURE_ENABLED) return;
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
          this.showToast('No se pudo iniciar la llamada. Inténtalo nuevamente.', "error");
          this.endVoiceCall(false);
        }
      }

      listenIncomingVoiceCalls() {
        if (!CHAT_FEATURE_ENABLED) return;
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
        if (!CHAT_FEATURE_ENABLED) return;
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
        if (!CHAT_FEATURE_ENABLED) return;
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
        if (!CHAT_FEATURE_ENABLED) return;
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
        if (!CHAT_FEATURE_ENABLED) return;
        const isAdmin = this.getChatRole() === 'admin';
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
          this.activeChatWorker = this.getChatThreadId();
          this.renderActiveChatHeader();
        }

        this.subscribeChatMessages();
        this.setupMultiWorkerChatListeners();
      }

      setupMultiWorkerChatListeners() {
        if (!CHAT_FEATURE_ENABLED) return;
        if (!window.db || !this.currentUser) return;
        const isAdmin = this.getChatRole() === 'admin';
        const names = isAdmin ? this.workers.map(w => this.getChatThreadId(w)).filter(Boolean) : [this.getChatThreadId()].filter(Boolean);
        names.forEach(wName => {
          if (this.dedicatedWorkerUnsubscribes[wName]) return;
          if (this.dedicatedWorkerRetryTimers[wName]) {
            clearTimeout(this.dedicatedWorkerRetryTimers[wName]);
            delete this.dedicatedWorkerRetryTimers[wName];
          }
          const listenerStartedAt = Date.now();
          const startupGraceMs = 5000;
          const messageTimestampMs = value => {
            if (value && typeof value.toMillis === 'function') return value.toMillis();
            if (value instanceof Date) return value.getTime();
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric > 0) return numeric;
            const parsed = Date.parse(value || '');
            return Number.isFinite(parsed) ? parsed : 0;
          };
          const query = db.collection('chats_internos').doc(wName).collection('mensajes').orderBy('timestamp', 'asc');
          let cancelled = false, unsubscribe = null, unsubscribeThreadDoc = null, baselineIds = new Set(), firstSnapshot = true, retryScheduled = false;
          const retryAfterListenerError = (context, error) => {
            this.reportChatSyncError(context, error);
            if (cancelled || retryScheduled) return;
            retryScheduled = true;
            cancelled = true;
            if (unsubscribe) unsubscribe();
            if (unsubscribeThreadDoc) unsubscribeThreadDoc();
            delete this.dedicatedWorkerUnsubscribes[wName];
            this.dedicatedWorkerRetryTimers[wName] = setTimeout(() => {
              delete this.dedicatedWorkerRetryTimers[wName];
              if (!this.currentUser || this.getChatRole() !== (isAdmin ? 'admin' : 'worker')) return;
              this.setupMultiWorkerChatListeners();
            }, 1500);
          };
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
          }, error => retryAfterListenerError(`estado de escritura de ${wName}`, error));
          const attach = () => {
            if (cancelled) return;
            unsubscribe = query.onSnapshot(snap => {
              this.chatSyncErrorShown = false;
              this.refreshChatThreadSummary(wName, snap, isAdmin);
              snap.docChanges().forEach(change => {
                if (change.type !== 'added') return;
                const msgId = change.doc.id;
                if (baselineIds.has(msgId)) return;
                const data = change.doc.data();
                if (data.type === 'call') return;
                const fromOther = isAdmin ? this.getChatRole(data.senderRole) === 'worker' : this.getChatRole(data.senderRole) === 'admin';
                if (!fromOther) return;
                this.notifyIncomingChatMessage(wName, msgId, data, { receivedAsNew: true });
              });
              if (firstSnapshot) { firstSnapshot = false; baselineIds.clear(); }
            }, error => retryAfterListenerError(`mensajes de ${wName}`, error));
          };
          query.get().then(snapshot => {
            if (cancelled) return;
            snapshot.forEach(doc => {
              const timestamp = messageTimestampMs(doc.data()?.timestamp);
              // No clasificar como histórico un mensaje recibido mientras se conectaba el listener.
              if (timestamp < listenerStartedAt - startupGraceMs) baselineIds.add(doc.id);
            });
            attach();
          }).catch(error => {
            console.warn('[CHAT] No se pudo cargar la línea base de mensajes; se omitirá solo la primera lectura:', error);
            if (cancelled) return;
            let ignoreFirstSnapshot = true;
            unsubscribe = query.onSnapshot(snap => {
              this.chatSyncErrorShown = false;
              this.refreshChatThreadSummary(wName, snap, isAdmin);
              if (ignoreFirstSnapshot) {
                snap.docChanges().forEach(change => {
                  if (change.type !== 'added') return;
                  const data = change.doc.data();
                  const isRecent = messageTimestampMs(data.timestamp) >= listenerStartedAt - startupGraceMs;
                  const fromOther = isAdmin ? this.getChatRole(data.senderRole) === 'worker' : this.getChatRole(data.senderRole) === 'admin';
                  if (isRecent && fromOther && data.type !== 'call') this.notifyIncomingChatMessage(wName, change.doc.id, data, { receivedAsNew: true });
                  else baselineIds.add(change.doc.id);
                });
                ignoreFirstSnapshot = false;
                return;
              }
              snap.docChanges().forEach(change => {
                if (change.type !== 'added' || baselineIds.has(change.doc.id)) return;
                const data = change.doc.data();
                if (data.type === 'call') return;
                const fromOther = isAdmin ? this.getChatRole(data.senderRole) === 'worker' : this.getChatRole(data.senderRole) === 'admin';
                if (!fromOther) return;
                this.notifyIncomingChatMessage(wName, change.doc.id, data, { receivedAsNew: true });
              });
            }, listenError => retryAfterListenerError(`mensajes de ${wName}`, listenError));
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
            const isIncoming = isAdmin ? this.getChatRole(data.senderRole) === 'worker' : this.getChatRole(data.senderRole) === 'admin';
          if (isIncoming && !this.isChatMessageReadForCurrentUser(wName, doc.id, data) && !data[`hiddenFor_${myRole}`]) unreadCount++;
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
        if (!CHAT_FEATURE_ENABLED) return;
        if (this.getChatRole() !== 'admin' || window.innerWidth < 640) return;
        if (!Array.isArray(this.openChatTabs)) this.openChatTabs = [];
        const alreadyOpen = this.openChatTabs.includes(wName);
        if (!alreadyOpen) this.openChatTabs.push(wName);

        // En escritorio, cada mensaje vuelve a mostrar el acceso compacto del remitente.
        const previousWorker = this.activeChatWorker;
        const previousMessages = document.getElementById('chat-messages-container');
        if (previousWorker && previousWorker !== wName && previousMessages) {
          this.chatConversationHtmlCache[previousWorker] = previousMessages.innerHTML;
        }
        // Al recibir un mensaje, abrir el acceso compacto del trabajador (como el dock
        // visible de la interfaz), manteniendo el indicador de no leídos.
        this.minimizedChatWindows[wName] = true;
        this.activeChatWorker = wName;
        this.chatDockUnreadByWorker?.add(wName);
        document.getElementById('chat-desktop-windows')?.classList.remove('hidden');
        this.renderChatTabs();
        this.renderActiveChatHeader();
        if (previousWorker !== wName) this.subscribeChatMessages();
        this.renderMessengerWindows();
        this.renderConversationsSidebar();
      }

      showBrowserChatNotification(wName, data = {}, msgId = '') {
        if (!CHAT_FEATURE_ENABLED) return;
        const desktopAdmin = this.getChatRole() === 'admin' && window.innerWidth >= 640;
        if ((!document.hidden && !desktopAdmin) || !('Notification' in window)) return;
        if (Notification.permission !== 'granted') {
          console.info('[CHAT] Notificación del sistema no disponible: permiso del navegador en', Notification.permission);
          return;
        }
        try {
          const notification = new Notification(`${data.senderName || wName} te envió un mensaje`, {
            body: String(data.text || 'Tienes un mensaje nuevo.').slice(0, 180),
            tag: `portonpro-chat-${String(wName)}-${String(msgId || Date.now())}`,
            renotify: true
          });
          notification.onclick = () => {
            window.focus();
            this.openDirectWorkerChat(wName);
            notification.close();
          };
        } catch (error) {
          console.warn('[CHAT] El navegador no permitió mostrar la notificación del sistema:', error?.message || error);
        }
      }

      notifyIncomingChatMessage(wName, msgId, data, { receivedAsNew = false } = {}) {
        if (!CHAT_FEATURE_ENABLED) return;
        const uniqueId = `${wName}:${msgId}`;
        // El listener filtra los mensajes históricos antes de llegar aquí. En un mensaje
        // recién agregado, el campo compartido `status` puede cambiar a "read" por otra
        // suscripción antes de procesar este snapshot; eso no debe silenciar el aviso.
        // La caché local y el indicador oculto sí representan lectura previa real.
        const readCache = this.getChatReadMessageCache()?.threads?.[String(wName)] || [];
        if (data?.[`hiddenFor_${this.getChatRole()}`] || readCache.map(String).includes(String(msgId))) return;
        if (!receivedAsNew && this.isChatMessageReadForCurrentUser(wName, msgId, data)) return;
        if (this.notifiedChatMessageIds.has(uniqueId)) return;
        this.notifiedChatMessageIds.add(uniqueId);
        if (this.notifiedChatMessageIds.size > 500) {
          const oldestId = this.notifiedChatMessageIds.values().next().value;
          this.notifiedChatMessageIds.delete(oldestId);
        }
        this.chatActivityRanks[wName] = ++this.chatActivitySequence;
        console.info('[CHAT] Mensaje nuevo: ejecutar alerta de escritorio/móvil.', { worker: wName, messageId: msgId, receivedAsNew });
        // Las alertas no deben depender de que el dock de chat pueda renderizarse.
        try {
          this.showPopupNotification({
            title: `${data.senderName || wName} te envió un mensaje`,
            details: data.text || '', type: 'chat', icon: '💬',
            onClick: () => this.openDirectWorkerChat(wName),
            force: true
          });
        } catch (error) { console.warn('[CHAT] No se pudo pintar el aviso dentro de la aplicación:', error); }
        try { this.showBrowserChatNotification(wName, data, msgId); }
        catch (error) { console.warn('[CHAT] No se pudo mostrar el aviso del navegador:', error); }
        try {
          const soundResult = SoundEngine.playMessageSound();
          soundResult?.then?.(played => {
            if (!played) console.info('[CHAT] Sonido pendiente o bloqueado por la política de audio del navegador.');
          });
        }
        catch (error) { console.warn('[CHAT] No se pudo reproducir el sonido:', error); }
        try {
          this.ensureIncomingWorkerWindow(wName);
          console.info('[CHAT] Ventana compacta del trabajador abierta/restaurada.', { worker: wName });
        }
        catch (error) { console.warn('[CHAT] No se pudo restaurar la conversación minimizada:', error); }
        if (this.getChatRole() === 'admin') this.renderConversationsSidebar();
      }

      getChatReadMessageCache() {
        const user = this.currentUser || {};
        const identity = String(user.id || user.username || user.fullName || '').trim().toLocaleLowerCase();
        if (!identity) return null;
        const key = `portonpro_chat_read_ids_v1_${this.getChatRole()}_${encodeURIComponent(identity)}`;
        if (this.chatReadMessageCacheKey !== key) {
          this.chatReadMessageCacheKey = key;
          try {
            const saved = JSON.parse(SafeStorage.getItem(key) || '{}');
            this.chatReadMessageCache = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
          } catch (_) { this.chatReadMessageCache = {}; }
        }
        return { key, threads: this.chatReadMessageCache };
      }

      isChatMessageReadForCurrentUser(threadId, messageId, data = {}) {
        const role = this.getChatRole();
        if (data?.status === 'read' || data?.[`hiddenFor_${role}`]) return true;
        if (!threadId || !messageId) return false;
        const cache = this.getChatReadMessageCache();
        return Boolean(cache?.threads?.[String(threadId)]?.includes(String(messageId)));
      }

      rememberChatMessagesAsRead(threadId, messageIds = []) {
        if (!threadId || !Array.isArray(messageIds) || messageIds.length === 0) return;
        const cache = this.getChatReadMessageCache();
        if (!cache) return;
        const key = String(threadId);
        const current = Array.isArray(cache.threads[key]) ? cache.threads[key] : [];
        const ids = new Set(current.map(String));
        messageIds.forEach(id => { if (id !== undefined && id !== null) ids.add(String(id)); });
        // Acota el almacenamiento local para no hacer crecer indefinidamente el perfil.
        cache.threads[key] = [...ids].slice(-1500);
        SafeStorage.setItem(cache.key, JSON.stringify(cache.threads));
      }

      reportChatSyncError(context, error) {
        if (!CHAT_FEATURE_ENABLED) return;
        console.error(`[CHAT] Falló la sincronización (${context}):`, error);
        if (this.chatSyncErrorShown) return;
        this.chatSyncErrorShown = true;
        this.showToast('No se pudieron sincronizar los mensajes en tiempo real. Revisa la conexión e inténtalo de nuevo.', 'error');
      }

      clearDedicatedWorkerChatListeners() {
        Object.keys(this.dedicatedWorkerUnsubscribes).forEach(k => {
          this.dedicatedWorkerUnsubscribes[k]();
        });
        this.dedicatedWorkerUnsubscribes = {};
        Object.keys(this.dedicatedWorkerRetryTimers || {}).forEach(k => clearTimeout(this.dedicatedWorkerRetryTimers[k]));
        this.dedicatedWorkerRetryTimers = {};
      }

      disableChatRuntime() {
        // Desconecta solo suscripciones de chat/llamadas; no borra mensajes,
        // conversaciones ni altera la presencia general de la aplicación.
        ['chatUnsubscribe', 'chatThreadUnsubscribe', 'chatThreadsUnsubscribe', 'callUnsubscribe'].forEach(key => {
          try { this[key]?.(); } catch (error) { console.warn('[CHAT] No se pudo cerrar una suscripción:', error); }
          this[key] = null;
        });
        try { this.clearDedicatedWorkerChatListeners?.(); } catch (_) {}
        try { this.callSignalingUnsubscribes?.forEach(unsubscribe => unsubscribe()); } catch (_) {}
        this.callSignalingUnsubscribes = [];
        try { this.endVoiceCall?.(false); } catch (_) {}
        try { this.stopIncomingCallRingtone?.(); } catch (_) {}
        ['chat-floating-button-container', 'chat-window-modal', 'chat-desktop-windows', 'chat-minimized-windows', 'modal-voice-call']
          .forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.querySelectorAll('.chat-reaction-picker, #toast-notification-stack [data-notification-type="chat"], #toast-notification-stack [data-notification-type="call"]')
          .forEach(element => element.remove());
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations?.().then(registrations => registrations.forEach(registration => {
            registration.getNotifications?.().then(notifications => notifications.forEach(notification => {
              if (String(notification.tag || '').startsWith('portonpro-chat-')) notification.close();
            }));
          })).catch(() => {});
        }
      }

      subscribeAllChatThreads() {
        if (!CHAT_FEATURE_ENABLED) return;
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
        if (!CHAT_FEATURE_ENABLED) return;
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
        if (!CHAT_FEATURE_ENABLED) return;
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
        if (!CHAT_FEATURE_ENABLED) return;
        wName = this.getChatThreadId(wName);
        const previousWorker = this.activeChatWorker;
        const previousMessages = document.getElementById('chat-messages-container');
        if (previousWorker && previousMessages) this.chatConversationHtmlCache[previousWorker] = previousMessages.innerHTML;
        this.activeChatWorker = wName;
        this.chatDockUnreadByWorker?.delete(wName);
        if (this.getChatRole() === 'admin') {
          const summary = this.chatThreadSummaries[wName];
          if (summary) summary.unreadCount = 0;
          if (this.conversations[wName]) this.conversations[wName].unreadByAdmin = 0;
          this.markChatConversationAsRead(wName);
          this.renderConversationsSidebar();
        }
        if (this.getChatRole() === 'admin') {
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
        if (this.getChatRole() === 'admin') {
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
        const activeThread = this.getChatRole() === 'admin' ? this.activeChatWorker : this.getCurrentDisplayName();
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
          if (this.getChatRole() === 'admin') {
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
          const composer = host.querySelector(this.getChatRole() === 'admin' && host !== mainHost ? '.messenger-window-form' : 'form[onsubmit*="handleSendMessage"]');
          if (composer) host.insertBefore(indicator, composer);
          else host.appendChild(indicator);
          if (wasNearBottom) scroller.scrollTop = scroller.scrollHeight;
        });
      }
      renderChatTabs() {
        const tray = document.getElementById('chat-open-tabs');
        if (!tray || this.getChatRole() !== 'admin') return;
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
        if (window.innerWidth < 640 || this.getChatRole() !== 'admin') {
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
                (isMinimized ? '' : '<button class="messenger-window-minimize" type="button" title="Minimizar" aria-label="Minimizar ' + this.escapeHtml(name) + '" onclick="event.stopPropagation();app.toggleMessengerWindow(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))">−</button>') +
                '<button class="messenger-window-close" type="button" title="Cerrar" aria-label="Cerrar ' + this.escapeHtml(name) + '" onclick="event.stopPropagation();app.closeChatTab(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))">×</button>' +
              '</span></header>' +
            (isMinimized ? '' : '<div class="messenger-window-messages">' + cached + '</div><form class="messenger-window-form" onsubmit="app.handleMessengerWindowSend(event,decodeURIComponent(\'' + encodeURIComponent(name) + '\'))"><input type="text" autocomplete="off" placeholder="Escribe un mensaje..." aria-label="Mensaje para ' + this.escapeHtml(name) + '"><button type="submit" title="Enviar" aria-label="Enviar">➤</button></form>') +
          '</section>';
        });
        dock.innerHTML = visibleCount
          ? renderedWindows.map((markup, index) => this.minimizedChatWindows[names[index]]
            ? '<div class="messenger-window-position-slot" aria-hidden="true" style="width:' + cellWidth + 'px;min-width:' + cellWidth + 'px;max-width:' + cellWidth + 'px;flex:0 0 ' + cellWidth + 'px;height:1px;pointer-events:none"></div>'
            : markup).join('')
          : '';
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
              '<header class="messenger-window-header" role="button" tabindex="0" title="Abrir o minimizar conversación" onclick="app.toggleMessengerWindow(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();app.toggleMessengerWindow(decodeURIComponent(\'' + encodeURIComponent(name) + '\'))}">' +
                '<span class="messenger-window-avatar seasonal-worker-avatar">' + avatar + '</span><span class="messenger-window-identity"><span class="messenger-window-title">' + this.escapeHtml(name) + '</span><span class="messenger-window-activity ' + presenceClass + '">' + this.escapeHtml(presenceText) + '</span></span>' +
                (unreadCount > 0 && this.prefs.chatBadge ? '<span class="messenger-window-unread-badge">' + (unreadCount > 99 ? '99+' : String(unreadCount)) + '</span>' : '') +
                '<span class="messenger-window-controls">' +
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
        if (restoring && this.getChatRole() === 'admin' && window.innerWidth >= 640) {
          this.chatDockUnreadByWorker?.delete(workerName);
          const summary = this.chatThreadSummaries[workerName];
          if (summary) summary.unreadCount = 0;
          if (this.conversations[workerName]) this.conversations[workerName].unreadByAdmin = 0;
          document.getElementById('chat-desktop-windows')?.classList.remove('hidden');
          this.markChatConversationAsRead(workerName);
          this.renderConversationsSidebar();
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
        if (this.getChatRole() !== 'admin') return;
        const contactsPanel = document.getElementById('chat-window-modal');
        const contactsPanelWasOpen = Boolean(contactsPanel && !contactsPanel.classList.contains('hidden'));
        this.openChatTabs = (this.openChatTabs || []).filter(name => name !== workerName);
        delete this.minimizedChatWindows[workerName];
        if (this.activeChatWorker === workerName) {
          const next = this.openChatTabs[0];
          if (next && contactsPanelWasOpen) return this.selectChatConversation(next);
          this.activeChatWorker = next || '';
          if (next) this.subscribeChatMessages();
        }
        // Closing a docked/minimized worker chat must not open the main contacts
        // panel as a side effect when that panel was previously closed.
        this.renderChatTabs();
        this.renderMessengerWindows();
        if (contactsPanel && !contactsPanelWasOpen) {
          contactsPanel.classList.add('hidden');
          document.getElementById('chat-launcher-button')?.setAttribute('aria-expanded', 'false');
        }
      }
      showMobileChatSidebar() {
        document.getElementById('chat-sidebar').classList.remove('mobile-conversation-open');
        document.getElementById('chat-conversation-area').classList.add('mobile-list-open');
      }

      openDirectWorkerChat(workerName) {
        if (!CHAT_FEATURE_ENABLED) return;
        this.activeChatWorker = workerName;
        const chatModal = document.getElementById('chat-window-modal');
        chatModal.classList.remove('hidden');
        this.selectChatConversation(workerName);
      }

      toggleChatWindow() {
        if (!CHAT_FEATURE_ENABLED) return;
        const chatModal = document.getElementById('chat-window-modal');
        if (!chatModal) return;
        const opening = chatModal.classList.contains('hidden');
        chatModal.classList.toggle('hidden', !opening);
        document.getElementById('chat-launcher-button')?.setAttribute('aria-expanded', String(opening));
        const isDesktopAdminContacts = this.getChatRole() === 'admin' && window.innerWidth >= 640;
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
        if (!CHAT_FEATURE_ENABLED) return;
        const menu = document.getElementById('chat-conversation-options-dropdown');
        if (menu) menu.classList.toggle('hidden');
      }

      async archiveCurrentConversation() {
        if (this.getChatRole() !== 'admin') return;
        const threadId = this.getChatThreadId();
        this.toggleChatOptionsMenu();

        if (window.db && threadId) {
          await db.collection('chats_internos').doc(threadId).set({ archived: true }, { merge: true });
          this.showToast("Conversación archivada", "info");
        }
      }

      async clearCurrentConversation() {
        if (this.getChatRole() !== 'admin') return;
        this.toggleChatOptionsMenu();
        if (!(await this.showSystemConfirm("¿Deseas vaciar todos los mensajes de esta conversación?", { title: "Vaciar conversación", confirmText: "Vaciar", icon: "trash" }))) return;

        const threadId = this.getChatThreadId();
        if (window.db && threadId) {
          const snap = await db.collection('chats_internos').doc(threadId).collection('mensajes').get();
          snap.forEach(d => d.ref.delete());
          await db.collection('chats_internos').doc(threadId).update({ lastMessage: 'Conversación vaciada' });
          this.showToast("Conversación vaciada", "success");
        }
      }

      async deleteCurrentConversation() {
        if (this.getChatRole() !== 'admin') return;
        this.toggleChatOptionsMenu();
        if (!(await this.showSystemConfirm("¿Deseas eliminar completamente esta conversación y su historial?", { title: "Eliminar conversación", confirmText: "Eliminar", icon: "trash" }))) return;

        const threadId = this.getChatThreadId();
        if (window.db && threadId) {
          const snap = await db.collection('chats_internos').doc(threadId).collection('mensajes').get();
          snap.forEach(d => d.ref.delete());
          await db.collection('chats_internos').doc(threadId).delete();
          this.showToast("Conversación eliminada", "info");
        }
      }

      async deleteMessageForEveryone(msgId) {
        const threadId = this.getChatThreadId();
        const message = this.chatMessages.find(m => m.id === msgId);
        if (this.getChatRole() !== 'admin' && (!message || this.getChatRole(message.senderRole) !== 'worker' || message.senderName !== this.getCurrentDisplayName())) return;
        if (!(await this.showSystemConfirm("¿Eliminar este mensaje para todos?", { title: "Eliminar mensaje", confirmText: "Eliminar", icon: "trash" }))) return;
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
        if (!CHAT_FEATURE_ENABLED) return;
        const threadId = this.getChatThreadId();
        const myRole = this.getChatRole();

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
        if (!CHAT_FEATURE_ENABLED) return;
        if (!window.db) return;
        this.chatMessageInitialRenderDone = false;
        if (this.chatUnsubscribe) { this.chatUnsubscribe(); }

        const role = this.getChatRole();
        const threadId = this.getChatThreadId();

        if (this.chatThreadUnsubscribe) this.chatThreadUnsubscribe();
        this.chatThreadUnsubscribe = db.collection('chats_internos').doc(threadId).onSnapshot(doc => {
          if (doc.exists) {
            const data = doc.data();
            const otherRole = role === 'admin' ? 'worker' : 'admin';
            const isOtherTyping = data.typing && data.typing[otherRole];
            this.chatTypingByWorker[threadId] = Boolean(isOtherTyping);
            if (role === 'worker') {
              this.workerUnreadCount = Number(data.unreadByWorker || 0);
              const summary = this.chatThreadSummaries[threadId];
              const count = summary?.hasMessages ? summary.unreadCount : this.workerUnreadCount;
              this.updateChatLauncherUnread(count);
            }

            this.renderChatTypingIndicators();
          }
        }, error => this.reportChatSyncError(`conversación ${threadId}`, error));

        this.chatUnsubscribe = db.collection('chats_internos')
          .doc(threadId)
          .collection('mensajes')
          .orderBy('timestamp', 'desc')
          .limit(80)
          .onSnapshot(snapshot => {
            this.chatSyncErrorShown = false;
            const msgs = [];
            let unreadCount = 0;

            // La consulta trae los mensajes más nuevos; invertirlos conserva el orden cronológico en pantalla.
            snapshot.docs.slice().reverse().forEach(doc => {
              const data = doc.data();
              const msgId = doc.id;

              const myHiddenKey = `hiddenFor_${role}`;
              if (!data[myHiddenKey]) {
                msgs.push({ id: msgId, ...data });
              }

              const isFromOther = this.getChatRole(data.senderRole) !== role;
              if (isFromOther && !this.isChatMessageReadForCurrentUser(threadId, msgId, data)) {
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
            const badgeCount = threadSummary?.hasMessages ? threadSummary.unreadCount : (role === 'worker' && this.workerUnreadCount !== null ? this.workerUnreadCount : unreadCount);
            this.updateChatLauncherUnread(badgeCount);
            const chatWindow = document.getElementById('chat-window-modal');
            const desktopConversationOpen = role === 'admin' && window.innerWidth >= 640 && this.openChatTabs.includes(threadId) && !this.minimizedChatWindows[threadId];
            const mobileOrWorkerConversationOpen = chatWindow && !chatWindow.classList.contains('hidden') && (role !== 'admin' || window.innerWidth < 640);
            if ((desktopConversationOpen || mobileOrWorkerConversationOpen) && !document.hidden) this.markMessagesAsRead();
          }, err => this.reportChatSyncError(`mensajes de ${threadId}`, err));
      }

      renderChatMessages() {
        if (!CHAT_FEATURE_ENABLED) return;
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
          const isMine = this.getChatRole() === 'admin' ? this.getChatRole(m.senderRole) === 'admin' : m.senderName === myName;
          let messageText = m.text || '';
          if (m.type === 'call') {
            const isCaller = this.getChatRole() === 'admin' ? m.callerRole === 'admin' : m.callerName === myName && m.callerRole === this.currentUser.role;
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

        if (!window.db) {
          this.showToast('El mensaje no se envió porque no hay conexión con el servicio de mensajería.', 'error');
          return;
        }
        if (this.chatSending) return;
        this.chatSending = true;
        const myName = this.getCurrentDisplayName();
        const role = this.getChatRole();
        const threadId = this.getChatThreadId();
        if (!threadId) {
          this.chatSending = false;
          this.showToast('No se pudo identificar la conversación. Vuelve a abrir el chat.', 'error');
          return;
        }

        const msgObj = {
          threadId: threadId,
          text: text,
          senderName: myName,
          senderRole: role,
          recipient: role === 'admin' ? threadId : this.getAdminPresenceInfo().name,
          time: this.formatTime(new Date()),
          timestamp: Date.now(),
          status: 'sent'
        };

        try {
          const messageRef = db.collection('chats_internos').doc(threadId).collection('mensajes').doc();
          const threadRef = db.collection('chats_internos').doc(threadId);
          const updatePayload = {
            lastMessage: text,
            lastTime: this.formatTime(new Date()),
            lastTimestamp: msgObj.timestamp,
            workerName: threadId,
            archived: false,
            typing: { [role]: false }
          };
          updatePayload[role === 'admin' ? 'unreadByWorker' : 'unreadByAdmin'] = firebase.firestore.FieldValue.increment(1);
          await messageRef.set(msgObj);
          input.value = '';
          try {
            await threadRef.set(updatePayload, { merge: true });
          } catch (threadError) {
            console.warn('[CHAT] Mensaje enviado; no se pudo actualizar el resumen de la conversación:', threadError);
            this.showToast('El mensaje se envió, pero el resumen de la conversación tardó en actualizarse.', 'info');
          }
        } catch(err) {
          console.error('[CHAT] No se pudo enviar el mensaje:', { threadId, role, code: err?.code, message: err?.message }, err);
          this.showToast('No se pudo enviar el mensaje. Conservamos el texto; revisa la conexión e inténtalo de nuevo.', 'error');
        } finally {
          this.chatSending = false;
        }
      }

      async markChatConversationAsRead(workerName) {
        if (!window.db || this.getChatRole() !== 'admin' || !workerName) return;
        try {
          const threadRef = db.collection('chats_internos').doc(workerName);
          const snapshot = await threadRef.collection('mensajes')
            .orderBy('timestamp', 'desc')
            .get();
          const incoming = snapshot.docs.filter(doc => {
            const message = doc.data();
            return this.getChatRole(message.senderRole) !== this.getChatRole();
          });
          this.rememberChatMessagesAsRead(workerName, incoming.map(doc => doc.id));
          const pending = incoming.filter(doc => doc.data().status !== 'read');
          for (let start = 0; start < pending.length; start += 450) {
            const batch = db.batch();
            pending.slice(start, start + 450).forEach(doc => batch.update(doc.ref, { status: 'read' }));
            await batch.commit();
          }
          await threadRef.set({ unreadByAdmin: 0 }, { merge: true });
          const summary = this.chatThreadSummaries[workerName];
          if (summary) summary.unreadCount = 0;
          if (this.conversations[workerName]) this.conversations[workerName].unreadByAdmin = 0;
          this.chatDockUnreadByWorker?.delete(workerName);
          this.renderMessengerWindows();
          this.renderConversationsSidebar();
        } catch (error) {
          console.warn('[CHAT] No se pudo marcar la conversación como leída:', error);
        }
      }

      markMessagesAsRead() {
        if (!window.db || this.chatMessages.length === 0) return;
        const role = this.getChatRole();
        const threadId = this.getChatThreadId();

        const incoming = this.chatMessages.filter(message => this.getChatRole(message.senderRole) !== role && message.id);
        const pendingRead = incoming.filter(message => !this.isChatMessageReadForCurrentUser(threadId, message.id, message));
        this.rememberChatMessagesAsRead(threadId, incoming.map(message => message.id));
        pendingRead.forEach(m => {
          db.collection('chats_internos').doc(threadId).collection('mensajes').doc(m.id).update({ status: 'read' }).catch(() => {});
        });

        const resetField = role === 'admin' ? 'unreadByAdmin' : 'unreadByWorker';
        db.collection('chats_internos').doc(threadId).set({ [resetField]: 0 }, { merge: true }).catch(() => {});
      }

      renderTechniciansMonitor() {
        const grid = document.getElementById('technicians-status-grid');
        const counter = document.getElementById('techs-online-counter');
        if (!grid) return;

        const workerSources = [
          ...(Array.isArray(this.workers) ? this.workers : []),
          ...(Array.isArray(this.users) ? this.users.filter(user => ['worker', 'trabajador', 'tecnico', 'técnico'].includes(String(user.role || '').toLowerCase().trim())) : [])
        ];
        const workerById = new Map(workerSources.map(user => [String(user.username || user.id || user.fullName || '').trim().toLowerCase(), user]));
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
          this.schedulePresenceExpiryRender();
          return;
        }

        grid.innerHTML = monitorWorkers.map(u => {
          const presenceStatus = this.getPresenceStatus(u);
          const isOnline = presenceStatus === 'available';
          const presenceCardClass = presenceStatus === 'available'
            ? 'bg-brand-limeLight border-brand-limeBorder shadow-sm presence-card-connected'
            : presenceStatus === 'inactive'
              ? 'presence-card-inactive border shadow-sm'
              : presenceStatus === 'absent'
                ? 'bg-amber-50 border-amber-200 shadow-sm presence-card-absent'
                : 'bg-slate-50 border-slate-200';
          const presenceLabel = this.getPresenceLabel(presenceStatus);
          const lastActivity = this.getPresenceActivityTimestamp(u);
          const lastActivityLabel = lastActivity ? this.formatFullDateTime(new Date(lastActivity)) : 'Sin actividad registrada';
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
                    <span class="font-bold ${presenceStatus === 'available' ? 'text-emerald-600' : presenceStatus === 'inactive' || presenceStatus === 'absent' ? 'text-amber-600' : 'text-slate-700'}">${this.escapeHtml(lastActivityLabel)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');

        counter.textContent = `${onlineCount} En Línea`;
        if (window.lucide) lucide.createIcons();
        this.schedulePresenceExpiryRender();
      }

      toggleTechniciansMonitor() {
        if (this.currentUser?.role !== 'admin') return;
        const grid = document.getElementById('technicians-status-grid');
        const button = document.getElementById('btn-toggle-technicians-monitor');
        const label = document.getElementById('technicians-monitor-toggle-label');
        if (!grid || !button) return;
        const collapsed = !grid.classList.contains('hidden');
        grid.classList.toggle('hidden', collapsed);
        button.setAttribute('aria-expanded', String(!collapsed));
        button.setAttribute('aria-label', collapsed ? 'Mostrar técnicos' : 'Ocultar técnicos');
        button.title = collapsed ? 'Mostrar técnicos' : 'Ocultar técnicos';
        if (label) label.textContent = collapsed ? 'Mostrar' : 'Ocultar';
        const icon = button.querySelector('[data-lucide]');
        if (icon) icon.setAttribute('data-lucide', collapsed ? 'chevron-down' : 'chevron-up');
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
          subtitle.textContent = 'Gestión integral del personal';
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
          AuthSessionStore.setItem(JSON.stringify(this.currentUser));

          if (window.db && this.currentUser.id) {
            db.collection('users').doc(this.currentUser.id).update({ photo: base64Data }).catch(e => console.error(e));
            db.collection('presencia').doc(this.currentUser.username.toLowerCase()).set({ photo: base64Data }, { merge: true }).catch(() => {});
          }

          this.renderMySettingsPhotoPreview();
          this.setupDashboardUI();
          this.renderTasks();
          if (this.currentUser.role === 'admin') this.renderTechniciansMonitor();
          this.showToast('Foto actualizada correctamente.', 'success');
        };
        reader.readAsDataURL(file);
      }

      removeOwnPhoto() {
        this.currentUser.photo = '';
        AuthSessionStore.setItem(JSON.stringify(this.currentUser));

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
              const nextVersion = Math.max(1, Number(userDoc.data().sessionVersion) || 1) + 1;
              this.sessionInvalidating = true;
              await db.collection('users').doc(this.currentUser.id).update({ password: newPass, sessionVersion: nextVersion });
              this.clearRememberedCredentials();
              this.logout();
              this.sessionInvalidating = false;
              this.showToast('Contraseña actualizada. Inicia sesión nuevamente con la nueva contraseña.', 'success');
              return;
            } else {
              this.showToast('Contraseña actual incorrecta', 'error');
            }
          } catch(err) {
            this.sessionInvalidating = false;
            this.showToast('No fue posible actualizar la contraseña. Inténtalo nuevamente.', 'error');
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
        field('save').textContent = 'Actualizar trabajador';
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
        document.getElementById('btn-save-user').textContent = 'Guardar trabajador';
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
        const existingUser = this.users.find(user => String(user.id) === String(id));
        let photo = existingUser?.photo || '';

        if (username.toLowerCase() === 'administrador' && id !== 'admin') {
          this.showToast('El usuario no puede llamarse administrador', 'error');
          return;
        }

        if (photoFile) {
          try { photo = await this.encodeManagedWorkerPhoto(photoFile); }
          catch (error) { console.error('[TRABAJADORES] No se pudo procesar la foto.', error); this.showToast('No se pudo procesar la foto seleccionada.', 'error'); return; }
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
          active: true,
          sessionVersion: existingUser
            ? Math.max(1, Number(existingUser.sessionVersion) || 1) + (String(existingUser.password || '') !== password ? 1 : 0)
            : 1
        };

        if (window.db) {
          try {
            if (id) {
              await db.collection('users').doc(id).set(userData, { merge: true });
            } else {
              const docId = 'tech-' + Date.now();
              await db.collection('users').doc(docId).set({ ...userData, lastHeartbeat: 0, lastLogin: 'Nunca' });
            }
            let presencePhotoSynced = true;
            try {
              await db.collection('presencia').doc(String(username).trim().toLowerCase()).set({ username, fullName, role: 'worker', photo }, { merge: true });
            } catch (syncError) {
              presencePhotoSynced = false;
              console.warn('[PERFIL] No se pudo publicar el avatar en el registro de presencia:', syncError);
            }
            this.showToast(presencePhotoSynced ? (id ? `Trabajador ${fullName} actualizado correctamente.` : `Trabajador ${fullName} registrado correctamente.`) : 'El trabajador se guardó, pero la foto puede tardar en sincronizarse.', presencePhotoSynced ? 'success' : 'info');
            if (id) this.closeEmployeeEditBubble();
            this.resetUserForm();
          } catch(err) {
            console.error("Error guardando trabajador en Firestore:", err);
            this.showToast('No se pudo guardar el trabajador. Inténtalo nuevamente.', 'error');
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
        if (!(await this.showSystemConfirm("¿Está seguro de eliminar este trabajador?", { title: "Eliminar trabajador", confirmText: "Eliminar", icon: "trash" }))) return;
        if (window.db) {
          try {
            await db.collection('users').doc(id).delete();
            this.showToast('Trabajador eliminado.', 'info');
          } catch(err) {
            this.showToast('No se pudo eliminar el trabajador. Inténtalo nuevamente.', 'error');
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
          if (label) {
            label.textContent = select.value === 'ALL' ? fallbackLabel : (selected?.textContent || fallbackLabel).trim();
            label.classList.toggle('order-filter-label--free', select.value === 'LIBRE');
          }
          menu.replaceChildren();
          Array.from(select.options).forEach(option => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `order-filter-option${option.value === 'LIBRE' ? ' order-filter-option--free' : ''}`;
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
          const hiddenOption = this.currentUser?.role === 'admin' ? '<option value="NO_VISIBLE_WORKERS">🔒 No visible para trabajadores</option>' : '';
          taskAssignedSelect.innerHTML = `<option value="LIBRE">🟢 LIBRE</option>${hiddenOption}${opts}`;
          if ([...taskAssignedSelect.options].some(option => option.value === previousAssigned)) taskAssignedSelect.value = previousAssigned;
        }
        if (filterTechSelect) filterTechSelect.innerHTML = `<option value="ALL">Todos los Técnicos</option><option value="LIBRE">🟢 LIBRE</option>` + opts;
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
        label.classList.toggle('task-technician-label--free', selected?.value === 'LIBRE');
        menu.replaceChildren();
        Array.from(select.options).forEach(option => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = `task-technician-option${option.value === 'LIBRE' ? ' task-technician-option--free' : ''}`;
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

      isTaskHiddenFromWorkers(task) {
        return task?.hiddenFromWorkers === true || String(task?.assignedTo || '').trim().toUpperCase() === 'NO_VISIBLE_WORKERS';
      }

      updateStats() {}

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
          targets = this.tasks.filter(t => t.status === 'REALIZADA' && !t.archivedAt && t.invoiceInConsolidated !== true);
          label = 'REALIZADAS';
        } else if (category === 'NO_REALIZADA') {
          targets = this.tasks.filter(t => t.status === 'NO_REALIZADA' && !t.archivedAt && t.invoiceInConsolidated !== true);
          label = 'PENDIENTES';
        } else if (category === 'PENDIENTE_GRUPO') {
          targets = this.tasks.filter(t => t.status === 'EN_PROCESO' && !t.archivedAt && t.invoiceInConsolidated !== true);
          label = 'EN PROCESO';
        }

        if (targets.length === 0) return this.showToast(`No hay órdenes para reiniciar`, 'info');
        if (!(await this.showSystemConfirm(`¿Deseas reiniciar ${targets.length} orden(es) de ${label}?`, { title: "Reiniciar órdenes", confirmText: "Reiniciar", icon: "warning" }))) return;

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

      parseAuditLogDate(value) {
        if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value.getTime());
        if (typeof value === 'number' && Number.isFinite(value)) {
          const numericDate = new Date(value);
          return Number.isFinite(numericDate.getTime()) ? numericDate : null;
        }
        const text = String(value || '').trim();
        if (!text) return null;
        const localDate = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?)?/i);
        if (localDate) {
          let hours = Number(localDate[4] || 0);
          const meridiem = String(localDate[7] || '').toLowerCase().replace(/[.\s]/g, '');
          if (meridiem.startsWith('p') && hours < 12) hours += 12;
          if (meridiem.startsWith('a') && hours === 12) hours = 0;
          const parsed = new Date(Number(localDate[3]), Number(localDate[2]) - 1, Number(localDate[1]), hours, Number(localDate[5] || 0), Number(localDate[6] || 0));
          return Number.isFinite(parsed.getTime()) ? parsed : null;
        }
        const parsed = new Date(text);
        return Number.isFinite(parsed.getTime()) ? parsed : null;
      }

      startOfAuditWeek(date) {
        const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        return monday;
      }

      auditWeekKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }

      formatAuditWeekRange(start) {
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
        const format = date => date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${format(start)} – ${format(end)}`;
      }

      renderAdminAuditLog(historyWeekKey) {
        const section = document.getElementById('section-admin-audit-log');
        const body = document.getElementById('audit-log-tbody');
        const counter = document.getElementById('audit-log-counter');
        const currentRange = document.getElementById('audit-log-current-range');
        const historyDetails = document.getElementById('audit-log-history');
        const historyCounter = document.getElementById('audit-log-history-counter');
        const historySelect = document.getElementById('audit-log-history-week');
        const historyBody = document.getElementById('audit-log-history-tbody');
        if (!section || !body || !counter || !historySelect || !historyBody || this.currentUser?.role !== 'admin') return;

        const reportStatuses = new Set(['REALIZADA', 'NO_REALIZADA', 'EN_PROCESO']);
        const reports = (Array.isArray(this.tasks) ? this.tasks : []).filter(task =>
          task && (task.completedAt || reportStatuses.has(String(task.status || '').toUpperCase()))
        );
        const today = new Date();
        const currentWeekStart = this.startOfAuditWeek(today);
        const currentWeekKey = this.auditWeekKey(currentWeekStart);
        if (currentRange) currentRange.textContent = this.formatAuditWeekRange(currentWeekStart);

        const datedReports = reports.map(task => {
          const reportDate = this.parseAuditLogDate(task.completedAt) || this.parseAuditLogDate(task.completedAtMs) || this.parseAuditLogDate(task.date) || today;
          let weekStart = this.startOfAuditWeek(reportDate);
          // Legacy orders without a report timestamp remain visible in the current view
          // until their scheduled date; a future date must not hide a report from both lists.
          if (weekStart > currentWeekStart) weekStart = currentWeekStart;
          return { task, reportDate, weekStart, weekKey: this.auditWeekKey(weekStart) };
        });
        const currentReports = datedReports.filter(record => record.weekKey === currentWeekKey);
        const historyWeeks = new Map();
        datedReports.filter(record => record.weekKey < currentWeekKey).forEach(record => {
          if (!historyWeeks.has(record.weekKey)) historyWeeks.set(record.weekKey, { start: record.weekStart, reports: [] });
          historyWeeks.get(record.weekKey).reports.push(record);
        });
        const orderedWeeks = Array.from(historyWeeks.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        const wantedWeek = historyWeekKey !== undefined ? String(historyWeekKey || '') : String(this.auditLogSelectedWeek || '');
        const selectedWeekKey = orderedWeeks.some(([key]) => key === wantedWeek) ? wantedWeek : (orderedWeeks[0]?.[0] || '');
        this.auditLogSelectedWeek = selectedWeekKey;
        const historyWasOpen = Boolean(historyDetails?.open);

        counter.textContent = `${currentReports.length} Informes`;
        body.replaceChildren();
        historyBody.replaceChildren();
        historySelect.replaceChildren();
        orderedWeeks.forEach(([key, week]) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = this.formatAuditWeekRange(week.start);
          historySelect.appendChild(option);
        });
        historySelect.disabled = orderedWeeks.length === 0;
        if (selectedWeekKey) historySelect.value = selectedWeekKey;
        else {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'No hay semanas anteriores';
          historySelect.appendChild(option);
          historySelect.value = '';
        }
        if (historyCounter) historyCounter.textContent = `${orderedWeeks.length} ${orderedWeeks.length === 1 ? 'semana' : 'semanas'} · ${datedReports.length - currentReports.length} informes`;
        if (historyDetails) historyDetails.open = historyWasOpen;

        const appendRows = (targetBody, records, emptyMessage) => {
          if (!records.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 6;
            cell.className = 'p-4 text-center text-slate-400';
            cell.textContent = emptyMessage;
          row.appendChild(cell);
            targetBody.appendChild(row);
            return;
          }
          records.forEach(({ task }) => {
            const row = document.createElement('tr');
            const evidenceCount = Array.isArray(task.evidence) ? task.evidence.length : 0;
            const values = [task.completedAt || task.date || '—', task.assignedTo || '—', task.client || '—', task.status || '—', task.observations || '—', evidenceCount ? `${evidenceCount} archivo(s)` : '—'];
            values.forEach(value => {
              const cell = document.createElement('td');
              cell.className = 'p-2 align-top';
              cell.textContent = String(value);
              row.appendChild(cell);
            });
            targetBody.appendChild(row);
          });
        };

        appendRows(body, currentReports, 'No hay informes registrados esta semana.');
        const selectedWeekReports = historyWeeks.get(selectedWeekKey)?.reports || [];
        appendRows(historyBody, selectedWeekReports, 'No hay informes en esta semana.');
      }

      renderTasks() {
        const search = document.getElementById('filter-search').value.toLowerCase();
        const statusFilter = document.getElementById('filter-status').value;
        const techFilter = document.getElementById('filter-tech').value;
        const container = document.getElementById('tasks-container');
        const emptyState = document.getElementById('empty-state');
        const countTag = document.getElementById('filtered-count');
        const isAdmin = this.currentUser.role === 'admin';
        const isWorker = this.currentUser.role === 'worker';
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
        const normalizeWorkerName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
        const myWorkerId = String(this.currentUser.id || this.users?.find(user => (user.fullName || user.username) === myName)?.id || '');
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
          if (this.showArchivedTasks ? (!isAdmin || !t.archivedAt) : (!!t.archivedAt || t.invoiceInConsolidated === true)) return false;
          if (!isAdmin && (this.isTaskHiddenFromWorkers(t) || (!this.isTaskFree(t) && t.assignedTo !== myName))) return false;
          if (isWorker && t.status === 'REALIZADA') return false;

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
        const currentOrder = new Map(filtered.map((task, index) => [String(task.id), index]));
        filtered.sort((a, b) => {
          const urgency = Number(b.urgent === true) - Number(a.urgent === true);
          if (urgency) return urgency;
          if (a.urgent === true && b.urgent === true) return currentOrder.get(String(a.id)) - currentOrder.get(String(b.id));
          const freeOrder = Number(this.isTaskFree(a)) - Number(this.isTaskFree(b));
          if (freeOrder) return freeOrder;
          if (this.isTaskFree(a) && this.isTaskFree(b)) return currentOrder.get(String(a.id)) - currentOrder.get(String(b.id));
          return (statusPriority[a.status] ?? 4) - (statusPriority[b.status] ?? 4);
        });

        countTag.textContent = filtered.length;

        if (filtered.length === 0) {
          container.innerHTML = '';
          emptyState.classList.remove('hidden');
          return;
        }

        emptyState.classList.add('hidden');

        container.innerHTML = filtered.map(t => {
          let statusBadge = '<span class="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold">⏳ Pendiente</span>';
          let borderClass = 'border-rose-200';

          if (t.status === 'EN_PROCESO') {
            statusBadge = '<span class="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">⚙️ En Proceso</span>';
            borderClass = 'border-blue-300';
          } else if (t.status === 'REALIZADA') {
            statusBadge = '<span class="bg-brand-limeLight text-brand-limeHover border border-brand-limeBorder text-[10px] px-2 py-0.5 rounded-full font-bold">✅ Realizada</span>';
            borderClass = 'border-brand-lime/40';
          } else if (t.status === 'NO_REALIZADA') {
            statusBadge = '<span class="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold">⏳ Pendiente</span>';
            borderClass = 'border-rose-200';
          }

          const taskIsFree = this.isTaskFree(t);
          const taskIsHiddenFromWorkers = this.isTaskHiddenFromWorkers(t);
          const workerClaimIsMine = t.claimedByWorkerId
            ? String(t.claimedByWorkerId) === myWorkerId
            : String(t.claimedByWorkerName || '').trim().toLocaleLowerCase() === String(myName || '').trim().toLocaleLowerCase();
          const orderStatusVisualClass = t.urgent === true
            ? 'order-status-urgent'
            : t.status === 'EN_PROCESO'
            ? 'order-status-in-progress'
            : t.status === 'REALIZADA' ? 'order-status-completed' : '';
          const rawWorkDate = String(t.date || '');
          const workDate = /^\d{4}-\d{2}-\d{2}$/.test(rawWorkDate) ? rawWorkDate.split('-').reverse().join('/') : rawWorkDate;
          const adminLine = t.administrator ? `<p class="order-administrator worker-order-extra mt-1 text-xs text-slate-600"><span class="font-semibold">Administrador / contacto:</span> ${this.escapeHtml(t.administrator)}</p>` : '';
          const phoneLine = t.phone ? `<p class="order-phone worker-order-extra mt-0.5 text-xs text-slate-600"><span class="font-semibold">Teléfono:</span> ${this.escapeHtml(t.phone)}</p>` : '';
          const workValueLine = isAdmin && t.workValue !== null && t.workValue !== undefined && t.workValue !== '' ? `<p class="order-work-value mt-1 text-xs font-bold text-emerald-800"><span class="font-semibold">Valor del trabajo:</span> ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(t.workValue) || 0)}</p>` : '';
          const orderInstructions = String(t.instructions || '').trim();
          const orderObservations = String(t.observations || '').trim();
          const techObj = taskIsFree ? null : this.getTaskTechnician(t);
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
            <div data-task-id="${this.escapeHtml(t.id)}" class="order-card ${orderStatusVisualClass} ${isAdmin ? 'admin-order-card-compact' : ''} ${isWorker ? 'worker-order-card-compact' : ''} bg-white rounded-2xl p-3.5 sm:p-4 border ${borderClass} shadow-sm flex flex-col justify-between min-w-0 overflow-hidden transition-all duration-200 hover:shadow-md ${isAdmin && t.status === 'REALIZADA' && !t.archivedAt && t.urgent !== true ? 'completed-order-alert' : ''}">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-mono font-black text-slate-500">${t.id}</span>
                  <div class="flex flex-col items-end justify-center gap-1">${t.urgent === true ? '<span class="order-urgent-badge" aria-label="Orden urgente">🚨 URGENTE</span>' : ''}${statusBadge}${t.status === 'EN_PROCESO' && (t.workStarted === true || t.workStartedAt || t.startedAt) ? '<span class="order-work-started-indicator" role="status">🟡 En Curso</span>' : ''}</div>
                </div>

                <h3 class="font-extrabold text-slate-900 text-sm sm:text-base leading-snug break-words">${this.escapeHtml(t.client || 'Cliente')}</h3>
                <p class="order-service-line text-xs font-semibold text-slate-700 mt-0.5">${this.escapeHtml(t.serviceType || 'Servicio sin especificar')}</p>
                <p class="order-date-line mt-1 text-[11px] text-slate-500"><span class="font-semibold">Fecha de realización:</span> ${this.escapeHtml(workDate || 'Sin fecha')}</p>
                ${adminLine}
                ${phoneLine}
                ${workValueLine}

                <div class="order-client-panel worker-order-extra mt-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 space-y-1.5 text-xs min-w-0">
                  <p class="text-slate-600 flex items-start gap-1.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5"></i><span class="line-clamp-2 break-words">${this.escapeHtml(t.address || "Sin dirección")}</span></p>
                  <div class="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Abrir ruta</span>
                    <div class="flex items-center gap-1.5"><button type="button" onclick="app.openWazeNavigation(${this.escapeHtml(JSON.stringify(String(t.address || t.serviceLocation || '')))})" class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-slate-200 bg-white hover:border-brand-lime hover:bg-brand-limeLight active:scale-95 transition flex items-center justify-center" aria-label="Abrir ruta en Waze" title="Abrir ruta en Waze"><img src="assets/media/media-1.png" alt="" aria-hidden="true" class="w-6 h-6 sm:w-7 sm:h-7 object-contain"></button><button type="button" onclick="app.openGoogleMapsNavigation(${this.escapeHtml(JSON.stringify(String(t.address || t.serviceLocation || '')))})" class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-slate-200 bg-white hover:border-brand-lime hover:bg-brand-limeLight active:scale-95 transition flex items-center justify-center" aria-label="Abrir ruta en Google Maps" title="Abrir ruta en Google Maps"><img src="assets/media/media-2.png" alt="" aria-hidden="true" class="w-6 h-6 sm:w-7 sm:h-7 object-contain"></button></div>
                  </div>
                </div>

                <div class="order-observations order-instructions worker-order-extra mt-2 p-2 rounded-xl text-xs bg-slate-50 border text-slate-700 text-[11px]">
                  <span class="block mb-0.5 font-bold not-italic">Por hacer</span><span class="line-clamp-3 whitespace-pre-line">${this.escapeHtml(orderInstructions || 'Sin instrucciones registradas.')}</span>
                </div>
                ${this.showArchivedTasks ? '<details class="archived-order-extra mt-2"><summary><span>Ver informe y técnico</span><i data-lucide="chevron-down"></i></summary><div class="archived-order-extra-content">' : ''}
                <div class="order-observations order-completed-notes worker-order-extra mt-1.5 p-2 rounded-xl text-xs bg-emerald-50 border border-emerald-100 text-slate-700 text-[11px]">
                  <span class="block mb-0.5 font-bold not-italic text-emerald-800">Realizado</span><span class="order-observations-text line-clamp-3 whitespace-pre-line">${this.escapeHtml(orderObservations || 'Pendiente de registrar.')}</span>
                </div>

                <div class="order-tech-section worker-order-extra mt-2.5 pt-2 border-t text-xs">
                  <span class="text-slate-500 text-[11px] block mb-1.5">Técnico:</span>
                  ${taskIsHiddenFromWorkers
                    ? '<span class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">🔒 No visible para trabajadores</span>'
                    : taskIsFree
                    ? '<span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">🟢 LIBRE · Disponible</span>'
                    : `<div class="flex items-center gap-2"><div onclick="app.zoomWorkerPhoto('${techPhoto}', '${t.assignedTo}')" class="seasonal-worker-avatar cursor-pointer w-9 h-9 rounded-full overflow-hidden bg-slate-200 shrink-0 flex items-center justify-center border-2 border-brand-lime" title="Ampliar foto">${techPhoto ? `<img src="${this.escapeHtml(techPhoto)}" alt="Foto de ${this.escapeHtml(t.assignedTo)}" class="w-full h-full object-cover">` : `<span class="text-xs font-bold">${this.escapeHtml(String(t.assignedTo || '?').charAt(0).toUpperCase())}</span>`}</div><div class="min-w-0"><div class="font-bold text-slate-800 text-[11px]">${this.escapeHtml(t.assignedTo)}</div><span class="presence-label is-${techPresenceStatus}">${techPresenceLabel}</span>${techDetails.length ? `<div class="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-slate-500">${techDetails.map(detail => `<span>${detail}</span>`).join('')}</div>` : ''}</div></div>`}
                </div>

                ${this.showArchivedTasks ? '</div></details>' : ''}
              </div>

              <div class="order-card-actions mt-3 pt-2 border-t flex items-center justify-between gap-1">
                <div class="flex items-center gap-2"><button type="button" onclick="app.viewOrderDetails('${this.escapeHtml(t.id)}')" class="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-brand-dark hover:border-brand-lime flex items-center justify-center" title="Ver orden" aria-label="Ver orden"><i data-lucide="eye" class="w-4 h-4"></i></button>${!isAdmin && isWorker && taskIsFree ? '<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-emerald-700">🟢 LIBRE</span>' : ''}</div>

                <div class="flex items-center gap-1">
                  ${isWorker ? `<button type="button" class="worker-order-expand" onclick="event.stopPropagation(); app.toggleWorkerOrderCard(this)" aria-expanded="false"><i data-lucide="chevron-down" aria-hidden="true"></i><span>Ver detalles</span></button>` : ''}
                  ${!isAdmin && isWorker && taskIsFree
                    ? `<button type="button" onclick="app.takeFreeOrder('${t.id}')" class="worker-order-action worker-order-action--take">✅ Tomar Orden</button>`
                    : `<button type="button" onclick="app.openReportModal('${t.id}')" class="worker-order-action worker-order-action--report">Registrar Informe</button>`}
                  ${!isAdmin && isWorker && !taskIsFree && normalizeWorkerName(t.assignedTo) === normalizeWorkerName(myName) && (t.status === 'PENDIENTE' || t.status === 'NO_REALIZADA')
                    ? `<button type="button" onclick="app.startTaskWork('${this.escapeHtml(t.id)}', this)" class="worker-order-action worker-order-action--start">✅ Iniciar</button>` : ''}
                  ${!isAdmin && isWorker && !taskIsFree && t.claimedFromFree === true && workerClaimIsMine
                    ? `<button type="button" onclick="app.releaseFreeOrder('${this.escapeHtml(t.id)}')" class="worker-order-action worker-order-action--release">Liberar Orden</button>` : ''}

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
            const updatedTasks = storedTasks.map(item => String(item?.id) === String(id) ? { ...item, assignedTo: myName, assignedWorkerId: String(this.currentUser.id || this.users?.find(user => (user.fullName || user.username) === myName)?.id || '') } : item);
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
          this.showToast('No se pudo asignar la orden. Inténtalo nuevamente.', 'error');
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
        document.getElementById('task-address').value = t.address || '';
        document.getElementById('task-administrator').value = t.administrator || t.contact || '';
        this.setTaskClientMode('new');
        this.renderServiceTypeOptions(t.serviceType);
        document.getElementById('task-equipment').value = t.equipment;
        document.getElementById('task-assigned-to').value = this.isTaskHiddenFromWorkers(t) ? 'NO_VISIBLE_WORKERS' : this.isTaskFree(t) ? 'LIBRE' : t.assignedTo;
        this.renderTaskTechnicianMenu();
        document.getElementById('task-priority').value = t.priority;
        document.getElementById('task-date').value = t.date;
        document.getElementById('task-instructions').value = t.instructions || '';
        const depositInput = document.getElementById('task-deposit-amount');
        if (depositInput) depositInput.value = t.depositAmount == null ? '' : String(t.depositAmount);
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
          this.showToast('No se pudo guardar la orden. Inténtalo nuevamente.', 'error');
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
        const depositField = document.getElementById('task-deposit-amount');
        const depositRaw = String(depositField?.value ?? '').trim();
        const enteredDeposit = depositRaw === '' ? null : Number(depositRaw);
        if (depositRaw !== '' && (!Number.isFinite(enteredDeposit) || enteredDeposit < 0)) {
          this.showToast('Escribe un valor de abono válido, igual o mayor que cero.', 'error');
          depositField?.focus();
          return;
        }
        const localDate = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
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
            const previousAssignee = String(this.tasks[index].assignedTo || '').trim();
            this.tasks[index].assignedTo = document.getElementById('task-assigned-to').value;
            this.tasks[index].hiddenFromWorkers = this.tasks[index].assignedTo === 'NO_VISIBLE_WORKERS';
            this.tasks[index].assignedWorkerId = this.getTaskTechnician({ assignedTo: this.tasks[index].assignedTo })?.id || '';
            if (previousAssignee !== String(this.tasks[index].assignedTo || '').trim()) {
              delete this.tasks[index].claimedFromFree;
              delete this.tasks[index].claimedByWorkerId;
              delete this.tasks[index].claimedByWorkerName;
              delete this.tasks[index].assignedAt;
            }
            this.tasks[index].priority = document.getElementById('task-priority').value;
            this.tasks[index].date = document.getElementById('task-date').value;
            this.tasks[index].instructions = document.getElementById('task-instructions').value;
            if (enteredDeposit !== null) {
              const previousDeposit = Math.max(0, Number(this.tasks[index].depositAmount) || 0);
              this.tasks[index].depositAmount = enteredDeposit;
              this.tasks[index].depositDate = enteredDeposit > 0
                ? enteredDeposit === previousDeposit ? (this.tasks[index].depositDate || localDate()) : localDate()
                : null;
            }
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
            hiddenFromWorkers: document.getElementById('task-assigned-to').value === 'NO_VISIBLE_WORKERS',
            assignedWorkerId: this.getTaskTechnician({ assignedTo: document.getElementById('task-assigned-to').value })?.id || '',
            priority: document.getElementById('task-priority').value,
            date: document.getElementById('task-date').value,
            instructions: document.getElementById('task-instructions').value,
            depositAmount: enteredDeposit ?? 0,
            depositDate: (enteredDeposit ?? 0) > 0 ? localDate() : null,
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

      async deleteTask(id) {
        if (this.currentUser.role !== 'admin') return;
        if (!(await this.showSystemConfirm(`¿Eliminar la orden ${id}?`, { title: "Eliminar orden", confirmText: "Eliminar", icon: "trash" }))) return;
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
        if (!window.firebase?.storage) return this.showToast('No está disponible la carga de facturas en este momento.', 'error');

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
          this.showToast('No se pudo adjuntar la factura. Inténtalo nuevamente.', 'error');
        } finally {
          event.target.value = '';
        }
      }

      openReportModal(id) {
        const t = this.tasks.find(x => x.id === id);
        if (!t) return;
        const currentName = this.getCurrentDisplayName();
        if (this.currentUser?.role !== 'admin' && (this.isTaskHiddenFromWorkers(t) || (!this.isTaskFree(t) && t.assignedTo !== currentName))) return;
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
        this.activeReportUrgent = this.currentUser?.role === 'admin' && t.urgent === true;
        const urgentControl = document.getElementById('report-urgent-control');
        const urgentCheckbox = document.getElementById('report-urgent-checkbox');
        if (urgentControl) {
          if (this.currentUser?.role === 'admin') {
            urgentControl.classList.remove('hidden');
            urgentControl.style.display = 'flex';
          } else {
            urgentControl.classList.add('hidden');
            urgentControl.style.removeProperty('display');
          }
        }
        if (urgentCheckbox) urgentCheckbox.checked = this.activeReportUrgent;
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

      setReportUrgent(enabled) {
        if (this.currentUser?.role !== 'admin' || !this.selectedTask) {
          const checkbox = document.getElementById('report-urgent-checkbox');
          if (checkbox) checkbox.checked = this.selectedTask?.urgent === true;
          return this.showToast('Solo el administrador puede cambiar la prioridad urgente.', 'error');
        }
        this.activeReportUrgent = Boolean(enabled);
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
          this.showToast('No se pudieron guardar las evidencias. Inténtalo nuevamente.', 'error');
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
        const isAdmin = this.currentUser?.role === 'admin';
        const taskId = this.selectedTask.id;
        let taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex < 0) return this.showToast('La orden ya no está disponible para guardar.', 'error');
        let previousUrgent = this.tasks[taskIndex].urgent === true;
        let urgencyChanged = isAdmin && this.activeReportUrgent !== previousUrgent;
        if (!this.activeReportStatus && !urgencyChanged) return this.showToast('Selecciona Realizada, Pendiente o En Proceso antes de guardar', 'error');
        if (this.activeReportStatus && (!await this.waitForEvidenceReads() || this.selectedTask?.id !== taskId || !await this.persistLegacyEvidence(taskId))) return;
        taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex < 0) return this.showToast('La orden ya no está disponible para guardar.', 'error');
        previousUrgent = this.tasks[taskIndex].urgent === true;
        urgencyChanged = isAdmin && this.activeReportUrgent !== previousUrgent;
        if (!this.activeReportStatus && !urgencyChanged) return this.showToast('La prioridad de la orden ya cambió. Vuelve a abrirla para confirmar el estado actual.', 'info');
        const observations = document.getElementById('rep-observations').value.trim();

        if (taskIndex !== -1) {
          const wasCompleted = this.tasks[taskIndex].status === 'REALIZADA';
          const nextStatus = this.activeReportStatus || this.tasks[taskIndex].status;
          if (this.activeReportStatus) {
            this.tasks[taskIndex].status = nextStatus;
            this.tasks[taskIndex].observations = observations;
            this.tasks[taskIndex].evidence = this.currentReportEvidence;
          }
          if (isAdmin) {
            if (this.activeReportUrgent) this.tasks[taskIndex].urgent = true;
            else delete this.tasks[taskIndex].urgent;
          }
          if (this.activeReportStatus) {
            this.tasks[taskIndex].completedAt = this.formatFullDateTime(new Date());
            if (nextStatus === 'REALIZADA') {
              if (!wasCompleted || !this.tasks[taskIndex].completedAtMs) this.tasks[taskIndex].completedAtMs = Date.now();
              this.tasks[taskIndex].paymentDueAt = this.tasks[taskIndex].completedAtMs + 30 * 86400000;
            } else if (wasCompleted) {
              this.tasks[taskIndex].completedAtMs = null;
              this.tasks[taskIndex].paymentDueAt = null;
            }
          }

          if (this.activeReportStatus) {
            const myName = this.getCurrentDisplayName();
            this.addActivityNotification(myName, this.selectedTask.id, this.activeReportStatus, observations, 'order');
          }

          console.info('[ORDER] URL guardada: enviando a Firestore', { taskId, cantidad: this.currentReportEvidence.length, urls: this.currentReportEvidence.map(item => item?.url || item?.src || null) });
          const saved = await this.saveTasks(true);
          if (!saved?.ok) {
            if (this.currentUser?.role === 'admin') {
              if (previousUrgent) this.tasks[taskIndex].urgent = true;
              else delete this.tasks[taskIndex].urgent;
            }
            return;
          }
          console.info('[ORDER] URL guardada en Firestore', { taskId, cantidad: this.tasks[taskIndex].evidence?.length || 0, urls: (this.tasks[taskIndex].evidence || []).map(item => item?.url || item?.src || null), persistencia: saved.localOnly ? 'solo-local' : 'Firestore' });
          await this.deleteRemovedEvidenceFiles();
          this.updateStats();
          this.renderTasks();
          this.closeReportModal();
          this.showToast(this.activeReportStatus ? 'Informe guardado con éxito' : 'Prioridad urgente actualizada.', 'success');
        }
      }

      setTaskInProgress() {
        this.setReportStatus('EN_PROCESO');
      }

      async startTaskWork(id, buttonElement) {
        const taskId = String(id || '');
        const workerName = this.getCurrentDisplayName();
        const taskIndex = this.tasks.findIndex(task => String(task.id) === String(taskId));
        const button = buttonElement;
        const roleLabel = String(this.currentUser?.role || this.currentUser?.rol || this.currentUser?.userType || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
        const isWorker = roleLabel === 'worker' || roleLabel.includes('trabajador') || roleLabel.includes('tecnico') || roleLabel.includes('technician');
        const normalizeWorkerName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
        if (!isWorker) {
          this.showToast('Esta acción está disponible únicamente para trabajadores.', 'error');
          return false;
        }
        if (taskIndex < 0 || this.isTaskFree(this.tasks[taskIndex]) || normalizeWorkerName(this.tasks[taskIndex].assignedTo) !== normalizeWorkerName(workerName)) {
          this.showToast('Solo puedes iniciar una orden asignada a tu usuario.', 'error');
          return false;
        }
        const task = this.tasks[taskIndex];
        if (task.status === 'EN_PROCESO') return true;
        if (task.status !== 'PENDIENTE' && task.status !== 'NO_REALIZADA') {
          this.showToast('Esta orden no se puede iniciar en su estado actual.', 'error');
          return false;
        }
        const previousStatus = task.status;
        const previousWorkStarted = {
          workStarted: task.workStarted,
          workStartedAt: task.workStartedAt,
          workStartedBy: task.workStartedBy,
          workStartedByName: task.workStartedByName
        };
        task.status = 'EN_PROCESO';
        task.workStarted = true;
        task.workStartedAt = new Date().toISOString();
        task.workStartedBy = String(this.currentUser?.id || '');
        task.workStartedByName = workerName;
        if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
        const saved = await this.saveTasks(true);
        if (!saved?.ok) {
          task.status = previousStatus;
          for (const [field, value] of Object.entries(previousWorkStarted)) {
            if (value === undefined) delete task[field]; else task[field] = value;
          }
          SafeStorage.setItem('portonpro_tasks_v4', JSON.stringify(this.tasks));
          if (button) { button.disabled = false; button.textContent = '✅ Iniciar'; }
          return false;
        }
        this.updateStats();
        this.renderTasks();
        this.showToast('Orden iniciada. El estado cambió a En Proceso.', 'success');
        return true;
      }

      handleUploadEvidence(e) {
        const files = Array.from(e.target.files || []);
        const taskId = this.selectedTask?.id;
        if (!files.length || !taskId) return;
        if (!window.firebase?.storage) {
          this.showToast('No está disponible la carga de evidencias en este momento.', 'error');
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
            this.showToast(`No se pudo adjuntar ${file.name}. Inténtalo nuevamente.`, 'error');
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
        if (this.currentUser?.role !== 'admin' && (this.isTaskHiddenFromWorkers(t) || (!this.isTaskFree(t) && t.assignedTo !== myName))) return;
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
        document.getElementById('view-technician').textContent = this.isTaskHiddenFromWorkers(t) ? 'No visible para trabajadores' : t.assignedTo || '—';
        document.getElementById('view-completed-at').textContent = `Fecha del trabajo: ${t.date || '—'}` + (t.completedAt ? ` · Realizada: ${t.completedAt}` : '');
        document.getElementById('view-observations').textContent = t.observations || 'No se registraron observaciones del trabajo realizado.';

        const badge = document.getElementById('view-order-badge');
        const statusLabels = { PENDIENTE: '⏳ Pendiente', EN_PROCESO: 'En proceso', REALIZADA: 'Realizada', NO_REALIZADA: '⏳ Pendiente' };
        badge.textContent = statusLabels[t.status] || t.status || 'Pendiente';
        const badgeStyles = { PENDIENTE: 'bg-rose-100 text-rose-800', EN_PROCESO: 'bg-blue-100 text-blue-800', REALIZADA: 'bg-emerald-100 text-emerald-800', NO_REALIZADA: 'bg-rose-100 text-rose-800' };
        badge.className = `px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${badgeStyles[t.status] || 'bg-slate-100 text-slate-700'}`;

        const technician = this.getTaskTechnician(t);
        const avatar = document.getElementById('view-technician-avatar');
        avatar.innerHTML = this.isTaskHiddenFromWorkers(t) ? '🔒' : technician?.photo ? `<img src="${this.escapeHtml(technician.photo)}" alt="" class="w-full h-full object-cover">` : this.escapeHtml((t.assignedTo || '?').charAt(0).toUpperCase());

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
        if (this.isTaskHiddenFromWorkers(task) || (!this.isTaskFree(task) && task.assignedTo !== this.getCurrentDisplayName())) return;
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
      // Expose the singleton to auxiliary modules that initialize through window.app.
      window.app = app;
    });

