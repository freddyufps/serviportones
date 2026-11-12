(function () {
  if (typeof PortonProApp === 'undefined' || !PortonProApp.prototype) return;
  const proto = PortonProApp.prototype;

  // El panel antiguo se conserva como nodo vacío porque setupDashboardUI lo consulta,
  // pero su presentación y los botones GPS ya no se muestran.
  if (typeof proto.setupDashboardUI === 'function') {
    const originalSetupDashboardUI = proto.setupDashboardUI;
    proto.setupDashboardUI = function (...args) {
      const result = originalSetupDashboardUI.apply(this, args);
      const banner = document.getElementById('dashboard-banner');
      if (banner) {
        banner.replaceChildren();
        banner.classList.add('hidden');
        banner.setAttribute('aria-hidden', 'true');
      }
      return result;
    };
  }

  // Los contadores y sus acciones de reinicio se retiraron del panel principal.
  proto.updateStats = function () {};

  // Desactivar por completo la captura/consulta GPS. No se escribe ni se borra
  // información histórica de gps_locations.
  proto.toggleWorkerGps = function () {};
  proto.startGpsSharing = function () {};
  proto.openAdminGpsModal = function () {};
  proto.initAdminMap = function () {};
  proto.subscribeGpsLocations = function () {};
  proto.renderGpsWorkersList = function () {};
  proto.updateGpsMarkersOnMap = function () {};
  proto.focusWorkerOnMap = function () {};
  proto.openExternalRoute = function () {};

  proto.stopGpsSharing = function () {
    if (this.gpsWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
    }
    this.gpsWatchId = null;
    this.gpsConnectedAt = null;
    this.isGpsSharing = false;
  };

  proto.closeAdminGpsModal = function () {
    if (typeof this.gpsLocationsUnsubscribe === 'function') this.gpsLocationsUnsubscribe();
    this.gpsLocationsUnsubscribe = null;
    if (this.adminMap && typeof this.adminMap.remove === 'function') this.adminMap.remove();
    this.adminMap = null;
    this.adminMapMarkers = {};
    this.locationsData = {};
  };
})();
