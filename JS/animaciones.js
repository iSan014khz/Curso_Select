// Entrada escalonada de las secciones al hacer scroll, con Motion (animate + inView + stagger).
//
// Contrato: la página es legible y usable SIN este archivo. Aquí solo se mejora.
//   - <head> deja <html data-motion="pending"> solo si la visita admite movimiento; mientras tanto
//     el CSS oculta los [data-reveal].
//   - Este archivo carga Motion y pasa a "on". Si Motion falla, tarda de más (guardia de <head>) o la
//     persona activa "reducir movimiento" a media visita, pasa a "off" y todo queda visible.
//   - Con "off" (o sin el atributo) nada se oculta nunca: no hay contenido esperando una animación.
(function () {
    const raiz = document.documentElement;
    if (raiz.getAttribute('data-motion') !== 'pending') return;

    // Versión fija: un major nuevo no debe cambiar la página en producción sin que nadie lo pruebe
    const MOTION = 'https://cdn.jsdelivr.net/npm/motion@13.4.6/+esm';
    // Las dependencias que arrastra esa versión (entrada -> dom -> motion-dom y motion-utils). Se piden todas a la
    // vez para que no lleguen en cascada. Si se sube la versión de Motion, esta lista se puede actualizar o quitar:
    // solo es una optimización, la importación funciona igual sin ella.
    const DEPENDENCIAS = ['framer-motion@13.4.6/dom', 'motion-dom@13.4.5', 'motion-utils@13.3.0'];
    const EASE_OUT = [0.23, 1, 0.32, 1]; // cubic-bezier(0.23, 1, 0.32, 1), igual que --ease-out
    // Es una entrada de marketing que se ve una vez por visita, no UI que se repite: por eso 400 ms y no los 300 ms
    // del presupuesto de la UI. La curva fuerte lleva el 80 % del recorrido al primer tercio, así que se siente corta.
    const DURACION = 0.4;
    // En px y no en %: el 14 % de una tarjeta alta se movería más de 80 px
    const DESPLAZAMIENTO = 14;
    const ESCALON = 0.06; // 60 ms entre los elementos que entran juntos
    const ESCALON_MAX = 0.3; // tope: en un monitor muy alto entran muchos a la vez y la cascada no debe alargarse
    const elementos = Array.from(document.querySelectorAll('[data-reveal]'));
    const enCurso = new Set();
    let dejarDeObservar = () => { };

    function limpiar(el) {
        el.style.opacity = '';
        el.style.transform = '';
    }

    // Apagado total: el contenido queda exactamente como lo dejó la hoja de estilos
    function mostrarTodo() {
        raiz.setAttribute('data-motion', 'off');
        dejarDeObservar();
        enCurso.forEach((animacion) => animacion.stop());
        enCurso.clear();
        elementos.forEach(limpiar);
    }

    function iniciar({ animate, inView, stagger }) {
        // Si la guardia de <head> ganó la carrera, no se vuelve a ocultar nada
        if (raiz.getAttribute('data-motion') !== 'pending') return;

        // El estado oculto pasa de la hoja de estilos a estilos en línea: sin parpadeo entre uno y otro
        elementos.forEach((el) => {
            el.style.opacity = '0';
            el.style.transform = `translateY(${DESPLAZAMIENTO}px)`;
        });
        raiz.setAttribute('data-motion', 'on');

        const escalonar = stagger(ESCALON);

        // Cada elemento entra cuando se acerca a la pantalla. Los que coinciden en el mismo cuadro
        // (una fila de tarjetas) se escalonan 60 ms; uno que entra solo, entra solo.
        let cola = [];
        let cuadro = 0;

        function vaciarCola() {
            cuadro = 0;
            const lote = cola.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
            cola = [];
            try {
                // transform completo (no x/y): así corre en el compositor y no cae de cuadros mientras la página trabaja
                const animacion = animate(
                    lote,
                    { opacity: [0, 1], transform: [`translateY(${DESPLAZAMIENTO}px)`, 'translateY(0px)'] },
                    { duration: DURACION, ease: EASE_OUT, delay: (i, total) => Math.min(escalonar(i, total), ESCALON_MAX) }
                );
                enCurso.add(animacion);
                // Al terminar se devuelve el control a la hoja de estilos (así no queda un transform en línea
                // que pise, por ejemplo, un :active). Motion escribe los valores finales un cuadro después de
                // resolver la promesa, por eso se espera dos cuadros: el resultado visual es idéntico.
                animacion.then(() => {
                    enCurso.delete(animacion);
                    requestAnimationFrame(() => requestAnimationFrame(() => lote.forEach(limpiar)));
                });
            } catch (error) {
                mostrarTodo();
            }
        }

        // Sin devolver función desde el callback, inView deja de observar el elemento: entra una sola vez
        dejarDeObservar = inView(
            elementos,
            (el) => {
                cola.push(el);
                if (!cuadro) cuadro = requestAnimationFrame(vaciarCola);
            },
            { margin: '0px 0px -8% 0px' }
        );
    }

    // Si alguien activa "reducir movimiento" mientras usa la página, todo se muestra al instante
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)');
    const alCambiar = (e) => { if (e.matches) mostrarTodo(); };
    if (reducir.addEventListener) reducir.addEventListener('change', alCambiar);
    else reducir.addListener(alCambiar);

    // Se hace aquí, al final de la página, y no en <head>: así Motion (que no es crítico) no compite por ancho de
    // banda con la hoja de estilos y las fuentes.
    DEPENDENCIAS.forEach((paquete) => {
        const enlace = document.createElement('link');
        enlace.rel = 'modulepreload';
        enlace.href = 'https://cdn.jsdelivr.net/npm/' + paquete + '/+esm';
        document.head.appendChild(enlace);
    });

    import(MOTION).then(iniciar).catch(mostrarTodo);
})();
