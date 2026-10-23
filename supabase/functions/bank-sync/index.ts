import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { normalizeTransactions } from './transactions.mjs';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid = (v: unknown): v is string => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const ownerEmail = 'erwinklein1994@gmail.com';
const boundedFetch: typeof fetch = (input,init={}) => fetch(input,{...init,signal:AbortSignal.timeout(20000)});

Deno.serve(async req => {
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return json({error:'Método não permitido.'},405);
  try {
    const url=Deno.env.get('SUPABASE_URL')!;
    const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false},global:{fetch:boundedFetch,headers:{Authorization:req.headers.get('Authorization')||''}}});
    const {data:{user},error}=await auth.auth.getUser();
    if(error||!user||!user.email_confirmed_at||user.email?.toLowerCase()!==ownerEmail)return json({error:'Acesso não autorizado.'},401);
    const body=await req.json();
    const clientId=Deno.env.get('PLUGGY_CLIENT_ID');
    // Compatibility with the existing secret saved under the application's UUID.
    // Only a UUID alias is allowed, so this cannot resolve reserved platform keys.
    const clientSecret=Deno.env.get('PLUGGY_CLIENT_SECRET')||(uuid(clientId)?Deno.env.get(clientId):undefined);
    if(body.action==='status')return json({configured:!!clientId&&!!clientSecret});
    if(!clientId||!clientSecret)return json({error:'Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nos secrets do Supabase.'},503);
    if(!['attach','inspect','sync','verify'].includes(body.action))return json({error:'Ação inválida.'},400);
    const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false},global:{fetch:boundedFetch}});
    const checked = (r: {data: any,error: any})=>{if(r.error)throw new Error('Falha ao salvar ou consultar dados no Supabase.');return r.data;};
    const api=async(path:string,apiKey?:string,payload?:unknown)=>{
      const response=await fetch('https://api.pluggy.ai'+path,{method:payload?'POST':'GET',headers:{'Content-Type':'application/json',...(apiKey?{'X-API-KEY':apiKey}:{})},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(25000)});
      if(!response.ok)throw new Error(response.status===429?'Limite do provedor atingido. Tente novamente mais tarde.':'O Meu Pluggy não autorizou a leitura. Confira as credenciais, a conexão e o consentimento no provedor.');
      return response.json();
    };
    let stored:any;
    if(body.action==='sync'){
      if(!uuid(body.accountId))return json({error:'Conta inválida.'},400);
      stored=checked(await db.from('bank_accounts').select('*').eq('id',body.accountId).eq('owner_id',user.id).maybeSingle());
      if(!stored?.provider_id||!stored.item_id)return json({error:'Conta não vinculada para este usuário.'},404);
    } else if(['attach','inspect'].includes(body.action)&&(!uuid(body.itemId)||(body.action==='attach'&&(!['Erwin','Raquel'].includes(body.person)||!['Itaú','Santander','Banco do Brasil','Nubank'].includes(body.bank)))))return json({error:'Informe banco, titular e itemId válidos.'},400);
    const {apiKey}=await api('/auth',undefined,{clientId,clientSecret});
    if(body.action==='verify')return json({valid:!!apiKey});
    const itemId=stored?.item_id||body.itemId;
    const item=await api('/items/'+encodeURIComponent(itemId),apiKey);
    if(item.consentExpiresAt&&new Date(item.consentExpiresAt).getTime()<=Date.now())return json({error:'Consentimento expirado. Autorize novamente no Meu Pluggy e confira o novo itemId.'},409);
    if(item.status==='LOGIN_ERROR'||item.status==='OUTDATED'||item.executionStatus==='ERROR')return json({error:'A conexão precisa de atenção no Meu Pluggy. Confira a autorização bancária.'},409);
    if(['attach','inspect'].includes(body.action)){
      // This private app accepts only the personal-use connector; it never starts paid bank connections.
      if(item.connector?.id!==200)return json({error:'Use o conector MeuPluggy (200) da sua aplicação, conforme o guia de uso pessoal.'},400);
      let results:any[]=[],page=1,totalPages=1;
      do{const r=await api(`/accounts?itemId=${encodeURIComponent(itemId)}&page=${page}&pageSize=500`,apiKey);results.push(...r.results);totalPages=r.totalPages||1;page++;if(page>20)throw new Error('Muitas contas na conexão. Contate o suporte do provedor.');}while(page<=totalPages);
      results=results.filter(a=>a.currencyCode==='BRL');
      if(!results.length)return json({error:'Nenhuma conta em BRL disponível. Confira os consentimentos no Meu Pluggy.'},409);
      if(body.action==='inspect')return json({accounts:results.map(a=>({name:a.name,type:a.type,currency:a.currencyCode}))});
      const existing=checked(await db.from('bank_accounts').select('*').eq('owner_id',user.id));
      for(const a of results){
        const kind=a.type==='CREDIT'?'credit':'checking';
        const linked=existing.find((x:any)=>x.provider_id===a.id);
        if(linked&&linked.person!==body.person)return json({error:'Esta conta já está vinculada a outro titular. Confira a seleção.'},409);
        const manual=existing.filter((x:any)=>!x.provider_id&&x.bank===body.bank&&x.person===body.person&&x.kind===kind);
        const current=linked||(manual.length===1?manual[0]:null);
        const patch={bank:body.bank,name:String(a.name||body.bank).slice(0,100),person:body.person,kind,provider_id:a.id,item_id:itemId,balance:a.balance,balance_at:new Date().toISOString()};
        if(current){checked(await db.from('bank_accounts').update(patch).eq('id',current.id).eq('owner_id',user.id));Object.assign(current,patch);}
        else{const added=checked(await db.from('bank_accounts').insert({...patch,owner_id:user.id}).select('*').single());existing.push(added);}
      }
      return json({accounts:results.length});
    }
    // Force account scope even if a client tampers with a continuation cursor.
    if(body.cursor&&(typeof body.cursor!=='string'||!body.cursor.startsWith('?')||body.cursor.length>12000))return json({error:'Cursor inválido.'},400);
    const params=new URLSearchParams(body.cursor?body.cursor.slice(1):'');
    for(const key of [...params.keys()])if(!['accountId','after'].includes(key))params.delete(key);
    params.set('accountId',stored.provider_id);
    const batch=await api('/v2/transactions?'+params.toString(),apiKey);
    if(batch.results.length>500)throw new Error('O provedor retornou uma página maior que o limite esperado.');
    const rows=normalizeTransactions(batch.results,stored.provider_id,stored.kind);
    const count=rows.length?checked(await db.rpc('ingest_bank_transactions',{p_account:stored.id,p_rows:rows})):0;
    if(!batch.next){const a=await api('/accounts/'+encodeURIComponent(stored.provider_id),apiKey);checked(await db.from('bank_accounts').update({balance:a.balance,balance_at:new Date().toISOString()}).eq('id',stored.id).eq('owner_id',user.id));}
    return json({count,next:batch.next||null});
  }catch(error){return json({error:error instanceof Error?error.message:'Falha na integração bancária.'},500);}
});
