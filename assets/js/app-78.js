/* Mantiene una sola composición A4 en la vista previa de cotizaciones. */
(function () {
  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;
  let content;
  let resizeObserver;
  let mutationObserver;
  let layoutQueued = false;

  // Reutiliza el mismo trazado de canvas que usa el encabezado de Informes.
  // Así la diagonal queda idéntica en la vista previa y en la captura del PDF.
  function drawQuoteBanner(documentNode) {
    const banners = documentNode?.querySelectorAll('.quote-report-black-banner');
    if (!banners?.length) return;
    banners.forEach(banner => {
      let shape = banner.querySelector('.quote-report-black-banner-shape');
      if (!shape) {
        shape = document.createElement('canvas');
        shape.className = 'quote-report-black-banner-shape';
        shape.setAttribute('aria-hidden', 'true');
        banner.prepend(shape);
      }
      const width = banner.clientWidth;
      const height = banner.clientHeight;
      if (!width || !height) return;
      const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      shape.width = Math.round(width * ratio);
      shape.height = Math.round(height * ratio);
      const context = shape.getContext('2d');
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#050505';
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(width, 0);
      context.lineTo(width, height);
      context.lineTo(width * 0.17, height);
      context.closePath();
      context.fill();
    });
  }

  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      layoutPreview();
    });
  }

  function layoutPreview() {
    content = document.getElementById('quote-preview-content');
    const documentNode = content?.querySelector('.quote-document');
    if (!content || !documentNode) return;

    let frame = documentNode.closest('.quote-a4-frame');
    if (!frame) {
      frame = document.createElement('div');
      frame.className = 'quote-a4-frame';
      documentNode.parentNode.insertBefore(frame, documentNode);
      frame.appendChild(documentNode);
    }

    const styles = getComputedStyle(content);
    const availableWidth = Math.max(1, content.clientWidth -
      parseFloat(styles.paddingLeft || 0) - parseFloat(styles.paddingRight || 0));
    const scale = Math.min(1, availableWidth / PAGE_WIDTH);
    const pageHeight = Math.max(PAGE_HEIGHT, documentNode.scrollHeight);

    frame.style.width = `${PAGE_WIDTH * scale}px`;
    frame.style.height = `${pageHeight * scale}px`;
    documentNode.style.transform = `scale(${scale})`;
    documentNode.dataset.quoteA4Scale = String(scale);
    drawQuoteBanner(documentNode);
  }

  function install() {
    if (!window.app?.__quoteModule || app.__quoteA4Preview78) return false;
    const original = app.showQuotePreview;
    if (typeof original !== 'function') return false;

    app.__quoteA4Preview78 = true;
    app.showQuotePreview = function (...args) {
      const result = original.apply(this, args);
      queueLayout();
      return result;
    };

    content = document.getElementById('quote-preview-content');
    if (content && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(queueLayout);
      resizeObserver.observe(content);
    }
    if (content && 'MutationObserver' in window) {
      mutationObserver = new MutationObserver(queueLayout);
      mutationObserver.observe(content, { childList: true, subtree: true });
    }
    window.addEventListener('resize', queueLayout, { passive: true });
    queueLayout();
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 300) window.clearInterval(timer);
  }, 50);
})();
