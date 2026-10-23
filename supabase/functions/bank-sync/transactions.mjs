// Initial suggestions for newly imported records; resync never replaces user edits.
const folded = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function classification(description, amount) {
  const text = folded(description);
  if (/pagamento\s+(?:(?:da|de|do)\s+)?fatura|pag(?:to|amento)\s+(?:de\s+|do\s+)?cartao|credit card (?:bill )?payment/.test(text))
    return {category:'Dívidas',flow:'transfer'};
  const rules = [
    ['Salário', /salario|folha de pagamento/],
    ['Alimentação', /supermercado|mercado\b|padaria|restaurante|ifood|acougue|hortifruti/],
    ['Transporte', /\buber\b|\b99app\b|posto\b|combustivel|estacionamento|pedagio/],
    ['Saúde', /farmacia|drogaria|drogasil|droga raia|hospital|laboratorio|clinica/],
    ['Moradia', /aluguel|condominio|energia eletrica|conta de luz|sabesp|copasa/],
    ['Educação', /mensalidade escolar|faculdade|universidade|udemy|alura/],
    ['Pets', /petshop|pet shop|petz|cobasi|veterinari/],
    ['Serviços', /netflix|spotify|amazon prime|assinatura|tarifa bancaria/],
    ['Impostos', /\biptu\b|\bipva\b|receita federal|\bdarf\b/]
  ];
  return {category:rules.find(([category,rule])=>rule.test(text) && (category!=='Salário'||amount>0))?.[0]||'Sem categoria',flow:'normal'};
}

export function normalizeTransactions(results, accountId, accountKind='checking') {
  return results.filter(t=>t.accountId===accountId && t.currencyCode==='BRL' && t.status==='POSTED' && Number.isFinite(t.amount) && t.amount!==0).map(t=>{
    const amount=t.type==='DEBIT'?-Math.abs(t.amount):t.type==='CREDIT'?Math.abs(t.amount):t.amount;
    const description=String(t.description||'Lançamento bancário').slice(0,500);
    const suggested=t.providerCode==='PAGAMENTO_FATURA'||(accountKind==='credit'&&/^pagamento recebido$/i.test(description))?{category:'Dívidas',flow:'transfer'}:classification(description,amount);
    return {external_id:'pluggy:'+(t.providerId||t.id),booked_on:t.date.slice(0,10),description,amount,...suggested};
  });
}
