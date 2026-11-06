(() => {
  'use strict';

  const STORE_KEY = 'spem_technical_reports_v1';
  const SIGNATURE_KEY = 'spem_technical_report_signature_v1';
  const DELETED_KEY = 'spem_technical_reports_deleted_v1';
  const COLLECTION = 'informes_tecnicos';
  const REPORT_FOLDER_DB = 'spem_technical_report_downloads_v1';
  const REPORT_FOLDER_STORE = 'settings';
  const REPORT_FOLDER_KEY = 'destination';
  const SIGNATURE_ASSET = 'assets/img/firmas/polo-martinez-firma.png';
  const FOOTER = {
    email: 'serviportoneselectricos@hotmail.com',
    address: 'Urb. Santa Ana CL 9A #27-78',
    phones: '3133885836 - 3157716656'
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const localRead = () => {
    try { const value = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  };
  const localWrite = reports => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(reports)); return true; }
    catch { return false; }
  };
  const deletedRead = () => { try { const value = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]'); return Array.isArray(value) ? value.map(String) : []; } catch { return []; } };
  const reportDate = value => {
    if (!value) return '—';
    // Date inputs are stored as YYYY-MM-DD; parse them locally so UTC timezone
    // conversion cannot shift the inspection or creation date to the day before.
    const raw = String(value);
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    const date = value instanceof Date ? value : dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('es-CO', { day:'2-digit', month:'long', year:'numeric' }).format(date);
  };
  const isoToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const numberFromId = value => Number(String(value || '').match(/INF[- ]?(\d+)/i)?.[1] || 0);
  const byCreated = (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0);
  const signatureSource = () => {
    try { return localStorage.getItem(SIGNATURE_KEY) || SIGNATURE_ASSET; } catch { return SIGNATURE_ASSET; }
  };
  const openReportFolderDb = () => new Promise((resolve, reject) => {
    if (!window.indexedDB) return resolve(null);
    const request = indexedDB.open(REPORT_FOLDER_DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(REPORT_FOLDER_STORE)) request.result.createObjectStore(REPORT_FOLDER_STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const persistReportFolder = async handle => {
    const db = await openReportFolderDb(); if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(REPORT_FOLDER_STORE, 'readwrite'), store = tx.objectStore(REPORT_FOLDER_STORE);
      if (handle) store.put(handle, REPORT_FOLDER_KEY); else store.delete(REPORT_FOLDER_KEY);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  };
  const restoreReportFolder = async () => {
    const db = await openReportFolderDb(); if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(REPORT_FOLDER_STORE, 'readonly'), request = tx.objectStore(REPORT_FOLDER_STORE).get(REPORT_FOLDER_KEY);
      request.onsuccess = () => { const handle = request.result || null; db.close(); resolve(handle); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  };
  const safeReportFilename = report => {
    const client = String(report?.client || 'Cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
    return `${String(report?.number || 'Informe').replace(/[^A-Za-z0-9_-]/g, '_')}_${client || 'Cliente'}.pdf`;
  };
  const downloadReportBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  let reportPdfLibrariesPromise;
  const loadReportPdfScript = src => new Promise(resolve => {
    const script = document.createElement('script');
    script.src = src; script.async = true;
    script.addEventListener('load', () => resolve(true), { once: true });
    script.addEventListener('error', () => resolve(false), { once: true });
    document.head.appendChild(script);
  });
  const ensureReportPdfLibraries = () => {
    if (window.html2canvas && window.jspdf?.jsPDF) return Promise.resolve(true);
    if (reportPdfLibrariesPromise) return reportPdfLibrariesPromise;
    reportPdfLibrariesPromise = (async () => {
      if (!window.html2canvas && !await loadReportPdfScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')) return false;
      if (!window.jspdf?.jsPDF && !await loadReportPdfScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.0.0/jspdf.umd.min.js')) return false;
      return Boolean(window.html2canvas && window.jspdf?.jsPDF);
    })();
    return reportPdfLibrariesPromise;
  };
  // Reutilizable por las cotizaciones cuando se guardan en una carpeta elegida.
  // Captura el nodo actualmente visible y usa sus dimensiones CSS como tamaño de página.
  window.spemCreatePreviewPdfBlob = async (node, options = {}) => {
    if (!node || !await ensureReportPdfLibraries()) throw new Error('No está disponible la captura de PDF.');
    await document.fonts?.ready;
    await Promise.all([...node.querySelectorAll('img')].map(image => image.decode?.().catch(() => undefined)));
    const rect = node.getBoundingClientRect();
    const widthPx = Math.ceil(rect.width || node.scrollWidth);
    const heightPx = Math.ceil(Math.max(rect.height, node.scrollHeight));
    if (!widthPx || !heightPx) throw new Error('La vista previa no tiene dimensiones para exportar.');
    const canvas = await window.html2canvas(node, {
      scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false,
      scrollX: 0, scrollY: 0, width: widthPx, height: heightPx,
      windowWidth: Math.max(document.documentElement.clientWidth, widthPx),
      windowHeight: Math.max(document.documentElement.clientHeight, heightPx)
    });
    if (!canvas?.width || !canvas?.height) throw new Error('No se pudo capturar la vista previa.');
    const JsPDF = window.jspdf.jsPDF;
    if (options.format === 'a4') {
      const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      const pageWidthMm = pdf.internal.pageSize.getWidth(), pageHeightMm = pdf.internal.pageSize.getHeight();
      const marginMm = Math.max(0, Number(options.marginMm) || 0);
      const contentWidthMm = pageWidthMm - marginMm * 2, contentHeightMm = pageHeightMm - marginMm * 2;
      // Cotizaciones: colocar la captura completa en una hoja A4, conservando
      // proporciones y usando el área disponible sin los encabezados de imprimir del navegador.
      if (options.fitSinglePage) {
        const scale = Math.min(contentWidthMm / canvas.width, contentHeightMm / canvas.height);
        const imageWidthMm = canvas.width * scale, imageHeightMm = canvas.height * scale;
        const x = (pageWidthMm - imageWidthMm) / 2, y = (pageHeightMm - imageHeightMm) / 2;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', x, y, imageWidthMm, imageHeightMm, 'quote-preview-page', 'FAST');
        return pdf.output('blob');
      }
      const sourcePageHeight = Math.max(1, Math.floor(canvas.width * contentHeightMm / contentWidthMm));
      const pageCount = Math.max(1, Math.ceil(canvas.height / sourcePageHeight));
      for (let page = 0; page < pageCount; page += 1) {
        if (page) pdf.addPage('a4', 'portrait');
        const sourceY = page * sourcePageHeight, sourceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width; pageCanvas.height = sourceHeight;
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('No fue posible preparar la página de la cotización.');
        context.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
        const imageHeightMm = sourceHeight * contentWidthMm / canvas.width;
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.98), 'JPEG', marginMm, marginMm, contentWidthMm, imageHeightMm, `quote-preview-${page + 1}`, 'FAST');
      }
      return pdf.output('blob');
    }
    const pageWidthMm = widthPx * 25.4 / 96;
    const pageHeightMm = heightPx * 25.4 / 96;
    const pdf = new JsPDF({ unit: 'mm', format: [pageWidthMm, pageHeightMm], orientation: 'portrait', compress: true });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, pageWidthMm, pageHeightMm, 'preview-capture', 'FAST');
    return pdf.output('blob');
  };
  const requestReportFolderWritePermission = async handle => {
    if (!handle) return false;
    try {
      // Llamar primero a requestPermission mientras el clic del usuario sigue activo.
      let permission = await handle.requestPermission?.({ mode: 'readwrite' });
      if (permission !== 'granted') permission = await handle.queryPermission?.({ mode: 'readwrite' });
      return permission === 'granted';
    } catch { return false; }
  };
  const drawReportBanner = root => {
    const shape = root?.querySelector?.('.technical-report-black-banner-shape');
    const rect = shape?.getBoundingClientRect();
    if (!shape || !rect?.width || !rect?.height) return;
    const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    shape.width = Math.round(rect.width * ratio);
    shape.height = Math.round(rect.height * ratio);
    const context = shape.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle = '#050505';
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(rect.width, 0);
    context.lineTo(rect.width, rect.height);
    context.lineTo(rect.width * 0.17, rect.height);
    context.closePath();
    context.fill();
  };
  const writeReportToFolder = async (handle, blob, filename) => {
    if (!handle) return false;
    try {
      const file = await handle.getFileHandle(filename, { create: true });
      const writable = await file.createWritable(); await writable.write(blob); await writable.close();
      return true;
    } catch (error) { console.warn('[INFORMES] No se pudo guardar el PDF en la carpeta elegida.', error); return false; }
  };
  const reportRowsMarkup = (filtered, total) => filtered.length ? filtered.map(report => `<article class="technical-report-row"><div class="technical-report-row-main"><span class="technical-report-number">${escapeHtml(report.number)}</span><b>${escapeHtml(report.client || 'Cliente')}</b><small>Inspección: ${escapeHtml(reportDate(report.inspectionDate))} · Técnico: ${escapeHtml(report.technician || 'Polo Martínez')}</small><small>Creado: ${escapeHtml(reportDate(report.createdAt))} · Estado: ${escapeHtml(report.status || 'Realizado')}</small></div><div class="technical-report-row-actions"><button type="button" data-report-view="${escapeHtml(report.id)}" title="Ver informe" aria-label="Ver ${escapeHtml(report.number)}"><i data-lucide="eye"></i><span>Ver</span></button><button type="button" data-report-edit="${escapeHtml(report.id)}" title="Editar informe" aria-label="Editar ${escapeHtml(report.number)}"><i data-lucide="pencil"></i><span>Editar</span></button><button type="button" data-report-delete="${escapeHtml(report.id)}" title="Eliminar informe" aria-label="Eliminar ${escapeHtml(report.number)}"><i data-lucide="trash-2"></i><span>Eliminar</span></button></div></article>`).join('') : `<div class="technical-reports-empty"><i data-lucide="file-search"></i><b>${total ? 'No se encontraron informes.' : 'Aún no hay informes realizados.'}</b><span>${total ? 'Prueba con otro número, cliente o fecha.' : 'Usa “Realizar informe” para crear el primero.'}</span></div>`;
  const bindReportRowActions = (app, host) => {
    host.querySelectorAll('[data-report-view]').forEach(button => button.addEventListener('click', () => app.openTechnicalReportPreview(button.dataset.reportView)));
    host.querySelectorAll('[data-report-edit]').forEach(button => button.addEventListener('click', () => app.openTechnicalReportForm(button.dataset.reportEdit)));
    host.querySelectorAll('[data-report-delete]').forEach(button => button.addEventListener('click', async () => {
      const report = (app.technicalReports || []).find(item => String(item.id) === button.dataset.reportDelete);
      if (!report || !await app.showSystemConfirm?.(`¿Eliminar el informe ${report.number}?`, { title:'Eliminar informe', confirmText:'Eliminar', icon:'trash' })) return;
      app.technicalReports = app.technicalReports.filter(item => String(item.id) !== String(report.id));
      localWrite(app.technicalReports);
      const tombstones = [...new Set([...deletedRead(), String(report.id)])];
      try { localStorage.setItem(DELETED_KEY, JSON.stringify(tombstones)); } catch {}
      if (window.db && navigator.onLine) db.collection(COLLECTION).doc(report.id).delete().then(() => { try { localStorage.setItem(DELETED_KEY, JSON.stringify(deletedRead().filter(id => id !== String(report.id)))); } catch {} }).catch(error => console.warn('[INFORMES] El informe se eliminó en este dispositivo; la nube no sincronizó.', error));
      app.renderTechnicalReportsArchive();
      app.showToast?.('Informe eliminado.', 'success');
    }));
  };

  const install = () => {
    const app = window.app;
    const proto = app?.constructor?.prototype;
    if (!app || !proto || app.__technicalReports70) return false;
    app.__technicalReports70 = true;
    const clientKey = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
    const mergeExistingClientSources = instance => {
      const records = Array.isArray(instance.clientDirectory) ? instance.clientDirectory.slice() : [];
      const localRecords = (() => { try { const value = JSON.parse(localStorage.getItem('spem_clients_v1') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } })();
      const add = (candidate, fallbackId) => {
        if (!candidate || typeof candidate !== 'object') return;
        const name = String(candidate.name || candidate.client || candidate.clientName || '').trim();
        const condo = String(candidate.condo || candidate.condominium || '').trim();
        if (!name && !condo) return;
        const normalizedName = clientKey(name), normalizedCondo = clientKey(condo);
        const normalizedAddress = clientKey(candidate.address || '');
        const candidateDocument = clientKey(candidate.documentNumber || candidate.document || '');
        const existing = records.find(item => {
          const itemDocument = clientKey(item.documentNumber || item.document || '');
          if (candidateDocument && itemDocument) return candidateDocument === itemDocument;
          const itemName = clientKey(item.name || item.client);
          if (!normalizedName || itemName !== normalizedName) return false;
          const itemAddress = clientKey(item.address || '');
          return !(normalizedAddress && itemAddress && normalizedAddress !== itemAddress);
        });
        const normalized = {
          ...candidate,
          id: String(candidate.id || existing?.id || fallbackId || `legacy-client-${encodeURIComponent(normalizedName || normalizedCondo)}`),
          name: name || String(existing?.name || ''),
          condo: condo || String(existing?.condo || ''),
          documentNumber: String(candidate.documentNumber || candidate.document || existing?.documentNumber || ''),
          address: String(candidate.address || existing?.address || ''),
          phone: String(candidate.phone || existing?.phone || ''),
          email: String(candidate.email || existing?.email || ''),
          administrator: String(candidate.administrator || candidate.contact || existing?.administrator || '')
        };
        if (existing) {
          Object.assign(existing, Object.fromEntries(Object.entries(normalized).filter(([key, value]) => value !== '' || key === 'id')));
        } else records.push(normalized);
      };
      records.slice().forEach((item, index) => add(item, `directory-client-${index}`));
      localRecords.forEach((item, index) => add(item, `local-client-${index}`));
      (Array.isArray(instance.tasks) ? instance.tasks : []).forEach((task, index) => add({
        name: task?.client || task?.clientName,
        condo: task?.condo,
        address: task?.address,
        phone: task?.phone,
        administrator: task?.administrator || task?.contact
      }, `order-client-${index}`));
      (Array.isArray(instance.quotes) ? instance.quotes : []).forEach((quote, index) => add({
        name: quote?.client || quote?.clientName,
        condo: quote?.condo,
        address: quote?.address,
        phone: quote?.phone,
        email: quote?.email,
        documentNumber: quote?.documentNumber,
        administrator: quote?.contact || quote?.administrator
      }, `quote-client-${index}`));
      instance.clientDirectory = records;
      return records;
    };
    app.mergeExistingClientSources = function () { return mergeExistingClientSources(this); };
    app.technicalReports = localRead();
    app.technicalReportsArchiveOpen = false;
    app.technicalReportsDirectoryHandle = null;
    let reportsNavButton = null;
    let reportsNavigationRequest = 0;
    let clientsNavigationRequest = 0;
    restoreReportFolder().then(handle => {
      if (!handle || window.app !== app) return;
      app.technicalReportsDirectoryHandle = handle;
      const label = document.getElementById('technical-report-directory-label');
      if (label) label.textContent = handle.name || 'Carpeta seleccionada';
    }).catch(error => console.warn('[INFORMES] No se restauró la carpeta de descargas.', error));

    const persist = function () { localWrite(this.technicalReports || []); };
    const mergeCloudReports = function (snapshot) {
      const remote = [];
      snapshot?.forEach(doc => remote.push({ ...doc.data(), id: doc.id }));
      const local = localRead();
      const deleted = new Set(deletedRead());
      const merged = new Map(remote.filter(item => !deleted.has(String(item.id))).map(item => [String(item.id), item]));
      local.forEach(item => { const key = String(item.id); if (deleted.has(key)) return; const saved = merged.get(key); if (!saved || Number(item.updatedAt || 0) > Number(saved.updatedAt || 0)) merged.set(key, item); });
      this.technicalReports = [...merged.values()].sort(byCreated);
      persist.call(this);
      if (this.technicalReportsArchiveOpen) this.renderTechnicalReportsArchive();
    };

    proto.loadTechnicalReports = async function () {
      this.technicalReports = localRead();
      if (window.db && navigator.onLine) {
        try {
          const snapshot = await db.collection(COLLECTION).get();
          const remoteById = new Map();
          snapshot?.forEach(doc => remoteById.set(String(doc.id), doc.data() || {}));
          mergeCloudReports.call(this, snapshot);
          const localRows = localRead();
          const pendingWrites = localRows.filter(item => {
            if (deletedRead().includes(String(item.id))) return false;
            const remote = remoteById.get(String(item.id));
            return !remote || Number(item.updatedAt || 0) > Number(remote.updatedAt || 0);
          });
          await Promise.all(pendingWrites.map(item => db.collection(COLLECTION).doc(String(item.id)).set(item, { merge: true }).catch(error => console.warn('[INFORMES] Un informe local sigue pendiente de sincronización.', error))));
          const pendingDeletes = deletedRead();
          await Promise.all(pendingDeletes.map(id => db.collection(COLLECTION).doc(id).delete().catch(() => null)));
          if (pendingDeletes.length) localStorage.removeItem(DELETED_KEY);
        } catch (error) { console.warn('[INFORMES] Se usarán los informes guardados en este dispositivo.', error); }
      }
      if (this.technicalReportsArchiveOpen) this.renderTechnicalReportsArchive();
      return this.technicalReports;
    };

    proto.subscribeTechnicalReports = function () {
      if (this.technicalReportsUnsubscribe || !window.db || !navigator.onLine) return;
      try {
        this.technicalReportsUnsubscribe = db.collection(COLLECTION).onSnapshot(snapshot => mergeCloudReports.call(this, snapshot), error => {
          console.warn('[INFORMES] No se pudo actualizar la lista en tiempo real.', error);
        });
      } catch (error) { console.warn('[INFORMES] La lista seguirá disponible con los datos guardados localmente.', error); }
    };

    proto.nextTechnicalReportNumber = async function () {
      const used = (this.technicalReports || []).reduce((max, report) => Math.max(max, numberFromId(report.number)), 0);
      if (window.db && navigator.onLine && typeof db.runTransaction === 'function') {
        try {
          const ref = db.collection('configuracion').doc('consecutivo_informes_tecnicos');
          const next = await db.runTransaction(async transaction => {
            const snapshot = await transaction.get(ref);
            const previous = Number(snapshot.data()?.lastNumber || 0);
            const value = Math.max(previous, used) + 1;
            transaction.set(ref, { lastNumber: value, updatedAt: Date.now() }, { merge: true });
            return value;
          });
          return `INF-${String(next).padStart(4, '0')}`;
        } catch (error) { console.warn('[INFORMES] Se generará un consecutivo local.', error); }
      }
      return `INF-${String(used + 1).padStart(4, '0')}`;
    };
    proto.previewTechnicalReportNumber = async function () {
      let used = (this.technicalReports || []).reduce((max, report) => Math.max(max, numberFromId(report.number)), 0);
      if (window.db && navigator.onLine) {
        try {
          const sequence = await db.collection('configuracion').doc('consecutivo_informes_tecnicos').get();
          used = Math.max(used, Number(sequence.data()?.lastNumber || 0));
        } catch (error) { console.warn('[INFORMES] No se pudo leer el último consecutivo; se usará el del archivo local.', error); }
      }
      return `INF-${String(used + 1).padStart(4, '0')}`;
    };

    proto.ensureTechnicalReportForm = function () {
      let modal = document.getElementById('technical-report-form-modal');
      if (modal) return modal;
      modal = document.createElement('div');
      modal.id = 'technical-report-form-modal';
      modal.className = 'technical-report-modal hidden';
      modal.innerHTML = `<section class="technical-report-form-card" role="dialog" aria-modal="true" aria-labelledby="technical-report-form-title">
        <header class="technical-report-form-header"><div class="technical-report-heading-icon"><i data-lucide="clipboard-pen-line"></i></div><div><span>INFORME TÉCNICO</span><h2 id="technical-report-form-title">Realizar informe</h2><p id="technical-report-number-label"></p></div><button type="button" data-report-close aria-label="Cerrar">×</button></header>
        <form id="technical-report-form" class="technical-report-form">
          <input type="hidden" id="technical-report-id">
          <div class="technical-report-fields"><label>Cliente<input id="technical-report-client" list="technical-report-client-options" autocomplete="off" required placeholder="Selecciona o escribe el cliente"></label><datalist id="technical-report-client-options"></datalist>
            <label>Fecha de inspección<input id="technical-report-inspection-date" type="date" required></label>
            <label>Técnico responsable<input value="Polo Martínez" readonly aria-readonly="true"></label>
            <label class="technical-report-body-field">Contenido del informe<textarea id="technical-report-body" rows="13" required placeholder="Escribe el informe técnico completo..."></textarea></label>
          </div>
          <section class="technical-report-signature-editor"><div><b>Firma digital reutilizable</b><small>Se guarda en este dispositivo y se agrega a los futuros informes.</small></div><div class="technical-report-signature-controls"><img id="technical-report-signature-preview" alt="Firma digital de Polo Martínez"><button type="button" data-signature-open><i data-lucide="pen-line"></i><span>Registrar o cambiar firma</span></button></div></section>
          <footer class="technical-report-form-actions"><button type="button" data-report-close class="technical-report-secondary">Cancelar</button><button type="submit" class="technical-report-primary"><i data-lucide="save"></i><span>Guardar informe</span></button></footer>
        </form>
      </section>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', event => {
        if (event.target === modal || event.target.closest('[data-report-close]')) { modal.classList.add('hidden'); return; }
        if (event.target.closest('[data-signature-open]')) this.openTechnicalSignaturePad();
      });
      modal.querySelector('#technical-report-form').addEventListener('submit', event => { event.preventDefault(); this.saveTechnicalReport(); });
      return modal;
    };

    proto.openTechnicalSignaturePad = function () {
      let modal = document.getElementById('technical-signature-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'technical-signature-modal';
        modal.className = 'technical-report-modal technical-signature-modal hidden';
        modal.innerHTML = `<section class="technical-signature-card" role="dialog" aria-modal="true" aria-labelledby="technical-signature-title"><header><div><span>FIRMA DIGITAL</span><h2 id="technical-signature-title">Registra la firma de Polo Martínez</h2></div><button type="button" data-signature-close aria-label="Cerrar">×</button></header><p>Firma una vez dentro del recuadro. Se conservará en este dispositivo y se reutilizará automáticamente.</p><canvas id="technical-signature-canvas" width="900" height="280" aria-label="Área para dibujar la firma"></canvas><footer><button type="button" class="technical-report-secondary" data-signature-clear>Limpiar</button><button type="button" class="technical-report-secondary" data-signature-close>Cancelar</button><button type="button" class="technical-report-primary" data-signature-save>Guardar firma</button></footer></section>`;
        document.body.appendChild(modal);
        const canvas = modal.querySelector('canvas');
        const context = canvas.getContext('2d');
        context.strokeStyle = '#17212b'; context.lineWidth = 3; context.lineCap = 'round'; context.lineJoin = 'round';
        let drawing = false;
        const point = event => { const rect = canvas.getBoundingClientRect(); return { x:(event.clientX - rect.left) * canvas.width / rect.width, y:(event.clientY - rect.top) * canvas.height / rect.height }; };
        canvas.addEventListener('pointerdown', event => { drawing = true; canvas.setPointerCapture?.(event.pointerId); const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); });
        canvas.addEventListener('pointermove', event => { if (!drawing) return; const p = point(event); context.lineTo(p.x, p.y); context.stroke(); });
        ['pointerup','pointercancel','lostpointercapture'].forEach(name => canvas.addEventListener(name, () => { drawing = false; }));
        modal.addEventListener('click', event => {
          if (event.target === modal || event.target.closest('[data-signature-close]')) { modal.classList.add('hidden'); return; }
          if (event.target.closest('[data-signature-clear]')) { context.clearRect(0, 0, canvas.width, canvas.height); return; }
          if (event.target.closest('[data-signature-save]')) {
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let hasInk = false;
            for (let index = 3; index < pixels.length; index += 4) { if (pixels[index] > 0) { hasInk = true; break; } }
            if (!hasInk) return this.showToast?.('Firma dentro del recuadro antes de guardar.', 'error');
            const data = canvas.toDataURL('image/png');
            try { localStorage.setItem(SIGNATURE_KEY, data); }
            catch { return this.showToast?.('No se pudo guardar la firma en este dispositivo.', 'error'); }
            modal.classList.add('hidden');
            this.renderTechnicalSignaturePreview();
            this.showToast?.('Firma guardada para futuros informes en este dispositivo.', 'success');
          }
        });
      }
      modal.querySelector('canvas').getContext('2d').clearRect(0, 0, 900, 280);
      modal.classList.remove('hidden');
    };

    proto.renderTechnicalSignaturePreview = function () {
      const image = document.getElementById('technical-report-signature-preview');
      if (image) image.src = signatureSource();
    };

    proto.openTechnicalReportForm = async function (id = '') {
      if (this.currentUser?.role !== 'admin') return this.showToast?.('Esta función está disponible para el administrador.', 'error');
      const modal = this.ensureTechnicalReportForm();
      const form = modal.querySelector('#technical-report-form');
      form.reset();
      const existing = id ? (this.technicalReports || []).find(report => String(report.id) === String(id)) : null;
      const number = existing?.number || await this.previewTechnicalReportNumber();
      modal.dataset.reportId = existing?.id || '';
      modal.querySelector('#technical-report-id').value = existing?.id || '';
      modal.querySelector('#technical-report-form-title').textContent = existing ? 'Editar informe técnico' : 'Realizar informe';
      modal.querySelector('#technical-report-number-label').textContent = number;
      modal.querySelector('#technical-report-client').value = existing?.client || '';
      modal.querySelector('#technical-report-inspection-date').value = existing?.inspectionDate || isoToday();
      modal.querySelector('#technical-report-body').value = existing?.body || '';
      const clients = new Map();
      (this.getRegisteredTaskClients?.() || []).forEach(item => { if (item.name) clients.set(item.name.toLocaleLowerCase(), item.name); });
      (this.tasks || []).forEach(task => { const name = String(task.client || '').trim(); if (name) clients.set(name.toLocaleLowerCase(), name); });
      modal.querySelector('#technical-report-client-options').replaceChildren(...[...clients.values()].sort((a,b)=>a.localeCompare(b,'es')).map(name => new Option(name, name)));
      this.renderTechnicalSignaturePreview();
      modal.classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
      setTimeout(() => modal.querySelector('#technical-report-client')?.focus(), 30);
    };

    proto.saveTechnicalReport = async function () {
      if (this.currentUser?.role !== 'admin') return this.showToast?.('Esta función está disponible para el administrador.', 'error');
      const modal = document.getElementById('technical-report-form-modal');
      const form = modal?.querySelector('#technical-report-form');
      if (!form?.reportValidity()) return;
      const id = String(modal.dataset.reportId || '');
      const old = id ? (this.technicalReports || []).find(report => String(report.id) === id) : null;
      const timestamp = Date.now();
      const automaticNumber = old?.number || await this.nextTechnicalReportNumber();
      const report = {
        id: old?.id || (window.crypto?.randomUUID?.() || `inf_${timestamp}_${Math.random().toString(36).slice(2, 9)}`),
        number: automaticNumber,
        client: modal.querySelector('#technical-report-client').value.trim(),
        inspectionDate: modal.querySelector('#technical-report-inspection-date').value,
        technician: 'Polo Martínez',
        body: modal.querySelector('#technical-report-body').value.trim(),
        signature: old?.signature || signatureSource(),
        createdAt: old?.createdAt || timestamp,
        updatedAt: timestamp,
        status: 'Realizado'
      };
      const rows = [...(this.technicalReports || [])];
      const index = rows.findIndex(item => String(item.id) === String(report.id));
      if (index < 0) rows.unshift(report); else rows[index] = report;
      this.technicalReports = rows.sort(byCreated);
      if (!localWrite(this.technicalReports)) return this.showToast?.('No hay espacio disponible para guardar el informe en este dispositivo.', 'error');
      modal.classList.add('hidden');
      this.showToast?.('Informe guardado.', 'success');
      if (window.db && navigator.onLine) {
        try { await db.collection(COLLECTION).doc(report.id).set(report, { merge: true }); }
        catch (error) { console.warn('[INFORMES] Se conservaron los cambios locales; no se sincronizaron.', error); this.showToast?.('Informe guardado en este dispositivo; la sincronización quedó pendiente.', 'info'); }
      }
      this.technicalReportsArchiveOpen = true;
      this.renderTechnicalReportsArchive();
    };

    proto.ensureTechnicalReportsArchive = function () {
      let host = document.getElementById('tasks-container');
      if (!host) return null;
      return host;
    };

    proto.renderTechnicalReportsArchive = function () {
      if (this.currentUser?.role !== 'admin' || !this.technicalReportsArchiveOpen) return;
      const host = this.ensureTechnicalReportsArchive();
      if (!host) return;
      const previousSearch = host.querySelector('#technical-reports-search');
      const restoreSearchFocus = previousSearch && document.activeElement === previousSearch;
      const selectionStart = restoreSearchFocus ? previousSearch.selectionStart : null;
      const selectionEnd = restoreSearchFocus ? previousSearch.selectionEnd : null;
      const reports = [...(this.technicalReports || [])].sort(byCreated);
      const query = String(document.getElementById('technical-reports-search')?.value || '').trim().toLocaleLowerCase('es');
      const filtered = reports.filter(report => `${report.number} ${report.client} ${report.technician} ${report.inspectionDate}`.toLocaleLowerCase('es').includes(query));
      host.classList.remove('hidden'); host.style.display = 'block'; host.style.width = '100%'; host.style.gridTemplateColumns = 'minmax(0,1fr)';
      host.innerHTML = `<section class="technical-reports-archive"><header class="technical-reports-archive-heading"><div><span>ARCHIVO TÉCNICO</span><h3>Informes realizados</h3><p>Consulta, edita o exporta los informes técnicos guardados.</p></div><button type="button" class="technical-report-primary" data-create-report><i data-lucide="plus"></i><span>Realizar informe</span></button></header>
        <div class="technical-reports-tools"><label><i data-lucide="search"></i><input id="technical-reports-search" name="reportsQuery" type="search" inputmode="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" placeholder="Buscar número, cliente o fecha" value="${escapeHtml(query)}"></label><span data-reports-result-count>${filtered.length} de ${reports.length} informes</span></div>
        <div class="technical-reports-list">${reportRowsMarkup(filtered, reports.length)}</div></section>`;
      host.querySelector('[data-create-report]')?.addEventListener('click', () => this.openTechnicalReportForm());
      host.querySelector('#technical-reports-search')?.addEventListener('input', event => {
        const value = event.currentTarget.value.trim().toLocaleLowerCase('es');
        const currentReports = [...(this.technicalReports || [])].sort(byCreated);
        const currentFiltered = currentReports.filter(report => `${report.number} ${report.client} ${report.technician} ${report.inspectionDate}`.toLocaleLowerCase('es').includes(value));
        const list = host.querySelector('.technical-reports-list');
        if (list) list.innerHTML = reportRowsMarkup(currentFiltered, currentReports.length);
        const resultCount = host.querySelector('[data-reports-result-count]');
        if (resultCount) resultCount.textContent = `${currentFiltered.length} de ${currentReports.length} informes`;
        bindReportRowActions(this, host);
        if (window.lucide && list) lucide.createIcons({ root: list });
      });
      bindReportRowActions(this, host);
      if (restoreSearchFocus) {
        const nextSearch = host.querySelector('#technical-reports-search');
        nextSearch?.focus({ preventScroll: true });
        if (nextSearch && selectionStart !== null && selectionEnd !== null) nextSearch.setSelectionRange(selectionStart, selectionEnd);
      }
      const title = document.getElementById('orders-view-title'); if (title) title.textContent = 'Informes realizados';
      const count = document.getElementById('filtered-count'); if (count) count.classList.add('hidden');
      document.getElementById('empty-state')?.classList.add('hidden');
      document.getElementById('archived-documents-panel')?.classList.add('hidden');
      document.getElementById('clients-directory')?.remove();
      document.getElementById('section-admin-audit-log')?.classList.add('hidden');
      this.syncTechnicalReportsNavigation();
      if (window.lucide) lucide.createIcons();
    };

    proto.syncTechnicalReportsNavigation = function () {
      const nav = document.getElementById('orders-view-navigation');
      if (!nav) return;
      let button = nav.querySelector('[data-order-view="archived"], [data-order-view="reports"]');
      if (button) reportsNavButton = button;
      if (!button) button = reportsNavButton;
      if (!button) return;
      button.dataset.orderView = 'reports';
      button.setAttribute('aria-label', 'Informes realizados');
      button.title = 'Informes Realizados';
      const label = button.querySelector('.orders-nav-label') || button.querySelector('span:not([id])');
      if (label) label.textContent = 'Informes Realizados';
      button.querySelector('#orders-nav-archive-count')?.remove();
      const group = nav.querySelector(':scope > .orders-main-access-group') || nav;
      const activeButton = group.querySelector('[data-order-view="active"]');
      const quotesButton = group.querySelector('#btn-archived-quotes');
      const invoicesButton = group.querySelector('[data-order-view="invoices"]');
      // Reafirma el mismo orden tras navegación/render: Órdenes, Cotizaciones,
      // Informes realizados y Consolidado. Mover nodos existentes conserva sus listeners.
      const canonicalOrder = [activeButton, quotesButton, button, invoicesButton].filter(Boolean);
      if (canonicalOrder.some((item, index) => group.children[index] !== item)) {
        group.replaceChildren(...canonicalOrder);
      }
      nav.dataset.currentView = this.technicalReportsArchiveOpen ? 'reports' : (this.showDocumentControl ? 'invoices' : this.clientsDirectoryOpen ? 'clients' : this.quoteArchiveInlineOpen ? 'quotes' : this.showArchivedTasks ? 'archived' : 'active');
      nav.querySelectorAll('[data-order-view], #btn-archived-quotes').forEach(item => {
        const key = item.dataset.orderView || (item.id === 'btn-archived-quotes' ? 'quotes' : '');
        const selected = this.technicalReportsArchiveOpen ? key === 'reports' : key === nav.dataset.currentView;
        item.classList.toggle('is-current', selected);
        item.setAttribute('aria-current', selected ? 'page' : 'false');
        item.setAttribute('aria-pressed', String(selected));
      });
    };

    proto.openTechnicalReportsArchive = async function () {
      if (this.currentUser?.role !== 'admin') return this.showToast?.('Esta sección está disponible para el administrador.', 'error');
      const requestId = ++reportsNavigationRequest;
      this.showDocumentControl = false;
      this.clientsDirectoryOpen = false;
      this.quoteArchiveInlineOpen = false;
      this.quoteConsolidationOpen = false;
      this.showArchivedTasks = false;
      this.technicalReportsArchiveOpen = true;
      document.getElementById('quotes-shell')?.classList.add('hidden');
      document.body.classList.remove('quotes-open');
      await this.loadTechnicalReports();
      // La carga puede terminar después de que el usuario ya navegó a Clientes u otra vista.
      // Descarta esta respuesta obsoleta para que no reemplace el módulo que está activo.
      if (requestId !== reportsNavigationRequest || !this.technicalReportsArchiveOpen) return;
      this.subscribeTechnicalReports();
      this.renderTechnicalReportsArchive();
    };

    proto.ensureTechnicalReportDownloadSettings = function () {
      // Retirar las antiguas rutas de descarga; ubicación y nombre se eligen
      // en el diálogo Guardar como PDF del navegador.
      document.querySelectorAll('[data-settings-category="technical-report-downloads"], #settings-category-technical-report-downloads, [data-settings-category="quote-route"], #settings-category-quote-route').forEach(element => element.remove());
    };

    const originalShowSettingsCategory = proto.showSettingsCategory;
    if (typeof originalShowSettingsCategory === 'function' && !originalShowSettingsCategory.__technicalReportDownloads70) {
      const wrapped = function (category, ...args) {
        if (category === 'technical-report-downloads') this.ensureTechnicalReportDownloadSettings();
        return originalShowSettingsCategory.call(this, category, ...args);
      };
      wrapped.__technicalReportDownloads70 = true; proto.showSettingsCategory = wrapped;
    }
    const originalOpenSettingsModal = proto.openSettingsModal;
    if (typeof originalOpenSettingsModal === 'function' && !originalOpenSettingsModal.__technicalReportDownloads70) {
      const wrapped = function (...args) {
        this.ensureSettingsWorkspace?.();
        this.ensureTechnicalReportDownloadSettings();
        return originalOpenSettingsModal.apply(this, args);
      };
      wrapped.__technicalReportDownloads70 = true; proto.openSettingsModal = wrapped;
    }

    proto.downloadTechnicalReportPdf = async function (report, documentNode, button) {
      if (this.currentUser?.role !== 'admin') return this.showToast?.('Solo el administrador puede descargar informes.', 'error');
      if (!report || !documentNode) return this.showToast?.('No se encontró el informe para descargar.', 'error');
      const filename = safeReportFilename(report), originalText = button?.innerHTML;
      if (button) { button.disabled = true; button.innerHTML = '<i data-lucide="loader-circle"></i><span>Preparando PDF…</span>'; if (window.lucide) lucide.createIcons({ root: button }); }
      try {
        if (typeof window.printPreviewPdf !== 'function') throw new Error('No está disponible la impresión de la vista previa.');
        await window.printPreviewPdf(documentNode, filename);
        this.showToast?.('En el diálogo de impresión, selecciona “Guardar como PDF” y elige el nombre y la carpeta.', 'info');
      } catch (error) {
        console.error('[INFORMES] No se pudo abrir la impresión del informe.', error);
        this.showToast?.('No se pudo abrir la impresión del informe. Inténtalo nuevamente.', 'error');
      } finally {
        if (button) { button.disabled = false; button.innerHTML = originalText || '<i data-lucide="download"></i><span>Descargar PDF</span>'; if (window.lucide) lucide.createIcons({ root: button }); }
      }
    };

    proto.openTechnicalReportPreview = function (id) {
      if (this.currentUser?.role !== 'admin') return this.showToast?.('Esta vista está disponible para el administrador.', 'error');
      const report = (this.technicalReports || []).find(item => String(item.id) === String(id));
      if (!report) return this.showToast?.('No se encontró el informe solicitado.', 'error');
      let modal = document.getElementById('technical-report-preview-modal');
      if (!modal) { modal = document.createElement('div'); modal.id = 'technical-report-preview-modal'; modal.className = 'technical-report-preview-modal hidden'; document.body.appendChild(modal); }
      const contactFooter = `<footer class="technical-report-document-footer"><svg class="technical-report-footer-accent" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,0 920,0 1000,100 0,100" fill="#8cc63e"></polygon></svg><span>${escapeHtml(FOOTER.email)}</span><span>${escapeHtml(FOOTER.address)}</span><span>${escapeHtml(FOOTER.phones)}</span></footer>`;
      modal.innerHTML = `<section class="technical-report-preview-shell" role="dialog" aria-modal="true" aria-label="Vista previa del informe"><header class="technical-report-preview-controls"><b>${escapeHtml(report.number)} · Vista previa</b><div><button type="button" data-report-download><i data-lucide="download"></i><span>Descargar PDF</span></button><button type="button" data-report-preview-close aria-label="Cerrar">×</button></div></header><div class="technical-report-print-root"><article class="technical-report-document"><header class="technical-report-document-header"><div class="technical-report-green-bar"></div><div class="technical-report-black-banner"><canvas class="technical-report-black-banner-shape" aria-hidden="true"></canvas><b>INFORME TÉCNICO</b><span>${escapeHtml(report.number)}</span></div><img src="assets/media/invoice-pdf-company-logo.png" alt="ServiPortones Eléctricos Martínez"></header><main class="technical-report-document-body"><section class="technical-report-general"><h2>Datos Generales</h2><p>Cliente: <b>${escapeHtml(report.client)}</b></p><p>Fecha de inspección: ${escapeHtml(reportDate(report.inspectionDate))}</p><p>Técnico responsable: ${escapeHtml(report.technician || 'Polo Martínez')}</p></section><div class="technical-report-document-text">${escapeHtml(report.body).replace(/\r?\n/g, '<br>')}</div><section class="technical-report-signature-block"><img src="${escapeHtml(report.signature || signatureSource())}" alt="Firma digital"><b>POLO MARTÍNEZ VALENCIA</b><b>13390420</b><b>Representante legal</b></section></main>${contactFooter}</article></div></section>`;
      modal.classList.remove('hidden');
      drawReportBanner(modal);
      modal.querySelector('[data-report-preview-close]').addEventListener('click', () => modal.classList.add('hidden'));
      modal.querySelector('[data-report-download]').addEventListener('click', event => this.downloadTechnicalReportPdf(report, modal.querySelector('.technical-report-document'), event.currentTarget));
      if (window.lucide) lucide.createIcons();
    };

    const ensureReportAction = () => {
      const quote = document.getElementById('btn-create-quote');
      let button = document.getElementById('btn-create-report');
      if (!button && quote) {
        button = document.createElement('button');
        button.id = 'btn-create-report'; button.type = 'button'; button.className = 'orders-assign-button orders-action-tile';
        button.setAttribute('aria-label', 'Realizar informe'); button.title = 'Realizar informe';
        button.innerHTML = '<img class="orders-action-artwork" src="assets/img/nav/realizar-informe-transparent.png?v=20261105-report-action-icon-1" alt="" aria-hidden="true" decoding="async" fetchpriority="high">';
        quote.insertAdjacentElement('afterend', button);
      }
      if (!button) return;
      if (button.dataset.reportActionBound !== '1') {
        button.dataset.reportActionBound = '1';
        button.addEventListener('click', () => window.app?.openTechnicalReportForm());
      }
      // Lucide keeps data-lucide on generated SVGs. Re-running createIcons()
      // while observing this toolbar would replace the SVG repeatedly and
      // generate an endless MutationObserver loop that freezes the main thread.
      if (window.lucide && button.dataset.reportIconRendered !== '1' && button.querySelector('i[data-lucide]')) {
        button.dataset.reportIconRendered = '1';
        lucide.createIcons({ root: button });
      }
    };

    const syncActionVisibility = () => {
      const button = document.getElementById('btn-create-report');
      if (button) button.classList.toggle('hidden', window.app?.currentUser?.role !== 'admin');
    };
    document.addEventListener('click', event => {
      const viewButton = event.target.closest('#orders-view-navigation [data-order-view]');
      if (!viewButton) return;
      if (viewButton.dataset.orderView === 'archived' || viewButton.dataset.orderView === 'reports') {
        event.preventDefault(); event.stopImmediatePropagation(); window.app?.openTechnicalReportsArchive();
        return;
      }
      if (viewButton.dataset.orderView !== 'clients') clientsNavigationRequest += 1;
      // Invalida cualquier carga asíncrona de informes antes de ejecutar la navegación destino.
      reportsNavigationRequest += 1;
      if (window.app) window.app.technicalReportsArchiveOpen = false;
      if (viewButton.dataset.orderView === 'clients') {
        event.preventDefault(); event.stopImmediatePropagation();
        window.app?.openClientsDirectory?.();
      }
    }, true);
    document.addEventListener('click', event => {
      if (event.target.closest('#btn-create-quote, #btn-assign-order-filter')) app.technicalReportsArchiveOpen = false;
      if (event.target.closest('[data-technical-report-preview-close]')) document.getElementById('technical-report-preview-modal')?.classList.add('hidden');
    }, true);
    ['showActiveOrdersView','showArchivedOrdersView','openQuotesArchive','openDocumentControl','openClientsDirectory','openNewTaskModal'].forEach(method => {
      const original = proto[method];
      if (typeof original !== 'function' || original.__clearReportArchive70) return;
      const wrapped = function (...args) { reportsNavigationRequest += 1; this.technicalReportsArchiveOpen = false; return original.apply(this, args); };
      wrapped.__clearReportArchive70 = true; proto[method] = wrapped;
    });
    const originalOpenClients = proto.openClientsDirectory;
    if (typeof originalOpenClients === 'function' && !originalOpenClients.__refreshClientsDirectory70) {
      const wrappedOpenClients = function (...args) {
        const requestId = ++clientsNavigationRequest;
        const result = originalOpenClients.apply(this, args);
        if (this.currentUser?.role === 'admin') {
          this.startClientDirectorySync?.();
          // Refresh on explicit entry while preserving the existing live Firestore listener.
          const clientDb = window.db;
          if (clientDb?.collection) clientDb.collection('clientes').get().then(snapshot => {
            if (requestId !== clientsNavigationRequest || !this.clientsDirectoryOpen) return;
            this.clientDirectory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderClientsDirectory?.();
          }).catch(error => console.warn('[CLIENTES] No se pudo actualizar el directorio al abrirlo.', error));
        }
        return result;
      };
      wrappedOpenClients.__refreshClientsDirectory70 = true;
      proto.openClientsDirectory = wrappedOpenClients;
    }
    // app-47 copied its original navigation methods directly onto `app`, so
    // later prototype wrappers do not control the actual button click. Replace
    // that own method too and normalize every mutually exclusive route before
    // rendering, preventing a delayed order render from taking over Clients.
    const instanceOpenClients = app.openClientsDirectory;
    if (typeof instanceOpenClients === 'function' && !instanceOpenClients.__stableClientsRoute70) {
      const stableOpenClients = function (...args) {
        if (this.currentUser?.role !== 'admin') return;
        const requestId = ++clientsNavigationRequest;
        reportsNavigationRequest += 1;
        this.technicalReportsArchiveOpen = false;
        this.showDocumentControl = false;
        this.quoteArchiveInlineOpen = false;
        this.quoteConsolidationOpen = false;
        this.showArchivedTasks = false;
        this.clientsDirectoryOpen = true;
        mergeExistingClientSources(this);
        document.getElementById('quotes-shell')?.classList.add('hidden');
        document.body.classList.remove('quotes-open');
        document.getElementById('archived-documents-panel')?.classList.add('hidden');
        const host = document.getElementById('tasks-container');
        host?.classList.remove('hidden');
        host?.style.removeProperty('display');
        host?.style.removeProperty('width');
        host?.style.removeProperty('grid-template-columns');
        const result = instanceOpenClients.apply(this, args);
        // The legacy instance method calls renderTasks itself. Reassert the
        // Clients route after it returns, then render the directory explicitly.
        this.technicalReportsArchiveOpen = false;
        this.showDocumentControl = false;
        this.quoteArchiveInlineOpen = false;
        this.quoteConsolidationOpen = false;
        this.showArchivedTasks = false;
        this.clientsDirectoryOpen = true;
        mergeExistingClientSources(this);
        this.startClientDirectorySync?.();
        this.renderClientsDirectory?.();
        this.syncTechnicalReportsNavigation?.();
        const clientDb = window.db;
        if (clientDb?.collection) clientDb.collection('clientes').get().then(snapshot => {
          if (requestId !== clientsNavigationRequest || !this.clientsDirectoryOpen || this.showDocumentControl || this.quoteArchiveInlineOpen || this.showArchivedTasks) return;
          this.clientDirectory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          mergeExistingClientSources(this);
          this.renderClientsDirectory?.();
        }).catch(error => console.warn('[CLIENTES] No se pudo actualizar el directorio al abrirlo.', error));
        return result;
      };
      stableOpenClients.__stableClientsRoute70 = true;
      app.openClientsDirectory = stableOpenClients;
    }
    // The security module installs renderTasks directly on the app instance.
    // A prototype-only guard cannot intercept Firestore callbacks in that case.
    const instanceRenderTasks = app.renderTasks;
    if (typeof instanceRenderTasks === 'function' && !instanceRenderTasks.__stableClientsRoute70) {
      const stableRenderTasks = function (...args) {
        const clientsActive = this.currentUser?.role === 'admin' && this.clientsDirectoryOpen && !this.showDocumentControl && !this.quoteArchiveInlineOpen && !this.quoteConsolidationOpen && !this.showArchivedTasks && !this.technicalReportsArchiveOpen;
        if (clientsActive) {
          this.showDocumentControl = false;
          this.quoteArchiveInlineOpen = false;
          this.quoteConsolidationOpen = false;
          this.showArchivedTasks = false;
          mergeExistingClientSources(this);
          const host = document.getElementById('tasks-container');
          host?.classList.remove('hidden');
          host?.style.removeProperty('display');
          host?.style.removeProperty('width');
          host?.style.removeProperty('grid-template-columns');
          document.getElementById('quotes-shell')?.classList.add('hidden');
          document.body.classList.remove('quotes-open');
          document.getElementById('archived-documents-panel')?.classList.add('hidden');
          document.getElementById('empty-state')?.classList.add('hidden');
          this.ensureClientsNav?.();
          this.renderClientsDirectory?.();
          const title = document.getElementById('orders-view-title');
          if (title) title.textContent = 'Clientes';
          document.getElementById('section-admin-audit-log')?.classList.add('hidden');
          this.syncTechnicalReportsNavigation?.();
          return;
        }
        return instanceRenderTasks.apply(this, args);
      };
      stableRenderTasks.__stableClientsRoute70 = true;
      app.renderTasks = stableRenderTasks;
    }
    const instanceRefreshClients = app.refreshClientDirectoryUI;
    if (typeof instanceRefreshClients === 'function' && !instanceRefreshClients.__mergeExistingClients70) {
      const refreshClients = function (...args) {
        mergeExistingClientSources(this);
        return instanceRefreshClients.apply(this, args);
      };
      refreshClients.__mergeExistingClients70 = true;
      app.refreshClientDirectoryUI = refreshClients;
    }
    const originalRenderTasks = proto.renderTasks;
    if (typeof originalRenderTasks === 'function' && !originalRenderTasks.__renderTechnicalReports70) {
      const wrapped = function (...args) {
        if (this.technicalReportsArchiveOpen && this.currentUser?.role === 'admin') { this.renderTechnicalReportsArchive(); return; }
        if (this.technicalReportsArchiveOpen) {
          this.technicalReportsArchiveOpen = false;
          this.technicalReports = [];
        }
        // Firestore dispara renderTasks por cambios en órdenes/usuarios. Si Clientes está
        // abierto, esos callbacks no deben volver a dibujar las tarjetas de Órdenes encima.
        if (this.clientsDirectoryOpen && this.currentUser?.role === 'admin') {
          this.showDocumentControl = false;
          this.quoteArchiveInlineOpen = false;
          this.quoteConsolidationOpen = false;
          this.showArchivedTasks = false;
          this.startClientDirectorySync?.();
          const host = document.getElementById('tasks-container');
          host?.classList.remove('hidden');
          host?.style.removeProperty('display');
          host?.style.removeProperty('width');
          host?.style.removeProperty('grid-template-columns');
          this.ensureClientsNav?.();
          this.renderClientsDirectory?.();
          const title = document.getElementById('orders-view-title');
          if (title) title.textContent = 'Clientes';
          document.getElementById('section-admin-audit-log')?.classList.add('hidden');
          this.syncTechnicalReportsNavigation?.();
          return;
        }
        const result = originalRenderTasks.apply(this, args);
        ensureReportAction();
        this.syncTechnicalReportsNavigation();
        syncActionVisibility();
        return result;
      };
      wrapped.__renderTechnicalReports70 = true; proto.renderTasks = wrapped;
    }
    const initialize = () => { ensureReportAction(); syncActionVisibility(); app.syncTechnicalReportsNavigation(); };
    initialize();
    return true;
  };
  if (!install()) {
    const timer = setInterval(() => { if (install()) clearInterval(timer); }, 50);
    setTimeout(() => clearInterval(timer), 20000);
  }
  window.addEventListener('online', () => { if (window.app?.currentUser?.role === 'admin') window.app.loadTechnicalReports?.(); });
})();
