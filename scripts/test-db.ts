import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const pool = new Pool({ connectionString });

  try {
    const result = await pool.query('SELECT current_database(), current_schema()');
    console.log('Connected to:', result.rows[0]);

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
      LIMIT 20
    `);
    console.log('Tables in public schema:', tables.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
    console.log('Connection closed');
  }
}

main();
