require('dotenv').config();
const { seedDatabase } = require('./src/database/seed');

// Seed demo data
seedDatabase();

const app = require('./src/app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  CampusFlow AI Server Started`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`  Tagline: Write. Submit. Track. Approved.`);
  console.log(`========================================\n`);
  console.log(`  Demo Accounts:`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Admin:       admin@campusflow.edu / Admin@123`);
  console.log(`  Director:    director@campusflow.edu / Director@123`);
  console.log(`  HOD (CSE):   hod.cse@campusflow.edu / Hod@123`);
  console.log(`  Coordinator: coordinator.cse4a@campusflow.edu / Coord@123`);
  console.log(`  Student:     rahul.cse@campusflow.edu / Student@123`);
  console.log(`  CR:          cr.cse4a@campusflow.edu / Cr@123`);
  console.log(`  Pending:     priya.cse@campusflow.edu / Student@123`);
  console.log(`  ─────────────────────────────────────\n`);
});
