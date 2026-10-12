const pool = require('./db');

async function viewDatabaseData() {
  try {
    // Check saved tenders/Excel data
    const tendersResult = await pool.query('SELECT * FROM tender_database');
    console.log("\n📦 --- TENDERS / EXCEL DATA IN DB ---");
    if (tendersResult.rows.length === 0) {
      console.log("No tender data found yet.");
    } else {
      tendersResult.rows.forEach(row => {
        console.log(`Trader: ${row.trader_name}`);
        console.log("Lots/Data:", JSON.stringify(row.data, null, 2));
      });
    }

    // Check saved bills
    const billsResult = await pool.query('SELECT * FROM saved_bills');
    console.log("\n🧾 --- SAVED BILLS IN DB ---");
    console.log(`Total saved bills: ${billsResult.rows.length}`);
    billsResult.rows.forEach(row => {
      console.log(`Bill ID: ${row.id}, Data:`, row.data);
    });

    process.exit(0);
  } catch (err) {
    console.error("❌ Error querying database:", err);
    process.exit(1);
  }
}

viewDatabaseData();