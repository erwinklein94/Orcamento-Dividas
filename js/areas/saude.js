// Saúde: consultas e exames, medicamentos, vacinas, reembolsos do plano e medidas.
(() => {
  const K = LifeKit;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const afterStart = (inicio, fim) => inicio && fim && fim < inicio ? 'A data final precisa ser depois da inicial.' : '';

  const consultas = {
    name:'consultas', title:'Consultas e exames', add:'+ adicionar', empty:'Nenhuma consulta ou exame registrado.',
    fields:[
      {key:'titulo', label:'Especialidade ou exame', required:true, wide:true, placeholder:'Ex.: Dermatologista, hemograma'},
      {key:'tipo', label:'Tipo', type:'select', options:['Consulta','Exame','Retorno','Procedimento']},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'data', label:'Data', type:'date', required:true, today:true},
      {key:'hora', label:'Horário', type:'time'},
      {key:'status', label:'Situação', type:'select', required:true, options:['Agendado','Realizado','Cancelado']},
      {key:'local', label:'Profissional ou local'},
      {key:'obs', label:'Observações', type:'textarea'}
    ],
    defaults:() => ({tipo:'Consulta', status:'Agendado'}),
    // Agendados primeiro (do mais próximo), depois o histórico (do mais recente).
    sort:(a, b) => {
      const fa = a.status === 'Agendado' ? 0 : 1, fb = b.status === 'Agendado' ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return fa === 0 ? a.data.localeCompare(b.data) : b.data.localeCompare(a.data);
    },
    row:c => {
      const n = K.daysUntil(c.data);
      const badge = c.status === 'Realizado' ? {text:'Realizado', tone:'ok'} :
        c.status === 'Cancelado' ? {text:'Cancelado', tone:'neutral'} :
        n < 0 ? {text:'Confirmar se foi realizado', tone:'alert'} : {text:cap(K.when(c.data)), tone:n <= 7 ? 'warn' : 'neutral'};
      return {title:c.titulo, meta:[c.tipo, c.pessoa, `${K.date(c.data)}${c.hora ? ` às ${c.hora}` : ''}`, c.local],
        badge, note:c.obs, muted:c.status === 'Cancelado'};
    }
  };

  const medicamentos = {
    name:'medicamentos', title:'Medicamentos', add:'+ adicionar', empty:'Nenhum medicamento em uso.',
    fields:[
      {key:'nome', label:'Medicamento', required:true, wide:true},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'dose', label:'Dose', placeholder:'Ex.: 1 comprimido'},
      {key:'horarios', label:'Quando tomar', wide:true, placeholder:'Ex.: 8h e 20h, após as refeições'},
      {key:'inicio', label:'Início', type:'date', today:true},
      {key:'fim', label:'Término (vazio se contínuo)', type:'date'},
      {key:'obs', label:'Observações', type:'textarea'}
    ],
    validate:m => afterStart(m.inicio, m.fim),
    sort:(a, b) => (a.fim && a.fim < K.today()) - (b.fim && b.fim < K.today()) || a.nome.localeCompare(b.nome),
    row:m => {
      const n = K.daysUntil(m.fim), ended = n !== null && n < 0;
      const badge = ended ? {text:'Encerrado', tone:'neutral'} : n === null ? {text:'Uso contínuo', tone:'ok'} :
        {text:`Termina ${K.when(m.fim)}`, tone:n <= 7 ? 'warn' : 'ok'};
      return {title:m.nome, meta:[m.pessoa, m.dose, m.horarios], badge, note:m.obs, muted:ended};
    }
  };

  const vacinas = {
    name:'vacinas', title:'Vacinas', add:'+ adicionar', empty:'Nenhuma vacina registrada.',
    fields:[
      {key:'nome', label:'Vacina', required:true, wide:true},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'data', label:'Data da aplicação', type:'date', required:true, today:true},
      {key:'proxima', label:'Próxima dose ou reforço', type:'date'},
      {key:'obs', label:'Observações', type:'textarea'}
    ],
    validate:v => afterStart(v.data, v.proxima),
    sort:(a, b) => (a.proxima || '9999').localeCompare(b.proxima || '9999'),
    row:v => {
      const n = K.daysUntil(v.proxima);
      const badge = n === null ? {text:'Em dia', tone:'ok'} : n < 0 ? {text:'Reforço atrasado', tone:'alert'} :
        {text:`Reforço ${K.when(v.proxima)}`, tone:n <= 30 ? 'warn' : 'neutral'};
      return {title:v.nome, meta:[v.pessoa, `aplicada em ${K.date(v.data)}`], badge, note:v.obs};
    }
  };

  const reembolsos = {
    name:'reembolsos', title:'Reembolsos do plano', add:'+ adicionar', empty:'Nenhum pedido de reembolso.',
    fields:[
      {key:'descricao', label:'Descrição', required:true, wide:true, placeholder:'Ex.: Consulta particular com ortopedista'},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'data', label:'Data do pedido', type:'date', required:true, today:true},
      {key:'valor', label:'Valor (R$)', type:'money', required:true},
      {key:'status', label:'Situação', type:'select', required:true, options:['Enviado','Aprovado','Pago','Negado']},
      {key:'obs', label:'Observações', type:'textarea'}
    ],
    defaults:() => ({status:'Enviado'}),
    sort:(a, b) => b.data.localeCompare(a.data),
    row:r => ({title:r.descricao, meta:[r.pessoa, K.date(r.data)], value:K.BRL(r.valor), note:r.obs,
      badge:{text:r.status, tone:r.status === 'Pago' ? 'ok' : r.status === 'Negado' ? 'alert' : 'warn'}})
  };

  const medidas = {
    name:'medidas', title:'Medidas', add:'+ registrar', empty:'Nenhuma medida registrada.',
    fields:[
      {key:'data', label:'Data', type:'date', required:true, today:true},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'peso', label:'Peso (kg)', type:'number', step:'0.1', min:0},
      {key:'pressao', label:'Pressão', placeholder:'Ex.: 12/8'},
      {key:'glicemia', label:'Glicemia (mg/dL)', type:'number', min:0},
      {key:'obs', label:'Observações', type:'textarea'}
    ],
    validate:m => m.peso == null && !m.pressao && m.glicemia == null ? 'Informe ao menos peso, pressão ou glicemia.' : '',
    sort:(a, b) => b.data.localeCompare(a.data),
    row:m => ({title:K.date(m.data), meta:[m.pessoa, m.peso != null && `${String(m.peso).replace('.', ',')} kg`,
      m.pressao && `pressão ${m.pressao}`, m.glicemia != null && `glicemia ${m.glicemia} mg/dL`], note:m.obs})
  };

  function render(api) {
    const vis = name => api.items(name).filter(api.visible);
    const agendados = vis('consultas').filter(c => c.status === 'Agendado' && K.daysUntil(c.data) >= 0)
      .sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));
    const next = agendados[0];
    const emUso = vis('medicamentos').filter(m => !m.fim || m.fim >= K.today()).length;
    const reforcos = vis('vacinas').filter(v => v.proxima && K.daysUntil(v.proxima) <= 30).length;
    const pendente = vis('reembolsos').filter(r => r.status === 'Enviado' || r.status === 'Aprovado').reduce((a, r) => a + (+r.valor || 0), 0);
    K.hero(document.getElementById('areaHero'), {
      kicker:'Próximo compromisso de saúde',
      big:next ? cap(K.when(next.data)) : 'Nada agendado',
      sub:next ? `${next.titulo}${next.pessoa ? ` · ${next.pessoa}` : ''} · ${K.date(next.data)}${next.hora ? ` às ${next.hora}` : ''}` : 'Cadastre consultas e exames para acompanhar aqui.',
      stats:[{v:agendados.length, t:'Agendados'}, {v:emUso, t:'Medicamentos em uso'},
        {v:reforcos, t:'Reforços em 30 dias'}, {v:K.BRL(pendente), t:'Reembolsos a receber'}]
    });
    document.getElementById('areaContent').innerHTML =
      `<div class="lgrid">${[consultas, medicamentos, vacinas, reembolsos, medidas].map(spec => K.list(api, spec)).join('')}</div>`;
  }

  LifeShell.start({area:'saude', page:'saude.html', collections:['consultas','medicamentos','vacinas','reembolsos','medidas'], render});
})();
