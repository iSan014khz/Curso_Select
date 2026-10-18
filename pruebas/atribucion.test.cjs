const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const handler=require('../api/redirigir');
const script=fs.readFileSync(__dirname+'/../JS/atribucion.js','utf8');
const entorno={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY};
before(()=>{delete process.env.SUPABASE_URL;delete process.env.SUPABASE_ANON_KEY;});
after(()=>{
  for(const [clave,valor] of [['SUPABASE_URL',entorno.url],['SUPABASE_ANON_KEY',entorno.key]]){
    if(valor===undefined)delete process.env[clave];else process.env[clave]=valor;
  }
});

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
test('WhatsApp conserva numero y referencia v1 sin codigo visible',async()=>{
  const r=await redirigir('w','abc234');const u=new URL(r.destino);
  assert.equal(u.hostname,'wa.me');assert.equal(u.pathname,'/522212043005');
  const texto=u.searchParams.get('text');
  const [visible,oculta]=texto.split('\u2063\u2060');
  assert.equal(visible,'Hola, me interesa el curso BUAP 2027. ¿Me compartes información?');
  assert.equal(texto.includes('abc234'),false);
  assert.ok(oculta.endsWith('\u2060\u2063'));
  const bits=Array.from(oculta.slice(0,-2),c=>{assert.ok(c==='\u200b'||c==='\u200c');return c==='\u200c'?'1':'0'}).join('');
  assert.equal(bits.length,104);
  const bytes=bits.match(/.{8}/g).map(b=>parseInt(b,2));
  const carga=Buffer.from(bytes).toString('ascii');
  const checksum=require('node:crypto').createHash('sha256').update('abc234').digest('hex').slice(0,4);
  assert.equal(carga,`1:abc234:${checksum}`);
});
test('referencia invalida no se propaga al destino',async()=>{
  for(const c of ['', '../otro', '<script>', 'a'.repeat(33),'ABC234','abc23','abc2345','abc_23','abc234\n']){assert.equal((await redirigir('g',c)).destino,'/');assert.equal((await redirigir('w',c)).destino,'/');}
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
test('HEAD no registra visitas aunque tenga navegador normal',async()=>{
  const headers={};let destino;
  await handler({method:'HEAD',query:{tipo:'g',codigo:'abc234'},headers:{'user-agent':'Mozilla/5.0'}},{setHeader(k,v){headers[k]=v},redirect(_,d){destino=d}});
  assert.equal(destino,'/?ref=abc234');assert.equal(headers['x-clic'],'omitido-head');
});
