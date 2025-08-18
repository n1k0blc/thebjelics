// Load environment variables from .env file
require('dotenv').config();

console.log('--- Loading server.js with /api/partner route ---');

const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
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
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Add a simple "ping" route for health checks
app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
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
        await client.query('DELETE FROM rsvps WHERE group_id = $1 AND is_main_contact = false', [existingRecord.group_id]);
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
    res.status(201).json({ message: 'Thank you! Your RSVP has been submitted successfully.' });
  } catch (error) {
    // If any error occurs, roll back the transaction
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error saving RSVP to database:', error);

    // For all errors, send a generic message
    return res.status(500).json({ message: 'An error occurred while submitting your RSVP. Please try again.' });
  } finally {
    // Release the client back to the pool
    if (client) {
      client.release();
    }
  }
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});