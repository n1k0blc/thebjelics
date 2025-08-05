// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// --- Middleware ---
// Define explicit CORS options for better security and control
const corsOptions = {
  origin: '*', // In production, you should restrict this to your frontend's domain, e.g., 'https://your-wedding-site.com'
  methods: ['GET', 'POST', 'OPTIONS'], // Explicitly allow POST and the preflight OPTIONS
  allowedHeaders: ['Content-Type'], // Allow the Content-Type header sent by the frontend
  optionsSuccessStatus: 200 // Use 200 for OPTIONS success status for broader compatibility
};

// Enable CORS for all routes using the defined options
app.use(cors(corsOptions));

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

  const client = await pool.connect();

  try {
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
    await client.query('ROLLBACK');
    console.error('Error saving RSVP to database:', error);

    // Check for unique constraint violation on the email field (PostgreSQL error code 23505)
    if (error.code === '23505' && error.constraint === 'rsvps_email_key') {
      return res.status(409).json({ message: 'This email address has already been used to RSVP. Please use a different email.' });
    }

    // For all other errors, send a generic message
    return res.status(500).json({ message: 'An error occurred while submitting your RSVP. Please try again.' });
  } finally {
    // Release the client back to the pool
    client.release();
  }
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});