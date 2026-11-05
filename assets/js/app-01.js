
    (() => {
      // Aplicar el tema guardado antes de que el CSS pinte la pantalla de carga.
      try {
        const theme = localStorage.getItem('serviportones_visual_theme');
        if (['classic', 'christmas', 'easter', 'holy-week', 'halloween'].includes(theme)) {
          document.documentElement.dataset.seasonalTheme = theme;
        }
      } catch (error) {}
      try {
        const raw = localStorage.getItem('portonpro_session_v4') || sessionStorage.getItem('portonpro_session_v4');
        if (raw) {
          const session = JSON.parse(raw);
          if (session && typeof session === 'object' && session.username && session.role) {
            document.documentElement.classList.add('auth-session-pending');
            // Emergency recovery independent from the app bundle: if a script
            // fails before DOMContentLoaded or the session request never settles,
            // never leave the user trapped behind the restore splash.
            window.setTimeout(() => {
              if (!document.documentElement.classList.contains('auth-session-pending')) return;
              document.documentElement.classList.remove('auth-session-pending');
              try { localStorage.removeItem('portonpro_session_v4'); } catch (error) {}
              try { sessionStorage.removeItem('portonpro_session_v4'); } catch (error) {}
              document.body?.classList.add('seasonal-login-visible');
              document.getElementById('view-login')?.classList.remove('hidden');
              document.getElementById('view-dashboard')?.classList.add('hidden');
              const alert = document.getElementById('login-error-alert');
              const text = document.getElementById('login-error-text');
              if (text) text.textContent = 'No fue posible restaurar la sesión. Inicia sesión nuevamente.';
              alert?.classList.remove('hidden');
            }, 15000);
          }
        }
      } catch (error) {}
    })();
  
