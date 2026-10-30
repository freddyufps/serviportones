(() => {
  'use strict';
  const norm = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const timer = setInterval(() => {
    const instance = window.app;
    const AppClass = instance?.constructor;
    if (!instance || !AppClass?.prototype || !instance.__mobileClientModule47 || instance.__clientSearchStable52) return;
    clearInterval(timer);
    const proto = AppClass.prototype;
    instance.__clientSearchStable52 = true;
    instance.clientDirectorySearchValue = instance.clientDirectorySearchValue || '';

    const dataSignature = function () {
      return JSON.stringify((this.clientDirectory || []).map(c => [c.id,c.name,c.condo,c.documentNumber,c.address,c.email,c.phone,c.administrator]));
    };
    const allCardsMarkup = function () {
      const clients = (this.clientDirectory || []).slice().sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
      return clients.map((c,index) => '<article class="client-card" data-client-search="'+esc([c.name,c.condo,c.documentNumber,c.address,c.email,c.phone,c.administrator].filter(Boolean).join(' '))+'"><small class="client-index">Cliente '+(index+1)+'</small><b>'+esc(c.name)+'</b>'+(c.condo?'<span>Condominio: '+esc(c.condo)+'</span>':'')+(c.documentNumber?'<span>Documento: '+esc(c.documentNumber)+'</span>':'')+(c.address?'<span>Dirección: '+esc(c.address)+'</span>':'')+(c.phone?'<span>Teléfono: '+esc(c.phone)+'</span>':'')+(c.email?'<span>Correo: '+esc(c.email)+'</span>':'')+'<button type="button" onclick="app.showClientEditor('+JSON.stringify(c.id)+')">Editar</button></article>').join('') || '<div class="clients-empty">No hay clientes. Agrega un contacto o importa el Excel.</div>';
    };
    const applySearch = function (root) {
      if (!root) return;
      const input = root.querySelector('#clients-search');
      const value = input?.value ?? this.clientDirectorySearchValue ?? '';
      this.clientDirectorySearchValue = value;
      const term = norm(value);
      let shown = 0;
      root.querySelectorAll('.client-card[data-client-search]').forEach(card => {
        const visible = !term || norm(card.dataset.clientSearch || '').includes(term);
        card.hidden = !visible;
        if (visible) shown++;
      });
      let empty = root.querySelector('.clients-search-empty');
      if (term && shown === 0) {
        if (!empty) { empty = document.createElement('div'); empty.className = 'clients-empty clients-search-empty'; empty.textContent = 'No se encontraron clientes con esa búsqueda.'; root.querySelector('.clients-list')?.appendChild(empty); }
        empty.hidden = false;
      } else if (empty) empty.hidden = true;
      const count = root.querySelector('.clients-count');
      if (count) count.textContent = (term ? shown : (this.clientDirectory || []).length) + ' de ' + (this.clientDirectory || []).length + ' clientes';
      root.dataset.clientSearchSignature = term;
    };

    const originalRenderClients = proto.renderClientsDirectory;
    proto.renderClientsDirectory = function () {
      if (!this.clientsDirectoryOpen) return;
      const host = document.getElementById('tasks-container');
      if (!host) return;
      let root = document.getElementById('clients-directory');
      if (!root) {
        originalRenderClients?.call(this);
        root = document.getElementById('clients-directory');
      }
      if (!root) return;
      const input = root.querySelector('#clients-search');
      if (input) {
        input.type = 'text';
        input.setAttribute('inputmode','search');
        input.setAttribute('enterkeyhint','search');
        input.setAttribute('autocomplete','off');
        input.setAttribute('autocorrect','off');
        input.setAttribute('spellcheck','false');
        input.value = this.clientDirectorySearchValue ?? input.value;
      }
      const signature = dataSignature.call(this);
      if (root.dataset.clientDataSignature !== signature) {
        const list = root.querySelector('.clients-list');
        if (list) list.innerHTML = allCardsMarkup.call(this);
        root.dataset.clientDataSignature = signature;
      }
      const title = document.getElementById('orders-view-title');
      if (title) title.textContent = 'Clientes';
      document.getElementById('section-admin-audit-log')?.classList.add('hidden');
      this.ensureClientsNav?.();
      applySearch.call(this, root);
    };

    proto.filterClientDirectory = function () {
      const root = document.getElementById('clients-directory');
      const input = root?.querySelector('#clients-search');
      if (input) this.clientDirectorySearchValue = input.value;
      applySearch.call(this, root);
    };

    const originalRenderTasks = proto.renderTasks;
    if (originalRenderTasks) proto.renderTasks = function (...args) {
      const clientsView = this.clientsDirectoryOpen && !this.showDocumentControl && !this.quoteArchiveInlineOpen && !this.showArchivedTasks;
      if (clientsView && document.getElementById('clients-directory')) {
        this.ensureClientsNav?.();
        this.addClientAutocomplete?.();
        this.renderClientsDirectory();
        return;
      }
      const result = originalRenderTasks.apply(this,args);
      if (clientsView) this.renderClientsDirectory();
      return result;
    };
  }, 40);
})();

