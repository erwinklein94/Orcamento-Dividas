/* Calendar and credit reporting. All sums use integer cents, dates use UTC. */
const BankingCredit = (() => {
  const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const cents=n=>Math.round(Number(n)*100);
  const loanDescription=s=>/emprestimo|consignado|financiamento|credito pessoal|renegociacao de pendencias|encerramento de divida/.test(fold(s));
  const billPayment=s=>/^pagamento recebido$|pagamento\s+(?:(?:da|de)\s+)?fatura|pag(?:to|amento)\s+(?:de\s+|do\s+)?cartao/.test(fold(s));
  function weekly(rows,accounts,{month,person='',accountId=''}){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Selecione um mês válido.');
    const cards=accounts.filter(a=>a.kind==='credit'&&(!a.currency||a.currency==='BRL')&&(!person||a.person===person)&&(!accountId||a.id===accountId));
    const ids=new Set(cards.map(a=>a.id)),[y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();
    const weeks=[];let day=1;
    while(day<=last){const start=`${month}-${String(day).padStart(2,'0')}`,dow=new Date(start+'T12:00:00Z').getUTCDay(),endDay=Math.min(last,day+(7-dow)%7),end=`${month}-${String(endDay).padStart(2,'0')}`;weeks.push({start,end,partial:day===1&&dow!==1||endDay===last&&new Date(end+'T12:00:00Z').getUTCDay()!==0,byCard:Object.fromEntries(cards.map(a=>[a.id,0])),cents:0,credits:0,count:0,rows:[]});day=endDay+1;}
    const selected=rows.filter(r=>ids.has(r.account_id)&&r.flow==='normal'&&!billPayment(r.description)&&r.booked_on.startsWith(month));
    for(const r of selected){const w=weeks.find(w=>r.booked_on>=w.start&&r.booked_on<=w.end);if(!w)continue;const amount=cents(r.amount);if(amount<0){w.byCard[r.account_id]-=amount;w.cents-=amount;w.count++;w.rows.push(r);}else w.credits+=amount;}
    const coverage=cards.map(a=>{const out=rows.filter(r=>r.account_id===a.id&&r.flow==='normal'&&Number(r.amount)<0).map(r=>r.booked_on).sort();return{...a,first:out[0]||null,last:out.at(-1)||null,total:weeks.reduce((s,w)=>s+w.byCard[a.id],0)};});
    return{cards,coverage,weeks,cents:weeks.reduce((s,w)=>s+w.cents,0),credits:weeks.reduce((s,w)=>s+w.credits,0),count:weeks.reduce((s,w)=>s+w.count,0)};
  }
  function budgetLoans(payload,scenarioId){
    const scenarios=Array.isArray(payload?.scenarios)?payload.scenarios:[],scenario=scenarios.find(s=>s.id===(scenarioId||payload?.activeId))||scenarios[0];
    return{scenarios,scenario,reference:payload?.reference,loans:(scenario?.budget?.dividas||[]).map(d=>({...d,status:d.quitada?'quitado':d.ativa?'ativo':'fora_plano'}))};
  }
  function loanPayments(rows,accounts,{month,person='',bank=''}={}){
    const byId=new Map(accounts.map(a=>[a.id,a])),groups=new Map();
    for(const r of rows){const a=byId.get(r.account_id);if(!a||r.flow!=='normal'||Number(r.amount)>=0||!loanDescription(r.description)||person&&a.person!==person||bank&&a.bank!==bank)continue;
      const name=r.description.replace(/^(?:pagamento efetuado|compra no debito|compra no débito)[|\s]+/i,'').trim(),key=[a.bank,a.person,fold(name)].join('|');
      const g=groups.get(key)||{key,name,bank:a.bank,person:a.person,rows:[],cents:0,monthCents:0};g.rows.push(r);g.cents-=cents(r.amount);if(r.booked_on.startsWith(month||''))g.monthCents-=cents(r.amount);groups.set(key,g);
    }
    return [...groups.values()].map(g=>({...g,rows:g.rows.sort((a,b)=>b.booked_on.localeCompare(a.booked_on)),last:g.rows.map(r=>r.booked_on).sort().at(-1)})).sort((a,b)=>b.monthCents-a.monthCents||b.last.localeCompare(a.last));
  }
  function paymentsForContract(loan,payments){
    const contract=String(loan.contrato||'').replace(/\D/g,'').replace(/^0+/,'');
    if(contract.length<4)return [];
    const match=new RegExp('(?:^|\\D)0*'+contract+'(?!\\d)');
    return payments.filter(p=>p.bank===loan.credor&&p.person===loan.titular&&match.test(p.name));
  }
  // Fixed monthly installments: present value of the remaining annuity.
  // Never use an old payoff quote as principal at a different reference date.
  function loanPosition(loan){
    const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
    const remaining=loan.quitada?0:valid(loan.nRest)&&Number.isSafeInteger(loan.nRest)?loan.nRest:null;
    const installmentCents=valid(loan.parcela)&&Number.isSafeInteger(cents(loan.parcela))?cents(loan.parcela):null;
    const product=remaining!==null&&installmentCents!==null?remaining*installmentCents:null;
    const totalCents=Number.isSafeInteger(product)?product:null;
    const rate=valid(loan.taxaMes)?loan.taxaMes/100:null;
    let principalCents=null;
    if(totalCents===0)principalCents=0;
    else if(totalCents!==null&&rate!==null){
      const value=rate===0?totalCents:installmentCents*(-Math.expm1(-remaining*Math.log1p(rate)))/rate;
      principalCents=Math.min(totalCents,Math.max(0,Math.round(value)));
    }
    return{remaining,installmentCents,totalCents,principalCents,interestCents:principalCents===null?null:totalCents-principalCents,ratePercent:rate===null?null:loan.taxaMes,payoffQuoteCents:valid(loan.liq)?cents(loan.liq):null};
  }
  return{weekly,budgetLoans,loanPayments,loanDescription,paymentsForContract,loanPosition};
})();
if(typeof module!=='undefined')module.exports=BankingCredit;
