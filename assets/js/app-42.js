(() => {
  const root = document.documentElement;
  const isMobile = () => window.matchMedia('(max-width: 639px)').matches;

  const syncVisibleChatViewport = () => {
    const viewport = window.visualViewport;
    const visibleHeight = viewport?.height || window.innerHeight;
    const offsetTop = viewport?.offsetTop || 0;
    root.style.setProperty('--app-visual-viewport-height', `${visibleHeight}px`);
    root.style.setProperty('--app-visual-viewport-offset-top', `${offsetTop}px`);
    const keyboardOpen = isMobile() && window.innerHeight - visibleHeight > 110;
    document.body.classList.toggle('mobile-keyboard-open', keyboardOpen);
  };

  const markChatFieldsAsPlainText = (scope = document) => {
    const fields = scope.querySelectorAll?.('#chat-input-text, .messenger-window-form input[type="text"]') || [];
    fields.forEach((field) => {
      field.setAttribute('name', field.closest('.messenger-window-form') ? 'chat-message' : 'chat-message');
      field.setAttribute('autocomplete', 'off');
      field.setAttribute('autocorrect', 'off');
      field.setAttribute('autocapitalize', 'sentences');
      field.setAttribute('spellcheck', 'false');
      field.setAttribute('inputmode', 'text');
      field.setAttribute('enterkeyhint', 'send');
      field.setAttribute('data-lpignore', 'true');
      field.setAttribute('data-1p-ignore', 'true');
    });
  };

  syncVisibleChatViewport();
  markChatFieldsAsPlainText();
  window.visualViewport?.addEventListener('resize', syncVisibleChatViewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncVisibleChatViewport, { passive: true });
  window.addEventListener('resize', syncVisibleChatViewport, { passive: true });
  document.addEventListener('focusin', (event) => {
    if (!event.target.matches?.('#chat-input-text, .messenger-window-form input[type="text"]')) return;
    markChatFieldsAsPlainText(event.target.parentElement || document);
    window.setTimeout(syncVisibleChatViewport, 80);
  });

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) markChatFieldsAsPlainText(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
