/* Pure parsing and reporting functions, shared with regression tests. */
const BankingModel = (() => {
  const C=typeof BankingCategories!=='undefined'?BankingCategories:require('./banking-categories.js');
  const categories = C.names;
  function money(value) {
    let s=String(value??'').trim().replace(/R\$|\s/g,'');
    if (/^\(.*\)$/.test(s)) s='-'+s.slice(1,-1);
    if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
    if(!/^[+-]?\d+(\.\d{1,2})?$/.test(s))throw new Error(`Valor inválido: ${value}`);
    const cents=Math.round(Number(s)*100);
    if(!Number.isSafeInteger(cents)||Math.abs(cents)>999999999999999)throw new Error('Valor fora do limite.');
    return cents/100;
  }
  function date(value) {
    const s=String(value??'').trim(); let result;
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(s))result=s.split('/').reverse().join('-');
    else if(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(s))result=s.slice(0,10);
    else if(/^\d{8}(?:\d{6}.*)?$/.test(s))result=`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    const d=new Date(result+'T12:00:00Z');
    if(!result||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==result)throw new Error(`Data inválida: ${s}`);
    return result;
  }
  const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  function csvRows(text) {
    text=text.replace(/^\uFEFF/,'');
    const first=text.split(/\r?\n/)[0];
    const delimiter=first.includes(';')?';':first.includes('\t')?'\t':',';
    let rows=[],row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
      else if(ch===delimiter&&!quoted){row.push(field);field='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}
      else field+=ch;
    }
    if(quoted)throw new Error('CSV com aspas não fechadas.');
    row.push(field);if(row.some(x=>x.trim()))rows.push(row);
    return rows;
  }
  function parseCSV(text) {
    const rows=csvRows(text);if(rows.length<2)throw new Error('O CSV precisa de cabeçalho e lançamentos.');
    const headers=rows.shift().map(norm);
    const find=names=>headers.findIndex(h=>names.includes(h));
    const d=find(['data','date','data lancamento','data de lancamento']),v=find(['valor','amount','valor (r$)']);
    const desc=find(['descricao','description','historico','titulo','title','lancamento']);
    const id=find(['id','identificador','fitid']);
    if(d<0||v<0||desc<0)throw new Error('Colunas esperadas: data, descrição e valor. Use o modelo CSV ou importe OFX.');
    return rows.map((r,i)=>{
      try{return{booked_on:date(r[d]),description:String(r[desc]||'').trim(),amount:money(r[v]),external_id:id>=0?r[id]?.trim():null};}
      catch(e){throw new Error(`Linha ${i+2}: ${e.message}`);}
    });
  }
  function parseOFX(text) {
    if(!/<(?:CURDEF)>\s*BRL\s*</i.test(text))throw new Error('OFX precisa informar a moeda BRL.');
    const blocks=[...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];
    if(!blocks.length)throw new Error('Nenhum lançamento encontrado no OFX.');
    const value=(s,tag)=>new RegExp(`<${tag}>\\s*([^<\\r\\n]+)`,'i').exec(s)?.[1]?.trim();
    return blocks.map(([,b])=>({booked_on:date(value(b,'DTPOSTED')),amount:money(value(b,'TRNAMT')),
      description:value(b,'MEMO')||value(b,'NAME')||'Lançamento OFX',external_id:value(b,'FITID')||null}));
  }
  async function prepare(rows,accountId,source) {
    if(rows.length>5000)throw new Error('Importe até 5.000 lançamentos por arquivo.');
    const occurrences=new Map();
    return Promise.all(rows.map(async r=>{
      if(!r.description||r.description.length>500||!r.amount)throw new Error('Há descrição vazia, longa demais ou valor zero. Revise o arquivo.');
      const base=JSON.stringify([r.booked_on,r.description,r.amount]);
      const occurrence=(occurrences.get(base)||0)+1;occurrences.set(base,occurrence);
      let key=r.external_id;
      if(!key){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(base));key=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')+':'+occurrence;}
      return{account_id:accountId,external_id:`${source}:${key}`,booked_on:r.booked_on,description:r.description,amount:r.amount,source,category:'Sem categoria',flow:'normal'};
    }));
  }
  function summarize(rows) {
    let income=0,expense=0,excluded=0,uncategorized=0;const byCategory={},days={};
    for(const r of rows){const cents=Math.round(Number(r.amount)*100);
      if(r.flow!=='normal'){excluded+=Math.abs(cents);continue;}
      if(cents>0)income+=cents;else{expense-=cents;byCategory[r.category]=(byCategory[r.category]||0)-cents;days[r.booked_on]=(days[r.booked_on]||0)-cents;if(r.category==='Sem categoria')uncategorized++;}
    }
    return{income:income/100,expense:expense/100,net:(income-expense)/100,excluded:excluded/100,uncategorized,byCategory,days};
  }
  // A CSV export must not become a spreadsheet formula when opened in Excel.
  function csvCell(value){let s=String(value??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function matchesMovement(r,kind){return !kind||(kind==='expense'?r.flow==='normal'&&Number(r.amount)<0:kind==='income'?r.flow==='normal'&&Number(r.amount)>0:r.flow===kind);}
  function report(rows,accounts,scope){
    const {month,today}=scope,selectedAccount=new Map(accounts.map(a=>[a.id,a]));
    const matches=r=>{const a=selectedAccount.get(r.account_id);return a&&(!a.currency||a.currency==='BRL')&&(!scope.person||a.person===scope.person)&&(!scope.accountId||a.id===scope.accountId)&&(!scope.category||r.category===scope.category)&&matchesMovement(r,scope.movement)&&(!scope.search||C.fold(r.description+' '+r.category).includes(C.fold(scope.search)));};
    const base=rows.filter(matches),[year,mon]=month.split('-').map(Number);
    const previousMonth=new Date(Date.UTC(year,mon-2,1)).toISOString().slice(0,7);
    const partial=month===today.slice(0,7),cutoff=partial?Number(today.slice(8,10)):31;
    const current=base.filter(r=>r.booked_on.startsWith(month)),previous=base.filter(r=>r.booked_on.startsWith(previousMonth)&&Number(r.booked_on.slice(8,10))<=cutoff);
    const summary=summarize(current),before=summarize(previous),grouped=new Map();
    for(const r of current.filter(r=>r.flow==='normal'&&Number(r.amount)<0)){const k=r.category;const g=grouped.get(k)||{name:k,cents:0,count:0,previous:before.byCategory[k]||0};g.cents-=Math.round(Number(r.amount)*100);g.count++;grouped.set(k,g);}
    const categories=[...grouped.values()].sort((a,b)=>b.cents-a.cents).map(g=>({...g,share:summary.expense?g.cents/(summary.expense*100)*100:0}));
    const destinations=new Map();
    for(const r of current.filter(r=>r.flow==='normal'&&Number(r.amount)<0)){const name=r.description.replace(/^(?:pagamento efetuado|compra no debito|compra no débito|compra débito|pagamento de pix qr code|transferência enviada pelo pix|transferência enviada|pix enviado)[|\s]+/i,'').trim()||r.description;const key=C.fold(name);const entry=destinations.get(key)||{name,cents:0,count:0};entry.cents-=Math.round(Number(r.amount)*100);entry.count++;destinations.set(key,entry);}
    const history=Array.from({length:6},(_,i)=>{const key=new Date(Date.UTC(year,mon-6+i,1)).toISOString().slice(0,7);return{month:key,...summarize(base.filter(r=>r.booked_on.startsWith(key)))};});
    const expenseRows=current.filter(r=>r.flow==='normal'&&Number(r.amount)<0),uncategorized=expenseRows.filter(r=>r.category==='Sem categoria');
    const days=new Date(Date.UTC(year,mon,0)).getUTCDate(),displayDays=partial?Math.min(cutoff,days):days;
    let accumulated=0;const daily=Array.from({length:displayDays},(_,i)=>{const key=month+'-'+String(i+1).padStart(2,'0');const cents=summary.days[key]||0;accumulated+=cents;return{day:i+1,cents,accumulated};});
    return{current,previous,summary,before,categories,history,daily,partial,cutoff,previousMonth,expenseCount:expenseRows.length,uncategorizedCents:uncategorized.reduce((s,r)=>s-Math.round(Number(r.amount)*100),0),destinations:[...destinations.values()].sort((a,b)=>b.cents-a.cents),largest:expenseRows.slice().sort((a,b)=>Number(a.amount)-Number(b.amount)).slice(0,8)};
  }
  return{categories,money,date,csvRows,parseCSV,parseOFX,prepare,summarize,csvCell,matchesMovement,report};
})();
if(typeof module!=='undefined')module.exports=BankingModel;
