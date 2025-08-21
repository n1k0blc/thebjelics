document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const CORRECT_PASSWORD = 'Nadja&Niko';
    const PASSWORD_COOKIE_NAME = 'wedding_access';
    const PASSWORD_COOKIE_DURATION = 30; // days

    function setCookie(name, value, days) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
    }

    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    function checkPasswordAccess() {
        const accessCookie = getCookie(PASSWORD_COOKIE_NAME);
        const passwordOverlay = document.getElementById('password-overlay');
        
        if (accessCookie === 'granted') {
            // User has already entered correct password
            passwordOverlay.classList.add('hidden');
            setTimeout(() => {
                passwordOverlay.style.display = 'none';
            }, 500);
            return true;
        } else {
            // Show password overlay
            passwordOverlay.style.display = 'flex';
            return false;
        }
    }

    function handlePasswordSubmit(event) {
        event.preventDefault();
        const passwordInput = document.getElementById('password-input');
        const passwordError = document.getElementById('password-error');
        const enteredPassword = passwordInput.value.trim();

        if (enteredPassword === CORRECT_PASSWORD) {
            // Correct password
            setCookie(PASSWORD_COOKIE_NAME, 'granted', PASSWORD_COOKIE_DURATION);
            const passwordOverlay = document.getElementById('password-overlay');
            passwordOverlay.classList.add('hidden');
            setTimeout(() => {
                passwordOverlay.style.display = 'none';
            }, 500);
            passwordError.classList.remove('show');
        } else {
            // Incorrect password
            passwordError.textContent = 'Falsches Passwort. Bitte versuchen Sie es erneut.';
            passwordError.classList.add('show');
            passwordInput.value = '';
            passwordInput.focus();
            
            // Add shake animation
            passwordInput.style.animation = 'shake 0.5s ease-in-out';
            setTimeout(() => {
                passwordInput.style.animation = '';
            }, 500);
        }
    }

    // Initialize password protection
    const hasAccess = checkPasswordAccess();
    
    // Set up password form
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordSubmit);
    }

    // If no access, don't initialize the rest of the app
    if (!hasAccess) {
        return;
    }

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
    if (!rsvpForm) {
        console.log('RSVP form not found on this page');
        return; // Exit if no RSVP form is present
    }
    
    const steps = Array.from(rsvpForm.querySelectorAll('.form-step'));
    const nextBtns = rsvpForm.querySelectorAll('.next-btn');
    const resubmissionOverlay = document.getElementById('resubmissionOverlay');
    const editRsvpBtn = document.getElementById('editRsvpBtn');
    const keepRsvpBtn = document.getElementById('keepRsvpBtn');
    
    let previousSubmissionData = null;
    let isEditingExistingRSVP = false;

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
    
    // --- Message Translation Helper ---
    function translateMessage(message) {
        if (!message) return message;
        
        // Translation mappings for server messages
        const translations = {
            'Sorry, this name is not on our guest list.': 'Entschuldigung, dieser Name steht nicht auf unserer Gästeliste.',
            'Thank you! Your RSVP has been submitted successfully.': 'Vielen Dank! Ihr RSVP wurde erfolgreich übermittelt.',
        };
        
        // Handle dynamic messages with patterns
        if (message.includes('Changes can only be made by the main contact:')) {
            // Extract the name from the message
            const nameMatch = message.match(/Changes can only be made by the main contact: ([^.]+)\./);
            if (nameMatch) {
                const contactName = nameMatch[1];
                return `Änderungen können nur vom Hauptkontakt vorgenommen werden: ${contactName}. Bitte kontaktieren Sie diese Person, um Änderungen an Ihrem RSVP vorzunehmen.`;
            }
        }
        
        // Direct translation lookup
        return translations[message] || message;
    }
    // --- Guest Management ---
    let guestCount = 0;
    let maxAllowedGuests = 0; // This will be set dynamically
    const addGuestBtn = document.getElementById('add-guest-btn');
    const guestListContainer = document.getElementById('guest-list');

    function createGuestEntry(firstName = '', lastName = '') {
        console.log('createGuestEntry called with:', firstName, lastName, 'guestCount:', guestCount, 'maxAllowedGuests:', maxAllowedGuests); // Debug log
        if (guestCount >= maxAllowedGuests) {
            console.log('Cannot add guest: limit reached'); // Debug log
            return;
        }
        guestCount++;

        const guestEntry = document.createElement('div');
        guestEntry.classList.add('guest-entry');
        guestEntry.innerHTML = `
            <button type="button" class="remove-guest-btn" title="Gast entfernen">&times;</button>
            <label>Gastname <em>(erforderlich)</em></label>
            <div class="name-fields">
                <input type="text" name="guest-first-name-${guestCount}" placeholder="Vorname" value="${firstName}" required>
                <input type="text" name="guest-last-name-${guestCount}" placeholder="Nachname" value="${lastName}" required>
            </div>
        `;
        guestListContainer.appendChild(guestEntry);
        console.log('Guest entry created and added to DOM'); // Debug log

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

    // --- Resubmission Overlay Logic ---
    function showResubmissionOverlay() {
        resubmissionOverlay.classList.add('visible');
    }

    function hideResubmissionOverlay() {
        resubmissionOverlay.classList.remove('visible');
    }

    function showSuccessMessage() {
        const formMessage = document.getElementById('form-message');
        formMessage.textContent = 'Vielen Dank! Ihr RSVP wurde erfolgreich übermittelt.';
        formMessage.className = 'form-message success';
        steps.forEach(step => step.style.display = 'none');
        document.getElementById('submit-button').style.display = 'none';
    }

    async function loadPreviousSubmission(submissionData) {
        // Load main form data
        document.getElementById('first-name').value = submissionData.first_name || '';
        document.getElementById('last-name').value = submissionData.last_name || '';
        document.getElementById('email').value = submissionData.email || '';
        
        if (submissionData.attending !== null) {
            const attendingValue = submissionData.attending ? 'yes' : 'no';
            const attendingRadio = document.querySelector(`input[name="attending"][value="${attendingValue}"]`);
            if (attendingRadio) attendingRadio.checked = true;
        }
        
        document.getElementById('food-restrictions').value = submissionData.food_restrictions || '';
        document.getElementById('song').value = submissionData.song_request || '';
        document.getElementById('accommodation').value = submissionData.accommodation || '';
        
        // Format the arrival date properly for HTML date input (YYYY-MM-DD format)
        if (submissionData.arrival_date) {
            const arrivalDate = new Date(submissionData.arrival_date);
            if (!isNaN(arrivalDate.getTime())) {
                // Format as YYYY-MM-DD
                const formattedDate = arrivalDate.toISOString().split('T')[0];
                document.getElementById('arrival-date').value = formattedDate;
            }
        } else {
            document.getElementById('arrival-date').value = '';
        }
        
        document.getElementById('comment').value = submissionData.comment || '';

        // Load previous guests (including potential partners)
        try {
            const guestsResponse = await fetch(`/api/previous-guests?rsvpId=${submissionData.id}`);
            if (guestsResponse.ok) {
                const guestsData = await guestsResponse.json();
                
                // Clear any existing guests
                guestListContainer.innerHTML = '';
                guestCount = 0;
                
                // Check if this person has a partner by looking at the guests
                // If the first guest is a known partner (from couples table), allow 1 additional guest
                // If no partner, allow only 1 guest total
                const hasPartner = guestsData.guests.length > 0;
                
                // Try to determine if first guest is a partner by checking if they're a known couple
                if (hasPartner) {
                    // Check if first guest is a registered partner
                    const firstGuest = guestsData.guests[0];
                    try {
                        const partnerCheckResponse = await fetch(`/api/partner?firstName=${encodeURIComponent(submissionData.first_name)}&lastName=${encodeURIComponent(submissionData.last_name)}`);
                        if (partnerCheckResponse.ok) {
                            const partnerData = await partnerCheckResponse.json();
                            const isFirstGuestPartner = partnerData.firstName.toLowerCase() === firstGuest.first_name.toLowerCase() && 
                                                      partnerData.lastName.toLowerCase() === firstGuest.last_name.toLowerCase();
                            
                            if (isFirstGuestPartner) {
                                // Has registered partner - can have 1 additional guest (total 2: partner + 1 guest)
                                maxAllowedGuests = 2;
                            } else {
                                // First guest is not a registered partner - only 1 guest allowed
                                maxAllowedGuests = 1;
                            }
                        } else {
                            // No registered partner found - only 1 guest allowed
                            maxAllowedGuests = 1;
                        }
                    } catch (error) {
                        // Error checking partner - default to 1 guest
                        maxAllowedGuests = 1;
                    }
                } else {
                    // No guests at all - allow 1 guest
                    maxAllowedGuests = 1;
                }
                
                // Add all guests returned by the API (includes both regular guests and partners)
                guestsData.guests.forEach(guest => {
                    createGuestEntry(guest.first_name, guest.last_name);
                });
                
                // Update the add guest button visibility
                updateAddGuestButton();
            }
        } catch (error) {
            console.error('Error loading previous guests:', error);
            // Set default to 1 guest on error (conservative approach)
            maxAllowedGuests = 1;
        }
    }

    editRsvpBtn.addEventListener('click', async () => {
        hideResubmissionOverlay();
        isEditingExistingRSVP = true; // Flag to prevent re-check
        
        if (previousSubmissionData) {
            await loadPreviousSubmission(previousSubmissionData);
            
            // Keep step 1 visible but make the name fields read-only and move to step 2
            const step1 = document.getElementById('step-1');
            const step2 = document.getElementById('step-2');
            const firstNextBtn = step1.querySelector('.next-btn');
            const firstNameInput = document.getElementById('first-name');
            const lastNameInput = document.getElementById('last-name');
            
            // Make name fields read-only and style them differently
            firstNameInput.readOnly = true;
            lastNameInput.readOnly = true;
            firstNameInput.style.backgroundColor = '#f0f0f0';
            lastNameInput.style.backgroundColor = '#f0f0f0';
            firstNameInput.style.color = '#666';
            lastNameInput.style.color = '#666';
            
            // Hide the next button in step 1 and show step 2
            firstNextBtn.style.display = 'none';
            step2.classList.add('visible');
        }
    });

    keepRsvpBtn.addEventListener('click', () => {
        hideResubmissionOverlay();
        showSuccessMessage();
    });

    // --- Prevent Enter key from submitting form in early steps ---
    rsvpForm.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const currentStep = rsvpForm.querySelector('.form-step.visible');
            const isLastStep = currentStep && currentStep.id === 'step-3';
            
            if (!isLastStep) {
                event.preventDefault();
                // Trigger the next button click instead
                const nextBtn = currentStep.querySelector('.next-btn');
                if (nextBtn) {
                    nextBtn.click();
                }
            }
        }
    });

    // --- Step Navigation ---
    nextBtns.forEach((button, index) => {
        button.addEventListener('click', async () => {
            const currentStepElement = button.closest('.form-step');
            const nextStepElement = currentStepElement.nextElementSibling;

            // Validate current step before proceeding
            const currentFields = currentStepElement.querySelectorAll('[required]');
            const isValid = Array.from(currentFields).every(field => field.value.trim() !== '');
            if (!isValid) {
                alert('Bitte füllen Sie alle erforderlichen Felder aus.');
                return;
            }

            // Logic for Step 1 -> Step 2 (checking invitation and known guests)
            if (index === 0) {
                const firstNameInput = document.getElementById('first-name');
                const lastNameInput = document.getElementById('last-name');
                const nameError = document.getElementById('name-error');

                // Perform validation
                if (!firstNameInput.value.trim() || !lastNameInput.value.trim()) {
                    nameError.textContent = 'Vor- und Nachname sind erforderlich.';
                    return;
                }
                if (!validateName(firstNameInput.value) || !validateName(lastNameInput.value)) {
                    nameError.textContent = 'Namen dürfen nur Buchstaben, Leerzeichen und Bindestriche enthalten.';
                    return;
                }
                nameError.textContent = ''; // Clear error on success

                // Skip API checks if we're editing an existing RSVP
                if (isEditingExistingRSVP) {
                    // Move to next step directly
                    if (nextStepElement) {
                        button.style.display = 'none';
                        nextStepElement.classList.add('visible');
                    }
                    return;
                }

                // Clear any previously added guests before checking again
                guestListContainer.innerHTML = '';
                guestCount = 0;

                try {
                    // Step 1: Check if person is invited
                    const invitationResponse = await fetch(`/api/check-invitation?firstName=${encodeURIComponent(firstNameInput.value)}&lastName=${encodeURIComponent(lastNameInput.value)}`);
                    
                    if (!invitationResponse.ok) {
                        const invitationError = await invitationResponse.json();
                        nameError.textContent = translateMessage(invitationError.message) || 'Entschuldigung, dieser Name steht nicht auf unserer Gästeliste.';
                        return;
                    }

                    const invitationData = await invitationResponse.json();
                    
                    // Step 2: Check if person has already submitted
                    if (invitationData.hasSubmitted) {
                        // Check if person can edit (is main contact)
                        if (invitationData.canEdit === false) {
                            // Person is not the main contact, show error message
                            nameError.textContent = translateMessage(invitationData.message);
                            nameError.style.color = '#ff0000';
                            return;
                        }
                        
                        // Person can edit, show resubmission overlay
                        previousSubmissionData = invitationData.previousSubmission;
                        showResubmissionOverlay();
                        return; // Stop here, user needs to decide
                    }

                    // Step 3: Person is invited and hasn't submitted yet, check for partner
                    const partnerResponse = await fetch(`/api/partner?firstName=${encodeURIComponent(firstNameInput.value)}&lastName=${encodeURIComponent(lastNameInput.value)}`);
                    
                    console.log('Partner response status:', partnerResponse.status); // Debug log
                    
                    if (partnerResponse.ok) {
                        const partner = await partnerResponse.json();
                        console.log('Partner data received:', partner); // Debug log
                        // For known couples, set guest limit first, then pre-fill their partner
                        maxAllowedGuests = 2; // Partner + 1 additional guest
                        createGuestEntry(partner.firstName, partner.lastName);
                        console.log('Partner added, maxAllowedGuests set to:', maxAllowedGuests); // Debug log
                    } else {
                        console.log('No partner found, setting maxAllowedGuests to 1'); // Debug log
                        // For people without registered partner, allow only 1 guest
                        maxAllowedGuests = 1;
                    }
                } catch (error) {
                    console.error('Error checking invitation or partner:', error);
                    nameError.textContent = 'Ein Fehler ist beim Validieren Ihrer Einladung aufgetreten. Bitte versuchen Sie es erneut.';
                    return;
                }
            }

            // Logic for Step 2 -> Step 3 (validate guests)
            if (index === 1) {
                const firstName = document.getElementById('first-name').value;
                const lastName = document.getElementById('last-name').value;
                const guestEntries = document.querySelectorAll('.guest-entry');
                const formMessage = document.getElementById('form-message');

                // Clear any previous messages
                formMessage.textContent = '';
                formMessage.className = 'form-message';

                // Collect guest data
                const guests = [];
                guestEntries.forEach(entry => {
                    const guestFirstName = entry.querySelector('input[name^="guest-first-name"]').value;
                    const guestLastName = entry.querySelector('input[name^="guest-last-name"]').value;
                    if (guestFirstName.trim() && guestLastName.trim()) {
                        guests.push({ firstName: guestFirstName, lastName: guestLastName });
                    }
                });

                // Validate guest data with backend
                try {
                    const response = await fetch('/api/validate-guests', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            primaryGuest: { firstName, lastName },
                            guests
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        formMessage.textContent = translateMessage(errorData.message) || 'Fehler bei der Gast-Validierung.';
                        formMessage.className = 'form-message error';
                        return; // Stop here if validation fails
                    }
                } catch (error) {
                    console.error('Error validating guests:', error);
                    formMessage.textContent = 'Ein Fehler ist bei der Gast-Validierung aufgetreten. Bitte versuchen Sie es erneut.';
                    formMessage.className = 'form-message error';
                    return;
                }
            }

            // Move to next step
            if (nextStepElement) {
                button.style.display = 'none';
                nextStepElement.classList.add('visible');
            }
        });
    });

    // --- Real-time Email Validation ---
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            if (emailInput.value.trim() === '') {
                emailError.textContent = '';
                return;
            }
            
            if (!validateEmail(emailInput.value)) {
                emailError.textContent = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
                emailError.style.color = '#ff0000';
            } else {
                emailError.textContent = '';
            }
        });

        emailInput.addEventListener('input', () => {
            if (emailError.textContent && validateEmail(emailInput.value)) {
                emailError.textContent = '';
            }
        });
    }

    // --- Final Form Submission ---
    if (rsvpForm) {
        rsvpForm.addEventListener('submit', async (event) => {
            console.log('Form submit event triggered'); // Debug log
            
            const submitButton = document.getElementById('submit-button');
            const formMessage = document.getElementById('form-message');

            event.preventDefault();

            // --- Final Validation ---
            const emailInput = document.getElementById('email');
            const emailError = document.getElementById('email-error');
            const isAttending = rsvpForm.querySelector('input[name="attending"]:checked');
            let hasValidationErrors = false;

            // Email validation
            if (!emailInput.value.trim()) {
                emailError.textContent = 'E-Mail-Adresse ist erforderlich.';
                emailError.style.color = '#ff0000';
                hasValidationErrors = true;
            } else if (!validateEmail(emailInput.value)) {
                emailError.textContent = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
                emailError.style.color = '#ff0000';
                hasValidationErrors = true;
            } else {
                emailError.textContent = '';
            }

            // Attending validation
            if (!isAttending) {
                formMessage.textContent = 'Bitte wählen Sie aus, ob Sie teilnehmen werden.';
                formMessage.className = 'form-message error';
                hasValidationErrors = true;
            }

            // Guest name validation
            const guestEntries = document.querySelectorAll('.guest-entry');
            let hasGuestErrors = false;
            guestEntries.forEach(entry => {
                const firstNameInput = entry.querySelector('input[name^="guest-first-name"]');
                const lastNameInput = entry.querySelector('input[name^="guest-last-name"]');
                
                if (!firstNameInput.value.trim() || !lastNameInput.value.trim()) {
                    hasGuestErrors = true;
                } else if (!validateName(firstNameInput.value) || !validateName(lastNameInput.value)) {
                    hasGuestErrors = true;
                }
            });

            if (hasGuestErrors) {
                formMessage.textContent = 'Bitte füllen Sie alle Gastnamen korrekt aus (nur Buchstaben, Leerzeichen und Bindestriche sind erlaubt).';
                formMessage.className = 'form-message error';
                hasValidationErrors = true;
            }

            if (hasValidationErrors) {
                console.log('Validation errors found, stopping submission'); // Debug log
                return;
            }

            console.log('Validation passed, proceeding with submission'); // Debug log

            // Clear any previous error messages
            formMessage.textContent = '';
            formMessage.className = 'form-message';
            
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

            console.log('RSVP Data to submit:', rsvpData); // Debug log

            // Disable button and clear previous messages
            submitButton.disabled = true;
            submitButton.textContent = 'SENDEN...';
            formMessage.className = 'form-message'; // Reset the message

            try {
                // The backend endpoint URL
                const endpoint = '/api/rsvp';
                console.log('Sending request to:', endpoint); // Debug log

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rsvpData)
                });

                console.log('Response received:', response.status, response.statusText); // Debug log
                const responseData = await response.json();
                console.log('Response data:', responseData); // Debug log

                if (!response.ok) {
                    // Use the server's message, or a default for other errors
                    throw new Error(responseData.message || `Server responded with status: ${response.status}`);
                }

                // --- Success Path ---
                formMessage.textContent = translateMessage(responseData.message) || 'Vielen Dank! Ihr RSVP wurde erfolgreich übermittelt.';
                formMessage.classList.add('success');
                steps.forEach(step => step.style.display = 'none');
                submitButton.style.display = 'none';
            } catch (error) {
                // --- Error Path ---
                console.error('Submission Error:', error.message);
                formMessage.textContent = translateMessage(error.message);
                formMessage.classList.add('error');
            } finally {
                // This runs after success or error to re-enable the button if it's still visible.
                if (submitButton.style.display !== 'none') {
                    submitButton.disabled = false;
                    submitButton.textContent = 'SENDEN';
                }
            }
        });
    }

    // Alternative: Direct button click handler as backup
    const submitButton = document.getElementById('submit-button');
    if (submitButton) {
        submitButton.addEventListener('click', (event) => {
            console.log('Submit button clicked directly'); // Debug log
            // Let the form submit event handle this
            if (rsvpForm) {
                event.preventDefault();
                rsvpForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        });
    }

    function updateHamburgerColor() {
        const scrollY = window.scrollY;
        const homeSection = document.getElementById('home');
        const eventSection = document.getElementById('event');
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

        if (inSection(homeSection) || inSection(eventSection) || inSection(locationSection) || inSection(dresscodeSection) || inSection(faqSection) || inSection(rsvpSection)) {
            hamburgerBtn.classList.add('black-bg');
        } else {
            hamburgerBtn.classList.remove('black-bg');
        }
    }

    window.addEventListener('scroll', updateHamburgerColor);
    window.addEventListener('resize', updateHamburgerColor);
    updateHamburgerColor();

    // --- Sticky Banner ab der Event-Sektion ---
(function () {
  const eventSection = document.getElementById('event');
  const banner = eventSection ? eventSection.querySelector('.banner') : null;
  if (!eventSection || !banner) return;

  function updateBanner() {
    const eventTop = eventSection.offsetTop;
    const shouldFix = window.scrollY >= eventTop;

    if (shouldFix) {
      if (!banner.classList.contains('is-fixed')) {
        banner.classList.add('is-fixed');
      }
      // Platz für das fixierte Banner reservieren (dynamisch gemessen)
      const h = banner.offsetHeight;
      document.documentElement.style.setProperty('--banner-h', h + 'px');
      eventSection.classList.add('banner-active');
    } else {
      banner.classList.remove('is-fixed');
      document.documentElement.style.setProperty('--banner-h', '0px');
      eventSection.classList.remove('banner-active');
    }
  }

  ['scroll', 'resize', 'load'].forEach(ev =>
    window.addEventListener(ev, updateBanner, { passive: true })
  );
  updateBanner();
})();

// --- Sticky Banner für Gallery-Seite ---
(function () {
  const galleryHeaderRow = document.querySelector('.gallery-header-row');
  const banner = galleryHeaderRow ? galleryHeaderRow.querySelector('.banner') : null;
  if (!galleryHeaderRow || !banner) return;

  function updateBanner() {
    const shouldFix = window.scrollY >= 50; // Fixed threshold for gallery

    if (shouldFix) {
      if (!banner.classList.contains('is-fixed')) {
        banner.classList.add('is-fixed');
      }
      // Reserve space for the fixed banner
      const h = banner.offsetHeight;
      document.documentElement.style.setProperty('--banner-h', h + 'px');
      document.body.style.paddingTop = `${h}px`;
    } else {
      banner.classList.remove('is-fixed');
      document.documentElement.style.setProperty('--banner-h', '0px');
      document.body.style.paddingTop = '0';
    }
  }

  ['scroll', 'resize', 'load'].forEach(ev =>
    window.addEventListener(ev, updateBanner, { passive: true })
  );
  updateBanner();
})();

// --- Add to Calendar Functionality ---
const calendarButtons = document.querySelectorAll('.add-to-calendar-btn');

// Event data - adjust dates and times as needed
const eventData = {
    'welcome-dinner': {
        title: 'Welcome Dinner - Nadja & Niko Wedding',
        startDate: '2025-12-30T19:00:00', // Adjust to actual date/time
        endDate: '2025-12-30T22:00:00',
        location: 'Villa Baan Asan, Koh Samui, Thailand',
        description: 'Welcome dinner for Nadja & Niko\'s wedding celebration. Join us for an evening of good food and great company as we kick off our wedding festivities.'
    },
    'wedding-ceremony': {
        title: 'Wedding Ceremony & Reception - Nadja & Niko',
        startDate: '2025-12-31T16:00:00', // Adjust to actual date/time
        endDate: '2025-12-31T23:00:00',
        location: 'Villa Baan Asan, Koh Samui, Thailand',
        description: 'The wedding ceremony and reception of Nadja & Niko. Witness their vows and celebrate their love with dancing, dining, and unforgettable memories.'
    }
};

calendarButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const eventType = e.currentTarget.getAttribute('data-event');
        const event = eventData[eventType];
        
        if (event) {
            downloadCalendarEvent(event);
        }
    });
});

function downloadCalendarEvent(event) {
    // Format dates for ICS format (YYYYMMDDTHHMMSSZ)
    const formatDateForICS = (dateString) => {
        return new Date(dateString).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const startDate = formatDateForICS(event.startDate);
    const endDate = formatDateForICS(event.endDate);
    const now = formatDateForICS(new Date().toISOString());
    
    // Create ICS file content
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nadja & Niko Wedding//Calendar//EN
BEGIN:VEVENT
UID:${Date.now()}@thebjelics-wedding.com
DTSTAMP:${now}
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${event.title}
DESCRIPTION:${event.description}
LOCATION:${event.location}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
    
    // Create and download the file
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    window.URL.revokeObjectURL(link.href);
}

});