const { Pool } = require('pg');
require('dotenv').config();

// Initialize the PostgreSQL pool using your Render External Database URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for secure cloud databases like Render
  }
});

// Function to initialize the database tables
const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_bills (
        id TEXT PRIMARY KEY,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database table 'saved_bills' verified/created successfully.");
  } catch (err) {
    console.error("Error initializing database table:", err);
  }
};

// Run table creation on startup
initDatabase();

module.exports = pool;