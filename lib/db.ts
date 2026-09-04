import { env } from 'cloudflare:workers';

export function getDatabase(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}
