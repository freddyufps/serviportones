(() => {
  'use strict';

  const mobileTiles = window.matchMedia('(max-width: 540px)');
  let assignTileAnchor = null;
  let quoteTileAnchor = null;
  let reportTileAnchor = null;
  let actionGroup = null;

  const syncCreateActionGroup = () => {
    const quote = document.getElementById('btn-create-quote');
    const report = document.getElementById('btn-create-report');
    const assign = document.getElementById('btn-assign-order-filter');
    const controls = document.querySelector('#orders-toolbar .orders-filter-controls');
    const nav = document.getElementById('orders-view-navigation');
    if (!quote || !report || !assign || !controls || !nav) return;

    if (mobileTiles.matches) {
      if (!assignTileAnchor && assign.parentNode) {
        assignTileAnchor = document.createComment('assign-order-toolbar-position');
        assign.parentNode.insertBefore(assignTileAnchor, assign);
      }
      if (!quoteTileAnchor && quote.parentNode) {
        quoteTileAnchor = document.createComment('crear-cotizacion-toolbar-position');
        quote.parentNode.insertBefore(quoteTileAnchor, quote);
      }
      if (!reportTileAnchor && report.parentNode) {
        reportTileAnchor = document.createComment('realizar-informe-toolbar-position');
        report.parentNode.insertBefore(reportTileAnchor, report);
      }
      if (!actionGroup) {
        actionGroup = document.createElement('div');
        actionGroup.className = 'orders-create-actions-group';
      }
      if (actionGroup.parentNode !== controls) controls.insertBefore(actionGroup, assignTileAnchor);
      if (assign.parentNode !== actionGroup || quote.parentNode !== actionGroup || report.parentNode !== actionGroup) actionGroup.append(assign, quote, report);
      return;
    }

    if (assignTileAnchor?.parentNode) {
      assignTileAnchor.parentNode.insertBefore(assign, assignTileAnchor);
      assignTileAnchor.remove();
      assignTileAnchor = null;
    }
    if (quoteTileAnchor?.parentNode) {
      quoteTileAnchor.parentNode.insertBefore(quote, quoteTileAnchor);
      quoteTileAnchor.remove();
      quoteTileAnchor = null;
    }
    if (reportTileAnchor?.parentNode) {
      reportTileAnchor.parentNode.insertBefore(report, reportTileAnchor);
      reportTileAnchor.remove();
      reportTileAnchor = null;
    }
    actionGroup?.remove();
    actionGroup = null;
  };

  let mobilePageLock = null;
  const saveInlineStyles = (element, properties) => Object.fromEntries(properties.map(property => [
    property,
    [element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]
  ]));
  const restoreInlineStyles = (element, styles) => Object.entries(styles).forEach(([property, [value, priority]]) => {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  });

  const syncChatBackgroundLock = () => {
    const chatOpen = !document.getElementById('chat-window-modal')?.classList.contains('hidden');
    const mobile = window.matchMedia('(max-width: 639px)').matches;
    const root = document.documentElement;
    const body = document.body;

    if (mobile && chatOpen && !mobilePageLock) {
      const scrollY = window.scrollY || root.scrollTop || body.scrollTop || 0;
      const rootProperties = ['overflow', 'overscroll-behavior'];
      const bodyProperties = ['position', 'top', 'left', 'right', 'width', 'overflow', 'overscroll-behavior'];
      mobilePageLock = {
        scrollY,
        rootStyles: saveInlineStyles(root, rootProperties),
        bodyStyles: saveInlineStyles(body, bodyProperties)
      };
      root.classList.add('mobile-chat-background-locked');
      body.classList.add('mobile-chat-background-locked');
      root.style.setProperty('overflow', 'hidden', 'important');
      root.style.setProperty('overscroll-behavior', 'none', 'important');
      body.style.setProperty('position', 'fixed', 'important');
      body.style.setProperty('top', `${-scrollY}px`, 'important');
      body.style.setProperty('left', '0', 'important');
      body.style.setProperty('right', '0', 'important');
      body.style.setProperty('width', '100%', 'important');
      body.style.setProperty('overflow', 'hidden', 'important');
      body.style.setProperty('overscroll-behavior', 'none', 'important');
      return;
    }

    if (mobilePageLock && (!mobile || !chatOpen)) {
      const saved = mobilePageLock;
      mobilePageLock = null;
      root.classList.remove('mobile-chat-background-locked');
      body.classList.remove('mobile-chat-background-locked');
      restoreInlineStyles(root, saved.rootStyles);
      restoreInlineStyles(body, saved.bodyStyles);
      window.scrollTo(0, saved.scrollY);
    }
  };

  const syncViewport = () => {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const offsetTop = viewport?.offsetTop || 0;
    const keyboardHeight = Math.max(0, window.innerHeight - height - offsetTop);
    const mobile = window.matchMedia('(max-width: 639px)').matches;
    const keyboardOpen = mobile && keyboardHeight > 110;
    const root = document.documentElement;

    root.style.setProperty('--app-visual-viewport-height', `${height}px`);
    root.style.setProperty('--app-visual-viewport-offset-top', `${offsetTop}px`);
    root.style.setProperty('--app-mobile-keyboard-height', `${keyboardHeight}px`);
    document.body.classList.toggle('mobile-keyboard-open', keyboardOpen);
    syncChatBackgroundLock();

    const launcher = document.getElementById('chat-floating-button-container');
    const chat = document.getElementById('chat-window-modal');
    if (!mobile) {
      [launcher, chat].filter(Boolean).forEach(element => {
        ['position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-height', 'max-height', 'z-index']
          .forEach(property => element.style.removeProperty(property));
      });
      return;
    }

    const safeBottom = 'env(safe-area-inset-bottom, 0px)';
    if (launcher) {
      launcher.style.setProperty('position', 'fixed', 'important');
      launcher.style.setProperty('top', 'auto', 'important');
      launcher.style.setProperty('right', '12px', 'important');
      launcher.style.setProperty('bottom', `calc(${keyboardHeight}px + ${safeBottom} + 12px)`, 'important');
      launcher.style.setProperty('left', 'auto', 'important');
      launcher.style.setProperty('z-index', '2147483005', 'important');
    }
    if (chat) {
      const launcherHeight = Math.ceil(
        launcher?.getBoundingClientRect().height ||
        launcher?.querySelector('button')?.getBoundingClientRect().height ||
        48
      );
      const closedKeyboardGap = launcherHeight + 20;
      chat.style.setProperty('position', 'fixed', 'important');
      chat.style.setProperty('right', '0', 'important');
      chat.style.setProperty('left', '0', 'important');
      chat.style.setProperty('width', '100vw', 'important');
      chat.style.setProperty('min-height', '0', 'important');
      chat.style.setProperty('z-index', '2147483004', 'important');
      if (keyboardOpen) {
        // Preserve the current above-keyboard geometry while the keyboard is visible.
        chat.style.setProperty('top', `${offsetTop}px`, 'important');
        chat.style.setProperty('bottom', `calc(${keyboardHeight}px + ${safeBottom} + 82px)`, 'important');
        chat.style.setProperty('height', 'auto', 'important');
        chat.style.setProperty('max-height', `min(620px, ${Math.max(180, height - 82)}px)`, 'important');
      } else {
        // With the keyboard closed, anchor the window just above the launcher
        // and let it grow upward instead of leaving a tall empty gap underneath.
        const closedWindowBottom = `calc(${keyboardHeight}px + ${safeBottom} + ${closedKeyboardGap}px)`;
        const closedWindowHeight = `min(620px, max(180px, calc(var(--app-visual-viewport-height, 100dvh) - ${closedKeyboardGap + 12}px - ${safeBottom})))`;
        chat.style.setProperty('top', 'auto', 'important');
        chat.style.setProperty('bottom', closedWindowBottom, 'important');
        chat.style.setProperty('height', closedWindowHeight, 'important');
        chat.style.setProperty('max-height', closedWindowHeight, 'important');
      }
    }
  };

  const start = () => {
    document.querySelectorAll('img[data-fallback-src]').forEach(image => {
      if (image.dataset.fallbackBound) return;
      image.dataset.fallbackBound = '1';
      image.addEventListener('error', () => {
        image.src = image.dataset.fallbackSrc;
      }, { once: true });
    });
    syncCreateActionGroup();
    if (mobileTiles.addEventListener) mobileTiles.addEventListener('change', syncCreateActionGroup);
    else mobileTiles.addListener?.(syncCreateActionGroup);
    new MutationObserver(syncCreateActionGroup).observe(document.body, { childList: true, subtree: true });
    const chatModal = document.getElementById('chat-window-modal');
    if (chatModal) new MutationObserver(syncChatBackgroundLock).observe(chatModal, { attributes: true, attributeFilter: ['class'] });

    const blockBackgroundMotion = event => {
      if (!mobilePageLock) return;
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (target?.closest('#chat-messages-container, #chat-conversation-area, #chat-sidebar, .messenger-window-messages')) return;
      event.preventDefault();
    };
    document.addEventListener('touchmove', blockBackgroundMotion, { capture: true, passive: false });
    document.addEventListener('wheel', blockBackgroundMotion, { capture: true, passive: false });

    let frame = 0;
    const scheduleViewportSync = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        syncViewport();
      });
    };

    window.visualViewport?.addEventListener('resize', scheduleViewportSync, { passive: true });
    window.visualViewport?.addEventListener('scroll', scheduleViewportSync, { passive: true });
    window.addEventListener('resize', scheduleViewportSync, { passive: true });
    document.addEventListener('focusin', event => {
      if (!event.target.matches?.('#chat-input-text, .messenger-window-form input[type="text"]')) return;
      scheduleViewportSync();
      window.setTimeout(scheduleViewportSync, 180);
      window.setTimeout(scheduleViewportSync, 360);
      window.setTimeout(scheduleViewportSync, 700);
    });
    // app-47 calls this again after login and dashboard navigation. Its initial
    // call already installed the viewport handlers, so prevent accumulating a
    // second copy of the resize/scroll listeners on every return to the panel.
    const app = window.app;
    if (app && typeof app.initMobileChatFix === 'function' && !app.__mobileChatFixOnce66) {
      const originalInit = app.initMobileChatFix;
      app.initMobileChatFix = function (...args) {
        if (this.__mobileChatFixOnce66) {
          syncViewport();
          return;
        }
        this.__mobileChatFixOnce66 = true;
        return originalInit.apply(this, args);
      };
      app.__mobileChatFixOnce66 = true;
    }
    syncViewport();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
