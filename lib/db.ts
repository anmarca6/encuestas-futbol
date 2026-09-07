import { createClient, type Client } from '@libsql/client';

interface PreparedStatement {
  bind(...args: unknown[]): {
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
    run(): Promise<void>;
  };
}

interface Database {
  prepare(sql: string): PreparedStatement;
}

let client: Client | undefined;
let schemaReady: Promise<void> | undefined;

function getClient(): Client {
  client ??= createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  return client;
}

export function getDatabase(): Database {
  return {
    prepare(sql: string): PreparedStatement {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              const result = await getClient().execute({ sql, args: args as never[] });
              return (result.rows[0] as unknown as T) ?? null;
            },
            async all<T>(): Promise<{ results: T[] }> {
              const result = await getClient().execute({ sql, args: args as never[] });
              return { results: result.rows as unknown as T[] };
            },
            async run(): Promise<void> {
              await getClient().execute({ sql, args: args as never[] });
            },
          };
        },
      };
    },
  };
}

export function ensureCommunitySchema(): Promise<void> {
  schemaReady ??= (async () => {
    const db = getDatabase();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        nickname TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `).bind().run();
    await db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname
      ON users (nickname)
    `).bind().run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS predictions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        match_id TEXT NOT NULL,
        home_score INTEGER NOT NULL,
        away_score INTEGER NOT NULL,
        lineup TEXT,
        scorers TEXT NOT NULL DEFAULT '[]',
        mvp TEXT,
        published_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).bind().run();
    await db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_user_match
      ON predictions (user_id, match_id)
    `).bind().run();
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_predictions_match_published
      ON predictions (match_id, published_at)
    `).bind().run();
  })().catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}
