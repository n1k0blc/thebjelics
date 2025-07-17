document.addEventListener('DOMContentLoaded', () => {
    // Hamburger-Menü Toggle
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const menu = document.querySelector('.menu');
    const bars = document.querySelectorAll('.hamburger-btn .bar');
    const menuLinks = document.querySelectorAll('.menu a');

    hamburgerBtn.addEventListener('click', () => {
        hamburgerBtn.classList.toggle('active');
        menu.classList.toggle('active');
    });

    // Smooth Scrolling für Menü-Links
    const scrollLinks = document.querySelectorAll('.scroll-link');
    scrollLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                window.scrollTo({
                    top: targetSection.offsetTop,
                    behavior: 'smooth'
                });
            }

            // Menü schließen
            hamburgerBtn.classList.remove('active');
            menu.classList.remove('active');
        });
    });

    // Farbwechsel für Icon + Menü-Links basierend auf Scrollposition
    function updateMenuColors() {
        const scrollY = window.scrollY;
        const locationSection = document.getElementById('location');
        const dresscodeSection = document.getElementById('dresscode');
        const faqSection = document.getElementById('FAQ');
        const body = document.body;

        const inBrightSection = (section) => {
            if (!section) return false;
            const top = section.offsetTop;
            const height = section.offsetHeight;
            return scrollY >= top && scrollY < top + height;
        };

        const isBright = inBrightSection(locationSection) || inBrightSection(dresscodeSection) || inBrightSection(faqSection);

        bars.forEach(bar => {
            bar.style.backgroundColor = isBright ? 'black' : 'white';
        });

        menuLinks.forEach(link => {
            link.style.color = isBright ? 'black' : 'white';
        });

        if (isBright) {
            body.classList.add('content-light');
        } else {
            body.classList.remove('content-light');
        }
    }

    // Initial und beim Scrollen ausführen
    updateMenuColors();
    window.addEventListener('scroll', updateMenuColors);
});