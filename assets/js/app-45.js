(function(){
  'use strict';
  const proto=window.PortonProApp?.prototype;
  if(proto){
    const originalSelect=proto.selectChatConversation;
    if(typeof originalSelect==='function'&&!proto.__latestChatSelectionFix){
      proto.__latestChatSelectionFix=true;
      proto.selectChatConversation=function(name,...args){
        const key=String(name||'');
        this.chatMessageInitialRenderDone=false;
        this.chatScrollPositions=this.chatScrollPositions||{};
        this.chatWasNearBottom=this.chatWasNearBottom||{};
        delete this.chatScrollPositions[key];
        this.chatWasNearBottom[key]=true;
        const result=originalSelect.call(this,name,...args);
        const scrollLatest=()=>{
          document.querySelectorAll('#chat-messages-container, #chat-desktop-chat-cells [data-messenger-window="'+CSS.escape(key)+'"] .messenger-window-messages').forEach(el=>{el.scrollTop=el.scrollHeight;});
          this.chatScrollPositions[key]=Number.MAX_SAFE_INTEGER;
          this.chatWasNearBottom[key]=true;
        };
        requestAnimationFrame(()=>requestAnimationFrame(scrollLatest));
        setTimeout(scrollLatest,120);
        return result;
      };
    }
    const originalToggle=proto.toggleMessengerWindow;
    if(typeof originalToggle==='function'&&!proto.__singleTapChatRestoreFix){
      proto.__singleTapChatRestoreFix=true;
      proto.toggleMessengerWindow=function(name,...args){
        if(this.minimizedChatWindows?.[name]) return this.selectChatConversation(name);
        return originalToggle.call(this,name,...args);
      };
    }
    if(typeof proto.openReactionPicker==='function'&&!proto.__reactionOverlayFix){
      proto.__reactionOverlayFix=true;
      proto.openReactionPicker=function(event,messageId,threadId){
        this.closeReactionPicker?.();
        const popup=document.createElement('div');
        popup.className='chat-reaction-picker';
        popup.setAttribute('role','toolbar');
        popup.setAttribute('aria-label','Reacciones');
        const choices=['❤️','😂','👍','😮','😢','🙏'];
        const thread=threadId||this.getChatThreadId?.()||'';
        popup.innerHTML=choices.map(emoji=>'<button type="button" data-message-id="'+this.escapeHtml(messageId)+'" data-thread-id="'+this.escapeHtml(thread)+'" data-chat-reaction-emoji="'+this.escapeHtml(emoji)+'" aria-label="Reaccionar '+this.escapeHtml(emoji)+'">'+emoji+'</button>').join('');
        document.body.appendChild(popup);
        const viewport=window.visualViewport;
        const topEdge=Math.max(4,Number(viewport?.offsetTop||0)+4);
        const bottomEdge=Math.min(window.innerHeight,Number(viewport?.offsetTop||0)+Number(viewport?.height||window.innerHeight)-4);
        const row=[...document.querySelectorAll('.chat-message-row[data-chat-message-id]')].find(el=>el.dataset.chatMessageId===String(messageId)&&(!thread||el.dataset.chatThreadId===String(thread)));
        const anchor=event?.currentTarget?.getBoundingClientRect?.()||row?.getBoundingClientRect?.();
        const width=popup.offsetWidth||250,height=popup.offsetHeight||48;
        const px=Number.isFinite(Number(event?.clientX))&&Number(event.clientX)!==0?Number(event.clientX):(anchor?anchor.left+anchor.width/2:window.innerWidth/2);
        const left=Math.max(8,Math.min(px-width/2,window.innerWidth-width-8));
        let top=anchor?anchor.top-height-8:bottomEdge-height-12;
        if(top<topEdge&&anchor)top=anchor.bottom+8;
        top=Math.max(topEdge,Math.min(top,bottomEdge-height));
        Object.assign(popup.style,{position:'fixed',left:left+'px',top:top+'px',zIndex:'2147483647',maxWidth:'calc(100vw - 16px)',touchAction:'manipulation'});
      };
    }
  }

  // Intercept the inline handlers in capture phase so each tap executes exactly once.
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;
    const app=window.app;
    const quoteButton=target.closest('#btn-create-quote');
    if(quoteButton){
      event.preventDefault();event.stopImmediatePropagation();
      try{app?.openQuoteForm?.()}catch(error){console.error('[COTIZACIONES] No se pudo abrir el formulario',error);app?.showToast?.('No se pudo abrir la cotización. Recarga la página e inténtalo de nuevo.','error');}
      return;
    }
    if(!app||app.currentUser?.role!=='admin')return;
    const close=target.closest('.messenger-window-close');
    if(close){
      const windowEl=close.closest('[data-messenger-window]');if(!windowEl)return;
      event.preventDefault();event.stopImmediatePropagation();app.closeChatTab(windowEl.dataset.messengerWindow);return;
    }
    const minimize=target.closest('.messenger-window-minimize');
    if(minimize){
      const windowEl=minimize.closest('[data-messenger-window]');if(!windowEl)return;
      event.preventDefault();event.stopImmediatePropagation();app.toggleMessengerWindow(windowEl.dataset.messengerWindow);return;
    }
    const minimizedHeader=target.closest('#chat-minimized-windows .messenger-window-header');
    if(minimizedHeader){
      const windowEl=minimizedHeader.closest('[data-messenger-window]');if(!windowEl)return;
      event.preventDefault();event.stopImmediatePropagation();app.selectChatConversation(windowEl.dataset.messengerWindow);return;
    }
    const contact=target.closest('[data-chat-contact]');
    if(contact){
      const search=String(contact.dataset.chatContact||'').toLocaleLowerCase();
      const worker=(app.workers||[]).find(item=>String(item.fullName||item.username||'').toLocaleLowerCase()===search);
      if(!worker)return;
      event.preventDefault();event.stopImmediatePropagation();app.selectChatConversation(worker.fullName||worker.username);
    }
  },true);

  document.addEventListener('click',event=>{
    if(event.target.closest?.('.chat-reaction-picker'))return;
    if(!event.target.closest?.('.chat-reaction-picker'))window.app?.closeReactionPicker?.();
  },false);
})();
// No dejar la restauración de sesión bloqueada si Firestore queda pendiente.
(function(){
  const database=window.db;
  if(!database||typeof database.collection!=='function'||database.__sessionRestoreTimeout)return;
  const originalCollection=database.collection.bind(database);
  const settleWithin=(promise,fallback,label)=>new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{
      if(settled)return;
      settled=true;
      console.warn('[INICIO] Firestore tardó; se continúa con la sesión local:',label);
      resolve(typeof fallback==='function'?fallback():fallback);
    },1600);
    Promise.resolve(promise).then(value=>{
      if(settled)return;
      settled=true;clearTimeout(timer);resolve(value);
    },error=>{
      if(settled)return;
      settled=true;clearTimeout(timer);reject(error);
    });
  });
  database.collection=function(name,...args){
    const collection=originalCollection(name,...args);
    if(String(name)!=='presencia')return collection;
    if(typeof collection.get==='function'){
      const get=collection.get.bind(collection);
      collection.get=(...options)=>settleWithin(get(...options),{docs:[]},'consulta de presencia');
    }
    if(typeof collection.doc==='function'){
      const doc=collection.doc.bind(collection);
      collection.doc=(...parts)=>{
        const reference=doc(...parts);
        if(typeof reference.get==='function'){
          const get=reference.get.bind(reference);
          reference.get=(...options)=>settleWithin(get(...options),{exists:false,data:()=>({})},'lectura de presencia');
        }
        if(typeof reference.set==='function'){
          const set=reference.set.bind(reference);
          reference.set=(...options)=>settleWithin(set(...options),undefined,'actualización de presencia');
        }
        return reference;
      };
    }
    return collection;
  };
  database.__sessionRestoreTimeout=true;
})();
