
    (() => {
      // Aplicar el tema guardado antes de que el CSS pinte la pantalla de carga.
      try {
        const theme = localStorage.getItem('serviportones_visual_theme');
        if (['classic', 'christmas', 'easter', 'holy-week', 'halloween'].includes(theme)) {
          document.documentElement.dataset.seasonalTheme = theme;
        }
      } catch (error) {}
      // Show the branded restore screen only when a saved session needs validation.
      const savedSession = localStorage.getItem('portonpro_session_v4');
      if (savedSession) {
        const root = document.documentElement;
        root.classList.add('auth-session-pending');
        // The app's own validation timeout is shorter; this is a final fallback
        // in case the main application script fails before it can show login.
        window.setTimeout(() => {
          if (!root.classList.contains('auth-session-pending')) return;
          root.classList.remove('auth-session-pending');
          document.getElementById('view-login')?.classList.remove('hidden');
          document.getElementById('view-dashboard')?.classList.add('hidden');
        }, 18000);
      }
    })();
  
