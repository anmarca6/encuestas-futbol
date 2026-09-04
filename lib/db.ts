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
