(() => {
  'use strict';

  // One input-event controller, matching Consolidado's live-search behavior.
  // Filtering is always in place: it never renders a view or changes navigation.
  const SEARCH_ROOTS = {
    'payment-search': '#archived-documents-panel .payment-console',
    'quotes-search': '#tasks-container .quotes-archive',
    'technical-reports-search': '#tasks-container .technical-reports-archive',
    'clients-search': '#clients-directory'
  };
  const normalize = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

  const activeRoot = (app, input) => {
    const root = input.closest(SEARCH_ROOTS[input.id] || '');
    if (!root) return null;
    // Trust the rendered module, not stale route flags. This keeps searches
    // scoped to the visible panel and makes the input incapable of navigating.
    if (root.closest('.hidden,[hidden]') || getComputedStyle(root).display === 'none') return null;
    return root;
  };

  const filterQuotes = (app, root, input) => {
    const term = normalize(input.value);
    const month = root.querySelector('#quotes-month')?.value || '';
    const client = root.querySelector('#quotes-client')?.value || '';
    const condo = root.querySelector('#quotes-condo')?.value || '';
    const advisor = root.querySelector('#quotes-advisor')?.value || '';
    const byId = new Map((app.quotes || []).map(quote => [String(quote.id), quote]));
    let shown = 0;
    root.querySelectorAll('.quote-archive-row[data-quote-id]').forEach(row => {
      const quote = byId.get(String(row.dataset.quoteId)) || {};
      const match = (!term || normalize([quote.number, quote.client, quote.condo, quote.address].join(' ')).includes(term))
        && (!month || String(quote.date || '').startsWith(month))
        && (!client || quote.client === client)
        && (!condo || quote.condo === condo)
        && (!advisor || quote.advisor === advisor);
      row.hidden = !match;
      row.classList.toggle('hidden', !match);
      if (match) shown += 1;
    });
    root.querySelector('#quotes-empty-state')?.classList.toggle('hidden', (app.quotes || []).length > 0);
    root.querySelector('#quotes-no-results')?.classList.toggle('hidden', shown > 0 || !(app.quotes || []).length);
    const count = root.querySelector('#quotes-visible-count');
    if (count) count.textContent = `${shown} de ${(app.quotes || []).length} cotizaciones`;
    const dashboardCount = document.getElementById('filtered-count');
    if (dashboardCount && app.quoteArchiveInlineOpen) dashboardCount.textContent = String(shown);
  };

  const filterReports = (app, root, input) => {
    const term = normalize(input.value);
    const list = root.querySelector('.technical-reports-list');
    if (!list) return;
    const rows = [...list.querySelectorAll('.technical-report-row[data-report-search]')];
    let shown = 0;
    rows.forEach(row => {
      const match = !term || normalize(row.dataset.reportSearch).includes(term);
      row.hidden = !match;
      row.classList.toggle('hidden', !match);
      if (match) shown += 1;
    });
    const defaultEmpty = list.querySelector('.technical-reports-empty:not(.technical-reports-search-empty)');
    let empty = list.querySelector('.technical-reports-search-empty');
    if (term && shown === 0) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'technical-reports-empty technical-reports-search-empty';
        empty.innerHTML = '<i data-lucide="file-search"></i><b>No se encontraron informes.</b><span>Prueba con otro número, cliente o fecha.</span>';
        list.appendChild(empty);
        if (window.lucide) window.lucide.createIcons({ root: empty });
      }
      empty.hidden = false;
      empty.classList.remove('hidden');
      if (defaultEmpty) {
        defaultEmpty.hidden = true;
        defaultEmpty.classList.add('hidden');
      }
    } else if (empty) {
      empty.hidden = true;
      empty.classList.add('hidden');
    }
    if (defaultEmpty) {
      const showDefault = !term && rows.length === 0;
      defaultEmpty.hidden = !showDefault;
      defaultEmpty.classList.toggle('hidden', !showDefault);
    }
    const count = root.querySelector('[data-reports-result-count]');
    if (count) count.textContent = `${shown} de ${(app.technicalReports || []).length} informes`;
  };

  const apply = (app, input) => {
    if (!(input instanceof HTMLInputElement) || !Object.hasOwn(SEARCH_ROOTS, input.id) || !input.isConnected) return false;
    const root = activeRoot(app, input);
    if (!root) return true;
    switch (input.id) {
      case 'payment-search':
        app.renderDocumentControlRecords?.();
        break;
      case 'quotes-search':
        app.quoteArchiveCommittedSearch = input.value;
        filterQuotes(app, root, input);
        break;
      case 'technical-reports-search':
        filterReports(app, root, input);
        break;
      case 'clients-search':
        app.clientDirectorySearchValue = input.value;
        app.filterClientDirectory?.();
        break;
    }
    return true;
  };

  // Replace the old quote filter implementation so text and select filters use
  // the same in-place algorithm. Existing month/client/condo/advisor controls
  // continue to call app.filterQuotes() through their current change handlers.
  const installQuoteFilter = () => {
    const app = window.app;
    if (!app || !app.__quoteModule44) return false;
    if (app.__unifiedQuoteFilter75) return true;
    app.__unifiedQuoteFilter75 = true;
    app.filterQuotes = function () {
      const root = document.querySelector('#tasks-container .quotes-archive');
      const input = root?.querySelector('#quotes-search');
      if (root && input) filterQuotes(this, root, input);
    };
    return true;
  };

  const inputHandler = event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !Object.hasOwn(SEARCH_ROOTS, input.id)) return;
    event.stopImmediatePropagation();
    const app = window.app;
    if (app) apply(app, input);
  };
  const keyHandler = event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !Object.hasOwn(SEARCH_ROOTS, input.id)) return;
    if (event.key === 'Enter') event.preventDefault();
    event.stopImmediatePropagation();
  };

  window.__spemGenericSearchApply = (input, app = window.app) => app && apply(app, input);
  window.addEventListener('input', inputHandler, true);
  window.addEventListener('keydown', keyHandler, true);
  installQuoteFilter();
  if (!window.app?.__unifiedQuoteFilter75) {
    const timer = setInterval(() => { if (installQuoteFilter()) clearInterval(timer); }, 100);
    setTimeout(() => clearInterval(timer), 15000);
  }
})();
