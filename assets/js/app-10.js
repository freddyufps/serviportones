
(function(){
  const AppClass=typeof PortonProApp!=='undefined'?PortonProApp:null;
  if(AppClass?.prototype?.renderActiveChatHeader){
    const original=AppClass.prototype.renderActiveChatHeader;
    const mark=document.querySelector('#chat-window-modal .chat-brand-mark');
    const originalMarkup=mark?.innerHTML||'';
    AppClass.prototype.renderActiveChatHeader=function(){
      original.call(this);
      const logo=document.querySelector('#chat-window-modal .chat-brand-mark');
      if(!logo)return;
      if(this.currentUser?.role==='admin'){
        if(logo.classList.contains('chat-admin-identity')){logo.innerHTML=originalMarkup;logo.classList.remove('chat-admin-identity');logo.setAttribute('aria-label','ServiPortones');}
        return;
      }
      const admin=this.getAdminPresenceInfo?.();
      if(!admin)return;
      const name=String(admin.name||'Administrador');
      const status=String(admin.status||'disconnected');
      const safe=value=>this.escapeHtml?this.escapeHtml(value):String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const avatar=admin.photo?'<img src="'+safe(admin.photo)+'" alt="Foto de '+safe(name)+'">':safe(name.trim().charAt(0).toUpperCase()||'A');
      logo.classList.add('chat-admin-identity');
      logo.setAttribute('aria-label','Conversación con '+name);
      logo.innerHTML='<span class="chat-admin-identity-avatar seasonal-worker-avatar">'+avatar+'</span><span class="chat-admin-identity-copy"><span class="chat-admin-identity-name">'+safe(name)+'</span><span class="chat-admin-identity-status is-'+safe(status)+'">Administrador · '+safe(this.getPresenceLabel?.(status)||'Desconectado')+'</span></span>';
    };
  }
  const inMessage=target=>target instanceof Element?target.closest('#chat-window-modal #chat-messages-container .chat-message-row'):null;
  document.addEventListener('selectstart',event=>{if(matchMedia('(max-width: 639px)').matches&&inMessage(event.target))event.preventDefault();},true);
  document.addEventListener('contextmenu',event=>{if(matchMedia('(max-width: 639px)').matches&&inMessage(event.target)){event.preventDefault();}},true);
  document.addEventListener('selectionchange',()=>{
    if(!matchMedia('(max-width: 639px)').matches)return;
    const selection=getSelection();
    if(selection?.rangeCount&&inMessage(selection.anchorNode?.parentElement)){selection.removeAllRanges();}
  });
})();
