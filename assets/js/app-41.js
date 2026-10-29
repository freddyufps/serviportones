(function(){'use strict';function enhance(){const dialog=document.getElementById('payment-order-preview');if(!dialog||dialog.classList.contains('hidden'))return;dialog.querySelectorAll('.payment-order-preview-evidence li a').forEach(a=>{if(a.querySelector('img'))return;const href=a.getAttribute('href')||'';if(!/^data:image\//i.test(href)&&!(/\.(png|jpe?g|gif|webp|avif|bmp|svg)(?:[?#]|$)/i.test(href)))return;const label=(a.textContent||'Evidencia').trim().replace(/\s*↗\s*$/,'');const img=document.createElement('img');img.src=href;img.alt=label||'Evidencia fotográfica';img.loading='lazy';img.decoding='async';const caption=document.createElement('span');caption.textContent=label||'Ver evidencia';a.textContent='';a.append(img,caption);a.closest('li')?.classList.add('has-preview-image');});}const proto=window.PortonProApp?.prototype;if(proto&&typeof proto.openPaymentOrderPreview==='function'&&!proto.openPaymentOrderPreview.__premiumView){const original=proto.openPaymentOrderPreview;const wrapped=function(...args){const result=original.apply(this,args);requestAnimationFrame(enhance);return result};wrapped.__premiumView=true;proto.openPaymentOrderPreview=wrapped;}document.addEventListener('click',e=>{if(e.target.closest('[data-payment-view],[data-order-preview-close]'))requestAnimationFrame(enhance)},true);})();


// Selecting a desktop contact keeps both the contact list and its conversation visible.
(function(){const proto=window.PortonProApp?.prototype;if(!proto||typeof proto.selectChatConversation!=="function"||proto.selectChatConversation.__keepContactsAndChat)return;const original=proto.selectChatConversation;const wrapped=function(...args){const result=original.apply(this,args);if(this.currentUser?.role==="admin"&&window.innerWidth>=640){document.getElementById("chat-window-modal")?.classList.remove("hidden");document.getElementById("chat-desktop-windows")?.classList.remove("hidden");this.renderMessengerWindows?.()}return result};wrapped.__keepContactsAndChat=true;proto.selectChatConversation=wrapped})();

/* Move minimized chat windows into their own persistent desktop tray. */
(function(){
  const proto=window.PortonProApp?.prototype;
  if(!proto||typeof proto.renderMessengerWindows!=="function"||proto.renderMessengerWindows.__separateMinimizedTray)return;
  const original=proto.renderMessengerWindows;
  const wrapped=function(...args){
    const dock=document.getElementById("chat-desktop-chat-cells");
    const tray=document.getElementById("chat-minimized-windows");
    if(tray) tray.replaceChildren();
    const result=original.apply(this,args);
    if(!dock||!tray)return result;
    dock.querySelectorAll(".messenger-chat-window.is-minimized").forEach(windowEl=>tray.appendChild(windowEl));
    tray.classList.toggle("hidden",tray.childElementCount===0);
    return result;
  };
  wrapped.__separateMinimizedTray=true;
  proto.renderMessengerWindows=wrapped;
})();
