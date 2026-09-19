import { createClient, type Client } from '@libsql/client';
import { DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';

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
    const userColumns = await db.prepare('PRAGMA table_info(users)').bind().all<{ name: string }>();
    if (!userColumns.results.some((column) => column.name === 'avatar_url')) {
      await db.prepare('ALTER TABLE users ADD COLUMN avatar_url TEXT').bind().run();
    }
    if (!userColumns.results.some((column) => column.name === 'password_hash')) {
      await db.prepare('ALTER TABLE users ADD COLUMN password_hash TEXT').bind().run();
    }
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS communities (
        slug TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `).bind().run();
    const communityColumns = await db.prepare('PRAGMA table_info(communities)').bind().all<{ name: string }>();
    for (const column of ['header_title', 'header_subtitle', 'header_image', 'header_color', 'hero_title', 'hero_subtitle', 'hero_image', 'hero_image_version', 'hero_links']) {
      if (!communityColumns.results.some((item) => item.name === column)) {
        // Si otra instancia acaba de crear la columna, el ALTER falla con "duplicate column": no es un error.
        await db.prepare(`ALTER TABLE communities ADD COLUMN ${column} TEXT`).bind().run().catch((error: unknown) => {
          if (!/duplicate column/i.test(error instanceof Error ? error.message : String(error))) throw error;
        });
      }
    }
    await db.prepare('INSERT OR IGNORE INTO communities (slug, name, created_at) VALUES (?, ?, ?)')
      .bind(DEFAULT_COMMUNITY_SLUG, 'Granota App', Date.now()).run();
    // Los usuarios existentes pasan a la comunidad principal y el apodo pasa a ser único por comunidad.
    if (!userColumns.results.some((column) => column.name === 'community_slug')) {
      await db.prepare(`ALTER TABLE users ADD COLUMN community_slug TEXT NOT NULL DEFAULT '${DEFAULT_COMMUNITY_SLUG}'`).bind().run();
    }
    await db.prepare('DROP INDEX IF EXISTS idx_users_nickname').bind().run();
    await db.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_community_nickname
      ON users (community_slug, nickname)
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
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS matchday_mvps (
        matchday INTEGER PRIMARY KEY NOT NULL,
        player_id TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
    `).bind().run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS official_match_reports (
        matchday INTEGER PRIMARY KEY NOT NULL,
        home_score INTEGER NOT NULL,
        away_score INTEGER NOT NULL,
        formation TEXT NOT NULL,
        lineup TEXT NOT NULL,
        scorers TEXT NOT NULL DEFAULT '[]',
        mvp TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )
    `).bind().run();
  })().catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}
