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

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tender_database (
          id INT AUTO_INCREMENT PRIMARY KEY,
          batch_id VARCHAR(100) NOT NULL,
          upload_date VARCHAR(50) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          ca_name VARCHAR(100),
          trader VARCHAR(100),
          commodity VARCHAR(100),
          lot_no VARCHAR(50),
          price DECIMAL(12,2),
          bags INT,
          active_status VARCHAR(50) DEFAULT 'ACTIVE',
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ca_registered (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ca_name VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database tables verified/created successfully!");
  } catch (err) {
    console.error("Table check/creation error:", err);
  }
}

app.get('/api/cas', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT ca_name, password FROM ca_registered');
    let caObj = { "nitin ca": "123", "admin ca 1": "123", "admin ca 2": "123" };
    rows.forEach(r => {
      caObj[r.ca_name.trim().toUpperCase()] = r.password;
    });
    res.json(caObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cas/register', async (req, res) => {
  const { caName, password } = req.body;
  if (!caName || !password) {
    return res.status(400).json({ error: "CA Name and Password are required." });
  }
  const normalizedCaName = caName.trim().toUpperCase();
  try {
    await pool.query('INSERT INTO ca_registered (ca_name, password) VALUES (?, ?)', [normalizedCaName, password]);
    res.json({ success: true, message: 'CA registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'CA already exists or database error.' });
  }
});

// Get active tenders (only where active_status is 'ACTIVE')
app.get('/api/tenders', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM tender_database 
      WHERE active_status = 'ACTIVE'
      ORDER BY id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching tenders:", err);
    console.error("Error fetching tenders:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tenders/upload', upload.any(), async (req, res) => {
  try {
    const file = req.files && req.files.length > 0 ? req.files[0] : null;
    if (!file) return res.status(400).json({ error: "No file uploaded." });

    const caName = (req.body.caName || "NITIN CA").trim().toUpperCase();
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

      const trader = String(cleanRow['trader'] || cleanRow['trader name'] || cleanRow[0] || '').trim().toUpperCase();
      const commodity = String(cleanRow['commodity'] || cleanRow['item'] || cleanRow[1] || 'GENERAL').trim().toUpperCase();
      const lotNo = String(cleanRow['lotno'] || cleanRow['lot no'] || cleanRow[2] || '').trim();
      const price = parseFloat(cleanRow['price'] || cleanRow['rate'] || cleanRow[3] || 0);
      const bags = parseInt(cleanRow['bags'] || cleanRow['bag count'] || cleanRow[4] || 1, 10);

      if (trader && lotNo) {
        await pool.query(
          `INSERT INTO tender_database (batch_id, upload_date, file_name, ca_name, trader, commodity, lot_no, price, bags, active_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
          [batchId, currentDate, fileName, caName, trader, commodity, lotNo, price, bags]
        );
        insertedCount++;
      }
    }

    res.json({ success: true, message: `Successfully appended ${insertedCount} tenders for ${caName}!` });
  } catch (err) {
    console.error("Error processing Excel upload:", err);
    res.status(500).json({ error: err.message });
  }
});

// Lot Reversal endpoint: Updates active_status to 'DELETED' in TiDB instead of deleting records
app.delete('/api/tenders/reversal', async (req, res) => {
  try {
    const { caName, trader, commodity } = req.body;
    if (!caName || !trader || !commodity) {
      return res.status(400).json({ error: "Missing required parameters." });
    }

    const cleanCa = caName.trim().toUpperCase();
    const cleanTrader = trader.trim().toUpperCase();
    const cleanComm = commodity.trim().toUpperCase();

    const query = `UPDATE tender_database SET active_status = 'DELETED' WHERE UPPER(TRIM(ca_name)) = ? AND UPPER(TRIM(trader)) = ? AND UPPER(TRIM(commodity)) = ? AND active_status = 'ACTIVE'`;
    await pool.query(query, [cleanCa, cleanTrader, cleanComm]);

    res.json({ success: true, message: "Lots marked as DELETED in TiDB tender_database." });
  } catch (err) {
    console.error("Error updating lot reversal status:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tenders', async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE tender_database');
    res.json({ success: true, message: "Tender database cleared successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bills', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM saved_bills ORDER BY created_at DESC');
    const formattedRows = rows.map(row => ({
      id: row.id,
      uniqueId: row.unique_id,
      date: row.trade_date || row.weighed_date,
      caName: row.ca_name,
      trader: row.trader,
      commodity: row.commodity,
      lotNo: row.lot_no,
      bags: row.bags,
      bagWeights: typeof row.bag_weights === 'string' ? JSON.parse(row.bag_weights) : row.bag_weights,
      totalQty: row.total_qty,
      lessQty: row.less_qty,
      netQty: row.net_qty,
      price: row.price,
      amount: row.amount
    }));
    res.json(formattedRows);
  } catch (err) {
    console.error("Error fetching bills:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bills', async (req, res) => {
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  const currentDate = new Date().toLocaleDateString('en-GB', options);

  const { 
    id, uniqueId, tradeDate = currentDate, weighedDate = currentDate, 
    caName, weightedBy, trader, commodity, lotNo, bags, bagWeights, 
    totalQty, lessQty, netQty, price, amount 
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO saved_bills (id, unique_id, trade_date, weighed_date, ca_name, weighted_by, trader, commodity, lot_no, bags, bag_weights, total_qty, less_qty, net_qty, price, amount) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, uniqueId, tradeDate || currentDate, weighedDate || currentDate, 
        caName ? caName.trim().toUpperCase() : caName, weightedBy || 'Admin', 
        trader ? trader.trim().toUpperCase() : trader, commodity ? commodity.trim().toUpperCase() : commodity, 
        String(lotNo || "").trim(), bags, JSON.stringify(bagWeights), 
        totalQty, lessQty, netQty, price, amount
      ]
    );

    // Update active_status to SAVED in tender_database
    await pool.query(
      `UPDATE tender_database SET active_status = 'SAVED' WHERE UPPER(TRIM(ca_name)) = ? AND UPPER(TRIM(trader)) = ? AND UPPER(TRIM(commodity)) = ? AND TRIM(lot_no) = ?`,
      [caName.trim().toUpperCase(), trader.trim().toUpperCase(), commodity.trim().toUpperCase(), String(lotNo).trim()]
    );

    res.json({ success: true, message: "Bill saved successfully" });
  } catch (err) {
    console.error("Error saving bill:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bills/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM saved_bills WHERE id = ?', [id]);
    res.json({ success: true, message: "Saved bill deleted successfully" });
  } catch (err) {
    console.error("Error deleting bill:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));