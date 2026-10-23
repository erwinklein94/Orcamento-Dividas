// Local-only visual QA with synthetic data; never talks to Supabase.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const F=require('../js/finance-store.js');
const root=path.resolve(__dirname,'..');
const budget={renda:[{pessoa:'Erwin',tipo:'Salário',valor:4000,tributavel:true,dependentes:0,outrosDescontos:0}],custos:[{grupo:'Casa',nome:'Despesa exemplo',valor:500}],
  plano:{amortMensal:100,bonus:[]},dividas:[],strat:'juros',owner:'todos',simValue:100,tab:'orc'};
const payload={version:2,reference:{ano:2026,mes:8},defaults:budget,activeId:'one',scenarios:['one','two','three'].map((id,i)=>({id,name:`Cenário ${i+1}`,budget:F.clone(budget)}))};
const bootstrap=`let qaRow={id:'qa',revision:1,payload:${JSON.stringify(payload)}};
const qaClient={from(){let patch,expected;return{select(){return this;},update(v){patch=v;return this;},eq(k,v){if(k==='revision')expected=v;return this;},async maybeSingle(){
if(patch){if(expected!==qaRow.revision)return{data:null};qaRow.payload=patch.payload;qaRow.revision++;return{data:{revision:qaRow.revision}};}return{data:qaRow};}}}};
FinanceUI.start(qaClient,{id:'visual-qa'}).then(()=>{loginScreen.hidden=true;appWrap.hidden=false;});`;
const bankBootstrap=`(() => {
  const day=new Date(),month=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0');
  const accounts=[['Nubank','Raquel'],['Banco do Brasil','Raquel'],['Itaú','Erwin'],['Santander','Erwin'],['Banco do Brasil','Erwin']].map(([bank,person],i)=>({id:'qa-'+i,bank,person,name:'Conta exemplo',kind:'checking',balance:null}));
  const transactions=[['Salário exemplo',7000,'Salário',2],['Supermercado exemplo',-450,'Alimentação',0],['Farmácia exemplo',-130,'Saúde',1],['Restaurante exemplo',-125,'Lazer',2],['Pix entre contas',-800,'Sem categoria',3,'transfer'],['Compra exemplo',-80,'Sem categoria',4]].map(([description,amount,category,a,flow],i)=>({id:'tx-'+i,account_id:'qa-'+a,external_id:'qa:'+i,booked_on:month+'-'+String(i+1).padStart(2,'0'),description,amount,category,flow:flow||'normal',source:'csv'}));
  const client={auth:{getUser:async()=>({data:{user:{id:'qa',email:FINANCE_CONFIG.email}}}),onAuthStateChange(){},signOut:async()=>({data:{}})},functions:{invoke:async()=>({data:{configured:false}})},from(name){let filters=[],operation='read',patch,range=[0,999];const rows=name==='bank_accounts'?accounts:transactions;
    const q={select(){return q;},order(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},gte(k,v){filters.push(r=>r[k]>=v);return q;},lte(k,v){filters.push(r=>r[k]<=v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},range(a,b){range=[a,b];return q;},insert(v){operation='insert';patch=v;return q;},update(v){operation='update';patch=v;return q;},single(){return q.then(r=>({...r,data:r.data[0]}));},then(resolve,reject){return Promise.resolve().then(()=>{if(operation==='insert'){for(const row of Array.isArray(patch)?patch:[patch])rows.push({id:'qa-'+crypto.randomUUID(),balance:null,flow:'normal',...row});return {data:[]};}let found=rows.filter(r=>filters.every(f=>f(r)));if(operation==='update')found.forEach(r=>Object.assign(r,patch));return {data:JSON.parse(JSON.stringify(found.slice(range[0],range[1]+1)))};}).then(resolve,reject);}};return q;}};
  window.supabase={createClient:()=>client};
})();`;
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__qa-init.js'){res.setHeader('Content-Type','application/javascript');return res.end(bootstrap);}
  if(url.pathname==='/__bank-init.js'){res.setHeader('Content-Type','application/javascript');return res.end(bankBootstrap);}
  const isQA=url.pathname==='/__qa';
  const isBankQA=url.pathname==='/__bank-qa';
  const file=path.resolve(root,'.'+(isBankQA?'/bancos.html':isQA||url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)||/[/\\](supabase|\.git|node_modules)[/\\]/.test(file)||file.endsWith('.private.json')){res.writeHead(404);return res.end();}
  try{let content=fs.readFileSync(file);if(isQA)content=content.toString().replace('<script src="js/auth.js"></script>','<script src="/__qa-init.js"></script>');
    if(isBankQA)content=content.toString().replace('<script src="js/banking.js"></script>','<script src="/__bank-init.js"></script><script src="js/banking.js"></script>');
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':'text/plain');res.end(content);
  }catch{res.writeHead(404);res.end();}
}).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173/ ; synthetic QA: /__qa'));
