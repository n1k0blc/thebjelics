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

    // 1. Insert the main RSVP record
    const rsvpInsertQuery = `
      INSERT INTO rsvps (first_name, last_name, email, attending, food_restrictions, song_request, accommodation, arrival_date, comment)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id;
    `;
    const rsvpValues = [firstName, lastName, email, isAttending, foodRestrictions, song, accommodation, arrivalDate || null, comment];
    const rsvpResult = await client.query(rsvpInsertQuery, rsvpValues);
    const rsvpId = rsvpResult.rows[0].id;

    // 2. Insert each guest associated with the RSVP
    if (guests && guests.length > 0) {
      const guestInsertQuery = 'INSERT INTO guests (rsvp_id, first_name, last_name) VALUES ($1, $2, $3)';
      for (const guest of guests) {
        await client.query(guestInsertQuery, [rsvpId, guest.firstName, guest.lastName]);
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

    // Check for unique constraint violation on the email field (PostgreSQL error code 23505)
    if (error.code === '23505' && error.constraint === 'rsvps_email_key') {
      return res.status(409).json({ message: 'This email address has already been used to RSVP. Please use a different email.' });
    }

    // For all other errors, send a generic message
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