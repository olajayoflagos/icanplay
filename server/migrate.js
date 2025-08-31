import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isLocal =
  /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '') ||
  process.env.DATABASE_URL?.startsWith('postgresql://localhost');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function runSQL(client, filePath){
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
  console.log('✓', path.basename(filePath));
}

(async () => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    // 1) base schema
    await runSQL(client, path.join(__dirname, 'db.sql'));
    // 2) incremental migrations
    const migDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migDir)) {
      const files = fs.readdirSync(migDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      for (const f of files) {
        await runSQL(client, path.join(migDir, f));
      }
    }
    await client.query('commit');
    console.log('Migration completed.');
  } catch(e){
    await client.query('rollback');
    console.error(e);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
})();