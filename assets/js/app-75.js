(() => {
  'use strict';

  const SEARCH_IDS = new Set(['payment-search', 'quotes-search', 'technical-reports-search', 'clients-search']);
  const normalize = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

  const filterReports = (app, input) => {
    const root = input.closest('.technical-reports-archive');
    const list = root?.querySelector('.technical-reports-list');
    if (!root || !list) return;
    const term = normalize(input.value);
    const rows = [...list.querySelectorAll('.technical-report-row[data-report-search]')];
    let shown = 0;
    rows.forEach(row => {
      const match = !term || normalize(row.dataset.reportSearch).includes(term);
      row.hidden = !match;
      row.classList.toggle('hidden', !match);
      if (match) shown += 1;
    });
    let empty = list.querySelector('.technical-reports-search-empty');
    if (term && shown === 0 && rows.length) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'technical-reports-empty technical-reports-search-empty';
        empty.innerHTML = '<i data-lucide="file-search"></i><b>No se encontraron informes.</b><span>Prueba con otro número, cliente o fecha.</span>';
        list.appendChild(empty);
        if (window.lucide) window.lucide.createIcons({ root: empty });
      }
      empty.hidden = false;
      empty.classList.remove('hidden');
    } else if (empty) { empty.hidden = true; empty.classList.add('hidden'); }
    const count = root.querySelector('[data-reports-result-count]');
    if (count) count.textContent = `${shown} de ${(app.technicalReports || []).length} informes`;
  };

  const dispatch = event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !SEARCH_IDS.has(input.id) || input.dataset.spemSearchHandled === '1') return false;
    input.dataset.spemSearchHandled = '1';
    event.stopImmediatePropagation();
    const app = window.app;
    try {
      if (!app || !input.isConnected) return true;
      switch (input.id) {
        case 'payment-search':
          if (app.showDocumentControl) app.renderDocumentControlRecords?.();
          break;
        case 'quotes-search':
          app.quoteArchiveCommittedSearch = input.value;
          app.quoteArchiveRowsRefreshPending = false;
          app.filterQuotes?.();
          break;
        case 'technical-reports-search':
          filterReports(app, input);
          break;
        case 'clients-search':
          app.clientDirectorySearchValue = input.value;
          app.filterClientDirectory?.();
          break;
      }
    } finally {
      queueMicrotask(() => { if (input.isConnected) delete input.dataset.spemSearchHandled; });
    }
    return true;
  };

  window.__spemGenericSearchDispatch = dispatch;
  window.addEventListener('input', dispatch, true);
  window.addEventListener('search', dispatch, true);
})();
