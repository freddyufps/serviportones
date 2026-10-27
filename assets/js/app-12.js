
(function(){
  const C=typeof PortonProApp!=='undefined'?PortonProApp:null;
  if(!C?.prototype?.renderActiveChatHeader)return;
  const previous=C.prototype.renderActiveChatHeader;
  C.prototype.renderActiveChatHeader=function(){
    previous.call(this);
    if(this.currentUser?.role==='admin')return;
    const host=document.querySelector('#chat-window-modal .chat-brand-mark');
    const source=document.getElementById('worker-admin-presence-card');
    if(!host||!source)return;
    const card=source.cloneNode(true);
    const status=this.getAdminPresenceInfo?.()?.status||'disconnected';
    card.id='chat-admin-presence-header-card';
    card.className='chat-admin-presence-inline-card '+(status==='available'?'presence-card-connected':status==='absent'?'presence-card-absent':'');
    host.classList.add('chat-admin-identity');
    host.setAttribute('aria-label','Administrador activo: '+(this.getAdminPresenceInfo?.()?.name||'Administrador'));
    host.innerHTML=card.outerHTML;
  };
})();
