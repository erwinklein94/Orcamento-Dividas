// Shared, DOM-free model used by the browser and the automated tests.
const FinanceStore = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const text = value => typeof value === 'string';
  function validBudget(b) {
    return !!(b && Array.isArray(b.renda) && b.renda.length && b.renda.every(r =>
      r && text(r.pessoa) && text(r.tipo) && number(r.valor) && typeof r.tributavel === 'boolean' &&
      (r.dependentes == null || number(r.dependentes)) && (r.outrosDescontos == null || number(r.outrosDescontos))) &&
      Array.isArray(b.custos) && b.custos.every(c => c && text(c.grupo) && text(c.nome) && number(c.valor)) &&
      b.plano && number(b.plano.amortMensal) && Array.isArray(b.plano.bonus) && b.plano.bonus.every(x =>
        x && ['13','ppr'].includes(x.tipo) && text(x.nome) && text(x.pessoa) && number(x.bruto) &&
        Number.isInteger(x.mes) && x.mes >= 1 && x.mes <= 12 && (x.usar == null || number(x.usar))) &&
      ['juros','fluxo','snowball'].includes(b.strat) && ['todos','Erwin','Raquel'].includes(b.owner) &&
      number(b.simValue) && ['crono','orc','det','sim'].includes(b.tab) &&
      Array.isArray(b.dividas) && b.dividas.every(d => d &&
        ['contrato','titular','credor','tipo','primeira','ultima'].every(k => text(d[k])) &&
        ['parcela','nParc','nRest','taxaMes','cetMes','fimAno','fimMes'].every(k => number(d[k])) &&
        (d.liq == null || number(d.liq)) && (d.iniAno == null || number(d.iniAno)) &&
        (d.iniMes == null || number(d.iniMes)) && (d.obs == null || text(d.obs)) &&
        typeof d.ativa === 'boolean' && typeof d.quitada === 'boolean') &&
      new Set(b.dividas.map(d => d.contrato)).size === b.dividas.length);
  }
  function validPayload(s) {
    return !!(s && s.version === 2 && s.reference && Number.isInteger(s.reference.ano) &&
      s.reference.ano >= 2020 && s.reference.ano <= 2100 && Number.isInteger(s.reference.mes) &&
      s.reference.mes >= 0 && s.reference.mes <= 11 && validBudget(s.defaults) &&
      Array.isArray(s.scenarios) && s.scenarios.length >= 3 && s.scenarios.every(c =>
        c && text(c.id) && text(c.name) && c.name.trim() && c.name.length <= 60 && validBudget(c.budget)) &&
      new Set(s.scenarios.map(c => c.id)).size === s.scenarios.length && s.scenarios.some(c => c.id === s.activeId));
  }
  function uniqueName(s, base) {
    let name = base.slice(0,60), suffix = 2;
    while (s.scenarios.some(c => c.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      const ending = ` (${suffix++})`;
      name = base.slice(0,60-ending.length) + ending;
    }
    return name;
  }
  function add(s, budget, name, id) {
    const c = {id, name:uniqueName(s,name),budget:clone(budget)};
    s.scenarios.push(c);
    s.activeId = c.id;
    return c;
  }
  function recover(remote, local, uuid) {
    const result = clone(remote);
    for (const c of local.scenarios) {
      const copy = add(result,c.budget,`Recuperado: ${c.name}`,uuid());
      if (c.id === local.activeId) result.recoveredActive = copy.id;
    }
    result.activeId = result.recoveredActive;
    delete result.recoveredActive;
    return result;
  }
  function importLegacy(remote, legacy, uuid) {
    if (!legacy || legacy.version !== 1 || !Array.isArray(legacy.scenarios) || legacy.scenarios.length < 3) throw new Error('Backup local inválido.');
    const result = clone(remote);
    for (const c of legacy.scenarios) {
      if (!c || !text(c.name) || !c.budget || !Array.isArray(c.budget.dividas)) throw new Error('Cenário local inválido.');
      const budget = {...clone(result.defaults), ...clone(c.budget)};
      budget.dividas = result.defaults.dividas.map(d => {
        const previous = c.budget.dividas.find(x => x.contrato === d.contrato);
        return {...clone(d), ativa:previous?.ativa ?? d.ativa, quitada:previous?.quitada ?? d.quitada};
      });
      if (!validBudget(budget)) throw new Error('Cenário local inválido.');
      add(result,budget,`Importado: ${c.name}`,uuid());
    }
    return result;
  }
  // Serialize writes and compare revisions. A second device can never silently overwrite edits.
  function writer({ save, onSaved = () => {}, onError = () => {} }) {
    let revision = 0, latest, sequence = 0, savedSequence = 0, running, blocked = false;
    function reset(nextRevision) { revision=nextRevision;sequence=0;savedSequence=0;latest=undefined;blocked=false; }
    function change(value) { latest=clone(value);sequence++; }
    async function flush() {
      if (running) return running;
      if (blocked) return false;
      running = (async () => {
        while (sequence !== savedSequence) {
          const sentSequence = sequence, sent = clone(latest);
          try {
            const result = await save(sent,revision);
            if (!result) { blocked=true; onError('conflict'); return false; }
            revision = result.revision;
            savedSequence = sentSequence;
            onSaved(revision, sequence !== savedSequence);
          } catch (error) { onError('network',error); return false; }
        }
        return true;
      })();
      try { return await running; } finally { running=undefined; }
    }
    return {reset,change,flush,get revision(){return revision;},get dirty(){return sequence!==savedSequence;},get blocked(){return blocked;}};
  }
  return {clone,validBudget,validPayload,uniqueName,add,recover,importLegacy,writer};
})();
if (typeof module !== 'undefined') module.exports = FinanceStore;
