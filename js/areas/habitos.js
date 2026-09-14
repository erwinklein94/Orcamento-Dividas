// Hábitos: cadastro com meta semanal e marcação diária dos últimos 7 dias.
(() => {
  const K = LifeKit;
  const WEEKDAYS = ['dom','seg','ter','qua','qui','sex','sáb'];
  let api;
  const days = () => Array.from({length:7}, (_, i) => K.addDays(K.today(), i - 6));
  const doneThisWeek = h => { const week = new Set(days()); return (h.dias || []).filter(d => week.has(d)).length; };
  // A sequência só quebra depois que o dia termina sem marcação.
  function streak(h) {
    const set = new Set(h.dias || []);
    let d = K.today(), n = 0;
    if (!set.has(d)) d = K.addDays(d, -1);
    while (set.has(d)) { n++; d = K.addDays(d, -1); }
    return n;
  }

  const habitos = {
    name:'habitos', title:'Meus hábitos', add:'+ hábito', empty:'Nenhum hábito cadastrado.',
    fields:[
      {key:'nome', label:'Hábito', required:true, wide:true, placeholder:'Ex.: Caminhar 30 minutos'},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'meta', label:'Meta (dias por semana)', type:'number', required:true, step:'1', min:1, max:7},
      {key:'pausado', label:'Pausado (não aparece na semana)', type:'checkbox'}
    ],
    defaults:() => ({meta:7}),
    validate:h => Number.isInteger(h.meta) && h.meta >= 1 && h.meta <= 7 ? '' : 'A meta precisa ser de 1 a 7 dias por semana.',
    sort:(a, b) => (a.pausado === true) - (b.pausado === true) || a.nome.localeCompare(b.nome),
    row:h => {
      const done = doneThisWeek(h), s = streak(h);
      const badge = h.pausado ? {text:'Pausado', tone:'neutral'} : done >= h.meta ? {text:'Meta da semana', tone:'ok'} : {text:`${done}/${h.meta} na semana`, tone:'neutral'};
      return {title:h.nome, meta:[h.pessoa, `meta ${h.meta}× por semana`, s ? `${s} ${s === 1 ? 'dia seguido' : 'dias seguidos'}` : ''],
        progress:h.pausado ? null : done / h.meta * 100, badge, muted:h.pausado};
    }
  };

  function week(active) {
    const header = days().map(d => {
      const [y, m, day] = d.split('-').map(Number);
      return `<div class="hday${d === K.today() ? ' today' : ''}">${WEEKDAYS[new Date(y, m - 1, day).getDay()]}<br>${day}</div>`;
    }).join('');
    const rows = active.map(h => {
      const set = new Set(h.dias || []), s = streak(h);
      return `<div class="hname">${K.esc(h.nome)}<small>${K.esc([h.pessoa, `meta ${h.meta}×/semana`].filter(Boolean).join(' · '))}</small></div>
        ${days().map(d => `<button type="button" class="hcell${set.has(d) ? ' on' : ''}" data-habit="${h.id}" data-day="${d}"
          aria-pressed="${set.has(d)}" aria-label="${K.esc(h.nome)} em ${K.date(d)}">✓</button>`).join('')}
        <div class="hstreak">${s ? `${s} ${s === 1 ? 'dia' : 'dias'}` : '—'}</div>`;
    }).join('');
    return `<div class="panel"><h3>Últimos 7 dias</h3>${active.length ?
      `<div class="hscroll"><div class="hgrid"><div></div>${header}<div class="hday">sequência</div>${rows}</div></div>` :
      '<div class="lempty">Cadastre um hábito para começar a marcar os dias.</div>'}</div>`;
  }

  function render(currentApi) {
    api = currentApi;
    const active = api.items('habitos').filter(h => api.visible(h) && !h.pausado).sort(habitos.sort);
    const hoje = active.filter(h => (h.dias || []).includes(K.today())).length;
    const metaTotal = active.reduce((a, h) => a + h.meta, 0);
    const feitoTotal = active.reduce((a, h) => a + Math.min(doneThisWeek(h), h.meta), 0);
    K.hero(document.getElementById('areaHero'), {
      kicker:'Hábitos de hoje',
      big:active.length ? `${hoje} de ${active.length}` : 'Comece hoje',
      sub:active.length ? (hoje === active.length ? 'Tudo marcado hoje.' : 'Marque abaixo o que já fez hoje.') : 'Cadastre seu primeiro hábito abaixo.',
      stats:[{v:`${metaTotal ? Math.round(feitoTotal / metaTotal * 100) : 0}%`, t:'Metas da semana'},
        {v:active.reduce((a, h) => Math.max(a, streak(h)), 0), t:'Maior sequência (dias)'},
        {v:active.filter(h => doneThisWeek(h) >= h.meta).length, t:'Metas batidas'}, {v:active.length, t:'Hábitos ativos'}]
    });
    document.getElementById('areaContent').innerHTML = week(active) + K.list(api, habitos);
  }

  document.addEventListener('click', event => {
    const cell = event.target.closest('[data-habit]');
    if (!cell || !api) return;
    const habit = api.items('habitos').find(h => h.id === cell.dataset.habit);
    if (!habit) return;
    const copy = LifeStore.clone(habit), day = cell.dataset.day;
    copy.dias = (copy.dias || []).includes(day) ? copy.dias.filter(d => d !== day) : [...(copy.dias || []), day].sort();
    api.save('habitos', copy);
    document.querySelector(`[data-habit="${habit.id}"][data-day="${day}"]`)?.focus();
  });

  LifeShell.start({area:'habitos', page:'habitos.html', collections:['habitos'], render});
})();
