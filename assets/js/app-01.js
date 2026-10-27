
    (() => {
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
  