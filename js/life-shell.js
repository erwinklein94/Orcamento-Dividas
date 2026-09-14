// Shared shell for the life-area pages: login check, sidebar and revision-checked cloud saves.
const LifeShell = (() => {
  const AREAS = [['index.html','Finanças'],['saude.html','Saúde'],['habitos.html','Hábitos'],
    ['lazer.html','Lazer e Viagens'],['pets.html','Pets'],['carreira.html','Carreira e Estudos']];
  const PEOPLE = [['todos','Todos'],['Erwin','Erwin'],['Raquel','Raquel']];
  const PERSON_KEY = 'klein-life-person';
  const el = id => document.getElementById(id);
  let cfg, client, user, rowId, data, writer, timer, refreshing = false, person = 'todos';
  try { person = localStorage.getItem(PERSON_KEY) || 'todos'; } catch {}
  if (!PEOPLE.some(([p]) => p === person)) person = 'todos';

  const draftKey = () => `klein-life-draft-v1:${user.id}:${cfg.area}`;
  function draft(keep) {
    try {
      if (keep) localStorage.setItem(draftKey(), JSON.stringify(data));
      else localStorage.removeItem(draftKey());
      return true;
    } catch { return false; }
  }
  function status(text, error = false) {
    el('lifeStatus').textContent = text;
    el('lifeStatus').classList.toggle('life-error', error);
    el('lifeRetry').hidden = !error;
  }
  function fatal(text) {
    el('lifeLoading').hidden = false;
    el('appWrap').hidden = true;
    el('lifeLoadingMsg').textContent = text;
  }

  function renderHeader() {
    const nav = AREAS.map(([href,label]) =>
      `<a href="${href}"${href === cfg.page ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('');
    const seg = PEOPLE.map(([p,label]) =>
      `<button type="button" data-person="${p}" class="${p === person ? 'on' : ''}">${label}</button>`).join('');
    el('lifeHeader').innerHTML = `<div class="brand"><div class="mark">K</div><div><h1>Klein</h1></div></div>
      <nav class="areas" aria-label="Áreas da vida">${nav}</nav>
      <div class="filterbar"><b>Pessoa:</b><div class="seg" id="personSeg">${seg}</div></div>
      <button id="logoutButton" type="button">Sair da conta</button>`;
  }

  const api = {
    get data() { return data; },
    get person() { return person; },
    items: name => data.collections[name],
    // Registros sem pessoa ou do casal aparecem em qualquer filtro.
    visible: item => person === 'todos' || !item.pessoa || item.pessoa === 'Casal' || item.pessoa === person,
    save(name, item) { const saved = LifeStore.upsert(data, name, item); changed(); rerender(); return saved; },
    remove(name, id) { if (LifeStore.remove(data, name, id)) { changed(); rerender(); } }
  };
  function rerender() { cfg.render(api); }

  function changed() {
    if (!writer) return;
    writer.change(data);
    const backedUp = draft(true);
    status(backedUp ? 'Salvando na nuvem…' : 'Salvando na nuvem… Não feche esta página até concluir.');
    clearTimeout(timer);
    timer = setTimeout(() => writer.flush(), 450);
  }
  async function fetchRow() {
    const {data:row, error} = await client.from('life_areas').select('id,payload,revision').eq('area', cfg.area).maybeSingle();
    if (error) throw new Error('Não foi possível carregar seus dados. Verifique a conexão e recarregue a página.');
    if (row && !LifeStore.validPayload(row.payload)) throw new Error('Os dados salvos desta área precisam de revisão. Nada foi sobrescrito.');
    return row;
  }
  async function loadOrCreate() {
    const row = await fetchRow();
    if (row) return row;
    const {data:created, error} = await client.from('life_areas')
      .insert({area:cfg.area, payload:LifeStore.empty(cfg.collections)}).select('id,payload,revision').single();
    if (!error) return created;
    // Outra aba pode ter criado a área no mesmo instante.
    const retry = await fetchRow();
    if (retry) return retry;
    throw new Error('Não foi possível criar esta área. Entre primeiro no painel financeiro com sua conta confirmada.');
  }
  // Another device saved first: keep the newest version of every record and save again.
  async function resolveConflict() {
    try {
      const row = await fetchRow();
      if (!row) throw new Error('missing');
      data = LifeStore.merge(LifeStore.normalize(row.payload, cfg.collections), data);
      writer.reset(row.revision);
      rerender();
      changed();
      status('Outro dispositivo também editou esta área. As duas versões foram combinadas; salvando…');
    } catch {
      draft(true);
      status('Outro dispositivo editou esta área e não foi possível combinar agora. Suas edições continuam neste navegador.', true);
    }
  }
  async function refresh() {
    if (!writer || writer.dirty || writer.blocked || refreshing) return;
    refreshing = true;
    try {
      const row = await fetchRow();
      if (row && !writer.dirty && row.revision !== writer.revision) {
        data = LifeStore.normalize(row.payload, cfg.collections);
        writer.reset(row.revision);
        rerender();
        status('Atualizado a partir da nuvem.');
      }
    } catch { status('Não foi possível atualizar os dados. Verifique sua conexão.', true); }
    finally { refreshing = false; }
  }

  async function start(config) {
    cfg = config;
    if (!window.supabase) return fatal('Não foi possível carregar a conexão. Recarregue a página.');
    client = window.supabase.createClient(FINANCE_CONFIG.url, FINANCE_CONFIG.publishableKey);
    const {data:auth} = await client.auth.getSession();
    user = auth?.session?.user;
    if (!user || user.email?.toLowerCase() !== FINANCE_CONFIG.email) {
      location.replace(`index.html?next=${encodeURIComponent(cfg.page)}`);
      return;
    }
    renderHeader();
    let row;
    try { row = await loadOrCreate(); } catch (error) { return fatal(error.message); }
    rowId = row.id;
    data = LifeStore.normalize(row.payload, cfg.collections);
    writer = FinanceStore.writer({
      save: async (payload, revision) => {
        const {data:saved, error} = await client.from('life_areas').update({payload})
          .eq('id', rowId).eq('revision', revision).select('revision').maybeSingle();
        if (error) throw error;
        return saved;
      },
      onSaved: (revision, pending) => {
        if (!pending) draft(false);
        status(pending ? 'Salvando alterações seguintes…' : 'Tudo salvo na nuvem.');
      },
      onError: kind => {
        if (kind === 'conflict') { resolveConflict(); return; }
        const backedUp = draft(true);
        status(`Não foi possível salvar na nuvem. ${backedUp ? 'O rascunho está guardado neste navegador.' : 'Mantenha esta página aberta.'}`, true);
      }
    });
    writer.reset(row.revision);
    let pending;
    try { pending = JSON.parse(localStorage.getItem(draftKey())); } catch {}
    el('lifeLoading').hidden = true;
    el('appWrap').hidden = false;
    if (LifeStore.validPayload(pending)) {
      data = LifeStore.merge(data, pending);
      rerender();
      changed();
    } else {
      rerender();
      status('Dados carregados da nuvem.');
    }
  }

  document.addEventListener('click', async event => {
    const personButton = event.target.closest('#personSeg [data-person]');
    if (personButton && data) {
      person = personButton.dataset.person;
      try { localStorage.setItem(PERSON_KEY, person); } catch {}
      document.querySelectorAll('#personSeg button').forEach(b => b.classList.toggle('on', b === personButton));
      rerender();
    }
    if (event.target.closest('#logoutButton')) {
      clearTimeout(timer);
      if (writer && !await writer.flush() && !confirm('Algumas edições ainda não foram salvas na nuvem. Sair mesmo assim?')) return;
      await client.auth.signOut({scope:'local'});
      location.replace('index.html');
    }
    if (event.target.closest('#lifeRetry') && writer) {
      if (writer.blocked) resolveConflict(); else if (writer.dirty) writer.flush(); else refresh();
    }
  });
  window.addEventListener('beforeunload', e => { if (writer?.dirty) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('online', () => { if (writer?.dirty) writer.flush(); else refresh(); });
  window.addEventListener('focus', refresh);
  return {start};
})();
