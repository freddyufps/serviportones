(() => {
  const text = value => String(value ?? '').trim();
  const localDateStamp = value => {
    const date = new Date(Number(value));
    if (!Number.isFinite(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  function coordinates(value) {
    const source = text(value);
    const match = source.match(/^\s*(?:geo:)?\(?\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?\s*$/i);
    if (!match) return '';
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return '';
    return `${lat},${lon}`;
  }

  function isExplicitMapLocation(value) {
    const source = text(value);
    return Boolean(coordinates(source) || /^(?:https?:\/\/|waze:\/\/)/i.test(source) || /^(?:maps\.google\.|www\.google\.[^/]+\/maps|waze\.com\/|maps\.app\.goo\.gl\/|goo\.gl\/maps)/i.test(source));
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
    app.openWazeNavigation = value => {
      const target = locationTargets(value);
      if (!target) return app.showToast?.('No hay una dirección registrada', 'error');
      window.open(target.waze, '_blank', 'noopener,noreferrer');
    };
    app.openGoogleMapsNavigation = value => {
      const target = locationTargets(value);
      if (!target) return app.showToast?.('No hay una dirección registrada', 'error');
      window.open(target.maps, '_blank', 'noopener,noreferrer');
    };

    const openEdit = proto.openEditTaskModal;
    if (openEdit && !openEdit.__serviceLocation68) {
      const wrapped = function (id, ...args) {
        const result = openEdit.call(this, id, ...args);
        const task = (this.tasks || []).find(item => String(item.id) === String(id));
        const address = document.getElementById('task-address');
        if (address && task && !text(task.address) && text(task.serviceLocation)) address.value = text(task.serviceLocation);
        const deposit = document.getElementById('task-deposit-amount');
        if (deposit) deposit.value = task?.depositAmount == null ? '' : String(task.depositAmount);
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
        const address = text(form?.querySelector('#task-address')?.value);
        const originalAddress = text(editingTask?.address);
        const originalClientSave = this.saveClientRecord;
        const shouldKeepMapLinkOutOfClient = isExplicitMapLocation(address) && typeof originalClientSave === 'function';
        if (shouldKeepMapLinkOutOfClient) {
          this.saveClientRecord = function (record, ...clientArgs) {
            const existingClient = this.findDirectoryClient?.(record?.name || record?.client || record?.clientName);
            return originalClientSave.call(this, { ...record, address: text(existingClient?.address) }, ...clientArgs);
          };
        }
        const depositField = form?.querySelector('#task-deposit-amount');
        const rawDeposit = String(depositField?.value ?? '').trim();
        const depositAmount = rawDeposit === '' ? 0 : Number(rawDeposit);
        if (rawDeposit !== '' && (!Number.isFinite(depositAmount) || depositAmount < 0)) {
          this.showToast?.('Escribe un valor de abono válido, igual o mayor que cero.', 'error');
          depositField?.focus();
          return false;
        }
        const originalSaveTasks = this.saveTasks;
        if (!form || typeof originalSaveTasks !== 'function') return saveTask.apply(this, args);

        const orderNumber = Number(form.querySelector('#task-order-number')?.value);
        const persistLocation = (...saveArgs) => {
          const target = editingTask || (this.tasks || []).find(item => String(item.id).toUpperCase() === `ORD-${orderNumber}`);
          if (target) {
            target.address = address;
            if (editingTask && address !== originalAddress && editingTask.serviceLocation) delete target.serviceLocation;
            if (!Number(target.createdAtMs) && target.createdAt) {
              const existingCreatedAt = typeof target.createdAt.toMillis === 'function' ? target.createdAt.toMillis() : Date.parse(target.createdAt);
              if (Number.isFinite(existingCreatedAt) && existingCreatedAt > 0) target.createdAtMs = existingCreatedAt;
            }
            if (!Number(target.createdAtMs)) {
              const scheduledDate = String(target.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
              target.createdAtMs = !editingTask || !scheduledDate
                ? Date.now()
                : new Date(Number(scheduledDate[1]), Number(scheduledDate[2]) - 1, Number(scheduledDate[3]), 12).getTime();
            }
            target.depositAmount = depositAmount;
            target.depositDate = depositAmount > 0 ? localDateStamp(target.createdAtMs) : null;
          }
          return originalSaveTasks.apply(this, saveArgs);
        };
        this.saveTasks = persistLocation;
        try {
          return await saveTask.apply(this, args);
        } finally {
          if (this.saveTasks === persistLocation) this.saveTasks = originalSaveTasks;
          if (shouldKeepMapLinkOutOfClient && this.saveClientRecord !== originalClientSave) this.saveClientRecord = originalClientSave;
        }
      };
      wrapped.__serviceLocation68 = true;
      proto.handleSaveTask = wrapped;
    }

    const bindLocationControls = (task, textId, mapsId, wazeId) => {
      const location = text(task?.address || task?.serviceLocation);
      const routeLocation = isExplicitMapLocation(task?.serviceLocation) ? task.serviceLocation : location;
      const value = document.getElementById(textId);
      if (value) value.textContent = location || '—';
      const targets = locationTargets(routeLocation);
      setRouteButton(document.getElementById(mapsId), targets, targets?.maps);
      setRouteButton(document.getElementById(wazeId), targets, targets?.waze);
    };

    const openDetails = proto.viewOrderDetails;
    if (openDetails && !openDetails.__serviceLocation68) {
      const wrapped = function (id, ...args) {
        const result = openDetails.call(this, id, ...args);
        const task = (this.tasks || []).find(item => String(item.id) === String(id));
        const depositRow = document.getElementById('view-order-deposit-row');
        const canSeeDeposit = this.currentUser?.role === 'admin' && Boolean(task);
        depositRow?.classList.toggle('hidden', !canSeeDeposit);
        if (canSeeDeposit) {
          const amount = Number(task.depositAmount) || 0;
          const depositValue = document.getElementById('view-order-deposit');
          const depositDate = document.getElementById('view-order-deposit-date');
          if (depositValue) depositValue.textContent = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
          const rawDate = amount > 0 ? (task.depositDate || task.createdAtMs || task.createdAt || '') : '';
          let date = null;
          if (rawDate && typeof rawDate.toDate === 'function') date = rawDate.toDate();
          else if (typeof rawDate === 'number' || /^\d+$/.test(String(rawDate))) date = new Date(Number(rawDate));
          else if (rawDate) date = new Date(String(rawDate).length === 10 ? `${rawDate}T12:00:00` : rawDate);
          if (depositDate) depositDate.textContent = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : '—';
        }
        bindLocationControls(task, 'view-address', 'view-address-maps', 'view-address-waze');
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
        bindLocationControls(task, 'rep-address', 'rep-btn-maps', 'rep-btn-waze');
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
