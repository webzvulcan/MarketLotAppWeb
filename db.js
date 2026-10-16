const mysql = require('mysql2/promise');
require('dotenv').config();

// Initialize the MySQL connection pool for TiDB Cloud
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 4000,
  ssl: { 
    minVersion: 'TLSv1.2', 
    rejectUnauthorized: true 
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Function to initialize the database tables
const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_bills (
        id VARCHAR(255) PRIMARY KEY,
        unique_id VARCHAR(100),
        date VARCHAR(50),
        ca_name VARCHAR(100),
        trader VARCHAR(150),
        commodity VARCHAR(100),
        lot_no VARCHAR(50),
        bags INT,
        bag_weights JSON,
        total_qty DECIMAL(10,2),
        less_qty DECIMAL(10,2),
        net_qty DECIMAL(10,2),
        amount DECIMAL(12,2),
        price DECIMAL(10,2),
        created_at BIGINT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tender_database (
        id INT AUTO_INCREMENT PRIMARY KEY,
        batch_id VARCHAR(100),
        file_name VARCHAR(255),
        trader VARCHAR(150),
        commodity VARCHAR(100),
        lot_no VARCHAR(50),
        price DECIMAL(10,2),
        bags INT,
        upload_date VARCHAR(50)
      );
    `);

    console.log("Database tables verified/created successfully on TiDB Cloud!");
  } catch (err) {
    console.error("Error initializing database tables:", err);
  }
};

// Run table creation on startup
initDatabase();

module.exports = pool;
