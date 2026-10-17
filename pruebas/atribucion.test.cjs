const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const handler=require('../api/redirigir');
const script=fs.readFileSync(__dirname+'/../JS/atribucion.js','utf8');

function pagina(ref,hrefs) {
  const enlaces=hrefs.map(href=>({href,getAttribute(){return this.href},setAttribute(_,valor){this.href=valor}}));
  vm.runInNewContext(script,{window:{location:{search:ref,href:'https://cursoselect.vercel.app/'+ref}},document:{querySelectorAll(){return enlaces}},URL,URLSearchParams});
  return enlaces.map(e=>e.href);
}
async function redirigir(tipo,codigo) {
  const headers={};let status,destino;
  await handler({query:{tipo,codigo},headers:{'user-agent':'CursoSelectPreview/1.0'}},{setHeader(k,v){headers[k]=v},redirect(s,d){status=s;destino=d}});
  return {headers,status,destino};
}
test('enlace web conserva el codigo de origen',async()=>{
  const r=await redirigir('g','abc234');assert.equal(r.status,302);assert.equal(r.destino,'/?ref=abc234');assert.equal(r.headers['Cache-Control'],'no-store');
});
test('WhatsApp conserva numero confirmado y mensaje con codigo',async()=>{
  const r=await redirigir('w','abc234');const u=new URL(r.destino);assert.equal(u.hostname,'wa.me');assert.equal(u.pathname,'/522212043005');assert.match(u.searchParams.get('text'),/\[abc234\]/);
});
test('referencia invalida no se propaga al destino',async()=>{
  for(const c of ['', '../otro', '<script>', 'a'.repeat(33)]){assert.equal((await redirigir('g',c)).destino,'/');assert.equal((await redirigir('w',c)).destino,'/');}
});
test('visita atribuida transforma todos los botones del numero confirmado',()=>{
  assert.deepEqual(pagina('?ref=abc234',['https://wa.me/522212043005?text=hola','https://wa.me/522212043005']),['/w/abc234','/w/abc234']);
});
test('visita organica conserva los contactos originales',()=>{
  const hrefs=['https://wa.me/522212043005?text=hola'];assert.deepEqual(pagina('',hrefs),hrefs);
});
test('no modifica compartir, otros destinos o protocolos',()=>{
  const hrefs=['https://wa.me/?text=compartir','https://wa.me/520000000000','https://otro.example/522212043005','http://wa.me/522212043005','#precio','javascript:void(0)'];assert.deepEqual(pagina('?ref=abc234',hrefs),hrefs);
});
test('referencia inyectada o excesiva no modifica contactos',()=>{
  const hrefs=['https://wa.me/522212043005'];for(const query of ['?ref=%3Cscript%3E','?ref=../x','?ref='+'a'.repeat(33)])assert.deepEqual(pagina(query,hrefs),hrefs);
});
test('registro excluye vista previa y no guarda IP ni navegador en claro',async()=>{
  const previo={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY,fetch:global.fetch};let cuerpo;
  try {
    process.env.SUPABASE_URL='https://prueba.invalid';process.env.SUPABASE_ANON_KEY='solo-prueba';
    global.fetch=async(_url,o)=>{cuerpo=JSON.parse(o.body);return {ok:true}};
    await handler({query:{tipo:'g',codigo:'abc234'},headers:{'user-agent':'CursoSelectPreview/1.0','x-forwarded-for':'192.0.2.10'},socket:{}},{setHeader(){},redirect(){}});
    assert.equal(cuerpo.p_destino,'web');assert.equal(cuerpo.p_es_bot,true);assert.match(cuerpo.p_ip_hash,/^[0-9a-f]{64}$/);assert.match(cuerpo.p_ua_hash,/^[0-9a-f]{64}$/);assert.ok(!JSON.stringify(cuerpo).includes('192.0.2.10'));
  } finally {
    global.fetch=previo.fetch;
    if(previo.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previo.url;
    if(previo.key===undefined)delete process.env.SUPABASE_ANON_KEY;else process.env.SUPABASE_ANON_KEY=previo.key;
  }
});
