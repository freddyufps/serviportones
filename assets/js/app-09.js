
(function(){
  const excluded='#header-presence-profile,#admin-presence-control,#admin-presence-toggle,#admin-presence-menu,#worker-admin-presence-card,#admin-identities-list,#settings-admin-identities-section';
  const iconNames={pencil:'Editar',edit:'Editar','edit-2':'Editar','file-edit':'Editar informe',trash:'Eliminar','trash-2':'Eliminar',map:'Ver mapa','map-pin':'GPS',navigation:'Navegar',printer:'Imprimir',eye:'Ver',archive:'Archivar','archive-restore':'Desarchivar',plus:'Agregar','plus-circle':'Nueva orden',settings:'Configuración','log-out':'Cerrar sesión',minus:'Minimizar',x:'Cerrar',save:'Guardar',check:'Confirmar','rotate-ccw':'Actualizar'};
  const labelFor=el=>String(el.getAttribute('title')||el.getAttribute('aria-label')||el.innerText||el.textContent||iconNames[el.querySelector('[data-lucide]')?.getAttribute('data-lucide')]||'').replace(/\s+/g,' ').trim().slice(0,70);
  let tip;
  const hide=()=>{if(tip){tip.hidden=true;tip.textContent=''}};
  const show=el=>{
    if(!tip||!el||el.closest(excluded)||!el.dataset.tooltipLabel)return hide();
    tip.textContent=el.dataset.tooltipLabel;tip.hidden=false;
    const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
    const left=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2));
    let top=r.bottom+7;
    if(top+h>innerHeight-8)top=Math.max(8,r.top-h-7);
    tip.style.left=left+'px';tip.style.top=top+'px';
  };
  const decorate=root=>{
    const nodes=[];
    if(root instanceof Element&&root.matches('button,a,[role="button"]'))nodes.push(root);
    if(root.querySelectorAll)nodes.push(...root.querySelectorAll('button,a,[role="button"]'));
    for(const el of nodes){
      if(el.closest(excluded)){delete el.dataset.professionalTooltip;delete el.dataset.tooltipLabel;continue}
      const label=labelFor(el);if(!label)continue;
      el.dataset.tooltipLabel=label;el.dataset.professionalTooltip='true';el.removeAttribute('title');
    }
  };
  const start=()=>{
    decorate(document);
    tip=document.createElement('div');tip.id='professional-tooltip-float';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.appendChild(tip);
    document.addEventListener('pointerover',e=>{const el=e.target.closest?.('[data-professional-tooltip]');if(el&&!el.contains(e.relatedTarget))show(el)},true);
    document.addEventListener('pointerout',e=>{const el=e.target.closest?.('[data-professional-tooltip]');if(el&&!el.contains(e.relatedTarget))hide()},true);
    document.addEventListener('focusin',e=>{const el=e.target.closest?.('[data-professional-tooltip]');if(el)show(el)},true);
    document.addEventListener('focusout',e=>{if(e.target.closest?.('[data-professional-tooltip]'))hide()},true);
    window.addEventListener('resize',hide,{passive:true});window.addEventListener('scroll',hide,true);
    let queued=false;new MutationObserver(records=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)decorate(node)})}).observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
