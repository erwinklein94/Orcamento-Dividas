// Building blocks shared by the life-area pages: formatting, hero, record lists and the edit dialog.
const LifeKit = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return iso(d); };
  const daysUntil = s => s ? Math.round((parseDate(s) - parseDate(today())) / 86400000) : null;
  const date = s => s ? s.split('-').reverse().join('/') : '—';
  const when = s => {
    const n = daysUntil(s);
    if (n === null) return '';
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
  };
  const BRLc = n => (+n || 0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const BRL = n => 'R$ ' + BRLc(n);
  const parseMoney = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;
  const PEOPLE = ['Erwin', 'Raquel', 'Casal'];
  const TONES = {ok:'q', warn:'p', alert:'r', neutral:'n'};
  let api, specs = {}, editing;

  function hero(target, {kicker, big, sub, stats}) {
    target.innerHTML = `<div class="k">${esc(kicker)}</div><div class="big">${esc(big)}</div><div class="when">${esc(sub)}</div>
      <div class="split">${stats.map(s => `<div><div class="v num">${esc(s.v)}</div><div class="t">${esc(s.t)}</div></div>`).join('')}</div>`;
  }

  // spec: {name, title, add, empty, fields, sort?, defaults?, validate?, row(item) => {title, meta, value, badge, progress, checklist, note, muted}}
  function list(currentApi, spec) {
    api = currentApi;
    specs[spec.name] = spec;
    const items = api.items(spec.name).filter(api.visible).sort(spec.sort || ((a, b) => b.u - a.u));
    const rows = items.map(item => {
      const r = spec.row(item);
      const meta = (r.meta || []).filter(Boolean);
      const checks = (r.checklist || []).map((c, i) =>
        `<label><input type="checkbox" data-check="${spec.name}|${item.id}|${r.checklistKey}|${i}" ${c.ok ? 'checked' : ''}><span class="${c.ok ? 'ok' : ''}">${esc(c.t)}</span></label>`).join('');
      return `<div class="lrow${r.muted ? ' muted' : ''}">
        <div class="lmain"><div class="ltitle">${esc(r.title)}</div>${meta.length ? `<div class="lmeta">${meta.map(esc).join(' · ')}</div>` : ''}
          ${r.progress != null ? `<div class="lbar" role="img" aria-label="${Math.round(r.progress)}%"><span style="width:${Math.max(0, Math.min(100, r.progress))}%"></span></div>` : ''}
          </div>
        <div class="lside">${r.value ? `<div class="lvalue num">${esc(r.value)}</div>` : ''}${r.badge ? `<span class="tag ${TONES[r.badge.tone] || 'n'}">${esc(r.badge.text)}</span>` : ''}</div>
        <div class="lactions"><button type="button" class="del ledit" data-edit="${spec.name}|${item.id}" aria-label="Editar ${esc(r.title)}">✎</button><button type="button" class="del" data-remove="${spec.name}|${item.id}" aria-label="Excluir ${esc(r.title)}">×</button></div>
        ${checks || r.note ? `<div class="lextra">${checks ? `<div class="lchecks">${checks}</div>` : ''}${r.note ? `<div class="lnote">${esc(r.note)}</div>` : ''}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="panel lpanel"><h3>${esc(spec.title)} <span class="cnt">${items.length}</span><button type="button" class="addbtn" data-add="${spec.name}">${esc(spec.add)}</button></h3>
      ${rows || `<div class="lempty">${esc(spec.empty)}</div>`}</div>`;
  }

  function field(f, value) {
    const req = f.required ? ' required' : '';
    const label = `${esc(f.label)}${f.required ? ' *' : ''}`;
    const cls = f.wide || f.type === 'textarea' || f.type === 'checklist' ? ' class="wide"' : '';
    if (f.type === 'textarea' || f.type === 'checklist') {
      const text = f.type === 'checklist' ? (value || []).map(c => c.t).join('\n') : value;
      return `<label${cls}>${label}<textarea name="${f.key}" rows="${f.type === 'checklist' ? 5 : 3}" maxlength="4000"${req}${f.type === 'checklist' ? ' placeholder="Um item por linha"' : ''}>${esc(text)}</textarea></label>`;
    }
    if (f.type === 'select' || f.type === 'person') {
      const options = f.type === 'person' ? PEOPLE : f.options;
      // Options are plain strings or [value, label] pairs (e.g. a record id shown by name).
      return `<label${cls}>${label}<select name="${f.key}"${req}><option value="">—</option>${options.map(o => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`;
      }).join('')}</select></label>`;
    }
    if (f.type === 'checkbox') return `<label class="check wide"><input type="checkbox" name="${f.key}"${value ? ' checked' : ''}>${label}</label>`;
    if (f.type === 'money') return `<label${cls}>${label}<input name="${f.key}" inputmode="decimal" placeholder="0,00" value="${value == null ? '' : BRLc(value)}"${req}></label>`;
    const type = ['number', 'date', 'time'].includes(f.type) ? f.type : 'text';
    const extra = type === 'number' ? ` step="${f.step || 'any'}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}` : ' maxlength="200"';
    const hint = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
    return `<label${cls}>${label}<input type="${type}" name="${f.key}" value="${esc(value)}"${extra}${hint}${req}></label>`;
  }

  function dialog() {
    let d = document.getElementById('lifeDialog');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'lifeDialog';
    d.className = 'life-dialog';
    document.body.append(d);
    d.addEventListener('submit', event => { event.preventDefault(); submit(); });
    d.addEventListener('click', event => { if (event.target.closest('[data-close]')) d.close(); });
    return d;
  }
  function openForm(spec, item) {
    const d = dialog();
    editing = {spec, item};
    const values = item || {...(spec.defaults ? spec.defaults() : {})};
    if (!item) for (const f of spec.fields) {
      if (f.type === 'person' && values[f.key] == null && api.person !== 'todos') values[f.key] = api.person;
      if (f.type === 'date' && f.today && values[f.key] == null) values[f.key] = today();
    }
    d.innerHTML = `<form novalidate><h3>${item ? 'Editar' : 'Adicionar'} · ${esc(spec.title)}</h3>
      <div class="fgrid">${spec.fields.map(f => field(f, values[f.key])).join('')}</div>
      <p class="ferror" role="alert"></p>
      <div class="factions"><button type="button" data-close>Cancelar</button><button type="submit" class="primary">Salvar</button></div></form>`;
    d.showModal();
    d.querySelector('input,select,textarea')?.focus();
  }
  function submit() {
    const {spec, item} = editing, form = dialog().querySelector('form');
    const out = {...(item || {}), id:item?.id || crypto.randomUUID()};
    for (const f of spec.fields) {
      const input = form.elements[f.key];
      const raw = f.type === 'checkbox' ? input.checked : input.value.trim();
      if (f.required && raw === '') { form.querySelector('.ferror').textContent = `Preencha “${f.label}”.`; input.focus(); return; }
      if (f.type === 'number') out[f.key] = raw === '' ? null : Number(raw);
      else if (f.type === 'money') out[f.key] = raw === '' ? null : parseMoney(raw);
      else if (f.type === 'checklist') out[f.key] = raw.split('\n').map(t => t.trim()).filter(Boolean)
        .map(t => ({t, ok:(item?.[f.key] || []).some(c => c.t === t && c.ok)}));
      else out[f.key] = raw;
    }
    const problem = spec.validate?.(out);
    if (problem) { form.querySelector('.ferror').textContent = problem; return; }
    api.save(spec.name, out);
    dialog().close();
  }

  document.addEventListener('click', event => {
    const add = event.target.closest('[data-add]');
    if (add && specs[add.dataset.add]) return openForm(specs[add.dataset.add]);
    const edit = event.target.closest('[data-edit]');
    if (edit) {
      const [name, id] = edit.dataset.edit.split('|');
      const item = api.items(name).find(x => x.id === id);
      if (item) openForm(specs[name], item);
      return;
    }
    const remove = event.target.closest('[data-remove]');
    if (remove) {
      const [name, id] = remove.dataset.remove.split('|');
      const item = api.items(name).find(x => x.id === id);
      if (item && confirm(`Excluir “${specs[name].row(item).title}”? Não é possível desfazer.`)) api.remove(name, id);
    }
  });
  document.addEventListener('change', event => {
    const check = event.target.closest('[data-check]');
    if (!check) return;
    const [name, id, key, index] = check.dataset.check.split('|');
    const item = api.items(name).find(x => x.id === id);
    if (!item?.[key]?.[index]) return;
    const copy = LifeStore.clone(item);
    copy[key][index].ok = check.checked;
    api.save(name, copy);
  });

  return {esc, today, addDays, daysUntil, date, when, BRL, parseMoney, hero, list};
})();
