// Pets: cadastro dos animais e cuidados recorrentes (vacina, vermífugo, antipulgas, consultas).
(() => {
  const K = LifeKit;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function age(birth) {
    if (!birth) return '';
    const [y, m] = birth.split('-').map(Number), [ty, tm] = K.today().split('-').map(Number);
    const months = (ty - y) * 12 + (tm - m);
    if (months < 0) return '';
    if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    const years = Math.floor(months / 12);
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  }

  const pets = {
    name:'pets', title:'Nossos pets', add:'+ pet', empty:'Nenhum pet cadastrado.',
    fields:[
      {key:'nome', label:'Nome', required:true},
      {key:'especie', label:'Espécie', type:'select', required:true, options:['Cachorro','Gato','Pássaro','Peixe','Outro']},
      {key:'raca', label:'Raça'},
      {key:'nascimento', label:'Nascimento', type:'date'},
      {key:'peso', label:'Peso (kg)', type:'number', step:'0.1', min:0},
      {key:'obs', label:'Observações (alergias, ração, veterinário)', type:'textarea'}
    ],
    sort:(a, b) => a.nome.localeCompare(b.nome),
    row:p => ({title:p.nome, meta:[p.especie, p.raca, age(p.nascimento)], value:p.peso != null ? `${String(p.peso).replace('.', ',')} kg` : '', note:p.obs})
  };

  function cuidadosSpec(api) {
    const all = api.items('pets');
    const petName = id => all.find(p => p.id === id)?.nome || 'Pet removido';
    return {
      name:'cuidados', title:'Cuidados', add:'+ cuidado', empty:all.length ? 'Nenhum cuidado registrado.' : 'Cadastre um pet para registrar cuidados.',
      fields:[
        {key:'pet', label:'Pet', type:'select', required:true, options:all.map(p => [p.id, p.nome])},
        {key:'tipo', label:'Cuidado', type:'select', required:true, options:['Vacina','Vermífugo','Antipulgas','Consulta','Exame','Banho e tosa','Outro']},
        {key:'data', label:'Feito em', type:'date', required:true, today:true},
        {key:'proxima', label:'Próxima vez', type:'date'},
        {key:'valor', label:'Valor (R$)', type:'money'},
        {key:'obs', label:'Observações', type:'textarea'}
      ],
      defaults:() => all.length === 1 ? {pet:all[0].id} : {},
      validate:c => c.proxima && c.proxima < c.data ? 'A próxima data precisa ser depois da última.' : '',
      sort:(a, b) => (a.proxima || '9999').localeCompare(b.proxima || '9999') || b.data.localeCompare(a.data),
      row:c => {
        const n = K.daysUntil(c.proxima);
        const badge = n === null ? {text:'Registrado', tone:'neutral'} : n < 0 ? {text:`Atrasado ${K.when(c.proxima)}`, tone:'alert'} :
          {text:`Próximo ${K.when(c.proxima)}`, tone:n <= 15 ? 'warn' : 'ok'};
        return {title:`${c.tipo} · ${petName(c.pet)}`, meta:[`feito em ${K.date(c.data)}`, c.proxima ? `próximo em ${K.date(c.proxima)}` : ''],
          value:c.valor ? K.BRL(c.valor) : '', badge, note:c.obs};
      }
    };
  }

  function render(api) {
    const cuidados = cuidadosSpec(api), list = api.items('cuidados');
    const scheduled = list.filter(c => c.proxima).sort((a, b) => a.proxima.localeCompare(b.proxima));
    const next = scheduled[0];
    const year = K.today().slice(0, 4);
    const n = next ? K.daysUntil(next.proxima) : null;
    K.hero(document.getElementById('areaHero'), {
      kicker:'Próximo cuidado',
      big:next ? (n < 0 ? `Atrasado ${K.when(next.proxima)}` : cap(K.when(next.proxima))) : 'Nada pendente',
      sub:next ? cuidados.row(next).title + ` · ${K.date(next.proxima)}` : 'Registre vacinas e vermífugos com a próxima data para ser lembrado aqui.',
      stats:[{v:api.items('pets').length, t:'Pets'}, {v:scheduled.filter(c => K.daysUntil(c.proxima) < 0).length, t:'Atrasados'},
        {v:scheduled.filter(c => { const d = K.daysUntil(c.proxima); return d >= 0 && d <= 30; }).length, t:'Próximos 30 dias'},
        {v:K.BRL(list.filter(c => c.data.startsWith(year)).reduce((a, c) => a + (+c.valor || 0), 0)), t:`Gastos em ${year}`}]
    });
    document.getElementById('areaContent').innerHTML = `<div class="lgrid">${K.list(api, cuidados)}${K.list(api, pets)}</div>`;
  }

  LifeShell.start({area:'pets', page:'pets.html', collections:['pets','cuidados'], render});
})();
