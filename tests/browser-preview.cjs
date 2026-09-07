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
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__qa-init.js'){res.setHeader('Content-Type','application/javascript');return res.end(bootstrap);}
  const isQA=url.pathname==='/__qa';
  const file=path.resolve(root,'.'+(isQA||url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+path.sep)||/[/\\](supabase|\.git|node_modules)[/\\]/.test(file)||file.endsWith('.private.json')){res.writeHead(404);return res.end();}
  try{let content=fs.readFileSync(file);if(isQA)content=content.toString().replace('<script src="js/auth.js"></script>','<script src="/__qa-init.js"></script>');
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':'text/plain');res.end(content);
  }catch{res.writeHead(404);res.end();}
}).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173/ ; synthetic QA: /__qa'));
