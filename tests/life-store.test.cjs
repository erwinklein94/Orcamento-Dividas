const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../js/life-store.js');
const item=(id,u,extra={})=>({id,u,...extra});
test('empty, upsert and remove keep the payload valid and remember deletions',()=>{
  const p=L.empty(['consultas','vacinas']);assert.ok(L.validPayload(p));
  const saved=L.upsert(p,'consultas',{id:'a',titulo:'Clínico'});
  assert.ok(Number.isFinite(saved.u));assert.equal(p.collections.consultas.length,1);
  L.upsert(p,'consultas',{...saved,titulo:'Cardiologista'});
  assert.deepEqual(p.collections.consultas.map(x=>x.titulo),['Cardiologista']);
  assert.equal(L.remove(p,'consultas','missing'),false);
  assert.equal(L.remove(p,'consultas','a'),true);
  assert.deepEqual(p.collections.consultas,[]);assert.deepEqual(p.deleted,['a']);assert.ok(L.validPayload(p));
  assert.equal(L.validPayload({...p,deleted:undefined}),false);
});
test('merge keeps the newest edit of each record from both devices and never resurrects deletions',()=>{
  const base=L.empty(['listas']);
  base.collections.listas=[item('x',1,{titulo:'old'}),item('y',1),item('z',1)];
  const remote=L.clone(base),local=L.clone(base);
  remote.collections.listas[0].titulo='remote';remote.collections.listas[0].u=5;
  local.collections.listas[0].titulo='local-older';local.collections.listas[0].u=3;
  local.collections.listas[1].u=9;local.collections.listas[1].titulo='local-newer';
  L.remove(remote,'listas','z');
  local.collections.listas.push(item('w',4));
  remote.collections.viagens=[item('v',2)];
  const merged=L.merge(remote,local);
  assert.deepEqual(merged.collections.listas.map(x=>x.id).sort(),['w','x','y']);
  assert.equal(merged.collections.listas.find(x=>x.id==='x').titulo,'remote');
  assert.equal(merged.collections.listas.find(x=>x.id==='y').titulo,'local-newer');
  assert.deepEqual(merged.collections.viagens.map(x=>x.id),['v']);
  assert.deepEqual(merged.deleted,['z']);assert.ok(L.validPayload(merged));
  assert.equal(remote.collections.listas.length,2);
});
test('normalize adds collections introduced later without touching saved records',()=>{
  const p=L.empty(['cursos']);p.collections.cursos.push(item('c',1));
  const n=L.normalize(p,['cursos','livros']);
  assert.deepEqual(Object.keys(n.collections),['cursos','livros']);assert.equal(n.collections.cursos[0].id,'c');
  assert.equal(p.collections.livros,undefined);
});
