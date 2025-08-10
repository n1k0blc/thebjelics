document.addEventListener('DOMContentLoaded', () => {
    // Hamburger-Menü Toggle
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const menu = document.querySelector('.menu');
    const overlay = document.querySelector('.overlay');
    const bars = document.querySelectorAll('.hamburger-btn .bar');
    const menuLinks = document.querySelectorAll('.menu a');

    hamburgerBtn.addEventListener('click', () => {
        hamburgerBtn.classList.toggle('active');
        menu.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.classList.toggle('menu-open');
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
            overlay.classList.remove('active');
            document.body.classList.remove('menu-open');
        });
    });

    // --- RSVP Multi-Step Form Logic ---
    const rsvpForm = document.getElementById('rsvp-form');
    const steps = Array.from(rsvpForm.querySelectorAll('.form-step'));
    const nextBtns = rsvpForm.querySelectorAll('.next-btn');

    // --- Validation Helpers ---
    function validateName(name) {
        // Allows letters (including international), spaces, hyphens, and apostrophes.
        const re = /^[a-zA-Z\u00C0-\u017F\s'-]+$/;
        return re.test(String(name));
    }
    function validateEmail(email) {
        const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        return re.test(String(email).toLowerCase());
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
        button.addEventListener('click', async () => {
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
                const firstNameInput = document.getElementById('first-name');
                const lastNameInput = document.getElementById('last-name');
                const nameError = document.getElementById('name-error');

                // Perform validation
                if (!firstNameInput.value.trim() || !lastNameInput.value.trim()) {
                    nameError.textContent = 'First and last name are required.';
                    return;
                }
                if (!validateName(firstNameInput.value) || !validateName(lastNameInput.value)) {
                    nameError.textContent = 'Names can only contain letters, spaces, and hyphens.';
                    return;
                }
                nameError.textContent = ''; // Clear error on success

                // Clear any previously added guests before checking again
                guestListContainer.innerHTML = '';
                guestCount = 0;

                try {
                    const response = await fetch(`http://localhost:3000/api/partner?firstName=${encodeURIComponent(firstNameInput.value)}&lastName=${encodeURIComponent(lastNameInput.value)}`);
                    
                    if (response.ok) {
                        const partner = await response.json();
                        // For known couples, pre-fill their partner and allow one more guest.
                        maxAllowedGuests = 2;
                        createGuestEntry(partner.firstName, partner.lastName);
                    } else {
                        // For other guests, allow them to add one guest manually.
                        maxAllowedGuests = 1;
                    }
                } catch (error) {
                    console.error('Error checking for partner:', error);
                    // Default behavior if API call fails
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

        // --- Final Validation ---
        const emailInput = document.getElementById('email');
        const emailError = document.getElementById('email-error');
        const isAttending = rsvpForm.querySelector('input[name="attending"]:checked');

        const isEmailValid = validateEmail(emailInput.value);

        if (!isEmailValid) {
            emailError.textContent = 'Please enter a valid email address.';
        } else {
            emailError.textContent = '';
        }

        if (!isAttending || !isEmailValid) {
            // Display a general message if any final validation fails
            formMessage.textContent = 'Please correct the errors before submitting.';
            formMessage.className = 'form-message error';
            return;
        }
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
        formMessage.className = 'form-message'; // Reset the message

        try {
            // The backend endpoint URL
            const endpoint = 'http://localhost:3000/api/rsvp';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rsvpData)
            });

            const responseData = await response.json();

            if (!response.ok) {
                // Use the server's message, or a default for other errors
                throw new Error(responseData.message || `Server responded with status: ${response.status}`);
            }

            // --- Success Path ---
            formMessage.textContent = responseData.message;
            formMessage.classList.add('success');
            steps.forEach(step => step.style.display = 'none');
            submitButton.style.display = 'none';
        } catch (error) {
            // --- Error Path ---
            console.error('Submission Error:', error.message); // Check the browser console for this message!
            formMessage.textContent = error.message;
            formMessage.classList.add('error');
        } finally {
            // This runs after success or error to re-enable the button if it's still visible.
            if (submitButton.style.display !== 'none') {
                submitButton.disabled = false;
                submitButton.textContent = 'SEND';
            }
        }
    });

    function updateHamburgerColor() {
        const scrollY = window.scrollY;
        const homeSection = document.getElementById('home');
        const locationSection = document.getElementById('location');
        const dresscodeSection = document.getElementById('dresscode');
        const faqSection = document.getElementById('FAQ');
        const rsvpSection = document.getElementById('rsvp');

        const inSection = (section) => {
            if (!section) return false;
            const top = section.offsetTop;
            const height = section.offsetHeight;
            return scrollY >= top && scrollY < top + height;
        };

        if (inSection(homeSection) || inSection(locationSection) || inSection(dresscodeSection) || inSection(faqSection) || inSection(rsvpSection)) {
            hamburgerBtn.classList.add('black-bg');
        } else {
            hamburgerBtn.classList.remove('black-bg');
        }
    }

    window.addEventListener('scroll', updateHamburgerColor);
});