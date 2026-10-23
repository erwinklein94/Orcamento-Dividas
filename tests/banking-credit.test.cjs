const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/banking-credit-model.js');
const accounts=[{id:'a',bank:'Itaú',person:'Erwin',kind:'credit'},{id:'b',bank:'Nubank',person:'Raquel',kind:'credit'},{id:'c',bank:'Santander',person:'Erwin',kind:'checking'}];
const tx=(day,amount,account_id='a',flow='normal',description='Compra')=>({booked_on:day,amount,account_id,flow,description});
test('weekly card report uses Monday-Sunday clipped to month and exact cent totals',()=>{
  const rows=[tx('2026-09-01',-10.01),tx('2026-09-06',-20,'b'),tx('2026-09-07',-30),tx('2026-09-30',-40,'b'),tx('2026-08-31',-500),tx('2026-09-03',-900,'c'),tx('2026-09-02',-800,'a','transfer'),tx('2026-09-03',-70,'b','ignore'),tx('2026-09-12',12,'b'),tx('2026-09-01',700,'b','normal','Pagamento recebido'),tx('2026-09-02',-600,'a','normal','Pagamento de fatura')];
  const r=C.weekly(rows,accounts,{month:'2026-09'});
  assert.equal(r.weeks.length,5);assert.equal(r.weeks[0].end,'2026-09-06');assert.equal(r.weeks[1].start,'2026-09-07');assert.equal(r.weeks.at(-1).end,'2026-09-30');assert.equal(r.weeks[0].partial,true);
  assert.equal(r.cents,10001);assert.equal(r.count,4);assert.equal(r.credits,1200);assert.equal(r.weeks[0].byCard.a,1001);assert.equal(r.weeks[0].byCard.b,2000);assert.equal(r.coverage.reduce((s,c)=>s+c.total,0),r.cents);
  const raquel=C.weekly(rows,accounts,{month:'2026-09',person:'Raquel'});assert.equal(raquel.cents,6000);assert.equal(raquel.cards.length,1);
});
test('weekly calendars handle leap days and six-week months without overlapping days',()=>{
  for(const month of ['2024-02','2026-03','2026-11','2027-01']){
    const r=C.weekly([],accounts,{month}),[y,m]=month.split('-').map(Number),days=new Date(Date.UTC(y,m,0)).getUTCDate();
    let seen=[];for(const w of r.weeks){for(let d=Number(w.start.slice(8));d<=Number(w.end.slice(8));d++)seen.push(d);}
    assert.equal(seen.length,days);assert.equal(new Set(seen).size,days);assert.equal(r.cents,0);
  }
  assert.equal(C.weekly([],accounts,{month:'2026-03'}).weeks.length,6);
  assert.throws(()=>C.weekly([],accounts,{month:'2026-13'}));
});
test('loan payments keep distinct contract numbers and exclude card bills, credit proceeds and transfers',()=>{
  const rows=[tx('2026-09-16',-100,'c','normal','EMPRESTIMO CONSIGNADO 111'),tx('2026-10-16',-101,'c','normal','EMPRESTIMO CONSIGNADO 111'),tx('2026-10-16',-80,'c','normal','EMPRESTIMO CONSIGNADO 222'),tx('2026-10-01',2000,'c','normal','Crédito de empréstimo'),tx('2026-10-02',-50,'c','transfer','Empréstimo recebido'),tx('2026-10-02',-30,'a','normal','Pagamento de fatura')];
  const groups=C.loanPayments(rows,accounts,{month:'2026-10',bank:'Santander',person:'Erwin'});
  assert.equal(groups.length,2);assert.equal(groups[0].rows.length,2);assert.equal(groups[0].monthCents,10100);assert.equal(groups[0].cents,20100);assert.equal(groups[0].last,'2026-10-16');
  assert.deepEqual(C.loanPayments(rows,accounts,{month:'2026-10',person:'Raquel'}),[]);
  const matches=C.paymentsForContract({contrato:'0000111',credor:'Santander',titular:'Erwin'},groups);assert.equal(matches.length,0); // short identifiers are ambiguous
  assert.equal(C.paymentsForContract({contrato:'0000732100565',credor:'Santander',titular:'Erwin'},[{bank:'Santander',person:'Erwin',name:'EMPRESTIMO CONSIGNADO 732100565'}]).length,1);
  assert.equal(C.paymentsForContract({contrato:'732100565',credor:'Santander',titular:'Erwin'},[{bank:'Santander',person:'Erwin',name:'EMPRESTIMO CONSIGNADO 7321005659'}]).length,0);
});
test('budget loans use one selected scenario and preserve saved paid/inactive contracts',()=>{
  const payload={activeId:'a',reference:{ano:2026,mes:8},scenarios:[{id:'a',name:'Atual',budget:{dividas:[{contrato:'1',ativa:true,quitada:false},{contrato:'2',ativa:false,quitada:true},{contrato:'3',ativa:false,quitada:false}]}},{id:'b',budget:{dividas:[{contrato:'1',ativa:true,quitada:false}]}}]};
  const r=C.budgetLoans(payload);assert.deepEqual(r.loans.map(l=>l.status),['ativo','quitado','fora_plano']);assert.equal(C.budgetLoans(payload,'b').loans.length,1);assert.equal(payload.scenarios[0].budget.dividas[0].status,undefined);assert.deepEqual(C.budgetLoans(null).loans,[]);
});
test('provider loans preserve missing balances and only accept the requested item and BRL',async()=>{
  const {normalizeLoans}=await import('../supabase/functions/bank-sync/loans.mjs');
  const loan={id:'one',itemId:'item',currencyCode:'BRL',productName:'Consignado',contractAmount:1000,payments:{contractOutstandingBalance:0},installments:{paidInstallments:3}};
  const rows=normalizeLoans([loan,{...loan,id:'two',payments:{}},{...loan,currencyCode:'USD'},{...loan,itemId:'other'}],'item');
  assert.equal(rows.length,2);assert.equal(rows[0].outstandingBalance,0);assert.equal(rows[1].outstandingBalance,null);assert.equal(rows[0].dueInstallments,null);assert.equal(rows[0].paidInstallments,3);
});
test('remaining loan value reconciles installment total, present value and future interest',()=>{
  const r=C.loanPosition({nRest:12,parcela:100,taxaMes:2,liq:400,ativa:false});
  assert.equal(r.remaining,12);assert.equal(r.totalCents,120000);assert.equal(r.principalCents,105753);assert.equal(r.interestCents,14247);
  assert.equal(r.totalCents,r.principalCents+r.interestCents);assert.equal(r.payoffQuoteCents,40000);
  assert.equal(C.loanPosition({nRest:12,parcela:100,taxaMes:2,liq:900}).interestCents,r.interestCents);
});
test('zero rates and paid loans have zero future interest; missing data never becomes a zero balance',()=>{
  const zero=C.loanPosition({nRest:3,parcela:100.01,taxaMes:0});assert.equal(zero.totalCents,30003);assert.equal(zero.principalCents,30003);assert.equal(zero.interestCents,0);
  const paid=C.loanPosition({nRest:10,parcela:50,taxaMes:2,quitada:true});assert.equal(paid.remaining,0);assert.equal(paid.totalCents,0);assert.equal(paid.interestCents,0);
  const noRate=C.loanPosition({nRest:2,parcela:50});assert.equal(noRate.totalCents,10000);assert.equal(noRate.principalCents,null);assert.equal(noRate.interestCents,null);
  for(const loan of [{parcela:50,taxaMes:2},{nRest:12,taxaMes:2},{nRest:-2,parcela:50,taxaMes:2},{nRest:2.5,parcela:50,taxaMes:2},{nRest:1e15,parcela:1e15,taxaMes:2}])assert.equal(C.loanPosition(loan).totalCents,null);
  const tiny=C.loanPosition({nRest:12,parcela:100,taxaMes:0.000000001});assert.equal(tiny.totalCents,tiny.principalCents+tiny.interestCents);assert.ok(Number.isFinite(tiny.principalCents));
});
