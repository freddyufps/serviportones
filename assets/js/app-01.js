
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
          }
        }
      } catch (error) {}
    })();
  