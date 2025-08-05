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

    // --- RSVP Multi-Step Form Logic ---
    const rsvpForm = document.getElementById('rsvp-form');
    const steps = Array.from(rsvpForm.querySelectorAll('.form-step'));
    const nextBtns = rsvpForm.querySelectorAll('.next-btn');

    // --- Mock Guest Database ---
    // In a real application, this would come from a server.
    const couples = [
        { p1: { firstName: "Max", lastName: "Mustermann" }, p2: { firstName: "Erika", lastName: "Mustermann" } },
        { p1: { firstName: "John", lastName: "Doe" }, p2: { firstName: "Jane", lastName: "Doe" } },
        { p1: { firstName: "David", lastName: "Witt" }, p2: { firstName: "Isabel", lastName: "Witt" } }
    ];

    function normalizeName(firstName, lastName) {
        return `${firstName.trim().toLowerCase()} ${lastName.trim().toLowerCase()}`;
    }

    // --- Guest Management ---
    let guestCount = 0;
    let maxAllowedGuests = 0; // This will be set dynamically
    const addGuestBtn = document.getElementById('add-guest-btn');
    const guestListContainer = document.getElementById('guest-list');

    function createGuestEntry(firstName = '', lastName = '') {
        if (guestCount >= maxAllowedGuests) return;
        guestCount++;

        const guestEntry = document.createElement('div');
        guestEntry.classList.add('guest-entry');
        guestEntry.innerHTML = `
            <button type="button" class="remove-guest-btn" title="Remove Guest">&times;</button>
            <label>Guest Name <em>(required)</em></label>
            <div class="name-fields">
                <input type="text" name="guest-first-name-${guestCount}" placeholder="First Name" value="${firstName}" required>
                <input type="text" name="guest-last-name-${guestCount}" placeholder="Last Name" value="${lastName}" required>
            </div>
        `;
        guestListContainer.appendChild(guestEntry);

        guestEntry.querySelector('.remove-guest-btn').addEventListener('click', (e) => {
            e.target.closest('.guest-entry').remove();
            guestCount--;
            updateAddGuestButton();
        });

        updateAddGuestButton();
    }

    function updateAddGuestButton() {
        addGuestBtn.style.display = guestCount >= maxAllowedGuests ? 'none' : 'block';
    }

    addGuestBtn.addEventListener('click', () => createGuestEntry());

    // --- Step Navigation ---
    nextBtns.forEach((button, index) => {
        button.addEventListener('click', () => {
            const currentStepElement = button.closest('.form-step');
            const nextStepElement = currentStepElement.nextElementSibling;

            // Validate current step before proceeding
            const currentFields = currentStepElement.querySelectorAll('[required]');
            const isValid = Array.from(currentFields).every(field => field.value.trim() !== '');
            if (!isValid) {
                alert('Please fill out all required fields.');
                return;
            }

            // Logic for Step 1 -> Step 2 (checking for known guests)
            if (index === 0) {
                const inputFirstName = document.getElementById('first-name').value;
                const inputLastName = document.getElementById('last-name').value;
                const inputFullName = normalizeName(inputFirstName, inputLastName);

                // Clear any previously added guests before checking again
                guestListContainer.innerHTML = '';
                guestCount = 0;

                const foundCouple = couples.find(c => 
                    normalizeName(c.p1.firstName, c.p1.lastName) === inputFullName || 
                    normalizeName(c.p2.firstName, c.p2.lastName) === inputFullName
                );

                if (foundCouple) {
                    // For known couples, pre-fill their partner and allow one more guest.
                    maxAllowedGuests = 2;
                    const partner = normalizeName(foundCouple.p1.firstName, foundCouple.p1.lastName) === inputFullName ? foundCouple.p2 : foundCouple.p1;
                    createGuestEntry(partner.firstName, partner.lastName);
                } else {
                    // For other guests, allow them to add one guest manually.
                    maxAllowedGuests = 1;
                }
            }

            // Move to next step
            if (nextStepElement) {
                button.style.display = 'none';
                nextStepElement.classList.add('visible');
            }
        });
    });

    // --- Final Form Submission ---
    rsvpForm.addEventListener('submit', async (event) => {
        const submitButton = document.getElementById('submit-button');
        const formMessage = document.getElementById('form-message');

        event.preventDefault();

        // Collect data from all steps
        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const email = document.getElementById('email').value;
        const attending = document.querySelector('input[name="attending"]:checked').value;
        const foodRestrictions = document.getElementById('food-restrictions').value;
        const song = document.getElementById('song').value;
        const accommodation = document.getElementById('accommodation').value;
        const arrivalDate = document.getElementById('arrival-date').value;
        const comment = document.getElementById('comment').value;

        const guests = [];
        document.querySelectorAll('.guest-entry').forEach(entry => {
            const guestFirstName = entry.querySelector('input[name^="guest-first-name"]').value;
            const guestLastName = entry.querySelector('input[name^="guest-last-name"]').value;
            guests.push({ firstName: guestFirstName, lastName: guestLastName });
        });

        const rsvpData = {
            firstName, lastName, email, attending,
            foodRestrictions, song, accommodation,
            arrivalDate, comment, guests
        };

        // Disable button and clear previous messages
        submitButton.disabled = true;
        submitButton.textContent = 'SENDING...';
        formMessage.style.display = 'none';

        try {
            // The backend endpoint URL
            const endpoint = 'http://localhost:5000/api/rsvp';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rsvpData)
            });

            const responseData = await response.json();

            if (response.ok) {
                formMessage.textContent = responseData.message;
                formMessage.className = 'form-message success';
                
                // Hide the form fields and submit button after success
                steps.forEach(step => step.style.display = 'none');
                submitButton.style.display = 'none';
            } else {
                formMessage.textContent = responseData.message;
                formMessage.className = 'form-message error';
                submitButton.disabled = false;
                submitButton.textContent = 'SEND';
            }
        } catch (error) {
            console.error('Error:', error);
            formMessage.textContent = 'A network error occurred. Please check your connection and try again.';
            formMessage.className = 'form-message error';
            submitButton.disabled = false;
            submitButton.textContent = 'SEND';
        }
    });
});