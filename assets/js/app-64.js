(function () {
  'use strict';

  if (window.__quotesArchiveStableFilter64) return;
  window.__quotesArchiveStableFilter64 = true;

  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const escapeAttr = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const money = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const isVisible = element => Boolean(element && !element.classList.contains('hidden') && element.getClientRects().length);

  function archiveRoot() {
    return document.querySelector('#quotes-shell:not(.hidden) .quotes-archive') || document.querySelector('#tasks-container .quotes-archive');
  }

  function quoteRows(instance) {
    return (instance.quotes || []).map(quote => {
      const html = instance.quoteRow(quote);
      return html.replace(/class=(['"])quote-archive-row\1/, `class="quote-archive-row" data-quote-id="${escapeAttr(quote.id)}"`);
    }).join('');
  }

  function metrics(instance) {
    const quotes = instance.quotes || [];
    const totalValue = quotes.reduce((sum, quote) => sum + (Number(quote.total) || 0), 0);
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const values = {
      total: String(quotes.length),
      value: money(totalValue),
      clients: String(new Set(quotes.map(quote => normalize(quote.client)).filter(Boolean)).size),
      average: money(quotes.length ? totalValue / quotes.length : 0),
      month: String(quotes.filter(quote => String(quote.date || '').startsWith(monthKey)).length)
    };
    document.querySelectorAll('.quotes-summary [data-quote-metric]').forEach(node => {
      const value = values[node.dataset.quoteMetric] ?? '0';
      if (node.textContent !== value) node.textContent = value;
    });
  }

  function ensureArchiveSummary(root) {
    const filters = root.querySelector('.quotes-filters');
    if (!filters) return;
    let summary = root.querySelector('.quotes-summary');
    if (!summary) {
      summary = document.createElement('section');
      summary.className = 'payment-summary quotes-summary';
      summary.setAttribute('aria-label', 'Resumen de cotizaciones');
      summary.innerHTML = '<article><span>Cotizaciones registradas</span><b data-quote-metric="total">0</b></article>' +
        '<article><span>Valor total cotizado</span><b data-quote-metric="value">$ 0</b></article>' +
        '<article><span>Clientes con propuesta</span><b data-quote-metric="clients">0</b></article>' +
        '<article><span>Promedio por propuesta</span><b data-quote-metric="average">$ 0</b></article>' +
        '<article><span>Cotizaciones de este mes</span><b data-quote-metric="month">0</b></article>';
    }
    let count = root.querySelector('#quotes-visible-count');
    if (!count) {
      count = document.createElement('div');
      count.id = 'quotes-visible-count';
      count.className = 'quotes-visible-count';
    }
    if (summary.nextElementSibling !== count || count.nextElementSibling !== filters) filters.before(summary, count);
  }

  function annotateQuoteRows(instance, root) {
    const quotes = instance.quotes || [];
    root.querySelectorAll('.quote-archive-row:not([data-quote-id])').forEach(row => {
      const text = normalize(row.textContent);
      const match = quotes.find(quote => quote.number && text.includes(normalize(quote.number)));
      if (match) row.dataset.quoteId = String(match.id);
    });
  }

  function ensureLiveArchive() {
    const root = archiveRoot();
    const instance = window.app;
    if (!root || !instance) return;
    ensureArchiveSummary(root);
    annotateQuoteRows(instance, root);
    metrics(instance);
    applyQuoteFilters(instance, root);
  }

  function refreshFilterOptions(instance, root) {
    const filters = [
      ['quotes-client', 'client', 'Todos los clientes'],
      ['quotes-condo', 'condo', 'Todos los condominios'],
      ['quotes-advisor', 'advisor', 'Todos los asesores']
    ];
    filters.forEach(([id, key, label]) => {
      const select = root.querySelector('#' + id);
      if (!select) return;
      const selected = select.value;
      const values = [...new Set((instance.quotes || []).map(quote => quote[key]).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), 'es'));
      select.replaceChildren(new Option(label, ''), ...values.map(value => new Option(value, value)));
      select.value = values.includes(selected) ? selected : '';
    });
  }

  function applyQuoteFilters(instance, root = archiveRoot()) {
    if (!root) return;
    const value = id => root.querySelector('#' + id)?.value || '';
    const term = normalize(value('quotes-search').trim());
    const month = value('quotes-month');
    const client = value('quotes-client');
    const condo = value('quotes-condo');
    const advisor = value('quotes-advisor');
    const byId = new Map((instance.quotes || []).map(quote => [String(quote.id), quote]));
    annotateQuoteRows(instance, root);
    let shown = 0;
    root.querySelectorAll('.quote-archive-row').forEach(row => {
      const quote = byId.get(row.dataset.quoteId) || {};
      const textMatch = !term || normalize([quote.number, quote.client, quote.condo, quote.address, row.textContent].join(' ')).includes(term);
      const matches = textMatch && (!month || String(quote.date || '').startsWith(month)) && (!client || quote.client === client) && (!condo || quote.condo === condo) && (!advisor || quote.advisor === advisor);
      row.classList.toggle('hidden', !matches);
      if (matches) shown += 1;
    });
    const list = root.querySelector('#quotes-archive-list');
    if (list) {
      let empty = list.querySelector('#quotes-filter-empty');
      if (!empty) {
        empty = document.createElement('div');
        empty.id = 'quotes-filter-empty';
        empty.className = 'quotes-empty hidden';
        empty.innerHTML = '<span>⌕</span><b>Sin resultados para esos filtros</b><p>Prueba cambiando la búsqueda o los filtros.</p>';
        list.appendChild(empty);
      }
      empty.classList.toggle('hidden', shown > 0 || !(instance.quotes || []).length);
      const originalEmpty = list.querySelector(':scope > .quotes-empty:not(#quotes-filter-empty)');
      if (originalEmpty) originalEmpty.classList.toggle('hidden', Boolean((instance.quotes || []).length));
    }
    const count = root.querySelector('#quotes-visible-count');
    if (count) {
      const label = `${shown} de ${(instance.quotes || []).length} cotizaciones`;
      if (count.textContent !== label) count.textContent = label;
    }
    if (instance.quoteArchiveInlineOpen) {
      const topCount = document.getElementById('filtered-count');
      const visibleCount = String(shown);
      if (topCount && topCount.textContent !== visibleCount) topCount.textContent = visibleCount;
    }
  }

  function refreshRowsInPlace(instance, root = archiveRoot()) {
    if (!root) return false;
    refreshFilterOptions(instance, root);
    const list = root.querySelector('#quotes-archive-list');
    if (!list) return false;
    const focused = root.querySelector('#quotes-search') === document.activeElement ? document.activeElement : null;
    const selection = focused && typeof focused.selectionStart === 'number' ? [focused.selectionStart, focused.selectionEnd] : null;
    list.innerHTML = (instance.quotes || []).length
      ? quoteRows(instance)
      : '<div class="quotes-empty"><span>✦</span><b>Aún no hay cotizaciones</b><p>Las propuestas guardadas aparecerán aquí.</p></div>';
    metrics(instance);
    applyQuoteFilters(instance, root);
    if (focused?.isConnected) {
      focused.focus({ preventScroll: true });
      if (selection) focused.setSelectionRange(selection[0], selection[1]);
    }
    return true;
  }

  function addSummary(markup) {
    if (markup.includes('class="quotes-summary')) return markup;
    const summary = '<section class="payment-summary quotes-summary" aria-label="Resumen de cotizaciones">' +
      '<article><span>Cotizaciones registradas</span><b data-quote-metric="total">0</b></article>' +
      '<article><span>Valor total cotizado</span><b data-quote-metric="value">$ 0</b></article>' +
      '<article><span>Clientes con propuesta</span><b data-quote-metric="clients">0</b></article>' +
      '<article><span>Promedio por propuesta</span><b data-quote-metric="average">$ 0</b></article>' +
      '<article><span>Cotizaciones de este mes</span><b data-quote-metric="month">0</b></article>' +
      '</section><div class="quotes-visible-count" id="quotes-visible-count"></div>';
    return markup.replace('<div class="quotes-filters">', summary + '<div class="quotes-filters">');
  }

  function install() {
    const proto = window.PortonProApp?.prototype;
    // app-44 registers the definitive inline archive after app-43 initializes.
    // Install only after that patch, otherwise app-44 overwrites these methods.
    if (!proto || !window.app?.__quoteModule44 || proto.__quotesArchiveStableFilter64 || typeof proto.quoteArchiveMarkup !== 'function') return false;

    const originalMarkup = proto.quoteArchiveMarkup;
    proto.quoteArchiveMarkup = function (...args) { return addSummary(originalMarkup.apply(this, args)); };

    const originalRow = proto.quoteRow;
    if (typeof originalRow === 'function') {
      proto.quoteRow = function (quote, ...args) {
        return originalRow.call(this, quote, ...args).replace(/class=(['"])quote-archive-row\1/, `class="quote-archive-row" data-quote-id="${escapeAttr(quote?.id)}"`);
      };
    }

    proto.filterQuotes = function () { applyQuoteFilters(this); };

    proto.renderQuotesCount = function (...args) {
      const count = document.getElementById('quotes-archive-count');
      if (count) count.textContent = String((this.quotes || []).length);
      const root = archiveRoot();
      if (root) refreshRowsInPlace(this, root);
      return undefined;
    };

    if (typeof proto.openQuotesArchive === 'function') {
      const originalOpen = proto.openQuotesArchive;
      proto.openQuotesArchive = function (...args) {
        const root = archiveRoot();
        if (root && (isVisible(document.getElementById('quotes-shell')) || this.quoteArchiveInlineOpen)) {
          refreshRowsInPlace(this, root);
          return;
        }
        const result = originalOpen.apply(this, args);
        const openedRoot = archiveRoot();
        if (openedRoot) {
          metrics(this);
          applyQuoteFilters(this, openedRoot);
        }
        return result;
      };
    }
    if (typeof proto.renderQuoteArchiveInline === 'function') {
      const originalInline = proto.renderQuoteArchiveInline;
      proto.renderQuoteArchiveInline = function (...args) {
        const result = originalInline.apply(this, args);
        const root = archiveRoot();
        if (root) {
          metrics(this);
          applyQuoteFilters(this, root);
        }
        return result;
      };
    }
    proto.__quotesArchiveStableFilter64 = true;
    return true;
  }

  document.addEventListener('input', event => {
    if (event.target?.id !== 'quotes-search') return;
    const instance = window.app;
    const root = archiveRoot();
    if (!instance || !root || !root.contains(event.target)) return;
    event.stopImmediatePropagation();
    applyQuoteFilters(instance, root);
  }, true);

  document.addEventListener('change', event => {
    if (!['quotes-month', 'quotes-client', 'quotes-condo', 'quotes-advisor'].includes(event.target?.id)) return;
    const instance = window.app;
    const root = archiveRoot();
    if (!instance || !root || !root.contains(event.target)) return;
    event.stopImmediatePropagation();
    applyQuoteFilters(instance, root);
  }, true);

  // Watch only the two archive hosts, so unrelated page updates do not rerun
  // the filter and a summary insertion cannot trigger a document-wide loop.
  const observeArchive = () => {
    ensureLiveArchive();
    const targets = [document.getElementById('tasks-container'), document.getElementById('quotes-window-content')].filter(Boolean);
    const observed = window.__quotesArchiveObservedTargets64 || (window.__quotesArchiveObservedTargets64 = new WeakSet());
    targets.forEach(target => {
      if (!observed.has(target)) {
        const observer = new MutationObserver(ensureLiveArchive);
        observer.observe(target, { childList: true, subtree: true });
        observed.add(target);
      }
    });
  };
  observeArchive();
  document.addEventListener('DOMContentLoaded', observeArchive, { once: true });

  const timer = window.setInterval(() => {
    if (install()) {
      window.clearInterval(timer);
      const root = archiveRoot();
      if (root && window.app) refreshRowsInPlace(window.app, root);
    }
  }, 40);
  window.setTimeout(() => window.clearInterval(timer), 15000);
})();
