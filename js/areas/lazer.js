// Lazer e Viagens: viagens com orçamento e checklist, e listas de filmes, séries, livros e lugares.
(() => {
  const K = LifeKit;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const TRIP_ORDER = ['Confirmada','Planejando','Sonho','Realizada','Cancelada'];
  const LIST_ORDER = ['Em andamento','Quero','Feito'];

  const viagens = {
    name:'viagens', title:'Viagens', add:'+ viagem', empty:'Nenhuma viagem planejada.',
    fields:[
      {key:'destino', label:'Destino', required:true, wide:true},
      {key:'status', label:'Situação', type:'select', required:true, options:TRIP_ORDER},
      {key:'pessoa', label:'Quem vai', type:'person'},
      {key:'inicio', label:'Ida', type:'date'},
      {key:'fim', label:'Volta', type:'date'},
      {key:'orcamento', label:'Orçamento (R$)', type:'money'},
      {key:'gasto', label:'Já gasto (R$)', type:'money'},
      {key:'checklist', label:'Checklist da viagem', type:'checklist'},
      {key:'obs', label:'Observações', type:'textarea'}
    ],
    defaults:() => ({status:'Planejando', pessoa:'Casal'}),
    validate:v => v.inicio && v.fim && v.fim < v.inicio ? 'A volta precisa ser depois da ida.' : '',
    sort:(a, b) => TRIP_ORDER.indexOf(a.status) - TRIP_ORDER.indexOf(b.status) || (a.inicio || '9999').localeCompare(b.inicio || '9999'),
    row:v => {
      const n = K.daysUntil(v.inicio), list = v.checklist || [];
      const badge = v.status === 'Confirmada' && v.fim && K.daysUntil(v.fim) < 0 ? {text:'Atualize a situação', tone:'alert'} :
        v.status === 'Confirmada' && n !== null && n >= 0 ? {text:cap(K.when(v.inicio)), tone:n <= 30 ? 'warn' : 'ok'} :
        {text:v.status, tone:v.status === 'Realizada' || v.status === 'Confirmada' ? 'ok' : 'neutral'};
      const dates = v.inicio ? `${K.date(v.inicio)}${v.fim ? ` a ${K.date(v.fim)}` : ''}` : '';
      const money = v.orcamento ? `${K.BRL(v.gasto || 0)} de ${K.BRL(v.orcamento)}` : v.gasto ? K.BRL(v.gasto) : '';
      return {title:v.destino, meta:[v.pessoa, dates, list.length ? `checklist ${list.filter(c => c.ok).length}/${list.length}` : ''],
        value:money, badge, checklist:list, checklistKey:'checklist', note:v.obs,
        progress:v.orcamento ? (v.gasto || 0) / v.orcamento * 100 : null, muted:v.status === 'Cancelada'};
    }
  };

  const listas = {
    name:'listas', title:'Filmes, séries, livros e lugares', add:'+ item', empty:'A lista está vazia.',
    fields:[
      {key:'titulo', label:'Título ou lugar', required:true, wide:true},
      {key:'tipo', label:'Tipo', type:'select', required:true, options:['Filme','Série','Livro','Restaurante','Passeio']},
      {key:'status', label:'Situação', type:'select', required:true, options:['Quero','Em andamento','Feito']},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'nota', label:'Nota (1 a 5)', type:'number', step:'1', min:1, max:5},
      {key:'data', label:'Quando fez', type:'date'},
      {key:'obs', label:'Observações', type:'textarea'}
    ],
    defaults:() => ({status:'Quero'}),
    validate:x => x.nota == null || (Number.isInteger(x.nota) && x.nota >= 1 && x.nota <= 5) ? '' : 'A nota precisa ser um número inteiro de 1 a 5.',
    sort:(a, b) => LIST_ORDER.indexOf(a.status) - LIST_ORDER.indexOf(b.status) || a.titulo.localeCompare(b.titulo),
    row:x => ({title:x.titulo, meta:[x.tipo, x.pessoa, x.nota ? `nota ${x.nota}/5` : '', x.data ? K.date(x.data) : ''], note:x.obs,
      badge:{text:x.status, tone:x.status === 'Feito' ? 'ok' : x.status === 'Em andamento' ? 'warn' : 'neutral'}})
  };

  function render(api) {
    const trips = api.items('viagens').filter(api.visible);
    const items = api.items('listas').filter(api.visible);
    const planned = trips.filter(v => v.status === 'Confirmada' || v.status === 'Planejando');
    const next = planned.filter(v => v.inicio && K.daysUntil(v.inicio) >= 0).sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
    const year = K.today().slice(0, 4);
    K.hero(document.getElementById('areaHero'), {
      kicker:'Próxima viagem',
      big:next ? cap(K.when(next.inicio)) : 'Nenhuma data marcada',
      sub:next ? `${next.destino} · ${K.date(next.inicio)}${next.fim ? ` a ${K.date(next.fim)}` : ''}` : 'Planeje uma viagem com data de ida para ver a contagem aqui.',
      stats:[{v:planned.length, t:'Viagens planejadas'}, {v:K.BRL(planned.reduce((a, v) => a + (+v.orcamento || 0), 0)), t:'Orçamento planejado'},
        {v:items.filter(x => x.status === 'Quero').length, t:'Na lista de desejos'},
        {v:items.filter(x => x.status === 'Feito' && x.data?.startsWith(year)).length, t:`Feitos em ${year}`}]
    });
    document.getElementById('areaContent').innerHTML = `<div class="lgrid">${K.list(api, viagens)}${K.list(api, listas)}</div>`;
  }

  LifeShell.start({area:'lazer', page:'lazer.html', collections:['viagens','listas'], render});
})();
