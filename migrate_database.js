// Database migration script to update rsvps table structure
require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrateDatabase() {
  let client;
  
  try {
    client = await pool.connect();
    console.log('Connected to database, starting migration...');

    // Start transaction
    await client.query('BEGIN');

    // Add new columns to rsvps table
    console.log('Adding new columns to rsvps table...');
    
    try {
      await client.query('ALTER TABLE rsvps ADD COLUMN group_id UUID');
      console.log('✓ Added group_id column');
    } catch (error) {
      if (error.code === '42701') {
        console.log('✓ group_id column already exists');
      } else {
        throw error;
      }
    }

    try {
      await client.query('ALTER TABLE rsvps ADD COLUMN is_main_contact BOOLEAN DEFAULT false');
      console.log('✓ Added is_main_contact column');
    } catch (error) {
      if (error.code === '42701') {
        console.log('✓ is_main_contact column already exists');
      } else {
        throw error;
      }
    }

    // Migrate existing data if needed
    console.log('Checking for data migration...');
    
    // Check if there are RSVPs without group_id
    const { rows: unmigrated } = await client.query('SELECT COUNT(*) as count FROM rsvps WHERE group_id IS NULL');
    
    if (parseInt(unmigrated[0].count) > 0) {
      console.log(`Migrating ${unmigrated[0].count} existing RSVPs...`);
      
      // Get all RSVPs without group_id
      const { rows: rsvpsToMigrate } = await client.query('SELECT id FROM rsvps WHERE group_id IS NULL');
      
      for (const rsvp of rsvpsToMigrate) {
        // Generate a new group_id and mark as main contact
        const { rows: newGroupId } = await client.query('SELECT gen_random_uuid() as group_id');
        await client.query(
          'UPDATE rsvps SET group_id = $1, is_main_contact = true WHERE id = $2',
          [newGroupId[0].group_id, rsvp.id]
        );
      }
      
      console.log('✓ Migrated existing RSVPs');
    } else {
      console.log('✓ No existing RSVPs need migration');
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    
    // Show current table structure
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'rsvps' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nCurrent rsvps table structure:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run migration
migrateDatabase()
  .then(() => {
    console.log('\n🎉 Database migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration error:', error);
    process.exit(1);
  });
