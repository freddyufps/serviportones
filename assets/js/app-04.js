
            (() => {
              const video = document.querySelector('#login-brand-logo .login-animated-logo');
              const button = document.getElementById('login-video-audio-toggle');
              if (!video || !button) return;
              const icon = (muted) => muted
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m17 9 5 6m0-6-5 6"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/></svg>';
              const updateButton = () => {
                button.innerHTML = icon(video.muted);
                button.setAttribute('aria-label', video.muted ? 'Activar sonido del video' : 'Silenciar video');
                button.setAttribute('title', video.muted ? 'Activar sonido' : 'Silenciar');
                button.setAttribute('aria-pressed', String(!video.muted));
                button.style.display = 'grid';
              };
              video.volume = 0.7;
              video.muted = true;
              let userChoseAudio = false;
              let loginScreenActive = true;
              let unlockListenerActive = false;
              const startVideo = () => {
                if (!loginScreenActive) return;
                video.muted = true;
                video.play().then(updateButton).catch(() => {
                  video.muted = true;
                  updateButton();
                  video.play().catch(() => {});
                });
              };
              const unlockAudioFromPageGesture = (event) => {
                if (!loginScreenActive || userChoseAudio || (event.target instanceof Element && event.target.closest('#login-video-audio-toggle')) || !video.muted) return;
                video.muted = false;
                video.play().then(() => {
                  updateButton();
                  document.removeEventListener('pointerdown', unlockAudioFromPageGesture);
                  unlockListenerActive = false;
                }).catch(() => { video.muted = true; updateButton(); });
              };
              const attachUnlockListener = () => {
                if (unlockListenerActive) return;
                document.addEventListener('pointerdown', unlockAudioFromPageGesture);
                unlockListenerActive = true;
              };
              attachUnlockListener();
              window.stopLoginBrandVideo = () => {
                loginScreenActive = false;
                document.removeEventListener('pointerdown', unlockAudioFromPageGesture);
                unlockListenerActive = false;
                video.pause();
                video.muted = true;
                updateButton();
              };
              window.resumeLoginBrandVideo = () => {
                loginScreenActive = true;
                attachUnlockListener();
                startVideo();
              };
              button.addEventListener('click', async () => {
                if (!loginScreenActive) return;
                userChoseAudio = true;
                video.muted = !video.muted;
                try { await video.play(); } catch (error) { video.muted = true; }
                updateButton();
              });
              if (video.readyState >= 2) startVideo();
              else video.addEventListener('canplay', startVideo, { once: true });
            })();

// El video del login comienza siempre silenciado; el usuario decide cuándo habilitar el audio.

