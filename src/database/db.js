const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../campusflow.db');

// Ensure parent directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for better concurrency and integrity
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Initialize schema
function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

initSchema();

// Helper database wrapper methods
function query(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    // Convert null-prototype objects to clean JS plain objects
    return rows.map(row => ({ ...row }));
  } catch (error) {
    console.error('Database query error:', error, 'SQL:', sql, 'Params:', params);
    throw error;
  }
}

function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const row = stmt.get(...params);
    return row ? { ...row } : null;
  } catch (error) {
    console.error('Database get error:', error, 'SQL:', sql, 'Params:', params);
    throw error;
  }
}

function run(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  } catch (error) {
    console.error('Database run error:', error, 'SQL:', sql, 'Params:', params);
    throw error;
  }
}

function exec(sql) {
  try {
    return db.exec(sql);
  } catch (error) {
    console.error('Database exec error:', error, 'SQL:', sql);
    throw error;
  }
}

function transaction(fn) {
  try {
    db.exec('BEGIN TRANSACTION');
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = {
  db,
  query,
  get,
  run,
  exec,
  transaction,
  initSchema
};
