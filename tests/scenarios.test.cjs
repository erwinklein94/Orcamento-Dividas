const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const F=require('../js/finance-store.js');
const root=path.resolve(__dirname,'..');
function fixture(){
  const budget={renda:[{pessoa:'Erwin',tipo:'Salário',valor:4000,tributavel:true,dependentes:0,outrosDescontos:0}],
    custos:[{grupo:'Casa',nome:'Custo exemplo',valor:100}],plano:{amortMensal:50,bonus:[{tipo:'13',nome:'13º',pessoa:'Erwin',mes:12,bruto:4000,usar:null,usarAuto:true}]},
    dividas:[{contrato:'test-1',titular:'Erwin',credor:'Teste',tipo:'Teste',primeira:'01/09/2026',ultima:'01/12/2026',parcela:100,nParc:4,nRest:4,taxaMes:1,cetMes:1,fimAno:2026,fimMes:12,liq:400,ativa:true,quitada:false}],
    strat:'juros',owner:'todos',simValue:100,tab:'crono'};
  return {version:2,reference:{ano:2026,mes:8},defaults:budget,activeId:'one',scenarios:['one','two','three'].map(id=>({id,name:id,budget:F.clone(budget)}))};
}
test('independent full scenario copies and validation',()=>{
  const p=fixture();assert.ok(F.validPayload(p));
  F.add(p,p.scenarios[0].budget,'one','four');
  assert.equal(p.scenarios[3].name,'one (2)');
  p.scenarios[3].budget.dividas[0].ativa=false;
  p.scenarios[3].budget.renda[0].valor=8000;
  assert.equal(p.scenarios[0].budget.dividas[0].ativa,true);
  assert.equal(p.scenarios[0].budget.renda[0].valor,4000);
  p.activeId='missing';assert.equal(F.validPayload(p),false);
});
test('deleting scenarios keeps the payload valid and never removes the last one',()=>{
  const p=fixture();
  assert.equal(F.remove(p,'missing'),false);
  assert.equal(F.remove(p,'two'),true);
  assert.deepEqual(p.scenarios.map(c=>c.id),['one','three']);
  assert.equal(p.activeId,'one');assert.ok(F.validPayload(p));
  assert.equal(F.remove(p,'one'),true);
  assert.deepEqual(p.scenarios.map(c=>c.id),['three']);
  assert.equal(p.activeId,'three');assert.ok(F.validPayload(p));
  assert.equal(F.remove(p,'three'),false);
  assert.equal(p.scenarios.length,1);assert.ok(F.validPayload(p));
});
test('serialized saves include edits made while the previous request is in flight',async()=>{
  let release;const sent=[];
  const w=F.writer({save:async(payload,revision)=>{sent.push([payload,revision]);if(sent.length===1)await new Promise(r=>release=r);return{revision:revision+1};}});
  w.reset(4);w.change({value:1});const result=w.flush();w.change({value:2});release();
  assert.equal(await result,true);assert.deepEqual(sent,[[{value:1},4],[{value:2},5]]);assert.equal(w.dirty,false);
});
test('network failure keeps pending edits and supports retry',async()=>{
  let failed=true;const errors=[];
  const w=F.writer({save:async()=>{if(failed)throw Error('offline');return{revision:2};},onError:x=>errors.push(x)});
  w.reset(1);w.change(fixture());assert.equal(await w.flush(),false);assert.equal(w.dirty,true);
  failed=false;assert.equal(await w.flush(),true);assert.deepEqual(errors,['network']);
});
test('two devices cannot overwrite each other; conflict recovery preserves both sets',async()=>{
  let cloud={revision:1,payload:fixture()};
  const save=async(payload,revision)=>{if(revision!==cloud.revision)return null;cloud={payload:F.clone(payload),revision:revision+1};return{revision:cloud.revision};};
  const a=F.writer({save}),b=F.writer({save});a.reset(1);b.reset(1);
  const pa=fixture(),pb=fixture();pa.scenarios[0].name='Device A';pb.scenarios[0].name='Device B';
  a.change(pa);b.change(pb);assert.equal(await a.flush(),true);assert.equal(await b.flush(),false);assert.equal(b.blocked,true);
  let i=0;const recovered=F.recover(cloud.payload,pb,()=>`copy-${++i}`);
  assert.equal(recovered.scenarios.length,6);assert.equal(recovered.scenarios[0].name,'Device A');
  assert.equal(recovered.scenarios.find(c=>c.id===recovered.activeId).name,'Recuperado: Device B');
  assert.ok(F.validPayload(recovered));
});
test('legacy browser budgets import as independent copies with full cloud debt details',()=>{
  const p=fixture(),legacy={version:1,scenarios:F.clone(p.scenarios)};
  for(const c of legacy.scenarios)c.budget.dividas=c.budget.dividas.map(d=>({contrato:d.contrato,ativa:false,quitada:false}));
  let i=0;const result=F.importLegacy(p,legacy,()=>`import-${++i}`);
  assert.equal(result.scenarios.length,6);assert.ok(F.validPayload(result));
  assert.equal(result.scenarios[3].budget.dividas[0].credor,'Teste');assert.equal(result.scenarios[3].budget.dividas[0].ativa,false);
  assert.equal(p.scenarios.length,3);
});

async function boot(cloud={payload:fixture(),revision:1},storage=new Map()){
  function element(){
    const listeners={},classes=new Set();
    return {value:'',dataset:{},style:{},hidden:false,textContent:'',innerHTML:'',
      classList:{toggle(c,on){if(on)classes.add(c);else classes.delete(c);},add(c){classes.add(c);},remove(c){classes.delete(c);},contains:c=>classes.has(c)},
      replaceChildren(...children){this.children=children;},
      addEventListener(type,fn){(listeners[type]||=[]).push(fn);},
      emit(type,target=this){for(const fn of listeners[type]||[])fn({target,preventDefault(){}});},
      closest(){return null;}};
  }
  const ids=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  const nodes=Object.fromEntries(ids.map(id=>[id,Object.assign(element(),{id})]));
  const tabNodes=['crono','orc','det','sim'].map(tab=>Object.assign(element(),{dataset:{tab}}));
  tabNodes[0].classList.add('active');
  const document={getElementById:id=>nodes[id],createElement:element,
    querySelectorAll:selector=>selector==='#tabs button'?tabNodes:selector==='section'?['crono','orc','det','sim'].map(id=>nodes[id]):[],
    querySelector:selector=>selector==='#tabs button.active'?tabNodes.find(x=>x.classList.contains('active')):selector==='.ref b'?element():null};
  const prompts={confirm:true};
  const context=vm.createContext({...nodes,document,window:element(),crypto:webcrypto,console,setTimeout,clearTimeout,
    confirm:()=>prompts.confirm,
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  const client={from(){let value,revision;return{select(){return this;},update(v){value=v;return this;},eq(k,v){if(k==='revision')revision=v;return this;},async maybeSingle(){
    if(value){if(revision!==cloud.revision)return{data:null};cloud.payload=F.clone(value.payload);cloud.revision++;return{data:{revision:cloud.revision}};}
    return{data:{id:'workspace',...F.clone(cloud)}};
  }}}};
  context.client=client;
  for(const f of ['app.js','finance-store.js','scenarios.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',f),'utf8'),context);
  await vm.runInContext('FinanceUI.start(client,{id:"owner"})',context);
  return {nodes,cloud,storage,prompts,read:x=>JSON.parse(vm.runInContext(`JSON.stringify(${x})`,context)),
    input(dataset,value,id=''){nodes.orc.emit('input',{dataset,value,id});},
    activate(id){nodes.scenarioSelect.value=id;nodes.scenarioActivate.emit('click');},
    remove(id){nodes.scenarioSelect.value=id;nodes.scenarioDelete.emit('click');},
    flush:()=>vm.runInContext('FinanceUI.flush()',context),stop:()=>vm.runInContext('FinanceUI.stop()',context)};
}
test('real app handlers persist salaries, deductions, costs, bonus and active scenario across devices',async t=>{
  const app=await boot();t.after(app.stop);
  app.input({renda:'0'},'6.000,00');app.input({desconto:'0'},'300,00');app.input({bonususar:'0'},'200,00');app.input({},'150,00','amortMensal');
  app.activate('two');assert.equal(app.read('renda[0].valor'),4000);
  app.input({custo:'0'},'500,00');await app.flush();
  const other=await boot(app.cloud);t.after(other.stop);
  assert.equal(other.read('custos[0].valor'),500);assert.equal(other.nodes.scenarioActive.textContent,'two');
  other.activate('one');assert.equal(other.read('renda[0].valor'),6000);assert.equal(other.read('renda[0].outrosDescontos'),300);
  assert.equal(other.read('plano.amortMensal'),150);assert.equal(other.read('plano.bonus[0].usar'),200);await other.flush();
});
test('real copy/new/debt controls persist complete independent budgets',async t=>{
  const app=await boot();t.after(app.stop);
  app.input({custo:'0'},'250,00');
  app.nodes.det.emit('click',{dataset:{toggle:'0'},closest(){return this;}});
  app.activate('two');app.nodes.scenarioSelect.value='one';app.nodes.scenarioCopy.emit('click');
  assert.equal(app.read('custos[0].valor'),250);assert.equal(app.read('dividas[0].ativa'),false);
  app.input({custo:'0'},'350,00');app.nodes.scenarioName.value='My plan';app.nodes.scenarioRename.emit('submit');
  app.activate('one');assert.equal(app.read('custos[0].valor'),250);
  app.nodes.scenarioNew.emit('click');assert.equal(app.read('custos[0].valor'),100);await app.flush();
  assert.equal(app.cloud.payload.scenarios.length,5);assert.ok(app.cloud.payload.scenarios.some(c=>c.name==='My plan'));
});
test('real delete control confirms first, persists the removal and protects the last scenario',async t=>{
  const app=await boot();t.after(app.stop);
  app.input({custo:'0'},'250,00');
  app.prompts.confirm=false;app.remove('two');
  assert.deepEqual(app.nodes.scenarioSelect.children.map(o=>o.value),['one','two','three']);
  app.prompts.confirm=true;app.remove('two');
  assert.deepEqual(app.nodes.scenarioSelect.children.map(o=>o.value),['one','three']);
  assert.equal(app.nodes.scenarioActive.textContent,'one');assert.equal(app.read('custos[0].valor'),250);
  app.remove('one');
  assert.equal(app.nodes.scenarioActive.textContent,'three');assert.equal(app.read('custos[0].valor'),100);
  assert.equal(app.nodes.scenarioDelete.disabled,true);
  app.remove('three');
  assert.deepEqual(app.nodes.scenarioSelect.children.map(o=>o.value),['three']);
  assert.match(app.nodes.scenarioStatus.textContent,/ao menos um cenário/);
  await app.flush();
  assert.deepEqual(app.cloud.payload.scenarios.map(c=>c.name),['three']);
  assert.equal(app.cloud.payload.activeId,'three');
  const other=await boot(app.cloud);t.after(other.stop);
  assert.equal(other.nodes.scenarioActive.textContent,'three');
  assert.equal(other.nodes.scenarioDelete.disabled,true);
});
