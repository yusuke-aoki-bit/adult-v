import { Pool } from 'pg';
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const result = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product_sales' ORDER BY ordinal_position");
  console.log('product_sales columns:');
  result.rows.forEach((r: any) => console.log('  ' + r.column_name + ': ' + r.data_type));
  await pool.end();
}
main();
