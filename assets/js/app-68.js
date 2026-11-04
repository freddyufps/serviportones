(() => {
  const text = value => String(value ?? '').trim();

  function coordinates(value) {
    const source = text(value);
    const match = source.match(/^\s*(?:geo:)?\(?\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?\s*$/i);
    if (!match) return '';
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return '';
    return `${lat},${lon}`;
  }

  function locationTargets(value) {
    const raw = text(value);
    if (!raw) return null;

    let url = null;
    try {
      const candidate = /^waze:\/\//i.test(raw)
        ? raw.replace(/^waze:\/\//i, 'https://waze.com/')
        : /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      url = new URL(candidate);
      if (!['http:', 'https:'].includes(url.protocol)) url = null;
    } catch (_) {}

    const host = url?.hostname.toLowerCase() || '';
    const isWaze = /(^|\.)waze\.com$/.test(host);
    const isGoogleMaps = /^maps\.google\.[a-z.]+$/.test(host)
      || /(^|\.)google\.[a-z.]+$/.test(host) && /\/maps(?:\/|$)/i.test(url?.pathname || '')
      || host === 'maps.app.goo.gl'
      || host === 'goo.gl' && /\/maps(?:\/|$)/i.test(url?.pathname || '');

    const urlQuery = url && ['q', 'query', 'll', 'destination', 'center', 'daddr', 'place']
      .map(key => url.searchParams.get(key)).find(Boolean) || '';
    const pathCoords = url?.pathname.match(/@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
    const coords = coordinates(raw) || coordinates(urlQuery) || coordinates(pathCoords ? `${pathCoords[1]},${pathCoords[2]}` : '');
    const query = coords || urlQuery || raw;
    const maps = isGoogleMaps ? url.href : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    const waze = isWaze ? url.href : coords
      ? `https://waze.com/ul?ll=${encodeURIComponent(coords)}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;

    return { maps, waze };
  }

  function setRouteButton(button, target, href) {
    if (!button) return;
    button.disabled = !target;
    button.onclick = target ? () => window.open(href, '_blank', 'noopener,noreferrer') : null;
  }

  function install() {
    const app = window.app;
    const proto = app?.constructor?.prototype;
    if (!app || !proto || app.__serviceLocation68) return Boolean(app?.__serviceLocation68);
    app.__serviceLocation68 = true;
    app.resolveServiceLocationTargets = locationTargets;
    app.openServiceLocationInMaps = value => {
      const target = locationTargets(value);
      if (!target) return app.showToast?.('Ubicación no registrada', 'info');
      window.open(target.maps, '_blank', 'noopener,noreferrer');
    };
    app.openServiceLocationInWaze = value => {
      const target = locationTargets(value);
      if (!target) return app.showToast?.('Ubicación no registrada', 'info');
      window.open(target.waze, '_blank', 'noopener,noreferrer');
    };

    const openNew = proto.openNewTaskModal;
    if (openNew && !openNew.__serviceLocation68) {
      const wrapped = function (...args) {
        const result = openNew.apply(this, args);
        const field = document.getElementById('task-service-location');
        if (field) field.value = '';
        return result;
      };
      wrapped.__serviceLocation68 = true;
      proto.openNewTaskModal = wrapped;
    }

    const openEdit = proto.openEditTaskModal;
    if (openEdit && !openEdit.__serviceLocation68) {
      const wrapped = function (id, ...args) {
        const result = openEdit.call(this, id, ...args);
        const task = (this.tasks || []).find(item => String(item.id) === String(id));
        const field = document.getElementById('task-service-location');
        if (field) field.value = text(task?.serviceLocation);
        return result;
      };
      wrapped.__serviceLocation68 = true;
      proto.openEditTaskModal = wrapped;
    }

    const saveTask = proto.handleSaveTask;
    if (saveTask && !saveTask.__serviceLocation68) {
      const wrapped = async function (...args) {
        const form = document.getElementById('task-form');
        const id = text(form?.querySelector('#task-id')?.value);
        const editingTask = id ? (this.tasks || []).find(item => String(item.id) === id) : null;
        const location = text(form?.querySelector('#task-service-location')?.value);
        const originalSaveTasks = this.saveTasks;
        if (!form || typeof originalSaveTasks !== 'function') return saveTask.apply(this, args);

        const orderNumber = Number(form.querySelector('#task-order-number')?.value);
        const persistLocation = (...saveArgs) => {
          const target = editingTask || (this.tasks || []).find(item => String(item.id).toUpperCase() === `ORD-${orderNumber}`);
          if (target) target.serviceLocation = location;
          return originalSaveTasks.apply(this, saveArgs);
        };
        this.saveTasks = persistLocation;
        try {
          return await saveTask.apply(this, args);
        } finally {
          if (this.saveTasks === persistLocation) this.saveTasks = originalSaveTasks;
        }
      };
      wrapped.__serviceLocation68 = true;
      proto.handleSaveTask = wrapped;
    }

    const bindLocationControls = (task, textId, mapsId, wazeId) => {
      const location = text(task?.serviceLocation);
      const value = document.getElementById(textId);
      if (value) value.textContent = location || 'Ubicación no registrada';
      const targets = locationTargets(location);
      setRouteButton(document.getElementById(mapsId), targets, targets?.maps);
      setRouteButton(document.getElementById(wazeId), targets, targets?.waze);
    };

    const openDetails = proto.viewOrderDetails;
    if (openDetails && !openDetails.__serviceLocation68) {
      const wrapped = function (id, ...args) {
        const result = openDetails.call(this, id, ...args);
        const task = (this.tasks || []).find(item => String(item.id) === String(id));
        bindLocationControls(task, 'view-service-location', 'view-service-location-maps', 'view-service-location-waze');
        return result;
      };
      wrapped.__serviceLocation68 = true;
      proto.viewOrderDetails = wrapped;
    }

    const openReport = proto.openReportModal;
    if (openReport && !openReport.__serviceLocation68) {
      const wrapped = function (id, ...args) {
        const result = openReport.call(this, id, ...args);
        const task = (this.tasks || []).find(item => String(item.id) === String(id));
        bindLocationControls(task, 'rep-service-location', 'rep-btn-maps', 'rep-btn-waze');
        return result;
      };
      wrapped.__serviceLocation68 = true;
      proto.openReportModal = wrapped;
    }

    return true;
  }

  if (!install()) {
    let attempts = 0;
    const timer = window.setInterval(() => {
      if (install() || ++attempts >= 80) window.clearInterval(timer);
    }, 50);
  }
})();
