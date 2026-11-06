/* Imprime directamente el DOM de la vista previa con el motor vectorial del navegador. */
(function(){
  const printPreviewPdf=async(node,filename)=>{
    if(!node)throw new Error("No se encontró el documento de vista previa");
    await document.fonts?.ready;
    await Promise.all(Array.from(node.querySelectorAll("img"),image=>image.decode?.().catch(()=>undefined)));
    const rect=node.getBoundingClientRect(),width=Math.ceil(rect.width),height=Math.ceil(Math.max(rect.height,node.scrollHeight));
    if(!width||!height)throw new Error("La vista previa no tiene dimensiones imprimibles");
    const isQuote=node.matches(".quote-document"),target=isQuote?"#quote-preview-shell":"#technical-report-preview-modal",style=document.createElement("style");
    style.id="spem-exact-preview-print-style";
    style.textContent=`@media print{@page{size:${width}px ${height}px;margin:0}html,body{width:${width}px!important;min-width:0!important;height:${height}px!important;min-height:0!important;margin:0!important;padding:0!important;overflow:visible!important;background:#fff!important}body.printing-preview-document,body.printing-preview-document *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body.printing-preview-document>*:not(${target}){display:none!important}body.printing-preview-document ${target},body.printing-preview-document ${target} *{visibility:visible!important}body.printing-preview-document ${target}{position:static!important;inset:auto!important;display:block!important;width:${width}px!important;height:auto!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}body.printing-preview-document .quotes-scrim,body.printing-preview-document .quote-preview-toolbar,body.printing-preview-document .technical-report-preview-controls{display:none!important}body.printing-preview-document .quote-preview-window,body.printing-preview-document .technical-report-preview-shell{position:static!important;display:block!important;width:${width}px!important;height:auto!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important;border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}body.printing-preview-document .quote-preview-content,body.printing-preview-document .technical-report-print-root{display:block!important;width:${width}px!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;overflow:visible!important;background:#fff!important}body.printing-preview-document .quote-document{box-sizing:border-box!important;width:${width}px!important;max-width:none!important;height:auto!important;min-height:0!important;margin:0!important;box-shadow:none!important;break-after:avoid!important;page-break-after:avoid!important}body.printing-preview-document .technical-report-document{box-sizing:border-box!important;width:${width}px!important;max-width:none!important;height:${height}px!important;min-height:${height}px!important;margin:0!important;box-shadow:none!important;break-after:avoid!important;page-break-after:avoid!important}}`;
    document.head.appendChild(style);
    const oldTitle=document.title,clean=()=>{document.body.classList.remove("printing-preview-document");style.remove();document.title=oldTitle;window.removeEventListener("afterprint",clean)};
    document.title=filename.replace(/\.pdf$/i,"");document.body.classList.add("printing-preview-document");
    window.addEventListener("afterprint",clean,{once:true});
    requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
    return true;
  };
  window.printPreviewPdf=window.printPreviewPdf||printPreviewPdf;
  const saveQuotePdfBlob=async(blob,filename)=>{
    const url=URL.createObjectURL(blob),anchor=document.createElement("a");
    anchor.href=url;anchor.download=filename;anchor.style.display="none";
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return "download";
  };
  const install=()=>{
    if(!window.app||!app.__quoteModule||app.__quotePdfLogoFix61)return false;
    app.__quotePdfLogoFix61=true;
    const original=app.exportQuotePdf;
    if(!original){app.__quotePdfLogoFix61=false;return false}
    const exportQuotePdf=async function(q,auto){
      if(!q)return;
      if(auto){this.showQuotePreview(q);return this.showToast("La cotización quedó guardada. Desde su vista previa puedes seleccionar Guardar PDF.","info")}
      let doc=document.querySelector("#quote-preview-content .quote-document");
      if(!doc||this.quotePreviewQuote?.id!==q.id){this.showQuotePreview(q);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));doc=document.querySelector("#quote-preview-content .quote-document");}
      if(!doc)return this.showToast("No se encontró la vista previa para preparar el PDF. Ábrela e inténtalo de nuevo.","error");
      try{
        const name=(q.client||"CLIENTE").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"").toUpperCase();
        const filename=q.date+"_"+q.number+"_"+name+".pdf";
        // Abrir el selector desde el clic del usuario para permitir elegir carpeta y nombre.
        let fileHandle=null;
        if(window.isSecureContext&&typeof window.showSaveFilePicker==="function"){
          try{fileHandle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:"Documento PDF",accept:{"application/pdf":[".pdf"]}}]})}
          catch(error){if(error?.name==="AbortError")return;console.warn("[COTIZACIONES] No se pudo abrir el selector de destino; se descargará mediante el navegador.",error)}
        }
        await this.embedQuoteLogo?.(doc);
        if(typeof window.spemCreatePreviewPdfBlob!=="function")throw new Error("No está disponible la captura PDF de la vista previa.");
        // Captura el mismo DOM de la vista previa, escalado proporcionalmente al área A4.
        // Así se evita la impresión del navegador (URL, fecha y cabeceras automáticas).
        const blob=await window.spemCreatePreviewPdfBlob(doc,{format:"a4",fitSinglePage:true,marginMm:2});
        if(!blob?.size)throw new Error("El PDF generado está vacío.");
        if(fileHandle){const writable=await fileHandle.createWritable();await writable.write(blob);await writable.close();this.showToast("Cotización guardada en la ubicación elegida.","success");}
        else{await saveQuotePdfBlob(blob,filename);this.showToast("PDF de cotización descargado.","success");}
      }catch(error){
        if(error?.name==="AbortError")return;
        console.error("[COTIZACIONES]",error);
        this.showToast("No se pudo guardar la cotización en PDF. Inténtalo nuevamente.","error");
      }
    };
    app.exportQuotePdf=exportQuotePdf;
    // El botón Guardar PDF y cualquier llamada antigua de cotizaciones usan
    // siempre la captura de la vista previa; nunca abren la impresión del navegador.
    app.downloadQuotePdf=async function(){
      let q=this.quotePreviewQuote?.id===this.quoteCurrentId?this.quotePreviewQuote:(this.quotes||[]).find(item=>item.id===this.quoteCurrentId);
      if(!q){const form=document.getElementById("quote-form");if(form)q=this.collectQuote(form)}
      if(q)return exportQuotePdf.call(this,q,false);
    };
    const nativePreviewPrint=window.printPreviewPdf;
    if(typeof nativePreviewPrint==="function"&&!nativePreviewPrint.__quoteCapture61){
      const previewPrint=async function(node,filename){
        if(node?.matches?.(".quote-document")){
          const quote=app.quotePreviewQuote||(app.quotes||[]).find(item=>item.id===app.quoteCurrentId);
          if(!quote)throw new Error("No se encontró la cotización para exportar.");
          return exportQuotePdf.call(app,quote,false);
        }
        return nativePreviewPrint(node,filename);
      };
      previewPrint.__quoteCapture61=true;
      window.printPreviewPdf=previewPrint;
    }
    if(typeof app.quoteRow==="function"&&!app.__quotePdfLogoRows61){
      app.__quotePdfLogoRows61=true;
      const makeRow=app.quoteRow;
      app.quoteRow=function(q){
        let markup=makeRow.call(this,q);
        const id=JSON.stringify(q.id);
        const old="app.exportQuotePdf(app.quotes.find(x=>x.id==="+id+"),false)";
        const replacement="app.downloadArchivedQuotePdf("+id+")";
        return markup.split(old).join(replacement);
      };
    }
    app.downloadArchivedQuotePdf=function(id){let q=(this.quotes||[]).find(item=>item.id===id);if(!q)return null;if(this.quoteEphemeralImages?.[id])q={...q,items:(q.items||[]).map((item,index)=>({...item,imageData:this.quoteEphemeralImages[id][index]||""}))};this.showQuotePreview?.(q);return exportQuotePdf.call(this,q,false)};
    return true;
  };
  window.addEventListener("DOMContentLoaded",()=>{const timer=setInterval(()=>{if(install())clearInterval(timer)},50)});
})();
