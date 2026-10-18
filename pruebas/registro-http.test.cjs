// Ejecuta el redirector real y su fetch real contra Postman Simulation o el
// mismo stand-in HTTP en este proceso (para Windows con loopback aislado).
// No parchea fetch y no llama a Supabase de produccion.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/redirigir');
let base=process.env.CURSOSELECT_TEST_SIM_URL;
const activo=true;
const navegador='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
let anterior,servidorLocal;
before(async()=>{
  if(!base){
    servidorLocal=require('../postman/mocks/supabase/default');
    await new Promise(resolve=>servidorLocal.listen(0,'127.0.0.1',resolve));
    base='http://127.0.0.1:'+servidorLocal.address().port;
  }
  const u=new URL(base);assert.ok(['127.0.0.1','localhost'].includes(u.hostname),'La simulacion debe ser local');
  anterior={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY};
  process.env.SUPABASE_URL=base;process.env.SUPABASE_ANON_KEY='anon-solo-prueba';
});
after(async()=>{
  for(const [clave,valor] of [['SUPABASE_URL',anterior.url],['SUPABASE_ANON_KEY',anterior.key]]){
    if(valor===undefined)delete process.env[clave];else process.env[clave]=valor;
  }
  if(servidorLocal)await new Promise(resolve=>servidorLocal.close(resolve));
});
async function pedir(headers={},extra={}){
  const respuesta={headers:{}};
  await handler({method:'GET',query:{tipo:'g',codigo:'abc234'},socket:{},headers:{'user-agent':navegador,'x-forwarded-for':'192.0.2.10',...headers},...extra},
    {setHeader(k,v){respuesta.headers[k]=v},redirect(status,destino){Object.assign(respuesta,{status,destino})}});
  return respuesta;
}
async function registros(){const r=await fetch(base+'/_pruebas/registros');assert.equal(r.status,200);return r.json();}
test('registro real HTTP: navegador sin senales, hashes y sin PII en claro',{skip:!activo},async()=>{
  const r=await pedir();assert.equal(r.status,302);assert.equal(r.headers['x-clic'],'ok');
  const datos=(await registros()).at(-1);
  assert.equal(datos.p_codigo,'abc234');assert.equal(datos.p_destino,'web');assert.equal(datos.p_es_bot,false);
  assert.match(datos.p_ip_hash,/^[0-9a-f]{64}$/);assert.match(datos.p_ua_hash,/^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(datos).includes('192.0.2.10'));assert.ok(!JSON.stringify(datos).includes(navegador));
});
test('prefetch, previews, bots y herramientas quedan marcados sin llamarlos humanos',{skip:!activo},async()=>{
  for(const headers of [
    {purpose:'prefetch'}, {'sec-purpose':'prefetch;prerender'}, {'x-purpose':'preview'}, {'x-moz':'prefetch'},
    {'sec-fetch-purpose':'prerender'}, {'user-agent':''}, {'user-agent':'curl/8.5.0'},
    {'user-agent':'facebookexternalhit/1.1'}, {'user-agent':'CursoSelectPreview/1.0'},
  ]){
    assert.equal((await pedir(headers)).headers['x-clic'],'ok');
    assert.equal((await registros()).at(-1).p_es_bot,true,JSON.stringify(headers));
  }
});
test('WhatsApp ambiguo no se clasifica por su nombre; ausencia de senales no prueba humano',{skip:!activo},async()=>{
  await pedir({'user-agent':navegador+' WhatsApp/2.0'});
  assert.equal((await registros()).at(-1).p_es_bot,false);
});
test('HEAD y codigos invalidos no crean solicitudes RPC',{skip:!activo},async()=>{
  const antes=(await registros()).length;
  assert.equal((await pedir({}, {method:'HEAD'})).headers['x-clic'],'omitido-head');
  assert.equal((await pedir({}, {query:{tipo:'w',codigo:'ABC234'}})).headers['x-clic'],'codigo-invalido');
  assert.equal((await registros()).length,antes);
});
test('WhatsApp directo registra wa y redirige aun cuando la BD rechaza codigo desconocido',{skip:!activo},async()=>{
  const ok=await pedir({}, {query:{tipo:'w',codigo:'9v4ztw'}});
  assert.equal(ok.headers['x-clic'],'ok');assert.equal((await registros()).at(-1).p_destino,'wa');
  const antes=(await registros()).length;
  const rechazo=await pedir({}, {query:{tipo:'w',codigo:'zzzzzz'}});
  assert.equal(rechazo.headers['x-clic'],'http-400');assert.equal(rechazo.status,302);
  assert.equal(new URL(rechazo.destino).hostname,'wa.me');assert.equal((await registros()).length,antes);
});
