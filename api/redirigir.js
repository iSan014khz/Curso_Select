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

async function registrarClic({ codigo, destino, esBot, ip, ua }) {
  const url = process.env.SUPABASE_URL;
  const llave = process.env.SUPABASE_ANON_KEY;
  if (!url || !llave) return;

  const controlador = new AbortController();
  const cortar = setTimeout(() => controlador.abort(), 5000);
  try {
    await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/registrar_clic`, {
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
  } catch (_) {
    // Un fallo al registrar nunca bloquea la redirección.
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

  if (valido) {
    const ua = String(req.headers['user-agent'] || '');
    const registro = registrarClic({
      codigo,
      destino: tipo === 'w' ? 'whatsapp' : 'sitio',
      esBot: !ua || BOTS.test(ua),
      ip: ipDe(req),
      ua,
    }).catch(() => {});

    const enSegundoPlano = waitUntilDisponible();
    if (enSegundoPlano) {
      enSegundoPlano(registro);
    } else {
      await Promise.race([registro, new Promise((r) => setTimeout(r, ESPERA_MAXIMA_MS))]);
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, destino);
};
