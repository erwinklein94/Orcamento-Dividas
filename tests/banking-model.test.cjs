const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../js/banking-model.js');

test('Brazilian amounts, signs and real calendar dates are preserved',()=>{
  assert.equal(M.money('R$ -1.234,56'),-1234.56);
  assert.equal(M.money('(85,90)'),-85.9);
  assert.equal(M.money('12.34'),12.34);
  assert.equal(M.date('29/02/2024'),'2024-02-29');
  assert.equal(M.date('20261023120000[-3:BRT]'),'2026-10-23');
  for(const x of ['31/02/2026','2026-13-01','20260230','bad'])assert.throws(()=>M.date(x));
  for(const x of ['','1,2,3','1e3','12.345'])assert.throws(()=>M.money(x));
});
test('CSV handles Brazilian decimals, BOM, quoted separators and multiline descriptions',()=>{
  const rows=M.parseCSV('\uFEFFdata;descrição;valor;id\r\n23/10/2026;"Mercado; bairro";-123,45;abc\r\n24/10/2026;"Linha 1\nLinha ""2""";50,00;def');
  assert.equal(rows[0].amount,-123.45);assert.equal(rows[0].description,'Mercado; bairro');
  assert.equal(rows[1].description,'Linha 1\nLinha "2"');
  assert.equal(M.parseCSV('date,title,amount\n2026-10-23,Teste,-10.50')[0].amount,-10.5);
  assert.throws(()=>M.parseCSV('data;valor\n23/10/2026;-5'));
  assert.throws(()=>M.csvRows('data;descricao;valor\n"unclosed'));
});
test('OFX SGML and XML preserve FITID, expenses and credits; other currencies fail',()=>{
  const ofx='<OFX><CURDEF>BRL<STMTTRN><DTPOSTED>20261023120000<TRNAMT>-50.25<FITID>unique-1<MEMO>Mercado</STMTTRN><STMTTRN><DTPOSTED>20261024</DTPOSTED><TRNAMT>200.00</TRNAMT><FITID>unique-2</FITID><NAME>Pix</NAME></STMTTRN></OFX>';
  const rows=M.parseOFX(ofx);assert.equal(rows.length,2);assert.equal(rows[0].amount,-50.25);assert.equal(rows[0].external_id,'unique-1');assert.equal(rows[1].description,'Pix');
  assert.throws(()=>M.parseOFX(ofx.replace('BRL','USD')));
});
test('repeat imports are stable and identical purchases in a file stay distinct',async()=>{
  const row={booked_on:'2026-10-23',description:'Café',amount:-10};
  const a=await M.prepare([row,row],'account','csv'),b=await M.prepare([row,row],'account','csv');
  assert.deepEqual(a,b);assert.notEqual(a[0].external_id,a[1].external_id);
  assert.equal((await M.prepare([{...row,external_id:'bank-1'}],'account','ofx'))[0].external_id,'ofx:bank-1');
  await assert.rejects(M.prepare([{...row,amount:0}],'account','csv'));
});
test('reports exclude transfers and ignored entries and use integer cents',()=>{
  const rows=[{amount:1000,flow:'normal',category:'Salário'},{amount:-.1,flow:'normal',category:'Alimentação',booked_on:'2026-10-01'},{amount:-.2,flow:'normal',category:'Alimentação',booked_on:'2026-10-01'},{amount:-20,flow:'normal',category:'Sem categoria',booked_on:'2026-10-02'},{amount:-500,flow:'transfer'},{amount:500,flow:'transfer'},{amount:-100,flow:'ignore'}];
  const s=M.summarize(rows);assert.equal(s.income,1000);assert.equal(s.expense,20.3);assert.equal(s.net,979.7);assert.equal(s.byCategory['Alimentação'],30);assert.equal(s.uncategorized,1);
});
test('CSV text cannot introduce spreadsheet formulas',()=>{
  for(const v of ['=SUM(1,2)','+cmd','-cmd','@cmd'])assert.ok(M.csvCell(v).startsWith('"\''));
  assert.equal(M.csvCell('A "quote"'),'"A ""quote"""');
});
