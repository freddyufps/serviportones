
(function(){
  const C=typeof PortonProApp!=='undefined'?PortonProApp:null;
  if(!C?.prototype)return;
  const proto=C.prototype;
  proto.saveReaction=async function(messageId,emoji,thread){
    this.closeReactionPicker?.();
    thread=thread||this.getChatThreadId?.();
    if(!window.db||!thread||!messageId||!emoji||!this.currentUser)return;
    const identity={userName:this.getCurrentDisplayName(),userRole:this.currentUser.role,emoji};
    const isCurrentThread=String(this.getChatThreadId?.()||'')===String(thread);
    const message=isCurrentThread&&Array.isArray(this.chatMessages)?this.chatMessages.find(m=>String(m.id)===String(messageId)):null;
    const originalReactions=message?(Array.isArray(message.reactions)?message.reactions.map(r=>({...r})):[]):null;
    const previousOwn=originalReactions?.find(r=>r?.userName===identity.userName&&r?.userRole===identity.userRole)?.emoji||null;
    const desired=previousOwn===emoji?null:emoji;
    const applyToList=(list,next)=>{
      const out=(Array.isArray(list)?list:[]).filter(r=>r&&typeof r==='object').map(r=>({...r}));
      const idx=out.findIndex(r=>r.userName===identity.userName&&r.userRole===identity.userRole);
      if(idx>=0)out.splice(idx,1);
      if(next)out.push({...identity,emoji:next});
      return out;
    };
    const updateVisibleRows=(next)=>{
      document.querySelectorAll('.chat-message-row[data-chat-message-id]').forEach(row=>{
        if(String(row.dataset.chatMessageId)!==String(messageId)||String(row.dataset.chatThreadId)!==String(thread))return;
        const summary=row.querySelector('.chat-reaction-summary');
        if(!summary)return;
        const chips=[...summary.querySelectorAll('[data-chat-reaction-chip]')];
        const own=chips.find(chip=>chip.classList.contains('is-mine'));
        const changeCount=(chip,delta)=>{
          const countEl=chip.querySelector('span'),count=Math.max(0,(Number(countEl?.textContent)||0)+delta);
          if(count===0)chip.remove();else if(countEl)countEl.textContent=String(count);
        };
        if(own)changeCount(own,-1);
        if(!next)return;
        let target=[...summary.querySelectorAll('[data-chat-reaction-chip]')].find(chip=>chip.dataset.chatReactionChip===next);
        if(target){changeCount(target,1);target.classList.add('is-mine');}
        else{
          target=document.createElement('button');target.type='button';target.className='chat-reaction-chip is-mine';
          target.dataset.messageId=String(messageId);target.dataset.threadId=String(thread);target.dataset.chatReactionChip=next;
          target.append(document.createTextNode(next+' '));const count=document.createElement('span');count.textContent='1';target.append(count);summary.append(target);
        }
      });
    };
    if(message){message.reactions=applyToList(originalReactions,desired);this.renderChatMessages?.();}
    else updateVisibleRows(desired);
    try{
      const ref=db.collection('chats_internos').doc(thread).collection('mensajes').doc(messageId);
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);if(!snap.exists)throw new Error("El mensaje ya no existe");
        const list=Array.isArray(snap.data()?.reactions)?snap.data().reactions.slice():[];
        const idx=list.findIndex(r=>r&&r.userName===identity.userName&&r.userRole===identity.userRole);
        if(idx>=0&&list[idx].emoji===emoji)list.splice(idx,1);
        else if(idx>=0)list[idx]={...identity};
        else list.push({...identity});
        tx.update(ref,{reactions:list});
      });
    }catch(err){
      if(message&&originalReactions){message.reactions=originalReactions;this.renderChatMessages?.();}
      else updateVisibleRows(previousOwn);
      console.error('[CHAT] No se pudo guardar la reacción',{id:messageId,code:err?.code,message:err?.message},err);
      this.showToast?.('No se pudo guardar la reacción: '+(err?.message||err),'error');
    }
  };
})();
