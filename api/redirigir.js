// Redirector de enlaces cortos: /w/:codigo -> WhatsApp, /g/:codigo -> raíz del sitio.
// Registra el clic en Supabase (RPC registrar_clic) y redirige SIEMPRE, pase lo que pase.
//
// Variables de entorno (las define Santiago en Vercel; nunca van en el código):
//   SUPABASE_URL, SUPABASE_ANON_KEY   -> si faltan, se redirige sin registrar.
//   HASH_SALT (opcional)              -> sal para el hash de IP y user-agent.

const crypto = require('crypto');

const NUMERO_WHATSAPP = '522212043005';
const CODIGO_VALIDO = /^[A-Za-z0-9_-]{3,32}$/;
const ESPERA_MAXIMA_MS = 1500; // solo aplica si el runtime no ofrece waitUntil

// Los prefetchers de vista previa visitan el enlace al publicarlo; el reporte los excluye.
const BOTS = new RegExp(
  [
    'facebookexternalhit', 'facebot', 'meta-external', 'facebookcatalog',
    'whatsapp', 'twitterbot', 'linkedinbot', 'slackbot', 'slack-imgproxy',
    'telegrambot', 'bingbot', 'bingpreview', 'googlebot', 'google-inspectiontool',
    'adsbot', 'discordbot', 'pinterest', 'redditbot', 'applebot', 'skypeuripreview',
    'embedly', 'vkshare', 'crawler', 'spider', 'preview', 'fetcher',
    'headlesschrome', 'curl/', 'wget/', 'python-requests',
  ].join('|'),
  'i'
);

function hash(valor) {
  const sal = process.env.HASH_SALT || 'curso-select';
  return crypto.createHmac('sha256', sal).update(valor).digest('hex');
}

function ipDe(req) {
  const reenviada = req.headers['x-forwarded-for'];
  if (reenviada) return String(reenviada).split(',')[0].trim();
  return req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || '';
}

// En Vercel, waitUntil deja que el registro termine después de responder.
function waitUntilDisponible() {
  const contexto = globalThis[Symbol.for('@vercel/request-context')];
  const actual = contexto && contexto.get && contexto.get();
  return actual && actual.waitUntil ? actual.waitUntil.bind(actual) : null;
}

// Devuelve un estado corto que viaja en la cabecera x-clic. Sin secretos: solo dice
// QUE paso, nunca con que credenciales. Existe porque este registro es silencioso por
// diseno (nunca bloquea la redireccion), y sin esto un fallo es invisible.
async function registrarClic({ codigo, destino, esBot, ip, ua }) {
  const url = process.env.SUPABASE_URL;
  const llave = process.env.SUPABASE_ANON_KEY;
  if (!url) return llave ? 'falta-url' : 'sin-config';
  if (!llave) return 'falta-llave';

  const controlador = new AbortController();
  const cortar = setTimeout(() => controlador.abort(), 5000);
  try {
    // fetch NO lanza con 4xx/5xx: hay que mirar el status a mano o el rechazo es invisible.
    const r = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/registrar_clic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: llave,
        Authorization: `Bearer ${llave}`,
      },
      body: JSON.stringify({
        p_codigo: codigo,
        p_destino: destino,
        p_es_bot: esBot,
        p_ip_hash: ip ? hash(ip) : null,
        p_ua_hash: ua ? hash(ua) : null,
      }),
      signal: controlador.signal,
    });
    return r.ok ? 'ok' : `http-${r.status}`;
  } catch (e) {
    // Un fallo al registrar nunca bloquea la redirección.
    return `fallo-${(e && e.name) || 'desconocido'}`;
  } finally {
    clearTimeout(cortar);
  }
}

module.exports = async function handler(req, res) {
  const tipo = req.query.tipo === 'w' ? 'w' : 'g';
  const codigo = String(req.query.codigo || '');
  const valido = CODIGO_VALIDO.test(codigo);

  let destino = '/';
  if (tipo === 'w' && valido) {
    const texto = `Hola, me interesa el curso. Vi el anuncio [${codigo}]`;
    destino = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(texto)}`;
  }

  let estadoRegistro = valido ? 'pendiente' : 'codigo-invalido';
  if (valido) {
    const ua = String(req.headers['user-agent'] || '');
    const registro = registrarClic({
      codigo,
      // 'wa' | 'web': son los unicos valores que acepta registrar_clic en Supabase
      // (check constraint + raise). Cualquier otro se rechaza EN SILENCIO, porque el
      // registro va en un catch que nunca bloquea la redireccion. No los cambies.
      destino: tipo === 'w' ? 'wa' : 'web',
      esBot: !ua || BOTS.test(ua),
      ip: ipDe(req),
      ua,
    }).catch((e) => `fallo-${(e && e.name) || 'desconocido'}`);

    // Ruta rapida: waitUntil deja terminar el registro DESPUES de responder, asi que
    // la redireccion no espera a Supabase. A cambio, la cabecera no puede decir el
    // resultado (todavia no existe): dice 'en-segundo-plano'. Para comprobar que de
    // verdad se registro, se mira la fila en clics_anuncio, no la cabecera.
    // Si el runtime no ofrece waitUntil, se espera con tope y si se reporta el resultado.
    const enSegundoPlano = waitUntilDisponible();
    if (enSegundoPlano) {
      enSegundoPlano(registro);
      estadoRegistro = 'en-segundo-plano';
    } else {
      estadoRegistro = await Promise.race([
        registro,
        new Promise((r) => setTimeout(() => r('timeout'), ESPERA_MAXIMA_MS)),
      ]);
    }
  }

  res.setHeader('x-clic', estadoRegistro);
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, destino);
};
