// Conserva el origen del anuncio hasta el boton de contacto, sin cookies ni almacenamiento.
(function () {
    'use strict';
    const codigo = new URLSearchParams(window.location.search).get('ref');
    if (!codigo || !/^[A-Za-z0-9_-]{3,32}$/.test(codigo)) return;

    document.querySelectorAll('a[href]').forEach(function (enlace) {
        let destino;
        try { destino = new URL(enlace.getAttribute('href'), window.location.href); }
        catch (_) { return; }
        // Compartir la pagina en WhatsApp no es contactar al negocio.
        if (destino.protocol !== 'https:' || destino.hostname !== 'wa.me' ||
            destino.pathname !== '/522212043005') return;
        enlace.setAttribute('href', '/w/' + encodeURIComponent(codigo));
    });
})();
