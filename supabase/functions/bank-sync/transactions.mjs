// Shared rules are also used by the dashboard's classification review.
import '../../../js/banking-categories.js';
export function classification(description, amount) {
  const {category,flow}=globalThis.BankingCategories.classify(description,amount);
  return {category,flow};
}

export function normalizeTransactions(results, accountId, accountKind='checking') {
  return results.filter(t=>t.accountId===accountId && t.currencyCode==='BRL' && t.status==='POSTED' && Number.isFinite(t.amount) && t.amount!==0).map(t=>{
    const amount=t.type==='DEBIT'?-Math.abs(t.amount):t.type==='CREDIT'?Math.abs(t.amount):t.amount;
    const description=String(t.description||'Lançamento bancário').slice(0,500);
    const suggested=t.providerCode==='PAGAMENTO_FATURA'||(accountKind==='credit'&&/^pagamento recebido$/i.test(description))?{category:'Dívidas',flow:'transfer'}:classification(description,amount);
    return {external_id:'pluggy:'+(t.providerId||t.id),booked_on:t.date.slice(0,10),description,amount,...suggested};
  });
}
