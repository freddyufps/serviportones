
(function(){
  if(typeof PortonProApp==='undefined'||PortonProApp.prototype.__darkModeInstalled)return;
  PortonProApp.prototype.__darkModeInstalled=true;
  PortonProApp.prototype.applyDarkMode=function(){
    const saved=SafeStorage.getItem('serviportones_dark_mode')==='1';
    const dashboard=document.getElementById('view-dashboard');
    const enabled=saved && !!this.currentUser && !!dashboard && !dashboard.classList.contains('hidden');
    document.body.classList.toggle('theme-dark',enabled);document.documentElement.classList.toggle('theme-dark',enabled);
    const toggle=document.getElementById('btn-dark-mode'),glyph=document.getElementById('dark-mode-glyph');
    if(toggle){const label=enabled?'Desactivar modo oscuro':'Activar modo oscuro';toggle.setAttribute('aria-label',label);toggle.setAttribute('data-tooltip',label);toggle.setAttribute('aria-pressed',String(enabled));toggle.classList.toggle('is-dark-active',enabled)}
    if(glyph) glyph.textContent=enabled?'☀':'☾';
  };
  PortonProApp.prototype.setDarkMode=function(enabled){SafeStorage.setItem('serviportones_dark_mode',enabled?'1':'0');this.applyDarkMode()};
  PortonProApp.prototype.toggleDarkMode=function(){this.setDarkMode(SafeStorage.getItem('serviportones_dark_mode')!=='1')};
})();
