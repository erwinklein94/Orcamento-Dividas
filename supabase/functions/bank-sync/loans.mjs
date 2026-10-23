// Keep only fields used by the private loan view. Missing monetary data stays null.
export function normalizeLoans(rows,itemId){
  const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
  const text=v=>typeof v==='string'?v.slice(0,250):null;
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):null;
  return rows.filter(r=>r.itemId===itemId&&r.currencyCode==='BRL'&&typeof r.id==='string').map(r=>({id:r.id,contractNumber:text(r.contractNumber),productName:text(r.productName)||'Operação de crédito',kind:text(r.kind),contractAmount:number(r.contractAmount),outstandingBalance:number(r.payments?.contractOutstandingBalance),contractDate:date(r.contractDate),dueDate:date(r.dueDate),settlementDate:date(r.settlementDate),paidInstallments:number(r.installments?.paidInstallments),dueInstallments:number(r.installments?.dueInstallments),pastDueInstallments:number(r.installments?.pastDueInstallments),collectedAt:date(r.date)}));
}
