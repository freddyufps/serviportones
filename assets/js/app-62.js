/* Keep commercial actions inside the administrator-only orders toolbar. */
(function(){
  const install=()=>{
    if(!window.app||app.__ordersQuoteAdminGate62)return false;
    const quote=document.getElementById("btn-create-quote"),assign=document.getElementById("btn-assign-order-filter");
    if(!quote||!assign)return false;
    app.__ordersQuoteAdminGate62=true;
    const sync=()=>{quote.classList.toggle("hidden",app.currentUser?.role!=="admin");};
    sync();
    const render=app.renderTasks;
    if(typeof render==="function")app.renderTasks=function(...args){const result=render.apply(this,args);sync();return result};
    const open=app.openSettingsModal;
    if(typeof open==="function")app.openSettingsModal=function(...args){const result=open.apply(this,args);sync();return result};
    return true;
  };
  window.addEventListener("DOMContentLoaded",()=>{const timer=setInterval(()=>{if(install())clearInterval(timer)},50)});
})();
