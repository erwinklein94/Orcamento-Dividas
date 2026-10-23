const {test}=require('node:test');
const assert=require('node:assert/strict');
const rules=import('../supabase/functions/bank-sync/transactions.mjs');
test('provider imports posted BRL from the requested account with correct signs',async()=>{
  const {normalizeTransactions}=await rules;
  const base={id:'one',accountId:'account',currencyCode:'BRL',status:'POSTED',amount:20,type:'DEBIT',date:'2026-10-23T00:00:00Z',description:'Compra'};
  const rows=normalizeTransactions([base,{...base,id:'two',amount:-50,type:'CREDIT'}, {...base,status:'PENDING'}, {...base,currencyCode:'USD'}, {...base,accountId:'other'}, {...base,amount:0}], 'account');
  assert.equal(rows.length,2);assert.equal(rows[0].amount,-20);assert.equal(rows[1].amount,50);assert.equal(rows[0].booked_on,'2026-10-23');
  assert.equal(normalizeTransactions([{...base,description:'Pagamento recebido',type:'CREDIT'}],'account','credit')[0].flow,'transfer');
  assert.equal(normalizeTransactions([{...base,providerCode:'PAGAMENTO_FATURA'}],'account')[0].flow,'transfer');
});
test('initial categories are conservative and generic Pix stays a normal flow',async()=>{
  const {classification}=await rules;
  assert.deepEqual(classification('Pagamento de fatura',-200),{category:'Dívidas',flow:'transfer'});
  assert.equal(classification('PIX TRANSFERENCIA',-200).flow,'normal');
  assert.equal(classification('DROGARIA EXEMPLO',-20).category,'Saúde');
  assert.equal(classification('Supermercado exemplo',-80).category,'Supermercado');
  assert.equal(classification('Crédito salário',2000).category,'Salário');
  assert.equal(classification('Recebimento desconhecido',50).category,'Sem categoria');
});
