/* Capture the company wordmark into the PDF canvas as a same-origin data URI. */
(function(){
  const install=()=>{
    if(!window.app||!app.__quoteModule||app.__quotePdfLogoFix61)return false;
    app.__quotePdfLogoFix61=true;
    const original=app.exportQuotePdf;
    if(!original){app.__quotePdfLogoFix61=false;return false}
    const exportQuotePdf=async function(q,auto){
      if(!q)return;
      if(!await this.ensurePdfLibrary()){
        this.showQuotePreview(q);
        return this.showToast("No se cargó el exportador PDF. Usa Imprimir / Guardar como PDF.","info");
      }
      const host=document.createElement("div");
      host.className="quote-pdf-staging";
      host.innerHTML=document.querySelector("#quote-preview-content .quote-document")?.outerHTML||"";
      if(!host.innerHTML){this.showQuotePreview(q);host.innerHTML=document.getElementById("quote-preview-content")?.querySelector(".quote-document")?.outerHTML||"";}
      if(!host.innerHTML){host.remove();return original.call(this,q,auto)}
      document.body.appendChild(host);
      const doc=host.querySelector(".quote-document");
      try{
        const response=await fetch(new URL("assets/media/spem-logo.png",document.baseURI));
        if(!response.ok)throw new Error("No fue posible leer el logo");
        const blob=await response.blob();
        const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
        const logo=doc.querySelector(".quote-doc-brand img");
        if(logo){logo.src=data;await new Promise((resolve,reject)=>{if(logo.complete&&logo.naturalWidth)return resolve();logo.onload=resolve;logo.onerror=reject})}
        const name=(q.client||"CLIENTE").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"").toUpperCase();
        const filename=q.date+"_"+q.number+"_"+name+".pdf";
        const pdf=await html2pdf().set({margin:[9,10,10,10],filename,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true,allowTaint:false,backgroundColor:"#fff",scrollX:0,scrollY:0},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"]}}).from(doc).toPdf().get("pdf");
        const file=pdf.output("blob"),url=URL.createObjectURL(file),link=document.createElement("a");link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
        if(this.quoteDirectoryHandle){const handle=await this.quoteDirectoryHandle.getFileHandle(filename,{create:true}),writer=await handle.createWritable();await writer.write(file);await writer.close()}
        if(!auto)this.showToast("PDF descargado.","success");
      }catch(error){console.error("[COTIZACIONES]",error);this.showToast("No se pudo generar el PDF. Abre la vista previa para imprimir.","error")}
      finally{host.remove()}
    };
    const archiveExport=app.exportQuotePdf;
    app.exportQuotePdf=exportQuotePdf;
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
    app.downloadArchivedQuotePdf=function(id){const q=(this.quotes||[]).find(item=>item.id===id);return q?exportQuotePdf.call(this,q,false):null};
    return true;
  };
  window.addEventListener("DOMContentLoaded",()=>{const timer=setInterval(()=>{if(install())clearInterval(timer)},50)});
})();
