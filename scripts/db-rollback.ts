import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';

const args = process.argv.slice(2);

// Parse --migration argument (supports both --migration=0042 and --migration 0042)
function parseMigrationNumber(): string | undefined {
  const eqArg = args.find((a) => a.startsWith('--migration='));
  if (eqArg) {
    return eqArg.split('=')[1];
  }
  const flagIndex = args.indexOf('--migration');
  if (flagIndex !== -1 && args[flagIndex + 1]) {
    return args[flagIndex + 1];
  }
  return undefined;
}

const migrationNumber = parseMigrationNumber();
const dryRun = args.includes('--dry-run');
const listMode = args.includes('--list');

async function listRollbacks(): Promise<void> {
  const rollbackDir = path.resolve(__dirname, '../drizzle/rollbacks');
  if (!fs.existsSync(rollbackDir)) {
    console.error('No rollbacks directory found at:', rollbackDir);
    process.exit(1);
  }
  const files = fs
    .readdirSync(rollbackDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  console.log('\nAvailable rollback files:');
  console.log('========================');
  for (const file of files) {
    const match = file.match(/^(\d{4})_rollback_(.+)\.sql$/);
    if (match) {
      console.log(`  ${match[1]}  ${match[2]}`);
    } else {
      console.log(`  ${file}`);
    }
  }
  console.log('\nUsage: pnpm run db:rollback -- --migration=<number> [--dry-run]');
}

async function main(): Promise<void> {
  if (listMode) {
    await listRollbacks();
    return;
  }

  if (!migrationNumber) {
    console.error('Usage: pnpm run db:rollback -- --migration=0042 [--dry-run]');
    console.error('       pnpm run db:rollback -- --list');
    console.error('\nOptions:');
    console.error('  --migration=<number>  Migration number to roll back (e.g., 0042)');
    console.error('  --dry-run             Show SQL without executing');
    console.error('  --list                List available rollback files');
    process.exit(1);
  }

  // Find rollback SQL file
  const rollbackDir = path.resolve(__dirname, '../drizzle/rollbacks');
  if (!fs.existsSync(rollbackDir)) {
    console.error('No rollbacks directory found at:', rollbackDir);
    process.exit(1);
  }

  const files = fs.readdirSync(rollbackDir);
  const rollbackFile = files.find((f) => f.startsWith(`${migrationNumber}_rollback_`));

  if (!rollbackFile) {
    console.error(`No rollback file found for migration ${migrationNumber}`);
    console.error(`Expected file matching: ${migrationNumber}_rollback_*.sql`);
    console.error(`\nAvailable files in ${rollbackDir}:`);
    files.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
  }

  const sql = fs.readFileSync(path.join(rollbackDir, rollbackFile), 'utf-8');

  console.log(`\n=== Rollback: ${rollbackFile} ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`\nSQL to execute:\n${sql}\n`);

  if (dryRun) {
    console.log('Dry run complete. No changes made.');
    return;
  }

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  // Safety confirmation via countdown
  console.log('WARNING: This will modify the database. Make sure you have a backup.');
  console.log('Executing in 3 seconds... (Ctrl+C to abort)');
  await new Promise((r) => setTimeout(r, 3000));

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(sql);

    // Remove the corresponding entry from drizzle migrations journal
    await client.query(
      `DELETE FROM "__drizzle_migrations" WHERE hash IN (
        SELECT hash FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1
      )`,
    );

    await client.query('COMMIT');
    console.log('Rollback completed successfully.');
    console.log(`Migration ${migrationNumber} has been rolled back and removed from the migrations journal.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rollback failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
