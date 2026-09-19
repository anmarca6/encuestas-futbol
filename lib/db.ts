import { createClient, type Client } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { DEFAULT_COMMUNITY_SLUG } from '@/lib/community-shared';
import { hashPassword } from '@/lib/password';

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

    // Datos oficiales por comunidad. Sustituyen a matchday_mvps y official_match_reports (que se
    // conservan sin uso): la primera vez se copian a la comunidad principal.
    const existingTables = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('community_mvps', 'community_reports')")
      .bind()
      .all<{ name: string }>();
    const hasTable = (name: string) => existingTables.results.some((table) => table.name === name);
    const hadMvps = hasTable('community_mvps');
    const hadReports = hasTable('community_reports');
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS community_mvps (
        community_slug TEXT NOT NULL,
        matchday INTEGER NOT NULL,
        player_id TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (community_slug, matchday)
      )
    `).bind().run();
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS community_reports (
        community_slug TEXT NOT NULL,
        matchday INTEGER NOT NULL,
        home_score INTEGER NOT NULL,
        away_score INTEGER NOT NULL,
        formation TEXT NOT NULL,
        lineup TEXT NOT NULL,
        scorers TEXT NOT NULL DEFAULT '[]',
        mvp TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (community_slug, matchday)
      )
    `).bind().run();
    if (!hadMvps) {
      await db.prepare(`
        INSERT OR IGNORE INTO community_mvps (community_slug, matchday, player_id, reason, updated_at)
        SELECT ?, matchday, player_id, reason, updated_at FROM matchday_mvps
      `).bind(DEFAULT_COMMUNITY_SLUG).run();
    }
    if (!hadReports) {
      await db.prepare(`
        INSERT OR IGNORE INTO community_reports
          (community_slug, matchday, home_score, away_score, formation, lineup, scorers, mvp, reason, updated_at)
        SELECT ?, matchday, home_score, away_score, formation, lineup, scorers, mvp, reason, updated_at
        FROM official_match_reports
      `).bind(DEFAULT_COMMUNITY_SLUG).run();
    }

    // Cuentas de administración: los super administradores (por defecto leo y angel) se crean la primera
    // vez con la contraseña de ADMIN_PASSWORD, que pueden cambiar después; los de comunidad los crea un super.
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        community_slug TEXT,
        created_at INTEGER NOT NULL
      )
    `).bind().run();
    await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_accounts_username ON admin_accounts (username)').bind().run();
    const initialPassword = process.env.ADMIN_PASSWORD;
    if (initialPassword) {
      const superAdmins = (process.env.SUPER_ADMINS ?? 'leo,angel')
        .split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean);
      for (const username of superAdmins) {
        const found = await db.prepare('SELECT id FROM admin_accounts WHERE username = ? LIMIT 1').bind(username).first();
        if (found) continue;
        const passwordHash = await hashPassword(initialPassword);
        // Si otra instancia la crea a la vez, el índice único lo impide: no es un error.
        await db
          .prepare('INSERT INTO admin_accounts (id, username, password_hash, role, community_slug, created_at) VALUES (?, ?, ?, ?, NULL, ?)')
          .bind(randomUUID(), username, passwordHash, 'super', Date.now())
          .run()
          .catch((error: unknown) => {
            if (!/unique/i.test(error instanceof Error ? error.message : String(error))) throw error;
          });
      }
    }
  })().catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}
