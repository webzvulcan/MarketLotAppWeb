const pool = require('./db');

async function testConnectionAndSave() {
  try {
    // 1. Test if database is connected
    const timeResult = await pool.query('SELECT NOW()');
    console.log("✅ Database Connected Successfully at:", timeResult.rows[0].now);

    // 2. Test saving sample data into the table
    const sampleBill = {
      id: "test-bill-001",
      trader: "Sample Trader",
      amount: "1500.00",
      createdAt: Date.now()
    };

    await pool.query(
      'INSERT INTO saved_bills (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
      [sampleBill.id, JSON.stringify(sampleBill)]
    );
    console.log("✅ Data Saved Successfully to Render PostgreSQL!");

    // 3. Test reading the data back
    const readResult = await pool.query('SELECT * FROM saved_bills WHERE id = $1', ["test-bill-001"]);
    console.log("✅ Data Read From Database:", readResult.rows[0]);

    process.exit(0);
  } catch (err) {
    console.error("❌ Database Connection or Save Failed:", err);
    process.exit(1);
  }
}

testConnectionAndSave();