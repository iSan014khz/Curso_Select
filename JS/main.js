let menuOpen = false;

function toggleMenu() {
    menuOpen = !menuOpen;
    const menu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('overlay');
    const burger = document.getElementById('burger');
    const b1 = document.getElementById('b1');
    const b2 = document.getElementById('b2');
    const b3 = document.getElementById('b3');

    menu.classList.toggle('-translate-y-full', !menuOpen);
    menu.classList.toggle('open', menuOpen);
    overlay.classList.toggle('opacity-0', !menuOpen);
    overlay.classList.toggle('pointer-events-none', !menuOpen);
    burger.setAttribute('aria-expanded', menuOpen);

    // Animación de las barras → X
    if (menuOpen) {
        b1.style.transform = 'translateY(6.5px) rotate(45deg)';
        b2.style.opacity = '0';
        b2.style.transform = 'scaleX(0)';
        b3.style.transform = 'translateY(-6.5px) rotate(-45deg)';
    } else {
        b1.style.transform = '';
        b2.style.opacity = '';
        b2.style.transform = '';
        b3.style.transform = '';
    }
}

// Cerrar con Escape
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menuOpen) toggleMenu();
});
