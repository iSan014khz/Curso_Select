(async function () {
  'use strict';
  const contenedor = document.getElementById('demo-opciones');
  if (!contenedor) return;
  try {
    const respuesta = await fetch('/datos/muestra-medicina.json');
    if (!respuesta.ok) throw new Error('Muestra no disponible');
    const muestra = await respuesta.json();
    document.getElementById('demo-title').textContent = muestra.enunciado_md;
    const feedback = document.getElementById('demo-feedback');
    const reiniciar = document.getElementById('demo-reiniciar');
    for (const [letra, texto] of Object.entries(muestra.opciones)) {
      const boton = document.createElement('button');
      boton.type = 'button'; boton.className = 'demo-option';
      boton.dataset.letra = letra; boton.setAttribute('aria-pressed', 'false');
      const clave = document.createElement('b'); clave.textContent = letra;
      const contenido = document.createElement('span'); contenido.textContent = texto;
      boton.append(clave, contenido);
      boton.addEventListener('click', () => {
        boton.setAttribute('aria-pressed', 'true');
        for (const opcion of contenedor.children) {
          opcion.disabled = true;
          if (opcion.dataset.letra === muestra.correcta) opcion.dataset.correcta = '';
        }
        feedback.textContent = muestra.retro[letra] + (letra === muestra.correcta ? '' : ' Respuesta correcta: ' + muestra.opciones[muestra.correcta] + '.');
        feedback.hidden = false; reiniciar.hidden = false;
      });
      contenedor.append(boton);
    }
    reiniciar.addEventListener('click', () => {
      for (const boton of contenedor.children) {
        boton.disabled = false; boton.removeAttribute('data-correcta'); boton.setAttribute('aria-pressed', 'false');
      }
      feedback.hidden = true; reiniciar.hidden = true;
      contenedor.firstElementChild.focus();
    });
  } catch (_) {
    contenedor.textContent = 'La muestra no pudo cargar. Puedes consultar los contenidos por WhatsApp.';
  }
})();
