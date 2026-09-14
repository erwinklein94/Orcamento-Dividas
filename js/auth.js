(() => {
  const errorEl=document.getElementById('loginError');
  if(!window.supabase){errorEl.textContent='Não foi possível carregar a conexão. Recarregue a página.';return;}
  const client=window.supabase.createClient(FINANCE_CONFIG.url,FINANCE_CONFIG.publishableKey);
  const button=document.getElementById('loginSubmit');
  const signup=document.getElementById('signupButton');
  let loading=false, currentUser, authEpoch=0;
  // Área da vida que pediu login; só páginas conhecidas, nunca URLs externas.
  const next=['saude.html','habitos.html','lazer.html','pets.html','carreira.html'].find(p=>p===new URLSearchParams(location.search).get('next'));
  loginEmail.value=FINANCE_CONFIG.email;
  function fail(text){errorEl.textContent=text;}
  async function open(user){
    if(!user || currentUser===user.id)return;
    const request=++authEpoch;
    try {
      if(user.email?.toLowerCase()!==FINANCE_CONFIG.email)throw new Error('Use sua conta pessoal autorizada para este painel.');
      if(next){location.replace(next);return;}
      if(await FinanceUI.start(client,user) && request===authEpoch){currentUser=user.id;loginScreen.hidden=true;appWrap.hidden=false;fail('');}
    }catch(error){if(request===authEpoch){loginScreen.hidden=false;appWrap.hidden=true;fail(error.message);}}
  }
  loginForm.addEventListener('submit',async event=> {
    event.preventDefault();if(loading)return;loading=true;button.disabled=true;signup.disabled=true;
    fail('Entrando…');
    try {
      const {data,error}=await client.auth.signInWithPassword({email:loginEmail.value.trim(),password:loginSenha.value});
      if(error)throw new Error('Não foi possível entrar. Confira a senha e a confirmação do e-mail. No primeiro acesso, crie sua conta abaixo.');
      loginSenha.value='';await open(data.user);
    }catch(error){fail(error.message);}finally{loading=false;button.disabled=false;signup.disabled=false;}
  });
  signup.addEventListener('click',async()=> {
    if(loading)return;
    if(loginEmail.value.trim().toLowerCase()!==FINANCE_CONFIG.email){fail('Cadastre a conta pessoal autorizada indicada no campo de e-mail.');return;}
    if(loginSenha.value.length<10){fail('Escolha uma senha com pelo menos 10 caracteres para criar seu acesso.');return;}
    loading=true;button.disabled=true;signup.disabled=true;fail('Criando acesso…');
    try {
      const {data,error}=await client.auth.signUp({email:FINANCE_CONFIG.email,password:loginSenha.value});
      if(error)throw new Error('Não foi possível cadastrar. Tente novamente mais tarde; se já tem conta, use Entrar.');
      loginSenha.value='';
      if(data.session)await open(data.user);
      else fail('Confira seu e-mail para confirmar a conta. Depois, volte a este site e entre com sua senha.');
    }catch(error){fail(error.message);}finally{loading=false;button.disabled=false;signup.disabled=false;}
  });
  document.getElementById('logoutButton').addEventListener('click',async()=> {
    if(!await FinanceUI.flush())return;
    const {error}=await client.auth.signOut({scope:'local'});
    if(error){document.getElementById('scenarioStatus').textContent='Não foi possível sair. Tente novamente.';return;}
    authEpoch++;currentUser=undefined;FinanceUI.stop();appWrap.hidden=true;loginScreen.hidden=false;
  });
  // Defer API calls until the auth callback releases the library's lock.
  client.auth.onAuthStateChange((event,session)=> {
    if(event==='SIGNED_OUT'){authEpoch++;currentUser=undefined;FinanceUI.stop();appWrap.hidden=true;loginScreen.hidden=false;}
    if(!loading && session?.user && event!=='TOKEN_REFRESHED')setTimeout(()=>open(session.user),0);
  });
})();
