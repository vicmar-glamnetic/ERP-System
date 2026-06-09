import { pool, testConnection } from './db/client';

async function main() {
  await testConnection();
  console.log('DB connected successfully');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
