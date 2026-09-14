// Carreira e Estudos: metas profissionais, cursos e certificações, livros e histórico profissional.
(() => {
  const K = LifeKit;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const percent = x => x == null || (x >= 0 && x <= 100) ? '' : 'O progresso precisa ficar entre 0 e 100%.';

  const metas = {
    name:'metas', title:'Metas profissionais', add:'+ meta', empty:'Nenhuma meta profissional.',
    fields:[
      {key:'titulo', label:'Meta', required:true, wide:true, placeholder:'Ex.: Ser promovido a coordenador'},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'status', label:'Situação', type:'select', required:true, options:['Ativa','Concluída','Pausada']},
      {key:'prazo', label:'Prazo', type:'date'},
      {key:'progresso', label:'Progresso (%)', type:'number', step:'1', min:0, max:100},
      {key:'obs', label:'Próximos passos', type:'textarea'}
    ],
    defaults:() => ({status:'Ativa', progresso:0}),
    validate:m => percent(m.progresso),
    sort:(a, b) => ['Ativa','Pausada','Concluída'].indexOf(a.status) - ['Ativa','Pausada','Concluída'].indexOf(b.status) || (a.prazo || '9999').localeCompare(b.prazo || '9999'),
    row:m => {
      const n = K.daysUntil(m.prazo);
      const badge = m.status !== 'Ativa' ? {text:m.status, tone:m.status === 'Concluída' ? 'ok' : 'neutral'} :
        n !== null && n < 0 ? {text:'Prazo vencido', tone:'alert'} : n !== null ? {text:`Prazo ${K.when(m.prazo)}`, tone:n <= 30 ? 'warn' : 'neutral'} : {text:'Ativa', tone:'neutral'};
      return {title:m.titulo, meta:[m.pessoa, m.prazo ? `até ${K.date(m.prazo)}` : '', `${m.status === 'Concluída' ? 100 : m.progresso || 0}%`],
        progress:m.status === 'Concluída' ? 100 : m.progresso || 0, badge, note:m.obs, muted:m.status === 'Pausada'};
    }
  };

  const cursos = {
    name:'cursos', title:'Cursos e certificações', add:'+ curso', empty:'Nenhum curso registrado.',
    fields:[
      {key:'nome', label:'Curso ou certificação', required:true, wide:true},
      {key:'tipo', label:'Tipo', type:'select', options:['Curso','Certificação','Graduação','Pós-graduação','Idioma','Workshop']},
      {key:'status', label:'Situação', type:'select', required:true, options:['Quero fazer','Cursando','Concluído','Trancado']},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'instituicao', label:'Instituição'},
      {key:'progresso', label:'Progresso (%)', type:'number', step:'1', min:0, max:100},
      {key:'cargaHoras', label:'Carga horária (h)', type:'number', step:'1', min:0},
      {key:'inicio', label:'Início', type:'date'},
      {key:'conclusao', label:'Conclusão', type:'date'},
      {key:'custo', label:'Investimento (R$)', type:'money'},
      {key:'obs', label:'Observações', type:'textarea'}
    ],
    defaults:() => ({tipo:'Curso', status:'Quero fazer'}),
    validate:c => percent(c.progresso) || (c.inicio && c.conclusao && c.conclusao < c.inicio ? 'A conclusão precisa ser depois do início.' : ''),
    sort:(a, b) => ['Cursando','Quero fazer','Concluído','Trancado'].indexOf(a.status) - ['Cursando','Quero fazer','Concluído','Trancado'].indexOf(b.status) || a.nome.localeCompare(b.nome),
    row:c => ({title:c.nome, meta:[c.tipo, c.instituicao, c.pessoa, c.cargaHoras ? `${c.cargaHoras}h` : '', c.conclusao ? `concluído em ${K.date(c.conclusao)}` : ''],
      value:c.custo ? K.BRL(c.custo) : '', progress:c.status === 'Cursando' ? c.progresso || 0 : null, note:c.obs, muted:c.status === 'Trancado',
      badge:{text:c.status === 'Cursando' && c.progresso != null ? `Cursando · ${c.progresso}%` : c.status,
        tone:c.status === 'Concluído' ? 'ok' : c.status === 'Cursando' ? 'warn' : 'neutral'}})
  };

  const livros = {
    name:'livros', title:'Livros', add:'+ livro', empty:'Nenhum livro na lista.',
    fields:[
      {key:'titulo', label:'Título', required:true, wide:true},
      {key:'autor', label:'Autor'},
      {key:'status', label:'Situação', type:'select', required:true, options:['Quero ler','Lendo','Lido']},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'paginas', label:'Total de páginas', type:'number', step:'1', min:1},
      {key:'paginaAtual', label:'Página atual', type:'number', step:'1', min:0},
      {key:'conclusao', label:'Terminei em', type:'date'},
      {key:'nota', label:'Nota (1 a 5)', type:'number', step:'1', min:1, max:5},
      {key:'obs', label:'Aprendizados', type:'textarea'}
    ],
    defaults:() => ({status:'Quero ler'}),
    validate:l => l.paginas && l.paginaAtual > l.paginas ? 'A página atual não pode passar do total de páginas.' :
      l.nota != null && !(Number.isInteger(l.nota) && l.nota >= 1 && l.nota <= 5) ? 'A nota precisa ser um número inteiro de 1 a 5.' : '',
    sort:(a, b) => ['Lendo','Quero ler','Lido'].indexOf(a.status) - ['Lendo','Quero ler','Lido'].indexOf(b.status) || a.titulo.localeCompare(b.titulo),
    row:l => ({title:l.titulo, meta:[l.autor, l.pessoa, l.status === 'Lendo' && l.paginas ? `página ${l.paginaAtual || 0} de ${l.paginas}` : '',
      l.nota ? `nota ${l.nota}/5` : '', l.conclusao ? `lido em ${K.date(l.conclusao)}` : ''],
      progress:l.status === 'Lendo' && l.paginas ? (l.paginaAtual || 0) / l.paginas * 100 : null, note:l.obs,
      badge:{text:l.status, tone:l.status === 'Lido' ? 'ok' : l.status === 'Lendo' ? 'warn' : 'neutral'}})
  };

  const historico = {
    name:'historico', title:'Histórico profissional', add:'+ evento', empty:'Nenhum evento registrado.',
    fields:[
      {key:'evento', label:'Evento', type:'select', required:true, options:['Contratação','Promoção','Reajuste','Mudança de área','Reconhecimento','Desligamento']},
      {key:'data', label:'Data', type:'date', required:true, today:true},
      {key:'cargo', label:'Cargo', required:true},
      {key:'empresa', label:'Empresa'},
      {key:'pessoa', label:'Pessoa', type:'person'},
      {key:'salario', label:'Salário bruto (R$)', type:'money'},
      {key:'obs', label:'Observações', type:'textarea'}
    ],
    sort:(a, b) => b.data.localeCompare(a.data),
    row:h => ({title:`${h.evento}: ${h.cargo}`, meta:[h.empresa, h.pessoa, K.date(h.data)], value:h.salario ? K.BRL(h.salario) : '', note:h.obs})
  };

  function render(api) {
    const vis = name => api.items(name).filter(api.visible);
    const year = K.today().slice(0, 4);
    const cursosAno = vis('cursos').filter(c => c.status === 'Concluído' && c.conclusao?.startsWith(year));
    const livrosAno = vis('livros').filter(l => l.status === 'Lido' && l.conclusao?.startsWith(year));
    const concluidos = cursosAno.length + livrosAno.length;
    K.hero(document.getElementById('areaHero'), {
      kicker:`Aprendizado em ${year}`,
      big:`${concluidos} ${concluidos === 1 ? 'concluído' : 'concluídos'}`,
      sub:`${cursosAno.length} ${cursosAno.length === 1 ? 'curso' : 'cursos'} e ${livrosAno.length} ${livrosAno.length === 1 ? 'livro' : 'livros'} finalizados este ano`,
      stats:[{v:vis('cursos').filter(c => c.status === 'Cursando').length, t:'Cursos em andamento'},
        {v:vis('livros').filter(l => l.status === 'Lendo').length, t:'Livros em leitura'},
        {v:vis('metas').filter(m => m.status === 'Ativa').length, t:'Metas ativas'},
        {v:`${cursosAno.reduce((a, c) => a + (+c.cargaHoras || 0), 0)}h`, t:`Horas estudadas em ${year}`}]
    });
    document.getElementById('areaContent').innerHTML =
      `<div class="lgrid">${[metas, cursos, livros, historico].map(spec => K.list(api, spec)).join('')}</div>`;
  }

  LifeShell.start({area:'carreira', page:'carreira.html', collections:['metas','cursos','livros','historico'], render});
})();
