
(function(){
  const C=typeof PortonProApp!=='undefined'?PortonProApp:null;
  if(!C?.prototype?.renderActiveChatHeader)return;
  const previous=C.prototype.renderActiveChatHeader;
  C.prototype.renderActiveChatHeader=function(){
    previous.call(this);
    if(this.currentUser?.role==='admin')return;
    const host=document.querySelector('#chat-window-modal .chat-brand-mark');
    const info=this.getAdminPresenceInfo?.();
    if(!host||!info)return;
    const records=Object.values(this.presenceRecords||{});
    const adminRecord=records.find(record=>String(record?.role||'').toLowerCase()==='admin')||{};
    const activeName=String(adminRecord.activeAdminName||info.name||this.activeAdminName||'Administrador');
    const photo=adminRecord.adminIdentityPhotos?.[activeName]||this.adminIdentityPhotos?.[activeName]||info.photo||'';
    const status=String(info.status||'disconnected');
    const safe=value=>this.escapeHtml?this.escapeHtml(String(value)):String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const avatar=photo?'<img src="'+safe(photo)+'" alt="Foto de '+safe(activeName)+'">':safe(activeName.trim().charAt(0).toUpperCase()||'A');
    const cardClass=status==='available'?' presence-card-connected':status==='absent'?' presence-card-absent':'';
    host.classList.add('chat-admin-identity');
    host.setAttribute('aria-label','Administrador activo: '+activeName);
    host.innerHTML='<div class="chat-admin-header-card'+cardClass+'"><span class="chat-admin-header-avatar seasonal-worker-avatar">'+avatar+'</span><span class="chat-admin-header-copy"><span class="chat-admin-header-name">'+safe(activeName)+'</span><span class="chat-admin-header-role">Administrador</span><span class="chat-admin-header-status is-'+safe(status)+'">'+safe(this.getPresenceLabel?.(status)||'Desconectado')+'</span></span></div>';
  };
})();
