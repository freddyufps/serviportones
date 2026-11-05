
    (() => {
      // Aplicar el tema guardado antes de que el CSS pinte la pantalla de carga.
      try {
        const theme = localStorage.getItem('serviportones_visual_theme');
        if (['classic', 'christmas', 'easter', 'holy-week', 'halloween'].includes(theme)) {
          document.documentElement.dataset.seasonalTheme = theme;
        }
      } catch (error) {}
      // Keep the login screen available while a saved session is validated.
      // A pending network request must never hide the whole application.
    })();
  
