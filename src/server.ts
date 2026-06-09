import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { testConnection } from './db/client';

const PORT = process.env.PORT ?? 3000;

async function start(): Promise<void> {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
