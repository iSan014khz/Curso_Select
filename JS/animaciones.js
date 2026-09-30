// Movimiento de la página con Motion: un solo sistema para
//   - las entradas (el hero y los bloques de cada sección), todas con la misma gramática:
//     opacity 0→1, scale(0.96)→scale(1) y blur(8px)→blur(0), 280 ms, 60 ms entre elementos;
//   - las microinteracciones (hover y press): elevación de las tarjetas, pin de la sede presencial y presión
//     de los botones.
//
// Contrato: la página es legible y usable SIN este archivo. Aquí solo se mejora.
//   - <head> deja <html data-motion="pending"> y arranca la descarga de Motion (window.__motion). Mientras tanto
//     el CSS oculta [data-hero] y [data-reveal].
//   - Al llegar Motion se pasa a "on". Si Motion falla, o tarda más que la guardia del hero (1 s: el hero se
//     muestra sin animar) o la general (2.5 s: todo pasa a "off"), nada queda oculto.
//   - Con prefers-reduced-motion todo se anima solo con opacity: sin escala, sin blur, sin desplazamientos.
(function () {
    const raiz = document.documentElement;
    if (raiz.getAttribute('data-motion') !== 'pending') return;

    const carga = window.__motion;
    if (!carga) {
        raiz.setAttribute('data-motion', 'off');
        return;
    }

    // Las curvas salen de los tokens del CSS (--ease-out, --ease-in-out): un solo lugar donde cambiarlas
    function curva(token, respaldo) {
        const numeros = getComputedStyle(raiz).getPropertyValue(token).match(/-?\d*\.?\d+/g);
        return numeros && numeros.length === 4 ? numeros.map(Number) : respaldo;
    }
    const EASE_OUT = curva('--ease-out', [0.23, 1, 0.32, 1]);
    const EASE_IN_OUT = curva('--ease-in-out', [0.77, 0, 0.175, 1]);

    // Entradas: se ven una vez por visita, así que es donde vive el presupuesto de deleite
    const ENTRADA = { duracion: 0.28, escalon: 0.06, escalonMax: 0.3, escala: 0.96, desenfoque: 8 };
    // Microinteracciones: se repiten muchas veces por visita, así que son rápidas y casi imperceptibles
    const HOVER = 0.16;
    const PRESION = 0.12;
    const ESCALA_PRESION = 0.98;
    const ELEVACION = 2; // px que sube una tarjeta

    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Hover solo con puntero fino: en táctil el :hover es un falso positivo que se queda pegado tras el toque
    const puntero = window.matchMedia('(hover: hover) and (pointer: fine)');
    // Celulares de gama baja (2 GB o menos): blur cuesta, así que se queda scale + opacity
    const conDesenfoque = !(navigator.deviceMemory && navigator.deviceMemory <= 2);

    const hero = Array.from(document.querySelectorAll('[data-hero]'));
    const secciones = Array.from(document.querySelectorAll('[data-reveal]'));
    const todos = hero.concat(secciones);
    const enCurso = new Set();
    let dejarDeObservar = () => { };

    // --- Estado oculto y fotogramas de la entrada -------------------------------------------------------------
    function ocultar(el) {
        el.style.opacity = '0';
        if (reducir.matches) return;
        el.style.transform = `scale(${ENTRADA.escala})`;
        if (conDesenfoque) el.style.filter = `blur(${ENTRADA.desenfoque}px)`;
    }

    function fotogramas() {
        const f = { opacity: [0, 1] };
        if (!reducir.matches) {
            f.transform = [`scale(${ENTRADA.escala})`, 'scale(1)'];
            if (conDesenfoque) f.filter = [`blur(${ENTRADA.desenfoque}px)`, 'blur(0px)'];
        }
        return f;
    }

    function limpiar(el) {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.filter = '';
    }

    // Al terminar se devuelve el control a la hoja de estilos: no queda un transform o un filter en línea que
    // pise otra regla ni que mantenga al elemento en su propia capa. Motion escribe los valores finales un
    // cuadro después de resolver la promesa, por eso se espera dos cuadros (el resultado visual es idéntico).
    function alTerminar(animacion, elementos) {
        animacion.then(() => {
            enCurso.delete(animacion);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                elementos.forEach((el) => {
                    limpiar(el);
                    el.setAttribute('data-listo', ''); // ya puede reaccionar al hover
                });
            }));
        });
    }

    // Apagado total: el contenido queda exactamente como lo dejó la hoja de estilos
    function mostrarTodo() {
        raiz.setAttribute('data-motion', 'off');
        dejarDeObservar();
        enCurso.forEach((animacion) => animacion.stop());
        enCurso.clear();
        todos.forEach(limpiar);
    }

    // Si alguien activa "reducir movimiento" a media visita, lo que aún espera su entrada pierde la escala y el
    // desenfoque de su estado oculto y entra solo con opacity
    const alCambiarReduccion = (e) => {
        if (!e.matches) return;
        todos.filter((el) => !el.hasAttribute('data-listo')).forEach((el) => {
            el.style.transform = '';
            el.style.filter = '';
        });
    };
    if (reducir.addEventListener) reducir.addEventListener('change', alCambiarReduccion);
    else reducir.addListener(alCambiarReduccion);

    // --- Entradas ----------------------------------------------------------------------------------------------
    function iniciarEntradas({ animate, inView, stagger }) {
        // Si la guardia del hero ganó la carrera, el hero ya se ve: no se vuelve a ocultar ni a animar
        const aAnimar = raiz.hasAttribute('data-hero-skip') ? secciones : todos;

        // El estado oculto pasa de la hoja de estilos a estilos en línea: sin parpadeo entre uno y otro
        aAnimar.forEach(ocultar);
        raiz.setAttribute('data-motion', 'on');

        const escalonar = stagger(ENTRADA.escalon);

        // Cada elemento entra cuando se acerca a la pantalla. Los que coinciden en el mismo cuadro (los cinco del
        // hero, una fila de tarjetas) se escalonan; uno que entra solo, entra solo. Van en orden de documento.
        let cola = [];
        let cuadro = 0;

        function vaciarCola() {
            cuadro = 0;
            const lote = cola.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
            cola = [];
            try {
                // transform y filter completos (no x/y/scale): así corren en el compositor y no caen de cuadros
                // mientras la página trabaja
                const animacion = animate(lote, fotogramas(), {
                    duration: ENTRADA.duracion,
                    ease: EASE_OUT,
                    delay: (i, total) => Math.min(escalonar(i, total), ENTRADA.escalonMax),
                });
                enCurso.add(animacion);
                alTerminar(animacion, lote);
            } catch (error) {
                mostrarTodo();
            }
        }

        // Sin devolver función desde el callback, inView deja de observar el elemento: entra una sola vez
        dejarDeObservar = inView(
            aAnimar,
            (el) => {
                cola.push(el);
                if (!cuadro) cuadro = requestAnimationFrame(vaciarCola);
            },
            { margin: '0px 0px -8% 0px' }
        );
    }

    // --- Microinteracciones ------------------------------------------------------------------------------------
    // Son transiciones, no keyframes: animar de nuevo sobre el mismo elemento parte del valor actual, así que se
    // pueden interrumpir a media animación sin saltos. Solo tocan opacity y transform.
    function iniciarMicrointeracciones({ animate, hover, press }) {
        const ultima = new WeakMap();

        function mover(el, valor, duracion, curvaUsada) {
            const animacion = animate(el, { transform: valor }, { duration: duracion, ease: curvaUsada || EASE_OUT });
            ultima.set(el, animacion);
            // Al volver a reposo se devuelve el control a la hoja de estilos (salvo que ya haya otra animación encima)
            if (valor === 'none' || valor === 'scale(1)' || valor === 'translateY(0px)') {
                animacion.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (ultima.get(el) === animacion) el.style.transform = '';
                })));
            }
            return animacion;
        }

        function capa(padre, clase) {
            const el = document.createElement('span');
            el.className = clase;
            el.setAttribute('aria-hidden', 'true');
            padre.appendChild(el);
            return el;
        }

        // Tarjetas de área y de plataforma: suben 2 px y la sombra sube un escalón. La sombra ya está pintada en una
        // capa transparente; lo único que se anima es su opacity (así no se repinta nada en cada cuadro).
        // Con reduced motion: solo la sombra, sin desplazamiento.
        document.querySelectorAll('[data-lift]').forEach((tarjeta) => {
            const sombra = capa(tarjeta, 'card__lift');
            hover(tarjeta, () => {
                if (!puntero.matches || !tarjeta.hasAttribute('data-listo')) return;
                animate(sombra, { opacity: 1 }, { duration: HOVER, ease: EASE_OUT });
                if (!reducir.matches) mover(tarjeta, `translateY(-${ELEVACION}px)`, HOVER);
                return () => {
                    animate(sombra, { opacity: 0 }, { duration: HOVER, ease: EASE_OUT });
                    if (tarjeta.style.transform) mover(tarjeta, 'translateY(0px)', HOVER);
                };
            });
        });

        // Modalidad presencial: es la tarjeta con acción física real (hay que ir), así que tiene la única
        // microinteracción con carácter: el pin da un rebote corto de 2 px y la sede marca su borde.
        // Sube con ease-out y vuelve con ease-in-out, sin curvas nuevas. Con reduced motion: solo el borde.
        const presencial = document.querySelector('[data-pin]');
        if (presencial) {
            const pin = presencial.querySelector('.mode__icon');
            const sede = presencial.querySelector('.place');
            const borde = sede ? capa(sede, 'place__ring') : null;
            hover(presencial, () => {
                if (!puntero.matches || !presencial.hasAttribute('data-listo')) return;
                if (borde) animate(borde, { opacity: 1 }, { duration: HOVER, ease: EASE_OUT });
                if (pin && !reducir.matches) {
                    mover(pin, 'translateY(-2px)', 0.12, EASE_OUT).then(() => mover(pin, 'translateY(0px)', 0.16, EASE_IN_OUT));
                }
                return () => {
                    if (borde) animate(borde, { opacity: 0 }, { duration: HOVER, ease: EASE_OUT });
                    if (pin && pin.style.transform) mover(pin, 'translateY(0px)', HOVER);
                };
            });
        }

        // Botones: scale(0.98) al presionar, 120 ms. Es la microinteracción de más frecuencia, por eso casi no se nota.
        // Funciona también en táctil (no depende del hover). Con reduced motion no hay escala: queda el cambio de color.
        press('.btn, .fab', (el) => {
            if (reducir.matches) return;
            mover(el, `scale(${ESCALA_PRESION})`, PRESION);
            return () => mover(el, 'scale(1)', PRESION);
        });
    }

    function iniciar(motion) {
        // Si la guardia general ganó la carrera, no se vuelve a ocultar nada
        if (raiz.getAttribute('data-motion') !== 'pending') return;
        iniciarEntradas(motion);
        // Las microinteracciones son un extra: si su API cambiara, las entradas siguen funcionando
        if (typeof motion.hover === 'function' && typeof motion.press === 'function') {
            try {
                iniciarMicrointeracciones(motion);
            } catch (error) { /* la página sigue igual sin ellas */ }
        }
    }

    carga.then(iniciar).catch(mostrarTodo);
})();
