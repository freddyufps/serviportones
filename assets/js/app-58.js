(() => {
  'use strict';
  const HISTORY_KEY = 'spem_document_download_history_v1';
  const TASKS_KEY = 'portonpro_tasks_v4';
  const QUOTES_KEY = 'spem_quotes_v1';
  const DB_NAME = 'serviportones_documents_fs_v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, ' ');
  const pdfText = value => plain(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const fmtDate = () => new Intl.DateTimeFormat('es-CO',{dateStyle:'short',timeStyle:'short'}).format(new Date());
  const money = n => '$ ' + new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(Number(n)||0);
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
  const LOCAL_TASK_OVERRIDES_KEY = 'spem_local_task_overrides_v1';
  const localTaskOverrides = () => readJson(LOCAL_TASK_OVERRIDES_KEY, {});
  function keepLocalTask(task) { const rows=localTaskOverrides();rows[String(task.id)]=JSON.parse(JSON.stringify(task));try{localStorage.setItem(LOCAL_TASK_OVERRIDES_KEY,JSON.stringify(rows));}catch(error){console.warn('[LOCAL] No se pudo guardar la cola local de sincronización.',error);} }
  function mergeLocalTaskOverrides(app) { const rows=localTaskOverrides();if(!Object.keys(rows).length||!app)return;const current=Array.isArray(app.tasks)?app.tasks:[],seen=new Set();app.tasks=current.map(remote=>{const id=String(remote?.id??'');if(rows[id]){seen.add(id);return {...remote,...rows[id]};}return remote;});Object.keys(rows).forEach(id=>{if(!seen.has(id))app.tasks.push(rows[id]);});try{localStorage.setItem(TASKS_KEY,JSON.stringify(app.tasks));}catch{} }
  function syncLocalTaskOverrides(app) {
    if(!app||!window.db||!navigator.onLine)return;
    const queued=localTaskOverrides();
    if(!Object.keys(queued).length)return;
    Promise.resolve().then(()=>app.saveTasks?.(false)).then(result=>{
      if(!result?.ok){console.warn('[LOCAL] Los cambios siguen guardados en este dispositivo; Firestore no aceptó la sincronización.');return;}
      const latest=localTaskOverrides();
      Object.keys(queued).forEach(id=>{if(JSON.stringify(latest[id])===JSON.stringify(queued[id]))delete latest[id];});
      try{if(Object.keys(latest).length)localStorage.setItem(LOCAL_TASK_OVERRIDES_KEY,JSON.stringify(latest));else localStorage.removeItem(LOCAL_TASK_OVERRIDES_KEY);localStorage.setItem(TASKS_KEY,JSON.stringify(app.tasks||[]));}catch(error){console.warn('[LOCAL] No se pudo actualizar la cola local tras sincronizar.',error);}
    }).catch(error=>console.warn('[LOCAL] Los cambios siguen guardados en este dispositivo; Firestore no sincronizó.',error));
  }

  const history = () => readJson(HISTORY_KEY, []);
  const safeName = value => plain(value).replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,70) || 'Documento';

  function makePdf(title, rows) {
    const lines = [title, 'ServiPortones Electricos Martinez', 'Generado: ' + fmtDate(), ''];
    rows.forEach(([label,value]) => {
      const text = plain((label ? label + ': ' : '') + (value || '—'));
      for (let i=0;i<text.length;i+=88) lines.push(text.slice(i,i+88));
    });
    const pages = [];
    for (let i=0;i<lines.length;i+=48) pages.push(lines.slice(i,i+48));
    const objects = [], add = value => (objects.push(value), objects.length);
    const catalog = add(''), pagesId = add(''), font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'), refs=[];
    pages.forEach(pageLines => {
      let stream='BT\n/F1 10 Tf\n48 790 Td\n14 TL\n';
      pageLines.forEach((line,index) => { if(index) stream+='T*\n'; stream+='('+pdfText(line)+') Tj\n'; });
      stream+='ET';
      const content=add('<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream');
      refs.push(add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+font+' 0 R >> >> /Contents '+content+' 0 R >>')+' 0 R');
    });
    objects[catalog-1]='<< /Type /Catalog /Pages '+pagesId+' 0 R >>';
    objects[pagesId-1]='<< /Type /Pages /Kids ['+refs.join(' ')+'] /Count '+refs.length+' >>';
    let out='%PDF-1.4\n'; const offsets=[0];
    objects.forEach((object,index)=>{offsets.push(out.length);out+=(index+1)+' 0 obj\n'+object+'\nendobj\n';});
    const xref=out.length; out+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
    for(let i=1;i<offsets.length;i++) out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    out+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
    return new Blob([out],{type:'application/pdf'});
  }
  const quoteRows = q => [['Cotización',q.number],['Cliente',q.client],['Condominio',q.condo],['Dirección',q.address],['Ciudad',q.city],['Teléfono',q.phone],['Correo',q.email],['Fecha',q.date],['Asesor',q.advisor],['Resumen',q.summary],['Alcance',(q.scope||[]).join(', ')],['Descripción técnica',q.technical],...(q.items||[]).map((x,i)=>['Ítem '+(i+1),x.description+' | '+x.quantity+' x '+money(x.unit)]),['Subtotal',money(q.subtotal)],['Impuestos',money(q.taxValue)],['Total',money(q.total)],['Condiciones',q.payment],['Garantía',q.warranty],['Observaciones',q.notes]];
  const invoiceRows = t => [['Factura',t.invoiceNumber?'FE-'+String(t.invoiceNumber).replace(/^FE-/i,''):'Pendiente de número'],['Pago',t.paymentStatus||'PENDIENTE'],['Orden',t.id],['Fecha de realización',t.workDate||t.date||''],['Cliente',t.client||t.clientName],['Administrador / contacto',t.administrator||t.adminContact||t.contact],['Teléfono',t.phone||t.clientPhone],['Dirección',t.address],['Servicio',t.reason||t.service||t.workType],['Técnico',t.technicianName||t.assignedTo||t.technician],['Por hacer',t.instructions||t.workToDo||t.todo],['Trabajo realizado',t.completedWork||t.workDone||t.report?.description||t.report?.details],['Observaciones',t.observations||t.workObservations||t.report?.observations],['Valor',money(t.workValue)]];
  function addHistory(row) {
    const rows=history(); rows.unshift({...row,downloadedAt:new Date().toISOString()});
    try { localStorage.setItem(HISTORY_KEY,JSON.stringify(rows.slice(0,150))); } catch(e) { console.warn('[PDF] No se pudo actualizar el historial local.',e); }
    window.app?.renderDocumentDownloadHistory?.();
  }
  function updateLatestHistory(filename, type, destination) {
    const rows=history(), row=rows.find(item=>item.filename===filename&&item.type===type);
    if(row){row.destination=destination;try{localStorage.setItem(HISTORY_KEY,JSON.stringify(rows));}catch{};window.app?.renderDocumentDownloadHistory?.();}
  }
  function download(blob,filename) {
    const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url;a.download=filename;a.style.display='none';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function openPreview(blob,filename) {
    const url=URL.createObjectURL(blob);let box=document.getElementById('spem-pdf-preview');
    if(!box){box=document.createElement('div');box.id='spem-pdf-preview';box.className='spem-pdf-preview';document.body.appendChild(box);box.addEventListener('click',e=>{if(e.target===box||e.target.closest('[data-pdf-close]')){box.classList.remove('is-open');const frame=box.querySelector('iframe');if(frame)frame.src='about:blank';}});}
    box.innerHTML='<section><header><b>'+esc(filename)+'</b><button type="button" data-pdf-download>Descargar PDF</button><button type="button" data-pdf-close aria-label="Cerrar">×</button></header><iframe title="Vista previa PDF" src="'+url+'"></iframe></section>';
    box.querySelector('[data-pdf-download]').onclick=()=>download(blob,filename);box.classList.add('is-open');
  }
  function openDb() {
    return new Promise((resolve,reject)=>{if(!indexedDB)return resolve(null);const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('handles'))req.result.createObjectStore('handles');};req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);});
  }
  async function storeHandle(value) { try {const db=await openDb();if(!db)return;await new Promise((resolve,reject)=>{const tx=db.transaction('handles','readwrite');if(value)tx.objectStore('handles').put(value,'documents-root');else tx.objectStore('handles').delete('documents-root');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch(e){console.warn('[PDF] No se guardó el permiso de carpeta.',e);} }
  async function restoreHandle() { try {const db=await openDb();if(!db)return null;const result=await new Promise((resolve,reject)=>{const tx=db.transaction('handles','readonly'),req=tx.objectStore('handles').get('documents-root');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});db.close();return result;}catch{return null;} }
  async function writeToChosenFolder(blob,filename,folderName,root) {
    if(!root)return false;
    try {
      if(root.queryPermission&&await root.queryPermission({mode:'readwrite'})!=='granted'&&await root.requestPermission({mode:'readwrite'})!=='granted')return false;
      const folder=await root.getDirectoryHandle(folderName,{create:true});
      const file=await folder.getFileHandle(filename,{create:true});
      const stream=await file.createWritable();await stream.write(blob);await stream.close();return true;
    } catch(error) { console.warn('[PDF] No se pudo copiar a carpeta elegida; el navegador descargará el PDF.',error);return false; }
  }

  function install() {
    const app=window.app, proto=app?.constructor?.prototype;
    if(!app||!proto||app.__documents58)return false;
    app.__documents58=true;

    proto.recordAndDownloadPdf=async function(blob,filename,meta={},showPreview=false) {
      // Trigger the browser download immediately; a failed cloud or folder write must never block it.
      download(blob,filename);
      const folderName=meta.folder||'Documentos';
      addHistory({type:meta.type||'Documento',number:meta.number||'',client:meta.client||'',filename,destination:'Descargas del navegador'});
      if(showPreview)openPreview(blob,filename);
      if(this.documentsDirectoryHandle) {
        const rootName=this.documentsDirectoryHandle.name;
        const copied=await writeToChosenFolder(blob,filename,folderName,this.documentsDirectoryHandle);
        if(copied)updateLatestHistory(filename,meta.type||'Documento','Descargas + carpeta '+rootName+'/'+folderName);
      }
      return true;
    };
    proto.exportQuotePdf=async function(q,automatic=false) {
      if(!q)return false;
      try {const blob=makePdf('COTIZACIÓN '+(q.number||''),quoteRows(q));const filename=safeName((q.date||'')+'_'+(q.number||'Cotizacion')+'_'+q.client)+'.pdf';return await this.recordAndDownloadPdf(blob,filename,{type:'Cotización',number:q.number,client:q.client,folder:'Cotizaciones'},!automatic);}
      catch(error){console.error('[PDF COTIZACIÓN]',error);this.showToast?.('La cotización quedó guardada localmente, pero no se pudo crear su PDF.','error');return false;}
    };
    proto.downloadQuotePdf=async function(){let q=(this.quotes||[]).find(item=>item.id===this.quoteCurrentId);if(!q){const form=document.getElementById('quote-form');if(form)q=this.collectQuote(form);}if(q)return this.exportQuotePdf(q,false);};

    proto.saveQuote=async function(event) {
      event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
      const q=this.collectQuote(form);if(!q.items?.length)return this.showToast('Agrega al menos un producto o servicio.','error');
      const quotes=Array.isArray(this.quotes)?this.quotes:readJson(QUOTES_KEY,[]),old=quotes.find(item=>item.id===q.id);
      q.createdAt=old?.createdAt||q.updatedAt;
      const idx=quotes.findIndex(item=>item.id===q.id);
      if(idx<0){quotes.unshift(q);const year=new Date().getFullYear(),key='spem_quote_seq_'+year;localStorage.setItem(key,String((Number(localStorage.getItem(key))||1)+1));}
      else quotes[idx]=q;
      try {localStorage.setItem(QUOTES_KEY,JSON.stringify(quotes));} catch(error) {return this.showToast('No hay espacio local para guardar la cotización; libera espacio e inténtalo otra vez.','error');}
      this.quotes=quotes;
      if(q.client&&this.saveClientRecord){Promise.resolve().then(()=>this.saveClientRecord({name:q.client,condo:q.condo,address:q.address,email:q.email,phone:q.phone})).catch(error=>console.warn('[CLIENTES] Cotización local; cliente no sincronizado.',error));}
      if(q.orderId){const task=(this.tasks||[]).find(item=>String(item.id)===String(q.orderId));if(task){task.quoteIds=Array.from(new Set([...(task.quoteIds||[]),q.id]));try{localStorage.setItem(TASKS_KEY,JSON.stringify(this.tasks));keepLocalTask(task);syncLocalTaskOverrides(this);}catch(error){console.warn('[ORDEN] Cotización guardada; no se pudo asociar localmente a la orden.',error);}}}
      if(window.db&&navigator.onLine){Promise.resolve().then(()=>db.collection('cotizaciones').doc(q.id).set(q,{merge:true})).catch(error=>console.warn('[COTIZACIONES] Guardada localmente; Firestore no sincronizó.',error));}
      this.renderQuotesCount?.();this.decorateQuoteOrderCards?.();this.closeQuotes?.();
      this.showToast(window.db&&navigator.onLine?'Cotización guardada en este dispositivo; sincronización en segundo plano.':'Cotización guardada localmente; Firestore no disponible.','info');
      await this.exportQuotePdf(q,true);
    };

    proto.saveOrderInvoiceNumber=async function(id,rawNumber,rawValue) {
      if(this.currentUser?.role!=='admin')return this.showToast('Solo el administrador puede registrar facturas.','error');
      const task=(this.tasks||[]).find(item=>String(item.id)===String(id));
      if(!task)return this.showToast('No se encontró la orden.','error');
      if(task.status!=='REALIZADA')return this.showToast('Solo puedes facturar órdenes realizadas.','error');
      const number=String(rawNumber??'').trim().replace(/^FE-/i,'').trim(),valueText=String(rawValue??'').trim();
      const workValue=valueText===''?null:Number(valueText);
      if(valueText!==''&&(!Number.isFinite(workValue)||workValue<0))return this.showToast('Escribe un valor válido para el trabajo.','error');
      const previous=JSON.parse(JSON.stringify(task));
      task.invoiceNumber=number;task.paymentStatus='PENDIENTE';task.workValue=workValue;
      if(number)task.invoiceIssuedAt=task.invoiceIssuedAt||Date.now();else delete task.invoiceIssuedAt;
      task.archivedAt=task.archivedAt||Date.now();task.archivedBy=task.archivedBy||this.getCurrentDisplayName?.()||'Administrador';
      try {localStorage.setItem(TASKS_KEY,JSON.stringify(this.tasks));}
      catch(error){Object.keys(task).forEach(key=>{if(!(key in previous))delete task[key];});Object.assign(task,previous);return this.showToast('No hay espacio local para guardar la factura; libera espacio e inténtalo otra vez.','error');}
      keepLocalTask(task);
      document.getElementById('payment-invoice-dialog')?.classList.add('hidden');this.updateStats?.();this.renderTasks?.();
      this.showToast(window.db&&navigator.onLine?'Factura guardada localmente como pendiente; sincronizando en segundo plano.':'Factura guardada localmente como pendiente.','info');
      syncLocalTaskOverrides(this);
      const blob=makePdf('FACTURA '+(number?'FE-'+number:''),invoiceRows(task));
      await this.recordAndDownloadPdf(blob,safeName('FE_'+(number||'Pendiente')+'_'+(task.client||task.clientName))+'.pdf',{type:'Factura',number:number?'FE-'+number:'Pendiente',client:task.client||task.clientName,folder:'Facturas'},false);
      return true;
    };

    proto.renderDocumentDownloadHistory=function() {
      const host=document.getElementById('spem-docs-history');if(!host)return;
      const rows=history();host.innerHTML=rows.length?'<div class="spem-docs-history-list">'+rows.slice(0,40).map(row=>'<article><span>'+esc(new Intl.DateTimeFormat('es-CO',{dateStyle:'short',timeStyle:'short'}).format(new Date(row.downloadedAt)))+'</span><b>'+esc(row.type)+' · '+esc(row.number||'Sin número')+'</b><span>'+esc(row.client||'Cliente')+'</span><small>'+esc(row.filename)+' — '+esc(row.destination)+'</small></article>').join('')+'</div>':'<p class="spem-docs-empty">Aún no hay archivos descargados desde este dispositivo.</p>';
    };
    proto.ensureDocumentSettings=function() {
      const content=document.getElementById('settings-category-content'),nav=document.querySelector('#settings-workspace .settings-category-nav');if(!content||!nav)return;
      let button=nav.querySelector('[data-settings-category="documents"]');
      if(!button){button=document.createElement('button');button.type='button';button.className='settings-category-button';button.dataset.settingsCategory='documents';button.dataset.adminOnly='true';button.innerHTML='<i data-lucide="file-down"></i><span><b>Facturas y Descargas</b><small>Carpeta e historial de PDF.</small></span>';nav.appendChild(button);button.addEventListener('click',()=>this.showSettingsCategory('documents'));}
      let panel=document.getElementById('settings-category-documents');
      if(!panel){panel=document.createElement('section');panel.id='settings-category-documents';panel.className='settings-category-panel hidden';panel.innerHTML='<div class="settings-category-title"><div><h4>Facturas y Descargas</h4><p>Los PDF se descargan en la carpeta Descargas del navegador. Si el navegador lo permite, también puedes guardar una copia organizada.</p></div></div><div class="spem-docs-settings"><div class="spem-docs-location"><b>Ubicación</b><span id="spem-docs-location-label">Descargas del navegador</span><div><button type="button" id="spem-docs-choose">Elegir carpeta para copias</button><button type="button" id="spem-docs-reset">Restaurar por defecto</button></div><small>La página no puede cambiar la carpeta Descargas predeterminada de Windows o del navegador. En móviles o en file:// se usará Descargas.</small></div><h4>Historial de documentos</h4><div id="spem-docs-history"></div></div>';content.appendChild(panel);panel.addEventListener('click',async event=>{if(event.target.closest('#spem-docs-choose')){if(!window.showDirectoryPicker)return this.showToast('Este navegador no permite seleccionar carpetas; se usará Descargas.','info');try{this.documentsDirectoryHandle=await window.showDirectoryPicker({id:'serviportones-docs',mode:'readwrite'});await storeHandle(this.documentsDirectoryHandle);this.renderDocumentDownloadHistory();this.showToast('Carpeta configurada para guardar una copia de los PDF.','success');}catch(error){if(error.name!=='AbortError')this.showToast('No se pudo seleccionar la carpeta; los PDF seguirán descargándose normalmente.','info');}}if(event.target.closest('#spem-docs-reset')){this.documentsDirectoryHandle=null;await storeHandle(null);this.renderDocumentDownloadHistory();this.showToast('Restaurada la ubicación: Descargas del navegador.','success');}});}
      const label=document.getElementById('spem-docs-location-label');if(label)label.textContent=this.documentsDirectoryHandle?.name||'Descargas del navegador';this.renderDocumentDownloadHistory();if(window.lucide)lucide.createIcons();
    };
    const originalRenderTasks=proto.renderTasks;proto.renderTasks=function(...args){mergeLocalTaskOverrides(this);return originalRenderTasks?.apply(this,args);};
    const originalUpdateStats=proto.updateStats;proto.updateStats=function(...args){mergeLocalTaskOverrides(this);return originalUpdateStats?.apply(this,args);};
    window.addEventListener('online',()=>syncLocalTaskOverrides(window.app));
    const originalOpen=proto.openSettingsModal;proto.openSettingsModal=function(...args){const result=originalOpen.apply(this,args);if(this.currentUser?.role==='admin')setTimeout(()=>this.ensureDocumentSettings(),0);return result;};
    // Facturas y pagos se confirman primero en este dispositivo. Firestore queda
    // como sincronización opcional: un fallo de nube no revierte ni bloquea el cambio local.
    proto.saveOrderPaymentValue=async function(id,rawValue) {
      if(this.currentUser?.role!=="admin")return this.showToast("Solo el administrador puede cambiar el valor.","error");
      const task=(this.tasks||[]).find(item=>String(item.id)===String(id));
      if(!task||task.status!=="REALIZADA")return this.showToast("Solo puedes cambiar el valor de órdenes realizadas.","error");
      const text=String(rawValue??"").trim(),value=text===""?null:Number(text);
      if(text!==""&&(!Number.isFinite(value)||value<0))return this.showToast("Escribe un valor válido.","error");
      const previous=task.workValue;task.workValue=value;
      try{localStorage.setItem(TASKS_KEY,JSON.stringify(this.tasks));}catch(error){if(previous===undefined)delete task.workValue;else task.workValue=previous;return this.showToast("No hay espacio local para guardar el valor.","error");}
      keepLocalTask(task);
      document.getElementById("payment-value-dialog")?.classList.add("hidden");this.updateStats?.();this.renderTasks?.();this.showToast("Valor guardado en este dispositivo.","success");
      syncLocalTaskOverrides(this);
      return true;
    };
    proto.saveOrderPaymentStatus=async function(id,nextStatus) {
      if(this.currentUser?.role!=="admin")return this.showToast("Solo el administrador puede cambiar el estado del pago.","error");
      const task=(this.tasks||[]).find(item=>String(item.id)===String(id));
      if(!task||task.status!=="REALIZADA")return this.showToast("Solo puedes actualizar pagos de órdenes realizadas.","error");
      const previous={paymentStatus:task.paymentStatus,paymentDate:task.paymentDate};
      const status=nextStatus==="PAGADA"?"PAGADA":"PENDIENTE";task.paymentStatus=status;
      if(status==="PAGADA")task.paymentDate=Date.now();else delete task.paymentDate;
      try{localStorage.setItem(TASKS_KEY,JSON.stringify(this.tasks));}catch(error){if(previous.paymentStatus===undefined)delete task.paymentStatus;else task.paymentStatus=previous.paymentStatus;if(previous.paymentDate===undefined)delete task.paymentDate;else task.paymentDate=previous.paymentDate;return this.showToast("No hay espacio local para guardar el pago.","error");}
      keepLocalTask(task);
      this.updateStats?.();this.renderTasks?.();this.showToast(status==="PAGADA"?"Pago guardado en este dispositivo.":"Pago pendiente guardado en este dispositivo.","success");
      syncLocalTaskOverrides(this);
      return true;
    };    const originalCategory=proto.showSettingsCategory;proto.showSettingsCategory=function(category){if(category==='documents'&&this.currentUser?.role!=='admin')category='account';if(category==='documents')this.ensureDocumentSettings();const result=originalCategory.call(this,category);if(category==='documents'){const content=document.getElementById('settings-category-content');content?.querySelectorAll('.settings-category-panel').forEach(panel=>panel.classList.add('hidden'));document.getElementById('settings-category-documents')?.classList.remove('hidden');document.querySelectorAll('#settings-workspace .settings-category-button').forEach(button=>button.classList.toggle('active',button.dataset.settingsCategory==='documents'));this.renderDocumentDownloadHistory();}return result;};
    const originalRender=proto.renderDocumentControlRecords;proto.renderDocumentControlRecords=function(...args){const result=originalRender?.apply(this,args);document.querySelectorAll('#payment-table-area [data-payment-view]').forEach(button=>{const id=button.dataset.paymentView,actions=button.closest('.payment-order-actions');if(!actions||actions.querySelector('[data-invoice-pdf="'+CSS.escape(id)+'"]'))return;actions.insertAdjacentHTML('beforeend','<button type="button" class="spem-invoice-pdf" data-invoice-pdf="'+esc(id)+'" title="Vista previa y descarga PDF"><i data-lucide="file-down"></i><span>PDF</span></button>');});if(window.lucide)lucide.createIcons();return result;};
    document.addEventListener('click',async event=>{const button=event.target.closest('[data-invoice-pdf]');if(!button)return;const task=(window.app?.tasks||[]).find(item=>String(item.id)===String(button.dataset.invoicePdf));if(!task)return;const blob=makePdf('FACTURA '+(task.invoiceNumber?'FE-'+String(task.invoiceNumber).replace(/^FE-/i,''):''),invoiceRows(task)),filename=safeName('FE_'+(task.invoiceNumber||'Pendiente')+'_'+(task.client||task.clientName))+'.pdf';openPreview(blob,filename);addHistory({type:'Vista previa factura',number:task.invoiceNumber?'FE-'+task.invoiceNumber:'Pendiente',client:task.client||task.clientName,filename,destination:'Vista previa del navegador'});});
    const restored=restoreHandle();restored.then(async handle=>{if(handle&&await handle.queryPermission?.({mode:'readwrite'})==='granted'&&window.app)window.app.documentsDirectoryHandle=handle;});
    return true;
  }
  let attempts=0;const timer=setInterval(()=>{if(install()||++attempts>300)clearInterval(timer);},100);
})();

