import { assertEnv, env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { ensureAdmin } from './controllers/authController.js';

async function main() {
  assertEnv();
  await connectDb();
  await ensureAdmin();
  createApp().listen(env.port, () => console.log(`SPE Record Manager API running on port ${env.port}`));
}
main().catch((e) => {
  console.error('Failed to start:', e.message);
  process.exit(1);
});
