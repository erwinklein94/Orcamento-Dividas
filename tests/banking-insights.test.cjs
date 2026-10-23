const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../js/banking-model.js'),C=require('../js/banking-categories.js');
const accounts=[{id:'a',person:'Erwin'},{id:'b',person:'Raquel'}];
const tx=(date,amount,category='Supermercado',account_id='a',flow='normal',description='Compra exemplo')=>({booked_on:date,amount,category,account_id,flow,description});
test('reports compare matching days, exclude transfers and reconcile category shares',()=>{
  const rows=[tx('2026-10-01',-10.01),tx('2026-10-23',-20,'Saúde'),tx('2026-10-22',1000,'Salário'),tx('2026-10-02',-500,'Transferências','a','transfer'),tx('2026-10-03',-50,'Sem categoria','a','ignore'),tx('2026-09-01',-40),tx('2026-09-24',-99)];
  const r=M.report(rows,accounts,{month:'2026-10',today:'2026-10-23'});
  assert.equal(r.summary.expense,30.01);assert.equal(r.summary.income,1000);assert.equal(r.before.expense,40);assert.equal(r.expenseCount,2);
  assert.equal(r.categories.reduce((s,c)=>s+c.cents,0),3001);assert.ok(Math.abs(r.categories.reduce((s,c)=>s+c.share,0)-100)<1e-9);
  assert.equal(r.daily.length,23);assert.equal(r.daily.at(-1).accumulated,3001);assert.equal(r.destinations[0].cents,3001);
  assert.equal(r.history.at(-2).expense,139);assert.equal(r.history.at(-1).expense,30.01);
});
test('person, account, category and accent-insensitive search apply to every report',()=>{
  const rows=[tx('2026-10-01',-15,'Saúde','b','normal','Farmácia Central'),tx('2026-09-01',-10,'Saúde','b','normal','Farmácia Central'),tx('2026-10-02',-20,'Saúde','a'),tx('2026-10-02',-30,'Supermercado','b')];
  const r=M.report(rows,accounts,{month:'2026-10',today:'2026-10-23',person:'Raquel',accountId:'b',category:'Saúde',search:'farmacia'});
  assert.equal(r.current.length,1);assert.equal(r.summary.expense,15);assert.equal(r.before.expense,10);assert.equal(r.history.at(-2).expense,10);assert.equal(r.largest.length,1);
});
test('closed months use all days and history rolls over a year boundary',()=>{
  const r=M.report([tx('2025-12-31',-12),tx('2026-01-31',-18)],accounts,{month:'2026-01',today:'2026-10-23'});
  assert.equal(r.partial,false);assert.equal(r.before.expense,12);assert.equal(r.daily.length,31);assert.equal(r.history[0].month,'2025-08');assert.equal(r.history.at(-1).month,'2026-01');
  const empty=M.report([],accounts,{month:'2026-10',today:'2026-10-23'});assert.equal(empty.summary.expense,0);assert.deepEqual(empty.categories,[]);assert.equal(empty.daily.at(-1).accumulated,0);
});
test('expense drilldowns show exactly the rows counted by a category',()=>{
  const rows=[tx('2026-10-01',-15,'Moradia'),tx('2026-10-02',20,'Moradia'),tx('2026-10-03',-30,'Moradia','a','transfer')];
  const r=M.report(rows,accounts,{month:'2026-10',today:'2026-10-23',category:'Moradia',movement:'expense'});
  assert.equal(r.current.length,1);assert.equal(r.categories[0].count,r.current.length);assert.equal(r.summary.expense,15);assert.equal(r.summary.income,0);
  assert.equal(M.matchesMovement(rows[2],'transfer'),true);assert.equal(M.matchesMovement(rows[1],'income'),true);
});
test('classification separates known family movements and leaves ambiguous Pix for review',()=>{
  for(const name of ['PIX ENVIADO Erwin Klein','Transferência enviada pelo Pix|RAQUEL MARTINS RODRIGUES KLEIN','Pix recebido Raquel Martins Rodrigues'])assert.equal(C.classify(name,-100).flow,'transfer');
  for(const name of ['PIX ENVIADO Erwin Klein Junior','Pix enviado João','Mercado Pago','Mercado Livre','GOOGLE BRASIL INTERNET LTDA.','Loja Rio Claro','Transferência Banco do Brasil'])assert.equal(C.classify(name,-100).category,'Sem categoria');
  assert.equal(C.classify('Compra no débito|DROGAL RIO CLARO V',-10).category,'Saúde');
  assert.equal(C.classify('Aplicação RDB',-500).flow,'transfer');assert.equal(C.classify('Resgate RDB',500).flow,'transfer');
  assert.equal(C.classify('Pagamento efetuado|NOVA IMOVEIS & NEGOCIOS ARARAQUARA LTDA - ME',-2000).category,'Moradia');
  assert.equal(C.classify('ATACADAO 738 AS',-80).category,'Supermercado');assert.equal(C.classify('Compra débito Postomirante',-50).category,'Combustível');assert.equal(C.classify('TELEFONICA BRASIL S.A.',-80).category,'Internet e telefone');
  assert.equal(C.suggestion(tx('2026-10-01',-10,'Alimentação','a','normal','Supermercado exemplo')),null);
  const movement=C.suggestion(tx('2026-10-01',100,'Salário','a','normal','PIX RECEBIDO Erwin Klein'));
  assert.equal(movement.category,'Salário');assert.equal(movement.flow,'transfer');
  assert.equal(C.suggestion(tx('2026-10-01',-10,'Sem categoria','a','ignore','Supermercado exemplo')),null);
});
