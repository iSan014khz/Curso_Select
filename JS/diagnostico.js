// Muestra orientativa: puntua respuestas, no calcula probabilidades de admision.
(function () {
    'use strict';
    const preguntas = [
        { area: 'matematicas', texto: 'Un material cuesta $200. Si tiene 20% de descuento, ¿cuánto pagas?', opciones: ['$180', '$160', '$140', '$120'], correcta: 1 },
        { area: 'matematicas', texto: 'Si 2x + 5 = 17, ¿cuánto vale x?', opciones: ['4', '5', '6', '11'], correcta: 2 },
        { area: 'matematicas', texto: '¿Cuál es el resultado de 3/4 + 1/8?', opciones: ['4/12', '4/8', '5/8', '7/8'], correcta: 3 },
        { area: 'lectura', texto: 'Lee: «Un equipo revisó sus errores de práctica cada semana y eligió qué repasar según los que se repetían». ¿Qué describe mejor su estrategia?', opciones: ['Repetir siempre los mismos temas', 'Usar los errores para orientar el repaso', 'Evitar nuevas evaluaciones', 'Estudiar solo lo que ya domina'], correcta: 1 },
        { area: 'lectura', texto: 'En «Las pausas pueden ayudar a concentrarse porque reducen la fatiga», ¿qué función cumple «porque»?', opciones: ['Presentar una consecuencia', 'Introducir una razón', 'Añadir un ejemplo', 'Expresar una oposición'], correcta: 1 },
        { area: 'lectura', texto: 'Lee: «Todas las personas que entregaron la actividad recibieron retroalimentación. Ana entregó la actividad». ¿Qué se puede concluir?', opciones: ['Ana obtuvo la mejor calificación', 'Todas las personas del grupo entregaron', 'Ana recibió retroalimentación', 'Ana ya domina todos los temas'], correcta: 2 }
    ];
    const nombres = { matematicas: 'Matemáticas', lectura: 'Comprensión lectora' };
    function evaluar(respuestas) {
        if (!Array.isArray(respuestas) || respuestas.length !== preguntas.length ||
            Array.from(respuestas).some((r, i) => !Number.isInteger(r) || r < 0 || r >= preguntas[i].opciones.length)) {
            throw new Error('Responde las seis preguntas antes de consultar el resultado.');
        }
        const areas = Object.keys(nombres).map(id => {
            const indices = preguntas.map((p, i) => p.area === id ? i : -1).filter(i => i >= 0);
            const correctas = indices.filter(i => respuestas[i] === preguntas[i].correcta).length;
            return { id, nombre: nombres[id], correctas, total: indices.length, porcentaje: Math.round(correctas * 100 / indices.length) };
        });
        const correctas = areas.reduce((n, a) => n + a.correctas, 0);
        return { correctas, total: preguntas.length, porcentaje: Math.round(correctas * 100 / preguntas.length), areas };
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { preguntas, evaluar };
    if (typeof document === 'undefined') return;
    const raiz = document.getElementById('mini-diagnostico');
    if (!raiz) return;
    const inicio = raiz.querySelector('[data-diagnostico-inicio]');
    const formulario = raiz.querySelector('form');
    const resultado = raiz.querySelector('[data-diagnostico-resultado]');
    const leyenda = formulario.querySelector('legend');
    const opciones = formulario.querySelector('[data-opciones]');
    const atras = formulario.querySelector('[data-atras]');
    const siguiente = formulario.querySelector('[type="submit"]');
    let indice = 0;
    let respuestas = [];
    function dibujar() {
        const pregunta = preguntas[indice];
        raiz.querySelector('[data-paso]').textContent = 'Pregunta ' + (indice + 1) + ' de ' + preguntas.length + ' · ' + nombres[pregunta.area];
        formulario.querySelector('progress').value = indice + 1;
        leyenda.textContent = pregunta.texto;
        opciones.replaceChildren();
        pregunta.opciones.forEach((texto, valor) => {
            const etiqueta = document.createElement('label');
            etiqueta.className = 'diagnostico__opcion';
            const radio = document.createElement('input');
            radio.type = 'radio'; radio.name = 'respuesta'; radio.value = valor; radio.required = true;
            radio.checked = respuestas[indice] === valor;
            const titulo = document.createElement('span'); titulo.textContent = texto;
            etiqueta.append(radio, titulo); opciones.append(etiqueta);
        });
        atras.hidden = indice === 0;
        siguiente.textContent = indice === preguntas.length - 1 ? 'Ver mi resultado' : 'Siguiente';
        leyenda.focus();
    }
    function empezar() {
        indice = 0; respuestas = [];
        inicio.hidden = true; resultado.hidden = true; formulario.hidden = false;
        dibujar();
    }
    raiz.querySelector('[data-empezar]').addEventListener('click', empezar);
    raiz.querySelector('[data-repetir]').addEventListener('click', empezar);
    atras.addEventListener('click', () => {
        const seleccion = formulario.querySelector('input:checked');
        if (seleccion) respuestas[indice] = Number(seleccion.value);
        if (indice > 0) { indice--; dibujar(); }
    });
    formulario.addEventListener('submit', evento => {
        evento.preventDefault();
        const seleccion = formulario.querySelector('input:checked');
        if (!seleccion) return;
        respuestas[indice] = Number(seleccion.value);
        if (indice < preguntas.length - 1) { indice++; dibujar(); return; }
        const resumen = evaluar(respuestas);
        raiz.querySelector('[data-porcentaje]').textContent = resumen.porcentaje + '%';
        raiz.querySelector('[data-aciertos]').textContent = resumen.correctas + ' de ' + resumen.total + ' respuestas correctas';
        resultado.querySelector('progress').value = resumen.porcentaje;
        const lista = raiz.querySelector('[data-areas]'); lista.replaceChildren();
        resumen.areas.forEach(area => {
            const fila = document.createElement('li');
            fila.textContent = area.nombre + ': ' + area.correctas + '/' + area.total + ' · ' + area.porcentaje + '% de aciertos';
            lista.append(fila);
        });
        raiz.querySelector('[data-orientacion]').textContent = resumen.porcentaje === 100
            ? 'Buen resultado en esta muestra. Amplía la práctica a más temas y ejercicios con tiempo.'
            : 'Esta muestra te da un punto de partida. Nuestras clases y la práctica en la app pueden ayudarte a reforzar los temas que te cuestan.';
        formulario.hidden = true; resultado.hidden = false;
        resultado.querySelector('h3').focus();
    });
    raiz.querySelector('[data-empezar]').disabled = false;
})();
