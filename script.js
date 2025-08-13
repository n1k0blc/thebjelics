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

    // --- Resubmission Overlay Logic ---
    function showResubmissionOverlay() {
        resubmissionOverlay.classList.add('visible');
    }

    function hideResubmissionOverlay() {
        resubmissionOverlay.classList.remove('visible');
    }

    function showSuccessMessage() {
        const formMessage = document.getElementById('form-message');
        formMessage.textContent = 'Thank you! Your RSVP has been submitted successfully.';
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
        document.getElementById('arrival-date').value = submissionData.arrival_date || '';
        document.getElementById('comment').value = submissionData.comment || '';

        // Load previous guests and check for partner suggestions
        try {
            const guestsResponse = await fetch(`http://localhost:3000/api/previous-guests?rsvpId=${submissionData.id}`);
            if (guestsResponse.ok) {
                const guestsData = await guestsResponse.json();
                
                // Clear any existing guests
                guestListContainer.innerHTML = '';
                guestCount = 0;
                
                // Everyone gets maximum 2 guests
                maxAllowedGuests = 2;
                
                // Check for partner suggestions (even when editing)
                try {
                    const partnerResponse = await fetch(`http://localhost:3000/api/partner?firstName=${encodeURIComponent(submissionData.first_name)}&lastName=${encodeURIComponent(submissionData.last_name)}`);
                    
                    if (partnerResponse.ok) {
                        const partner = await partnerResponse.json();
                        
                        // Check if partner is already in previous guests
                        const hasPartner = guestsData.guests.some(guest => 
                            guest.first_name.toLowerCase() === partner.firstName.toLowerCase() && 
                            guest.last_name.toLowerCase() === partner.lastName.toLowerCase()
                        );
                        
                        if (!hasPartner) {
                            // Add partner suggestion first
                            createGuestEntry(partner.firstName, partner.lastName);
                        }
                    }
                } catch (error) {
                    console.error('Error checking for partner:', error);
                }
                
                // Add all previous guests
                guestsData.guests.forEach(guest => {
                    createGuestEntry(guest.first_name, guest.last_name);
                });
                
                // Update the add guest button visibility
                updateAddGuestButton();
            }
        } catch (error) {
            console.error('Error loading previous guests:', error);
            // Set default even on error
            maxAllowedGuests = 2;
        }
    }

    editRsvpBtn.addEventListener('click', async () => {
        hideResubmissionOverlay();
        isEditingExistingRSVP = true; // Flag to prevent re-check
        
        if (previousSubmissionData) {
            await loadPreviousSubmission(previousSubmissionData);
            
            // Move directly to step 2 (guest step)
            const step1 = document.getElementById('step-1');
            const step2 = document.getElementById('step-2');
            const firstNextBtn = step1.querySelector('.next-btn');
            
            // Hide step 1 and show step 2
            step1.classList.remove('visible');
            firstNextBtn.style.display = 'none';
            step2.classList.add('visible');
        }
    });

    keepRsvpBtn.addEventListener('click', () => {
        hideResubmissionOverlay();
        showSuccessMessage();
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
                alert('Please fill out all required fields.');
                return;
            }

            // Logic for Step 1 -> Step 2 (checking invitation and known guests)
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
                    const invitationResponse = await fetch(`http://localhost:3000/api/check-invitation?firstName=${encodeURIComponent(firstNameInput.value)}&lastName=${encodeURIComponent(lastNameInput.value)}`);
                    
                    if (!invitationResponse.ok) {
                        const invitationError = await invitationResponse.json();
                        nameError.textContent = invitationError.message || 'Sorry, this name is not on our guest list.';
                        return;
                    }

                    const invitationData = await invitationResponse.json();
                    
                    // Step 2: Check if person has already submitted
                    if (invitationData.hasSubmitted) {
                        previousSubmissionData = invitationData.previousSubmission;
                        showResubmissionOverlay();
                        return; // Stop here, user needs to decide
                    }

                    // Step 3: Person is invited and hasn't submitted yet, check for partner
                    const partnerResponse = await fetch(`http://localhost:3000/api/partner?firstName=${encodeURIComponent(firstNameInput.value)}&lastName=${encodeURIComponent(lastNameInput.value)}`);
                    
                    // Everyone gets maximum 2 guests
                    maxAllowedGuests = 2;
                    
                    if (partnerResponse.ok) {
                        const partner = await partnerResponse.json();
                        // For known couples, pre-fill their partner
                        createGuestEntry(partner.firstName, partner.lastName);
                    }
                    // For people without partner suggestions, they can still add 2 guests manually
                } catch (error) {
                    console.error('Error checking invitation or partner:', error);
                    nameError.textContent = 'An error occurred while validating your invitation. Please try again.';
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
                emailError.textContent = 'Please enter a valid email address.';
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
                emailError.textContent = 'Email address is required.';
                emailError.style.color = '#ff0000';
                hasValidationErrors = true;
            } else if (!validateEmail(emailInput.value)) {
                emailError.textContent = 'Please enter a valid email address.';
                emailError.style.color = '#ff0000';
                hasValidationErrors = true;
            } else {
                emailError.textContent = '';
            }

            // Attending validation
            if (!isAttending) {
                formMessage.textContent = 'Please select whether you will be attending.';
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
                formMessage.textContent = 'Please fill out all guest names correctly (letters, spaces, and hyphens only).';
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
            submitButton.textContent = 'SENDING...';
            formMessage.className = 'form-message'; // Reset the message

            try {
                // The backend endpoint URL
                const endpoint = 'http://localhost:3000/api/rsvp';
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
                formMessage.textContent = responseData.message;
                formMessage.classList.add('success');
                steps.forEach(step => step.style.display = 'none');
                submitButton.style.display = 'none';
            } catch (error) {
                // --- Error Path ---
                console.error('Submission Error:', error.message);
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
});