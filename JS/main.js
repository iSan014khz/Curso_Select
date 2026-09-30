// Menú móvil y diálogo de compartir.
// Nada de esto depende de Motion: tiene que funcionar aunque el CDN falle.
(function () {
    const raiz = document.documentElement;
    const burger = document.getElementById('burger');
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('overlay');
    const escritorio = window.matchMedia('(min-width: 768px)');

    // ==========================================
    // MENÚ MÓVIL
    // ==========================================
    function setMenu(abierto) {
        menu.toggleAttribute('data-open', abierto);
        overlay.toggleAttribute('data-open', abierto);
        raiz.classList.toggle('is-locked', abierto);
        burger.setAttribute('aria-expanded', abierto);
    }

    const estaAbierto = () => menu.hasAttribute('data-open');

    burger.addEventListener('click', () => setMenu(!estaAbierto()));
    overlay.addEventListener('click', () => setMenu(false));

    // Al elegir un enlace el menú se cierra y el ancla hace su trabajo
    menu.addEventListener('click', (e) => {
        if (e.target.closest('a')) setMenu(false);
    });

    // Cerrar con Escape y devolver el foco al botón
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && estaAbierto()) {
            setMenu(false);
            burger.focus();
        }
    });

    // Si el foco sale del panel con el teclado, no se queda abierto a medias
    menu.addEventListener('focusout', (e) => {
        const destino = e.relatedTarget;
        if (estaAbierto() && destino && !menu.contains(destino) && destino !== burger) setMenu(false);
    });

    // Al girar el celular o ensanchar la ventana hasta el diseño de escritorio, el panel ya no aplica
    const alCambiarAncho = (e) => { if (e.matches) setMenu(false); };
    if (escritorio.addEventListener) escritorio.addEventListener('change', alCambiarAncho);
    else escritorio.addListener(alCambiarAncho);

    // ==========================================
    // DIÁLOGO DE COMPARTIR
    // (las funciones toggleShareModal, shareWhatsApp, copyLink y nativeShare viven en index.html)
    // ==========================================
    const dialogo = document.getElementById('shareModal');
    const abrirDialogo = document.getElementById('shareOpen');

    abrirDialogo.addEventListener('click', () => {
        toggleShareModal();
        raiz.classList.toggle('is-locked', !!dialogo.open);
    });

    // Se cierre como se cierre (Escape, botón, fondo), el fondo vuelve a desplazarse
    dialogo.addEventListener('close', () => raiz.classList.remove('is-locked'));

    dialogo.addEventListener('click', (e) => {
        // Un clic en el fondo oscuro cae sobre el propio <dialog>, no sobre la tarjeta
        if (e.target === dialogo) return dialogo.close();

        const boton = e.target.closest('[data-share]');
        if (!boton) return;
        const accion = boton.dataset.share;
        if (accion === 'close') dialogo.close();
        else if (accion === 'whatsapp') shareWhatsApp();
        else if (accion === 'copy') copyLink();
        else if (accion === 'native') nativeShare();
    });

    // Sin la API de compartir del sistema, "Más opciones" no haría nada: mejor no mostrarlo
    if (!navigator.share) dialogo.querySelector('[data-share="native"]').hidden = true;
})();
