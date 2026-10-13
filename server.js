require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const XLSX = require('xlsx');

const app = express();
app.use(express.json());
app.use(cors());

// Connection pool setup
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
  connectionLimit: 5,
  connectTimeout: 10000
});

// Helper to auto-verify or initialize tables on startup
async function ensureTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tender_database (
          id INT AUTO_INCREMENT PRIMARY KEY,
          batch_id VARCHAR(100) NOT NULL,
          upload_date VARCHAR(50) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          trader VARCHAR(100),
          commodity VARCHAR(100),
          lot_no VARCHAR(50),
          price DECIMAL(12,2),
          bags INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saved_bills (
          id VARCHAR(100) PRIMARY KEY,
          unique_id VARCHAR(100),
          trade_date VARCHAR(50),
          weighed_date VARCHAR(50),
          ca_name VARCHAR(100),
          weighted_by VARCHAR(100),
          trader VARCHAR(100),
          commodity VARCHAR(100),
          lot_no VARCHAR(50),
          bags INT,
          bag_weights JSON,
          total_qty DECIMAL(10,2),
          less_qty DECIMAL(10,2),
          net_qty DECIMAL(10,2),
          price DECIMAL(12,2),
          amount DECIMAL(12,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database tables verified successfully on TiDB Cloud!");
  } catch (err) {
    console.error("Table check/creation error:", err);
  }
}

// --- API ENDPOINTS ---

app.get('/api/tenders', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tender_database ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error("Error fetching tenders:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tenders/upload', upload.any(), async (req, res) => {
  try {
    const file = req.files && req.files.length > 0 ? req.files[0] : null;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const batchId = 'BATCH_' + Date.now();
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    const currentDate = new Date().toLocaleDateString('en-GB', options);
    const fileName = file.originalname;

    let insertedCount = 0;

    for (const row of sheetData) {
      const cleanRow = {};
      Object.keys(row).forEach(k => {
        cleanRow[k.trim().toLowerCase()] = row[k];
      });

      const trader = String(
        cleanRow['trader'] || cleanRow['trader name'] || cleanRow['tradername'] || cleanRow[0] || ''
      ).trim();

      const commodity = String(
        cleanRow['commodity'] || cleanRow['item'] || cleanRow['goods'] || cleanRow[1] || 'General'
      ).trim();

      const lotNo = String(
        cleanRow['lotno'] || cleanRow['lot no'] || cleanRow['lot number'] || cleanRow['lot'] || cleanRow[2] || ''
      ).trim();

      const price = parseFloat(
        cleanRow['price'] || cleanRow['rate'] || cleanRow[3] || 0
      );

      const bags = parseInt(
        cleanRow['bags'] || cleanRow['bag count'] || cleanRow['bagcount'] || cleanRow[4] || 1, 
        10
      );

      if (trader && lotNo) {
        await pool.query(
          `INSERT INTO tender_database (batch_id, upload_date, file_name, trader, commodity, lot_no, price, bags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [batchId, currentDate, fileName, trader, commodity, lotNo, price, bags]
        );
        insertedCount++;
      }
    }

    res.json({ success: true, message: `Successfully imported ${insertedCount} tenders!`, batchId });
  } catch (err) {
    console.error("Error processing Excel upload:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bills', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM saved_bills ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error("Error fetching bills:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bills', async (req, res) => {
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  const currentDate = new Date().toLocaleDateString('en-GB', options);

  const { 
    id, 
    uniqueId, 
    tradeDate = currentDate, 
    weighedDate = currentDate, 
    caName, 
    weightedBy, 
    trader, 
    commodity, 
    lotNo, 
    bags, 
    bagWeights, 
    totalQty, 
    lessQty, 
    netQty, 
    price, 
    amount 
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO saved_bills (id, unique_id, trade_date, weighed_date, ca_name, weighted_by, trader, commodity, lot_no, bags, bag_weights, total_qty, less_qty, net_qty, price, amount) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        uniqueId, 
        tradeDate || currentDate, 
        weighedDate || currentDate, 
        caName, 
        weightedBy || 'Admin', 
        trader, 
        commodity, 
        lotNo, 
        bags, 
        JSON.stringify(bagWeights), 
        totalQty, 
        lessQty, 
        netQty, 
        price, 
        amount
      ]
    );
    res.json({ success: true, message: "Bill saved successfully" });
  } catch (err) {
    console.error("Error saving bill:", err);
    res.status(500).json({ error: err.message });
  }
});

// START SERVER (Required for Render)
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await ensureTables();
});
