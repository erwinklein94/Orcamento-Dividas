/* Shared, deterministic rules. Existing manual classifications take precedence. */
globalThis.BankingCategories = (() => {
  const names=['Sem categoria','Supermercado','Restaurantes e delivery','Alimentação','Moradia','Contas da casa','Internet e telefone','Combustível','Transporte','Saúde','Educação','Lazer','Pets','Compras','Assinaturas','Serviços','Impostos','Salário','Investimentos','Dívidas','Doações','Transferências'];
  const palette=['#5263df','#e79453','#268c83','#a16cbb','#d1a144','#5e91c9','#b95e70','#789452','#7869ac','#4f9da8','#ae834f','#df8872'];
  const color=name=>name==='Sem categoria'?'#9ba7ba':palette[Math.max(0,names.indexOf(name)-1)%palette.length];
  const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function classify(description,amount){
    const text=fold(description);
    if(/^(?:pix (?:enviado|recebido)|transferencia (?:enviada|recebida)(?: pelo pix)?)[|\s]+(?:erwin klein|raquel martins rodrigues(?: klein)?)(?:\s*[-|].*)?$/.test(text))return{category:'Transferências',flow:'transfer',reason:'Transferência identificada entre Erwin e Raquel'};
    if(/pagamento\s+(?:(?:da|de|do)\s+)?fatura|pag(?:to|amento)\s+(?:de\s+|do\s+)?cartao|credit card (?:bill )?payment/.test(text))return{category:'Dívidas',flow:'transfer',reason:'Pagamento de fatura; as compras aparecem separadamente'};
    if(/^(?:aplicacao|resgate) (?:rdb|cdb|em investimento)/.test(text))return{category:'Investimentos',flow:'transfer',reason:'Movimentação entre conta e investimento'};
    if(amount>0&&/valor adicionado na conta por cartao de credito|credito de emprestimo|emprestimo recebido/.test(text))return{category:'Dívidas',flow:'transfer',reason:'Crédito financiado; não é renda nova'};
    const rules=[
      ['Salário',/salario|folha de pagamento/],
      ['Dívidas',/emprestimo|consignado|renegociacao de pendencias|encerramento de divida|saldo em atraso|financiamento/],
      ['Supermercado',/supermercado|\bmercado\b(?! (?:pago|livre|bitcoin))|atacadao|savegnago|assai|hortifruti|acougue/],
      ['Restaurantes e delivery',/restaurante|ifood|lanchonete|pizzaria|hamburguer|padaria|nutri mais kids/],
      ['Combustível',/\bposto|combustivel|gasolina|etanol/],
      ['Transporte',/\buber\b|\b99app\b|estacionamento|pedagio|sem parar/],
      ['Saúde',/farmacia|drogaria|drogasil|droga raia|drogaven|\bdrogal\b|hospital|laboratorio|clinica/],
      ['Moradia',/aluguel|condominio|nova imoveis|imobiliaria/],
      ['Contas da casa',/energia eletrica|conta de luz|sabesp|copasa|companhia paulista de forca e luz|\bcpfl\b|\bdaae\b/],
      ['Internet e telefone',/telefonica brasil|\bvivo\b|\bclaro (?:s[ .]*a|movel|residencial|net)\b|\btim s a\b|(?:mensalidade|fatura|banda larga|provedor) (?:de )?internet/],
      ['Educação',/instituto educac|mensalidade escolar|faculdade|universidade|udemy|alura|livros didaticos/],
      ['Pets',/petshop|pet shop|pet center comercio|petz|cobasi|veterinari/],
      ['Assinaturas',/netflix|spotify|amazon prime|assinatura/],
      ['Serviços',/tarifa bancaria|facebook servicos online|google ads/],
      ['Impostos',/\biptu\b|\bipva\b|receita federal|\bdarf\b/],
      ['Investimentos',/remuneracao aplicacao|rendimentos rend pago aplic|rendimento de|juros de aplicacao/]
    ];
    const category=rules.find(([name,re])=>re.test(text)&&(name!=='Salário'||amount>0))?.[0]||'Sem categoria';
    return{category,flow:'normal',reason:category==='Sem categoria'?'Descrição insuficiente para classificar com segurança':'Categoria sugerida pela descrição do lançamento'};
  }
  function suggestion(row){
    const result=classify(row.description,Number(row.amount));
    if(row.flow!=='normal'||result.category==='Sem categoria')return null;
    if(row.category==='Sem categoria')return result;
    // Keep a filled category; only explicit internal/financing movements need a flow correction.
    return result.flow==='transfer'?{...result,category:row.category}:null;
  }
  return{names,color,fold,classify,suggestion};
})();
if(typeof module!=='undefined')module.exports=globalThis.BankingCategories;
