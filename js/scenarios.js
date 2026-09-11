const FinanceUI = (() => {
  const {clone,validPayload} = FinanceStore;
  const el = id => document.getElementById(id);
  const select = el('scenarioSelect');
  let client, user, rowId, store, writer, timer, epoch=0, refreshing=false;
  const draftKey = () => `klein-finance-draft-v2:${user.id}`;
  const active = () => store.scenarios.find(c => c.id === store.activeId);
  function message(text,error=false) {
    el('scenarioStatus').textContent=text;
    el('scenarioStatus').classList.toggle('scenario-error',error);
    el('scenarioRetry').hidden=!error || !!writer?.blocked;
    el('scenarioRecover').hidden=!writer?.blocked;
  }
  function snapshot() {
    return clone({renda,custos,plano,dividas,strat,owner,simValue:parseMoney(simInput.value),
      tab:document.querySelector('#tabs button.active')?.dataset.tab || 'crono'});
  }
  function draft() {
    try { localStorage.setItem(draftKey(),JSON.stringify({revision:writer.revision,payload:store})); return true; }
    catch { return false; }
  }
  function renderControls() {
    select.replaceChildren(...store.scenarios.map(c => {
      const option=document.createElement('option');option.value=c.id;
      option.textContent=c.name+(c.id===store.activeId?' (ativo)':'');return option;
    }));
    select.value=store.activeId;
    el('scenarioActive').textContent=active().name;
    el('scenarioName').value=active().name;
    el('scenarioActivate').disabled=true;
    el('scenarioDelete').disabled=store.scenarios.length<=1;
    try { el('scenarioImport').hidden=localStorage.getItem('klein-budget-scenarios-v1')===null; }
    catch { el('scenarioImport').hidden=true; }
  }
  function applyActive() {
    const b=clone(active().budget);
    REF=clone(store.reference);START=REF.ano*12+REF.mes;
    renda=b.renda;custos=b.custos;plano=b.plano;strat=b.strat;owner=b.owner;
    dividas.splice(0,dividas.length,...b.dividas);
    simInput.value=BRLc(b.simValue);amortMensal.value=BRLc(plano.amortMensal);
    document.querySelectorAll('#stratopts .opt').forEach(o=>o.classList.toggle('on',o.dataset.strat===strat));
    document.querySelectorAll('#ownerseg button').forEach(o=>o.classList.toggle('on',o.dataset.owner===owner));
    document.querySelectorAll('#tabs button').forEach(o=>o.classList.toggle('active',o.dataset.tab===b.tab));
    document.querySelectorAll('section').forEach(o=>o.classList.toggle('active',o.id===b.tab));
    document.querySelector('.ref b').textContent=`${MESES[REF.mes]} / ${REF.ano}`;
    updateBonusAuto();renderOrcamentoInputs();renderAll();renderControls();
  }
  function changed(capture=true) {
    if (!store || !writer) return;
    if(capture) active().budget=snapshot();
    if(!validPayload(store)) {message('Há dados inválidos. Corrija os valores antes de salvar.',true);return;}
    writer.change(store);
    const backedUp=draft();
    message(writer.blocked?'Outra sessão alterou o orçamento. Recupere suas edições como cópias para preservar as duas versões.':
      backedUp?'Salvando no Supabase…':'Salvando no Supabase… Não feche esta página até concluir.',writer.blocked);
    clearTimeout(timer);timer=setTimeout(()=>writer.flush(),450);
  }
  async function fetchRow() {
    const {data,error}=await client.from('finance_workspaces').select('id,payload,revision').maybeSingle();
    if(error) throw new Error('Não foi possível carregar seus dados. Verifique a conexão e tente entrar novamente.');
    if(!data) throw new Error('Acesso financeiro ainda não liberado. Confirme o e-mail da conta pessoal e entre novamente.');
    if(!validPayload(data.payload)) throw new Error('Os dados salvos precisam de revisão. Nenhuma informação foi sobrescrita.');
    return data;
  }
  async function start(supabase,userInfo) {
    const request=++epoch;client=supabase;user=userInfo;
    const row=await fetchRow();
    if(request!==epoch)return false;
    rowId=row.id;store=clone(row.payload);
    writer=FinanceStore.writer({
      save:async(payload,revision)=> {
        const {data,error}=await client.from('finance_workspaces').update({payload})
          .eq('id',rowId).eq('revision',revision).select('revision').maybeSingle();
        if(error)throw error;return data;
      },
      onSaved:(revision,pending)=> {
        if(request!==epoch)return;
        if(pending)draft();else {try{localStorage.removeItem(draftKey());}catch{}}
        message(pending?'Salvando alterações seguintes…':`“${active().name}” salvo no Supabase.`);
      },
      onError:kind=> {
        if(request!==epoch)return;
        const backedUp=draft();
        message(kind==='conflict'?'Outra sessão alterou o orçamento. Recupere suas edições como cópias para preservar as duas versões.':
          `Não foi possível salvar no Supabase. ${backedUp?'O rascunho está guardado neste navegador.':'Mantenha esta página aberta.'} Tente novamente.`,true);
      }
    });
    writer.reset(row.revision);
    let pending;
    try {const raw=localStorage.getItem(draftKey());if(raw)pending=JSON.parse(raw);}catch{}
    if(pending && validPayload(pending.payload)) {
      store=pending.revision===row.revision?pending.payload:FinanceStore.recover(store,pending.payload,()=>crypto.randomUUID());
    }
    applyActive();message('Dados carregados do Supabase.');
    if(pending && validPayload(pending.payload))changed(false);
    return true;
  }
  function stop() {
    epoch++;clearTimeout(timer);store=undefined;writer=undefined;user=undefined;
    renda=[];custos=[];plano={amortMensal:0,bonus:[]};dividas.splice(0);
    ['cronoList','detList','rendaList','custosList','recebList','recebResumo','simTable','resultCard'].forEach(id=>el(id).replaceChildren());
  }
  async function refresh() {
    if(!store || writer.dirty || refreshing)return;
    refreshing=true;const request=epoch;
    try {const row=await fetchRow();if(request===epoch&&!writer.dirty&&row.revision!==writer.revision){
      store=clone(row.payload);writer.reset(row.revision);applyActive();message('Orçamento atualizado a partir do Supabase.');
    }} catch {if(request===epoch)message('Não foi possível atualizar os dados. Verifique sua conexão.',true);}
    finally{refreshing=false;}
  }
  select.addEventListener('change',()=>{el('scenarioActivate').disabled=select.value===store?.activeId;});
  el('scenarioActivate').addEventListener('click',()=> {
    if(!store)return;active().budget=snapshot();store.activeId=select.value;applyActive();changed(false);
  });
  el('scenarioCopy').addEventListener('click',()=> {
    if(!store)return;active().budget=snapshot();const source=store.scenarios.find(c=>c.id===select.value);
    FinanceStore.add(store,source.budget,`Cópia de ${source.name}`,crypto.randomUUID());applyActive();changed(false);
  });
  el('scenarioNew').addEventListener('click',()=> {
    if(!store)return;active().budget=snapshot();
    FinanceStore.add(store,store.defaults,'Novo cenário',crypto.randomUUID());applyActive();changed(false);
  });
  el('scenarioDelete').addEventListener('click',()=> {
    if(!store)return;const target=store.scenarios.find(c=>c.id===select.value);if(!target)return;
    if(store.scenarios.length<=1) {message('Mantenha ao menos um cenário. Crie outro antes de excluir este.');return;}
    if(!confirm(`Excluir “${target.name}”? Os dados desse cenário serão apagados do Supabase e não poderão ser recuperados.`))return;
    if(target.id!==store.activeId)active().budget=snapshot();
    FinanceStore.remove(store,target.id);applyActive();changed(false);
    if(validPayload(store)&&!writer.blocked)message(`“${target.name}” excluído. Salvando no Supabase…`);
  });
  el('scenarioRename').addEventListener('submit',event=> {
    event.preventDefault();if(!store)return;const name=el('scenarioName').value.trim().slice(0,60);
    if(!name || store.scenarios.some(c=>c.id!==store.activeId&&c.name.toLocaleLowerCase()===name.toLocaleLowerCase())) {
      message('Escolha um nome não vazio e diferente dos demais cenários.');return;
    }
    active().name=name;renderControls();changed();
  });
  el('scenarioRetry').addEventListener('click',async()=>{if(writer?.dirty)await writer.flush();else await refresh();});
  el('scenarioRecover').addEventListener('click',async()=> {
    if(!writer?.blocked)return;el('scenarioRecover').disabled=true;
    try {
      const row=await fetchRow();store=FinanceStore.recover(row.payload,store,()=>crypto.randomUUID());
      writer.reset(row.revision);applyActive();changed(false);await writer.flush();
    }catch {message('Não foi possível recuperar. Suas edições continuam neste navegador.',true);}
    finally{el('scenarioRecover').disabled=false;}
  });
  el('scenarioImport').addEventListener('click',()=> {
    if(!store)return;
    try{active().budget=snapshot();store=FinanceStore.importLegacy(store,JSON.parse(localStorage.getItem('klein-budget-scenarios-v1')),()=>crypto.randomUUID());
      applyActive();changed(false);
    }catch{message('Não foi possível importar os cenários locais. O conteúdo original foi preservado.',true);}
  });
  orc.addEventListener('input',()=>changed());
  orc.addEventListener('click',e=>{if(e.target.closest('[data-del], #addCusto'))changed();});
  det.addEventListener('click',e=>{if(e.target.closest('[data-toggle]'))changed();});
  stratopts.addEventListener('click',e=>{if(e.target.closest('.opt'))changed();});
  ownerseg.addEventListener('click',e=>{if(e.target.closest('button'))changed();});
  tabs.addEventListener('click',e=>{if(e.target.closest('button'))changed();});
  simInput.addEventListener('input',()=>changed());
  simChips.addEventListener('click',e=>{if(e.target.closest('button'))changed();});
  window.addEventListener('beforeunload',e=>{if(writer?.dirty){e.preventDefault();e.returnValue='';}});
  window.addEventListener('online',()=>{if(writer?.dirty)writer.flush();else refresh();});
  window.addEventListener('focus',refresh);
  return {start,stop,flush:async()=>{clearTimeout(timer);return writer?writer.flush():true;}};
})();
