/* Sugerencias táctiles de contactos para formularios en móvil/PWA. */
(() => {
  'use strict';
  const mobile = window.matchMedia('(max-width: 700px)');
  let activeInput = null;
  let activeIndex = -1;
  let closeTimer = 0;
  let popup;

  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const isContactInput = input => input instanceof HTMLInputElement && (
    input.matches('#task-client, #task-client-search, #technical-report-client, #quote-form input[list="q-clients"], #quote-form input[list="q-condos"], #quote-form input[list="q-addresses"]')
  );
  const getSuggestions = input => {
    const directory = (window.app?.clientDirectory || []).flatMap(client => [client?.name, client?.condo]).filter(Boolean);
    if (input.id === 'task-client-search') return [...directory, ...(window.app?.getRegisteredTaskClients?.() || []).map(client => client?.name).filter(Boolean)];
    const listId = input.getAttribute('list');
    const list = listId && document.getElementById(listId);
    const options = list ? [...list.options].map(option => option.value).filter(Boolean) : [];
    return input.id === 'technical-report-client' ? [...options, ...directory] : options;
  };
  const ensurePopup = () => {
    if (popup) return popup;
    popup = document.createElement('div');
    popup.id = 'mobile-contact-suggestions';
    popup.className = 'mobile-contact-suggestions';
    popup.setAttribute('role', 'listbox');
    popup.hidden = true;
    document.body.appendChild(popup);
    popup.addEventListener('pointerdown', event => {
      const option = event.target.closest('[role="option"]');
      if (!option || !activeInput) return;
      event.preventDefault();
      choose(option.dataset.value);
    });
    return popup;
  };
  const positionPopup = () => {
    if (!activeInput || !popup || popup.hidden) return;
    const rect = activeInput.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const viewportTop = window.visualViewport?.offsetTop || 0;
    const spaceBelow = viewportTop + viewportHeight - rect.bottom;
    const maxHeight = Math.min(260, Math.max(120, viewportHeight * 0.38));
    popup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))}px`;
    popup.style.width = `${Math.min(rect.width, window.innerWidth - 16)}px`;
    popup.style.maxHeight = `${maxHeight}px`;
    popup.style.top = spaceBelow < Math.min(maxHeight, 180)
      ? `${Math.max(viewportTop + 8, rect.top - Math.min(maxHeight, popup.scrollHeight || maxHeight) - 6)}px`
      : `${rect.bottom + 5}px`;
  };
  const render = input => {
    if (!mobile.matches || !isContactInput(input) || !input.isConnected) return close();
    const source = getSuggestions(input);
    const query = normalize(input.value);
    const matches = [...new Set(source)].filter(value => !query || normalize(value).includes(query)).slice(0, 30);
    if (!matches.length) return close();
    activeInput = input;
    activeIndex = -1;
    const target = ensurePopup();
    target.innerHTML = matches.map((value, index) => `<button type="button" role="option" aria-selected="false" data-index="${index}" data-value="${escape(value)}">${escape(value)}</button>`).join('');
    target.hidden = false;
    positionPopup();
  };
  const close = () => {
    if (popup) popup.hidden = true;
    activeInput = null;
    activeIndex = -1;
  };
  const choose = value => {
    const input = activeInput;
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (input.id === 'task-client-search') window.app?.selectSavedTaskClient?.(value);
    close();
  };
  const setActive = index => {
    if (!popup || popup.hidden) return;
    const options = [...popup.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    activeIndex = (index + options.length) % options.length;
    options.forEach((option, position) => {
      option.setAttribute('aria-selected', String(position === activeIndex));
      if (position === activeIndex) option.scrollIntoView({ block: 'nearest' });
    });
  };

  document.addEventListener('focusin', event => {
    if (!mobile.matches || !isContactInput(event.target)) return;
    clearTimeout(closeTimer);
    render(event.target);
  });
  document.addEventListener('input', event => {
    if (mobile.matches && isContactInput(event.target)) render(event.target);
  });
  document.addEventListener('keydown', event => {
    if (!mobile.matches || !isContactInput(event.target)) return;
    if (event.key === 'ArrowDown' && popup && !popup.hidden) { event.preventDefault(); setActive(activeIndex + 1); }
    else if (event.key === 'ArrowUp' && popup && !popup.hidden) { event.preventDefault(); setActive(activeIndex < 0 ? popup.children.length - 1 : activeIndex - 1); }
    else if (event.key === 'Enter' && popup && !popup.hidden && activeIndex >= 0) { event.preventDefault(); choose(popup.children[activeIndex]?.dataset.value || ''); }
    else if (event.key === 'Escape') close();
  });
  document.addEventListener('focusout', event => {
    if (!isContactInput(event.target)) return;
    closeTimer = window.setTimeout(() => {
      if (!popup?.contains(document.activeElement)) close();
    }, 180);
  });
  document.addEventListener('pointerdown', event => {
    if (popup && !popup.hidden && !popup.contains(event.target) && event.target !== activeInput) close();
  });
  window.addEventListener('resize', positionPopup, { passive: true });
  window.addEventListener('scroll', positionPopup, { passive: true, capture: true });
  window.visualViewport?.addEventListener('resize', positionPopup, { passive: true });
  mobile.addEventListener?.('change', event => { if (!event.matches) close(); });
})();
