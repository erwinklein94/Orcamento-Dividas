/* Accessible SVG charts and summaries, driven by the same filtered report as the table. */
const BankingInsights = (() => {
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const pct=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
  const color=BankingCategories.color;
  const shortMonth=m=>new Date(m+'-02T12:00:00').toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
  const empty=text=>`<p class="bank-empty">${text}</p>`;
  function donut(r){
    if(!r.categories.length)return empty('Nenhum gasto confirmado neste filtro.');
    let offset=0;const circumference=2*Math.PI*72;
    const arcs=r.categories.map(c=>{const length=c.share/100*circumference;const html=`<circle cx="100" cy="100" r="72" fill="none" stroke="${color(c.name)}" stroke-width="25" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"><title>${esc(c.name)}: ${money(c.cents/100)} (${pct(c.share)})</title></circle>`;offset+=length;return html;}).join('');
    return `<div class="category-distribution"><div class="donut-wrap"><svg viewBox="0 0 200 200" role="img" aria-label="Distribuição das despesas por categoria">${arcs}<text x="100" y="94" text-anchor="middle" class="donut-label">GASTOS</text><text x="100" y="116" text-anchor="middle" class="donut-value">${esc(money(r.summary.expense))}</text></svg></div><div class="category-legend">${r.categories.map(c=>`<button type="button" data-analytics-category="${esc(c.name)}"><i style="background:${color(c.name)}"></i><span>${esc(c.name)}<small>${money(c.cents/100)}</small></span><b>${pct(c.share)}</b></button>`).join('')}</div></div>`;
  }
  function history(r){
    const max=Math.max(1,...r.history.flatMap(x=>[x.income,x.expense]));
    const grid=[0,.5,1].map(v=>`<line x1="10" y1="${166-v*130}" x2="490" y2="${166-v*130}" stroke="#dce3ef" stroke-dasharray="3 5"/>`).join('');
    return `<div class="chart-legend"><span><i style="background:#2a8b7a"></i>Entradas</span><span><i style="background:#6172e7"></i>Saídas</span></div><svg viewBox="0 0 500 210" class="history-svg" role="img" aria-label="Entradas e saídas confirmadas nos últimos seis meses">${grid}${r.history.map((h,i)=>{const x=24+i*78;return `<rect x="${x}" y="${166-h.income/max*130}" width="22" height="${h.income/max*130}" rx="5" fill="#2a8b7a"><title>${h.month}: entradas ${money(h.income)}</title></rect><rect x="${x+25}" y="${166-h.expense/max*130}" width="22" height="${h.expense/max*130}" rx="5" fill="#6172e7"><title>${h.month}: saídas ${money(h.expense)}</title></rect><text x="${x+23}" y="192" text-anchor="middle" fill="#64748b" font-size="12">${shortMonth(h.month)}${h.month===r.history.at(-1).month&&r.partial?'*':''}</text>`;}).join('')}</svg><div class="history-values">${r.history.map(h=>`<span><b>${shortMonth(h.month)}</b>${money(h.expense)}</span>`).join('')}</div>`;
  }
  function cumulative(r){
    if(!r.summary.expense)return empty('A evolução aparece quando há gastos no mês.');
    const max=Math.max(1,...r.daily.map(x=>x.accumulated)),points=r.daily.map((d,i)=>[24+i*450/Math.max(1,r.daily.length-1),165-d.accumulated/max*135,d]);
    const path=points.map(([x,y],i)=>`${i?'L':'M'} ${x} ${y}`).join(' ');
    return `<svg viewBox="0 0 500 215" class="history-svg" role="img" aria-label="Gastos acumulados no mês: ${esc(money(r.summary.expense))}"><path d="${path} L ${points.at(-1)[0]} 165 L 24 165 Z" fill="#6475e71a"/><path d="${path}" fill="none" stroke="#6172e7" stroke-width="3" stroke-linejoin="round"/>${points.map(([x,y,d])=>`<circle cx="${x}" cy="${y}" r="4" fill="#6172e7"><title>Dia ${d.day}: ${money(d.cents/100)} · acumulado ${money(d.accumulated/100)}</title></circle>`).join('')}<text x="24" y="195" font-size="12" fill="#64748b">Dia 1</text><text x="474" y="195" text-anchor="end" font-size="12" fill="#64748b">Dia ${r.daily.length}</text><text x="474" y="20" text-anchor="end" font-size="13" fill="#394ea6">${money(r.summary.expense)}</text></svg>`;
  }
  function details(r){
    if(!r.categories.length)return empty('Não há categorias com gastos neste filtro.');
    return `<div class="bank-table-wrap"><table class="bank-table category-table"><thead><tr><th>Categoria</th><th>Valor</th><th>Participação</th><th>Lançamentos</th><th>vs. mês anterior</th></tr></thead><tbody>${r.categories.map(c=>{const delta=c.cents-c.previous;return `<tr><td><button type="button" data-analytics-category="${esc(c.name)}"><i style="background:${color(c.name)}"></i>${esc(c.name)}</button></td><td><b>${money(c.cents/100)}</b></td><td><div class="category-share"><div><i style="width:${c.share}%;background:${color(c.name)}"></i></div>${pct(c.share)}</div></td><td>${c.count}</td><td>${c.previous?`<span class="${delta>0?'negative':'positive'}">${delta>0?'+':''}${pct(delta/c.previous*100)}</span><small class="cell-help">Antes: ${money(c.previous/100)}</small>`:'Sem base de comparação'}</td></tr>`;}).join('')}</tbody></table></div>`;
  }
  function destinations(r){const items=r.destinations.slice(0,8),max=Math.max(1,...items.map(x=>x.cents));return items.length?`<div class="destination-list">${items.map((d,i)=>`<button type="button" data-destination="${esc(d.name)}" title="${esc(d.name)}"><span class="destination-index">${i+1}</span><span class="destination-name">${esc(d.name)}<small>${d.count} lançamento(s)</small><i style="width:${d.cents/max*100}%"></i></span><b>${money(d.cents/100)}</b></button>`).join('')}</div>`:empty('Nenhum destino neste mês.');}
  function largest(r,accounts){const byId=new Map(accounts.map(a=>[a.id,a]));return r.largest.length?`<div class="largest-list">${r.largest.map(t=>`<button type="button" data-destination="${esc(t.description)}"><span>${esc(t.description)}<small>${esc(t.booked_on.split('-').reverse().join('/'))} · ${esc(byId.get(t.account_id)?.person)} · ${esc(t.category)}</small></span><b>${money(-Number(t.amount))}</b></button>`).join('')}</div>`:empty('Sem saídas neste filtro.');}
  return{donut,history,cumulative,details,destinations,largest};
})();
