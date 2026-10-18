// Stand-in local del contrato SQL registrar_clic: nunca usa credenciales reales.
// No se busco un mock de propietario: CLI sin sesion; basado en migraciones 020/021.
const http = require('node:http');
const registros = [];
const servidor = http.createServer(async (req, res) => {
  if (req.url === '/_pruebas/registros' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(registros));
  }
  if (req.url !== '/rest/v1/rpc/registrar_clic' || req.method !== 'POST') {
    res.writeHead(501); return res.end('Endpoint fuera del contrato probado');
  }
  let texto = '';
  for await (const fragmento of req) texto += fragmento;
  let datos;
  try { datos = JSON.parse(texto); } catch (_) { res.writeHead(400); return res.end(); }
  if (req.headers.apikey !== 'anon-solo-prueba' || req.headers.authorization !== 'Bearer anon-solo-prueba') {
    res.writeHead(401); return res.end();
  }
  if (!/^[a-z0-9]{6}$/.test(datos.p_codigo) || !['web','wa'].includes(datos.p_destino) ||
      typeof datos.p_es_bot !== 'boolean' ||
      ![datos.p_ip_hash,datos.p_ua_hash].every(v=>v===null || /^[0-9a-f]{64}$/.test(v))) {
    res.writeHead(400); return res.end();
  }
  if (!['abc234','9v4ztw'].includes(datos.p_codigo)) {
    res.writeHead(400); return res.end(JSON.stringify({code:'22023',message:'Publicacion desconocida'}));
  }
  registros.push(datos);
  res.writeHead(204); res.end();
});
module.exports = servidor;
if (require.main === module) servidor.listen(process.env.PORT || 4917, '127.0.0.1');
