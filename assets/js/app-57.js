(() => {
  'use strict';
  const install = () => {
    const app = window.app, proto = app?.constructor?.prototype;
    if (!app || !proto || !app.__quoteModule44 || app.__quoteArchiveSummary57) return false;
    app.__quoteArchiveSummary57 = true;

    const originalMarkup = proto.quoteArchiveMarkup;
    // Keep destinations exclusive: the quote archive temporarily uses the task host.
    // Remove its transient markup before showing invoices so it cannot remain underneath.
    const originalRenderTasks = proto.renderTasks;
    if (typeof originalRenderTasks === 'function' && !originalRenderTasks.__exclusiveDestinations57) {
      const renderTasks = function (...args) {
        const isInvoices = Boolean(this.showDocumentControl);
        const isClients = Boolean(this.clientsDirectoryOpen);
        const isQuotes = Boolean(this.quoteArchiveInlineOpen);
        if (isInvoices) {
          this.quoteArchiveInlineOpen = false;
          this.clientsDirectoryOpen = false;
          this.showArchivedTasks = false;
          document.getElementById('clients-directory')?.remove();
          const taskHost = document.getElementById('tasks-container');
          if (taskHost) {
            // The archive and client directory are temporary destinations rendered in this host.
            // Clear it before the invoice renderer hides it, so no previous module can remain below.
            taskHost.replaceChildren();
            taskHost.style.removeProperty('display');
            taskHost.style.removeProperty('width');
            taskHost.style.removeProperty('grid-template-columns');
          }
        } else if (isClients || isQuotes) {
          this.showDocumentControl = false;
          document.getElementById('archived-documents-panel')?.classList.add('hidden');
          if (isClients) this.quoteArchiveInlineOpen = false;
          if (isQuotes) {
            this.clientsDirectoryOpen = false;
            document.getElementById('clients-directory')?.remove();
          }
        }
        return originalRenderTasks.apply(this, args);
      };
      renderTasks.__exclusiveDestinations57 = true;
      proto.renderTasks = renderTasks;
    }

    // Focus synchronously to preserve the mobile keyboard, then restore it after send/render.
    const keepComposerFocused = (method, findInput) => {
      const original = proto[method];
      if (typeof original !== 'function' || original.__keepComposerFocused57) return;
      const wrapped = function (event, ...args) {
        const form = event?.currentTarget;
        const input = findInput(form, args);
        const hadText = Boolean(String(input?.value || '').trim());
        const focus = () => {
          if (!hadText) return;
          const current = input?.isConnected ? input : findInput(form, args);
          if (!current?.isConnected) return;
          try {
            current.focus({ preventScroll: true });
            const end = current.value.length;
            current.setSelectionRange?.(end, end);
          } catch (_) { /* Selection ranges are not supported by every mobile browser. */ }
        };
        const result = original.call(this, event, ...args);
        focus();
        if (result && typeof result.finally === 'function') result.finally(() => {
          focus();
          if (window.requestAnimationFrame) window.requestAnimationFrame(focus); else setTimeout(focus, 0);
          setTimeout(focus, 80);
        });
        return result;
      };
      wrapped.__keepComposerFocused57 = true;
      proto[method] = wrapped;
    };
    keepComposerFocused('handleSendMessage', form => form?.querySelector('#chat-input-text, input[type="text"]') || document.getElementById('chat-input-text'));
    keepComposerFocused('handleMessengerWindowSend', (form, args) => {
      const worker = args[0] || form?.dataset?.chatWorker;
      return form?.querySelector('input[type="text"]') || Array.from(document.querySelectorAll('#chat-desktop-chat-cells .messenger-window-form')).find(item => item.dataset.chatWorker === worker)?.querySelector('input[type="text"]');
    });
    if (typeof originalMarkup === 'function') proto.quoteArchiveMarkup = function (...args) {
      const markup = originalMarkup.apply(this, args);
      const quotes = Array.isArray(this.quotes) ? this.quotes : [];
      const total = quotes.reduce((sum, quote) => sum + (Number(quote?.total) || 0), 0);
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const thisMonth = quotes.filter(quote => String(quote?.date || '').startsWith(month)).length;
      const currency = new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
      }).format(total);
      const summary = `<section class="quote-archive-summary" aria-label="Resumen de cotizaciones">
        <article><span>Cotizaciones registradas</span><strong>${quotes.length}</strong></article>
        <article><span>Valor cotizado</span><strong>${currency}</strong></article>
        <article><span>Emitidas este mes</span><strong>${thisMonth}</strong></article>
      </section>`;
      return markup.replace('<div class="quotes-filters">', `${summary}<div class="quotes-filters">`);
    };

    proto.openClientsDirectory = function () {
      if (this.currentUser?.role !== 'admin') return;
      this.showDocumentControl = false;
      this.quoteArchiveInlineOpen = false;
      this.showArchivedTasks = false;
      this.clientsDirectoryOpen = true;
      document.getElementById('quotes-shell')?.classList.add('hidden');
      document.body.classList.remove('quotes-open');
      document.getElementById('archived-documents-panel')?.classList.add('hidden');
      const host = document.getElementById('tasks-container');
      if (host) {
        host.style.removeProperty('display');
        host.style.removeProperty('width');
        host.style.removeProperty('grid-template-columns');
      }
      this.renderTasks();
      if (!document.getElementById('clients-directory')) this.renderClientsDirectory();
      const nav = document.getElementById('orders-view-navigation');
      if (nav) {
        nav.dataset.currentView = 'clients';
        nav.querySelectorAll('[data-order-view], #btn-archived-quotes').forEach(item => {
          const key = item.dataset.orderView || (item.id === 'btn-archived-quotes' ? 'quotes' : '');
          const selected = key === 'clients';
          item.classList.toggle('is-current', selected);
          item.setAttribute('aria-current', selected ? 'page' : 'false');
          item.setAttribute('aria-pressed', String(selected));
        });
      }
    };
    return true;
  };
  if (!install()) {
    const timer = setInterval(() => { if (install()) clearInterval(timer); }, 100);
    setTimeout(() => clearInterval(timer), 60000);
  }
})();
