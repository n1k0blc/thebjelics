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

    // RSVP Form Submission
    const rsvpForm = document.getElementById('rsvp-form');

    rsvpForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent the default form submission

        // Get form data
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const email = document.getElementById('email').value;
        const attending = document.querySelector('input[name="attending"]:checked').value;
        const bringingGuest = document.querySelector('input[name="bringing-guest"]:checked').value;
        const guestFirstName = document.getElementById('guest-first-name').value;
        const guestLastName = document.getElementById('guest-last-name').value;
        const foodRestrictions = document.getElementById('food-restrictions').value;
        const song = document.getElementById('song').value;

        // Create data object
        const rsvpData = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            attending: attending,
            bringingGuest: bringingGuest,
            guestFirstName: guestFirstName,
            guestLastName: guestLastName,
            foodRestrictions: foodRestrictions,
            song: song
        };

        // Send data to the server
        try {
            const response = await fetch('http://localhost:5000/api/rsvp', { // Replace with your API endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(rsvpData)
            });

            const responseData = await response.json();

            if (response.ok) {
                alert(responseData.message); // Show success message
                rsvpForm.reset(); // Clear the form
            } else {
                alert(responseData.message); // Show error message
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while submitting the RSVP.');
        }
    });
});