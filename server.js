// Load environment variables from .env file
require('dotenv').config();

console.log('--- Loading server.js with /api/partner route ---');

const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
// Serve static files (HTML, CSS, JS, images)
app.use(express.static(__dirname));

// Manually handle CORS to ensure preflight requests are handled correctly.
app.use((req, res, next) => {
  // Allow requests from any origin. For production, you should restrict this to your frontend's domain.
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Allow the necessary methods for your application.
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // Allow the 'Content-Type' header, which is sent with your fetch request.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Intercept the preflight OPTIONS request and send a 200 OK response.
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Parse incoming JSON requests
app.use(express.json());

// --- PostgreSQL Connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Unix sockets don't use SSL
});

// Add a simple "ping" route for health checks
app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});

// Debug route to check database tables and data
app.get('/api/debug', async (req, res) => {
  try {
    // Check if tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    const { rows: tables } = await pool.query(tablesQuery);
    
    // Get table structure for rsvps
    const rsvpsStructureQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'rsvps' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    const { rows: rsvpsStructure } = await pool.query(rsvpsStructureQuery);
    
    // Get couples data
    const couplesQuery = `SELECT * FROM couples LIMIT 5;`;
    const { rows: couples } = await pool.query(couplesQuery);
    
    // Get rsvps data  
    const rsvpsQuery = `SELECT * FROM rsvps LIMIT 5;`;
    const { rows: rsvps } = await pool.query(rsvpsQuery);
    
    res.json({
      tables: tables.map(t => t.table_name),
      rsvpsStructure: rsvpsStructure,
      couples: couples,
      rsvps: rsvps
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- API Route to check if someone is invited ---
app.get('/api/check-invitation', async (req, res) => {
  const { firstName, lastName } = req.query;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required.' });
  }

  const normalizedFirstName = firstName.trim().toLowerCase();
  const normalizedLastName = lastName.trim().toLowerCase();

  const query = `
    SELECT id, first_name, last_name, email, attending, food_restrictions, song_request, 
           accommodation, arrival_date, comment, submission_timestamp, is_main_contact, group_id
    FROM rsvps
    WHERE LOWER(first_name) = $1 AND LOWER(last_name) = $2;
  `;

  try {
    const { rows } = await pool.query(query, [normalizedFirstName, normalizedLastName]);
    
    if (rows.length > 0) {
      const person = rows[0];
      const hasSubmitted = person.submission_timestamp !== null;
      
      // Check if this person is trying to edit but is not the main contact
      if (hasSubmitted && !person.is_main_contact) {
        // Find the main contact of this group
        const mainContactQuery = `
          SELECT first_name, last_name FROM rsvps 
          WHERE group_id = $1 AND is_main_contact = true 
          LIMIT 1
        `;
        const mainContactResult = await pool.query(mainContactQuery, [person.group_id]);
        
        if (mainContactResult.rows.length > 0) {
          const mainContact = mainContactResult.rows[0];
          return res.status(403).json({ 
            invited: true,
            hasSubmitted: true,
            canEdit: false,
            message: `Changes can only be made by the main contact: ${mainContact.first_name} ${mainContact.last_name}. Please contact them to make any modifications to your RSVP.`
          });
        }
      }
      
      return res.json({ 
        invited: true, 
        person: person,
        hasSubmitted: hasSubmitted,
        canEdit: true,
        previousSubmission: hasSubmitted ? person : null
      });
    }
    return res.status(404).json({ invited: false, message: 'Sorry, this name is not on our guest list.' });
  } catch (error) {
    console.error('Error checking invitation:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// --- API Route to get previous guests for an RSVP ---
app.get('/api/previous-guests', async (req, res) => {
  const { rsvpId } = req.query;

  if (!rsvpId) {
    return res.status(400).json({ error: 'RSVP ID is required.' });
  }

  try {
    // First, get the group_id and main contact info of the main RSVP
    const mainRsvpQuery = `
      SELECT group_id, first_name, last_name FROM rsvps WHERE id = $1;
    `;
    const mainRsvpResult = await pool.query(mainRsvpQuery, [rsvpId]);
    
    if (mainRsvpResult.rows.length === 0) {
      return res.status(404).json({ error: 'RSVP not found.' });
    }

    const { group_id: groupId, first_name: mainFirstName, last_name: mainLastName } = mainRsvpResult.rows[0];
    const guests = [];

    // Get all guests (non-main contacts) in the same group
    const guestsQuery = `
      SELECT first_name, last_name
      FROM rsvps
      WHERE group_id = $1 AND is_main_contact = false
      ORDER BY id;
    `;
    
    const guestsResult = await pool.query(guestsQuery, [groupId]);
    guests.push(...guestsResult.rows);

    // Additionally, check if the main contact has a known partner who should be displayed as a guest
    // This handles the case where the partner exists as a separate main contact
    const partnerQuery = `
      SELECT person1_first_name, person1_last_name, person2_first_name, person2_last_name
      FROM couples
      WHERE (LOWER(person1_first_name) = LOWER($1) AND LOWER(person1_last_name) = LOWER($2))
         OR (LOWER(person2_first_name) = LOWER($1) AND LOWER(person2_last_name) = LOWER($2));
    `;
    
    const partnerResult = await pool.query(partnerQuery, [mainFirstName, mainLastName]);
    
    if (partnerResult.rows.length > 0) {
      const couple = partnerResult.rows[0];
      let partnerName;

      if (mainFirstName.toLowerCase() === couple.person1_first_name.toLowerCase() && 
          mainLastName.toLowerCase() === couple.person1_last_name.toLowerCase()) {
        partnerName = { first_name: couple.person2_first_name, last_name: couple.person2_last_name };
      } else {
        partnerName = { first_name: couple.person1_first_name, last_name: couple.person1_last_name };
      }

      // Check if partner is already in the guests list
      const hasPartner = guests.some(guest => 
        guest.first_name.toLowerCase() === partnerName.first_name.toLowerCase() && 
        guest.last_name.toLowerCase() === partnerName.last_name.toLowerCase()
      );

      // If partner is not already in guests, add them
      if (!hasPartner) {
        guests.push(partnerName);
      }
    }
    
    return res.json({ guests });
  } catch (error) {
    console.error('Error fetching previous guests:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// --- API Route to find a known partner ---
app.get('/api/partner', async (req, res) => {
  const { firstName, lastName } = req.query;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required.' });
  }

  const normalizedFirstName = firstName.trim().toLowerCase();
  const normalizedLastName = lastName.trim().toLowerCase();

  const query = `
    SELECT person1_first_name, person1_last_name, person2_first_name, person2_last_name
    FROM couples
    WHERE (LOWER(person1_first_name) = $1 AND LOWER(person1_last_name) = $2)
       OR (LOWER(person2_first_name) = $1 AND LOWER(person2_last_name) = $2);
  `;

  try {
    const { rows } = await pool.query(query, [normalizedFirstName, normalizedLastName]);
    
    if (rows.length > 0) {
      const couple = rows[0];
      let partner;

      if (normalizedFirstName === couple.person1_first_name.toLowerCase() && normalizedLastName === couple.person1_last_name.toLowerCase()) {
        partner = { firstName: couple.person2_first_name, lastName: couple.person2_last_name };
      } else {
        partner = { firstName: couple.person1_first_name, lastName: couple.person1_last_name };
      }
      return res.json(partner);
    }
    return res.status(404).json({ message: 'No partner found.' });
  } catch (error) {
    console.error('Error fetching partner:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// --- Guest Validation Endpoint (for Step 2 -> Step 3 validation) ---
app.post('/api/validate-guests', async (req, res) => {
  const { primaryGuest, guests } = req.body;
  
  if (!primaryGuest || !primaryGuest.firstName || !primaryGuest.lastName) {
    return res.status(400).json({ message: 'Primärer Gast ist erforderlich.' });
  }

  let client;

  try {
    client = await pool.connect();

    console.log('Guest validation request:', { primaryGuest, guests }); // Debug log

    // Check if this person has a known partner (from couples table)
    const partnerQuery = `
      SELECT person1_first_name, person1_last_name, person2_first_name, person2_last_name
      FROM couples
      WHERE (LOWER(person1_first_name) = LOWER($1) AND LOWER(person1_last_name) = LOWER($2))
         OR (LOWER(person2_first_name) = LOWER($1) AND LOWER(person2_last_name) = LOWER($2));
    `;
    const partnerResult = await client.query(partnerQuery, [primaryGuest.firstName, primaryGuest.lastName]);
    const hasKnownPartner = partnerResult.rows.length > 0;

    console.log('Has known partner:', hasKnownPartner); // Debug log

    // Determine guest limits
    const maxGuestsAllowed = hasKnownPartner ? 2 : 1;
    const guestsList = guests || [];
    
    console.log('Max guests allowed:', maxGuestsAllowed, 'Actual guests:', guestsList.length); // Debug log
    
    // Check guest count
    if (guestsList.length > maxGuestsAllowed) {
      return res.status(400).json({ 
        message: hasKnownPartner 
          ? `Du kannst maximal ${maxGuestsAllowed} Gäste hinzufügen (deinen Partner und einen weiteren Gast).`
          : `Du kannst maximal ${maxGuestsAllowed} Gast hinzufügen.`
      });
    }

    // Validate all guests are on the invitation list (only for people with known partners)
    if (hasKnownPartner && guestsList.length > 0) {
      // For people with known partners, we need to check which guests are additional (not the partner)
      let partnerName = null;
      if (partnerResult.rows.length > 0) {
        const couple = partnerResult.rows[0];
        if (primaryGuest.firstName.toLowerCase() === couple.person1_first_name.toLowerCase() && 
            primaryGuest.lastName.toLowerCase() === couple.person1_last_name.toLowerCase()) {
          partnerName = { 
            firstName: couple.person2_first_name, 
            lastName: couple.person2_last_name 
          };
        } else {
          partnerName = { 
            firstName: couple.person1_first_name, 
            lastName: couple.person1_last_name 
          };
        }
      }

      // Filter out the known partner from guests list for validation
      const additionalGuests = guestsList.filter(guest => {
        if (partnerName) {
          return !(guest.firstName.toLowerCase() === partnerName.firstName.toLowerCase() && 
                   guest.lastName.toLowerCase() === partnerName.lastName.toLowerCase());
        }
        return true;
      });

      console.log('Additional guests to validate (excluding partner):', additionalGuests); // Debug log

      // Only validate additional guests (beyond partner) - they must be invited
      for (const guest of additionalGuests) {
        console.log('Validating additional guest:', guest.firstName, guest.lastName); // Debug log

        const invitedGuestQuery = `
          SELECT id FROM rsvps 
          WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
          LIMIT 1
        `;
        const invitedGuestResult = await client.query(invitedGuestQuery, [guest.firstName, guest.lastName]);
        
        console.log('Additional guest validation result for', guest.firstName, guest.lastName, ':', invitedGuestResult.rows.length); // Debug log
        
        if (invitedGuestResult.rows.length === 0) {
          // Guest is not invited - return error
          return res.status(400).json({ 
            message: `${guest.firstName} ${guest.lastName} ist nicht auf der Gästeliste und kann daher nicht hinzugefügt werden. Nur eingeladene Personen können als zusätzliche Gäste eingetragen werden.`
          });
        }
      }
    }

    // For people without known partners: No validation needed - they can add anyone
    console.log('Guest validation logic completed. HasKnownPartner:', hasKnownPartner); // Debug log

    // Check for duplicate guests
    if (guestsList.length > 1) {
      const guestNames = guestsList.map(g => `${g.firstName.toLowerCase()}_${g.lastName.toLowerCase()}`);
      const uniqueNames = [...new Set(guestNames)];
      if (guestNames.length !== uniqueNames.length) {
        return res.status(400).json({ 
          message: 'Doppelte Gäste sind nicht erlaubt. Bitte entferne duplizierte Namen.'
        });
      }
    }

    // Check if any guest has already submitted an RSVP
    for (const guest of guestsList) {
      console.log('Checking if guest has already submitted RSVP:', guest.firstName, guest.lastName); // Debug log

      const submittedGuestQuery = `
        SELECT id, first_name, last_name, group_id FROM rsvps 
        WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
        AND submission_timestamp IS NOT NULL
        LIMIT 1
      `;
      const submittedGuestResult = await client.query(submittedGuestQuery, [guest.firstName, guest.lastName]);
      
      if (submittedGuestResult.rows.length > 0) {
        const submittedGuest = submittedGuestResult.rows[0];
        
        // Check if this guest belongs to the same group as the primary guest (edit mode)
        const primaryGuestQuery = `
          SELECT group_id FROM rsvps 
          WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
          AND submission_timestamp IS NOT NULL
          LIMIT 1
        `;
        const primaryGuestResult = await client.query(primaryGuestQuery, [primaryGuest.firstName, primaryGuest.lastName]);
        
        // If primary guest has a group and submitted guest has same group, it's edit mode - allow it
        if (primaryGuestResult.rows.length > 0 && 
            primaryGuestResult.rows[0].group_id && 
            submittedGuest.group_id === primaryGuestResult.rows[0].group_id) {
          console.log('Guest belongs to same group - edit mode detected, allowing:', guest.firstName, guest.lastName); // Debug log
          continue; // Skip validation for same-group guests
        }
        
        console.log('Guest has already submitted RSVP:', guest.firstName, guest.lastName); // Debug log
        return res.status(400).json({ 
          message: `${guest.firstName} ${guest.lastName} hat bereits eine eigene RSVP eingereicht und kann daher nicht als Gast hinzugefügt werden.`
        });
      }
    }

    console.log('Guest validation passed'); // Debug log

    // If we reach here, validation passed
    res.status(200).json({ message: 'Gäste-Validierung erfolgreich.' });

  } catch (error) {
    console.error('Error during guest validation:', error);
    res.status(500).json({ message: 'Ein Fehler ist bei der Gast-Validierung aufgetreten.' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// --- API Routes ---
app.post('/api/rsvp', async (req, res) => {
  // Destructure all expected fields from the request body
  const {
    firstName,
    lastName,
    email,
    attending,
    foodRestrictions,
    song,
    accommodation,
    arrivalDate,
    comment,
    guests, // This is the array of guest objects
  } = req.body;

  // Convert "yes" string from form to a boolean for the database
  const isAttending = attending === 'yes';

  let client;

  try {
    // Establish a client from the pool
    client = await pool.connect();

    // Start a database transaction
    await client.query('BEGIN');

    console.log('RSVP submission - Final validation for:', { firstName, lastName, guests }); // Debug log

    // --- FINAL VALIDATION (Security against form manipulation) ---
    
    // 1. Validate name format for main person (no special characters)
    const nameRegex = /^[a-zA-Z\u00C0-\u017F\s'-]+$/;
    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: 'Namen dürfen nur Buchstaben, Leerzeichen und Bindestriche enthalten.'
      });
    }

    // 2. Check if main person is on the guest list
    const mainPersonQuery = `
      SELECT id FROM rsvps 
      WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
      LIMIT 1
    `;
    const mainPersonResult = await client.query(mainPersonQuery, [firstName, lastName]);
    
    if (mainPersonResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: 'Entschuldigung, dieser Name steht nicht auf unserer Gästeliste.'
      });
    }

    // 3. Validate guest names (no special characters)
    if (guests && guests.length > 0) {
      for (const guest of guests) {
        if (!nameRegex.test(guest.firstName) || !nameRegex.test(guest.lastName)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            message: 'Gastnamen dürfen nur Buchstaben, Leerzeichen und Bindestriche enthalten.'
          });
        }
      }
    }

    // 4. Check if this person has a known partner (determines validation rules for guests)
    const partnerQuery = `
      SELECT person1_first_name, person1_last_name, person2_first_name, person2_last_name
      FROM couples
      WHERE (LOWER(person1_first_name) = LOWER($1) AND LOWER(person1_last_name) = LOWER($2))
         OR (LOWER(person2_first_name) = LOWER($1) AND LOWER(person2_last_name) = LOWER($2));
    `;
    const partnerResult = await client.query(partnerQuery, [firstName, lastName]);
    const hasKnownPartner = partnerResult.rows.length > 0;

    console.log('Final validation - Has known partner:', hasKnownPartner); // Debug log

    // 5. Apply guest validation rules based on partner status
    if (hasKnownPartner && guests && guests.length > 0) {
      // For people with known partners: validate that additional guests (beyond partner) are invited
      let partnerName = null;
      if (partnerResult.rows.length > 0) {
        const couple = partnerResult.rows[0];
        if (firstName.toLowerCase() === couple.person1_first_name.toLowerCase() && 
            lastName.toLowerCase() === couple.person1_last_name.toLowerCase()) {
          partnerName = { 
            firstName: couple.person2_first_name, 
            lastName: couple.person2_last_name 
          };
        } else {
          partnerName = { 
            firstName: couple.person1_first_name, 
            lastName: couple.person1_last_name 
          };
        }
      }

      // Filter out the known partner from guests list for validation
      const additionalGuests = guests.filter(guest => {
        if (partnerName) {
          return !(guest.firstName.toLowerCase() === partnerName.firstName.toLowerCase() && 
                   guest.lastName.toLowerCase() === partnerName.lastName.toLowerCase());
        }
        return true;
      });

      console.log('Final validation - Additional guests to validate (excluding partner):', additionalGuests); // Debug log

      // Validate that additional guests (beyond partner) are in the RSVP table
      for (const guest of additionalGuests) {
        const invitedGuestQuery = `
          SELECT id FROM rsvps 
          WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
          LIMIT 1
        `;
        const invitedGuestResult = await client.query(invitedGuestQuery, [guest.firstName, guest.lastName]);
        
        if (invitedGuestResult.rows.length === 0) {
          // Guest is not invited - return error
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            message: `${guest.firstName} ${guest.lastName} ist nicht auf der Gästeliste und kann daher nicht hinzugefügt werden. Nur eingeladene Personen können als zusätzliche Gäste eingetragen werden.`
          });
        }
      }
      
      // For people with partners: also validate that all guests are on the invitation list
      for (const guest of guests) {
        const invitedGuestQuery = `
          SELECT id FROM rsvps 
          WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
          LIMIT 1
        `;
        const invitedGuestResult = await client.query(invitedGuestQuery, [guest.firstName, guest.lastName]);
        
        if (invitedGuestResult.rows.length === 0) {
          // Guest is not invited - return error
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            message: `${guest.firstName} ${guest.lastName} ist nicht auf der Gästeliste und kann daher nicht hinzugefügt werden.`
          });
        }
      }
    }
    
    // For people without known partners: No guest validation needed (they can add anyone)
    // Guest limit validation (already handled in frontend, but double-check here)
    const maxGuestsAllowed = hasKnownPartner ? 2 : 1;
    if (guests && guests.length > maxGuestsAllowed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: hasKnownPartner 
          ? `Du kannst maximal ${maxGuestsAllowed} Gäste hinzufügen (deinen Partner und einen weiteren Gast).`
          : `Du kannst maximal ${maxGuestsAllowed} Gast hinzufügen.`
      });
    }

    // 6. Check if any guest has already submitted an RSVP (prevents conflicts)
    if (guests && guests.length > 0) {
      for (const guest of guests) {
        console.log('Final validation - Checking if guest has already submitted RSVP:', guest.firstName, guest.lastName); // Debug log

        const submittedGuestQuery = `
          SELECT id, first_name, last_name, group_id FROM rsvps 
          WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
          AND submission_timestamp IS NOT NULL
          LIMIT 1
        `;
        const submittedGuestResult = await client.query(submittedGuestQuery, [guest.firstName, guest.lastName]);
        
        if (submittedGuestResult.rows.length > 0) {
          const submittedGuest = submittedGuestResult.rows[0];
          
          // Check if this guest belongs to the same group as the main person (edit mode)
          const mainPersonGroupQuery = `
            SELECT group_id FROM rsvps 
            WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
            AND submission_timestamp IS NOT NULL
            LIMIT 1
          `;
          const mainPersonGroupResult = await client.query(mainPersonGroupQuery, [firstName, lastName]);
          
          // If main person has a group and submitted guest has same group, it's edit mode - allow it
          if (mainPersonGroupResult.rows.length > 0 && 
              mainPersonGroupResult.rows[0].group_id && 
              submittedGuest.group_id === mainPersonGroupResult.rows[0].group_id) {
            console.log('Final validation - Guest belongs to same group - edit mode detected, allowing:', guest.firstName, guest.lastName); // Debug log
            continue; // Skip validation for same-group guests
          }
          
          console.log('Final validation - Guest has already submitted RSVP:', guest.firstName, guest.lastName); // Debug log
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            message: `${guest.firstName} ${guest.lastName} hat bereits eine eigene RSVP eingereicht und kann daher nicht als Gast hinzugefügt werden.`
          });
        }
      }
    }

    console.log('Final validation passed - proceeding with RSVP submission'); // Debug log

    // --- END FINAL VALIDATION ---

    // Check if main person already exists in database
    const existingMainQuery = `
      SELECT id, group_id FROM rsvps 
      WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2) 
      AND (submission_timestamp IS NULL OR submission_timestamp IS NOT NULL)
      LIMIT 1
    `;
    const existingMainResult = await client.query(existingMainQuery, [firstName, lastName]);

    let groupId;
    let mainRsvpId;

    if (existingMainResult.rows.length > 0) {
      // Person exists - UPDATE existing record
      const existingRecord = existingMainResult.rows[0];
      groupId = existingRecord.group_id;
      mainRsvpId = existingRecord.id;

      // If no group_id exists yet, generate a new one
      if (!groupId) {
        const groupIdResult = await client.query('SELECT gen_random_uuid() as group_id');
        groupId = groupIdResult.rows[0].group_id;
      }

      const rsvpUpdateQuery = `
        UPDATE rsvps 
        SET email = $1, attending = $2, food_restrictions = $3, song_request = $4, 
            accommodation = $5, arrival_date = $6, comment = $7, submission_timestamp = CURRENT_TIMESTAMP,
            is_main_contact = true, group_id = $9
        WHERE id = $8
      `;
      await client.query(rsvpUpdateQuery, [email, isAttending, foodRestrictions, song, accommodation, arrivalDate || null, comment, mainRsvpId, groupId]);

      // Delete existing guests in this group (we'll re-add them) - only if group_id exists
      if (existingRecord.group_id) {
        // Reset all guests (non-main contacts) in this group to NULL instead of deleting them
        const resetGuestsQuery = `
          UPDATE rsvps 
          SET email = NULL, attending = NULL, food_restrictions = NULL, song_request = NULL,
              accommodation = NULL, arrival_date = NULL, comment = NULL, group_id = NULL, 
              is_main_contact = true, submission_timestamp = NULL
          WHERE group_id = $1 AND is_main_contact = false
        `;
        await client.query(resetGuestsQuery, [existingRecord.group_id]);
      }

      // Handle partner deletion in UPDATE mode: If person has a known partner but no guests, remove partner from DB
      if (hasKnownPartner && (!guests || guests.length === 0)) {
        // Get partner details
        let partnerName = null;
        if (partnerResult.rows.length > 0) {
          const couple = partnerResult.rows[0];
          if (firstName.toLowerCase() === couple.person1_first_name.toLowerCase() && 
              lastName.toLowerCase() === couple.person1_last_name.toLowerCase()) {
            partnerName = { 
              firstName: couple.person2_first_name, 
              lastName: couple.person2_last_name 
            };
          } else {
            partnerName = { 
              firstName: couple.person1_first_name, 
              lastName: couple.person1_last_name 
            };
          }
        }

        if (partnerName) {
          console.log('UPDATE mode: Partner found but not in guests list - resetting partner values to NULL and removing couple relationship:', partnerName); // Debug log
          
          // Reset partner values to NULL (but keep the person in the database)
          const partnerUpdateQuery = `
            UPDATE rsvps 
            SET email = NULL, attending = NULL, food_restrictions = NULL, song_request = NULL,
                accommodation = NULL, arrival_date = NULL, comment = NULL, group_id = NULL, 
                is_main_contact = true, submission_timestamp = NULL
            WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
            AND submission_timestamp IS NOT NULL
          `;
          await client.query(partnerUpdateQuery, [partnerName.firstName, partnerName.lastName]);
          
          // Remove the couple relationship from couples table to prevent future partner suggestions
          const deleteCoupleQuery = `
            DELETE FROM couples 
            WHERE (LOWER(person1_first_name) = LOWER($1) AND LOWER(person1_last_name) = LOWER($2))
               OR (LOWER(person2_first_name) = LOWER($1) AND LOWER(person2_last_name) = LOWER($2))
               OR (LOWER(person1_first_name) = LOWER($3) AND LOWER(person1_last_name) = LOWER($4))
               OR (LOWER(person2_first_name) = LOWER($3) AND LOWER(person2_last_name) = LOWER($4))
          `;
          await client.query(deleteCoupleQuery, [firstName, lastName, partnerName.firstName, partnerName.lastName]);
          
          console.log('UPDATE mode: Couple relationship removed from couples table'); // Debug log
        }
      }
    } else {
      // Person doesn't exist - CREATE new record
      const groupIdResult = await client.query('SELECT gen_random_uuid() as group_id');
      groupId = groupIdResult.rows[0].group_id;

      const rsvpInsertQuery = `
        INSERT INTO rsvps (first_name, last_name, email, attending, food_restrictions, song_request, accommodation, arrival_date, comment, group_id, is_main_contact, submission_timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
        RETURNING id;
      `;
      const rsvpValues = [firstName, lastName, email, isAttending, foodRestrictions, song, accommodation, arrivalDate || null, comment, groupId, true];
      const rsvpResult = await client.query(rsvpInsertQuery, rsvpValues);
      mainRsvpId = rsvpResult.rows[0].id;
    }

    // Handle partner deletion: If person has a known partner but no guests, remove partner from DB
    if (hasKnownPartner && (!guests || guests.length === 0)) {
      // Get partner details
      let partnerName = null;
      if (partnerResult.rows.length > 0) {
        const couple = partnerResult.rows[0];
        if (firstName.toLowerCase() === couple.person1_first_name.toLowerCase() && 
            lastName.toLowerCase() === couple.person1_last_name.toLowerCase()) {
          partnerName = { 
            firstName: couple.person2_first_name, 
            lastName: couple.person2_last_name 
          };
        } else {
          partnerName = { 
            firstName: couple.person1_first_name, 
            lastName: couple.person1_last_name 
          };
        }
      }

      if (partnerName) {
        console.log('First submit: Partner found but not in guests list - resetting partner values and removing couple relationship:', partnerName); // Debug log
        
        // Reset partner values to NULL (but keep the person in the database)
        const partnerUpdateQuery = `
          UPDATE rsvps 
          SET email = NULL, attending = NULL, food_restrictions = NULL, song_request = NULL,
              accommodation = NULL, arrival_date = NULL, comment = NULL, group_id = NULL, 
              is_main_contact = true, submission_timestamp = NULL
          WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
          AND submission_timestamp IS NOT NULL
        `;
        await client.query(partnerUpdateQuery, [partnerName.firstName, partnerName.lastName]);
        
        // Remove the couple relationship from couples table to prevent future partner suggestions
        const deleteCoupleQuery = `
          DELETE FROM couples 
          WHERE (LOWER(person1_first_name) = LOWER($1) AND LOWER(person1_last_name) = LOWER($2))
             OR (LOWER(person2_first_name) = LOWER($1) AND LOWER(person2_last_name) = LOWER($2))
             OR (LOWER(person1_first_name) = LOWER($3) AND LOWER(person1_last_name) = LOWER($4))
             OR (LOWER(person2_first_name) = LOWER($3) AND LOWER(person2_last_name) = LOWER($4))
        `;
        await client.query(deleteCoupleQuery, [firstName, lastName, partnerName.firstName, partnerName.lastName]);
        
        console.log('Couple relationship removed from couples table'); // Debug log
      }
    }

    // Handle guests - check each guest individually
    if (guests && guests.length > 0) {
      for (const guest of guests) {
        // Check if this guest already exists in the database (as a main contact)
        const existingGuestQuery = `
          SELECT id FROM rsvps 
          WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
          AND submission_timestamp IS NULL
          LIMIT 1
        `;
        const existingGuestResult = await client.query(existingGuestQuery, [guest.firstName, guest.lastName]);

        if (existingGuestResult.rows.length > 0) {
          // Guest exists in database - UPDATE them as a guest in this group
          const existingGuestId = existingGuestResult.rows[0].id;
          const guestUpdateQuery = `
            UPDATE rsvps 
            SET email = $1, attending = $2, food_restrictions = $3, song_request = $4,
                accommodation = $5, arrival_date = $6, comment = $7, group_id = $8, is_main_contact = false,
                submission_timestamp = CURRENT_TIMESTAMP
            WHERE id = $9
          `;
          await client.query(guestUpdateQuery, [
            email, isAttending, foodRestrictions, song, accommodation, 
            arrivalDate || null, comment, groupId, existingGuestId
          ]);
        } else {
          // Guest doesn't exist - INSERT new guest record
          const guestInsertQuery = `
            INSERT INTO rsvps (first_name, last_name, email, attending, food_restrictions, song_request, accommodation, arrival_date, comment, group_id, is_main_contact, submission_timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
          `;
          await client.query(guestInsertQuery, [
            guest.firstName, guest.lastName, email, isAttending, foodRestrictions, 
            song, accommodation, arrivalDate || null, comment, groupId, false
          ]);
        }
      }
    }

    // Commit the transaction if all queries were successful
    await client.query('COMMIT');
    res.status(201).json({ message: 'Vielen Dank! Deine RSVP wurde erfolgreich übermittelt.' });
  } catch (error) {
    // If any error occurs, roll back the transaction
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error saving RSVP to database:', error);

    // For all errors, send a generic message
    return res.status(500).json({ message: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.' });
  } finally {
    // Release the client back to the pool
    if (client) {
      client.release();
    }
  }
});

// --- Serve main pages ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/travel', (req, res) => {
  res.sendFile(path.join(__dirname, 'travel.html'));
});

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'gallery.html'));
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});