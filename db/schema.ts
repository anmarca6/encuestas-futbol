import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nickname: text('nickname').notNull(),
  email: text('email').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_users_nickname').on(table.nickname),
  uniqueIndex('idx_users_email').on(table.email),
]);

export const predictions = sqliteTable('predictions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId: text('match_id').notNull(),
  homeScore: integer('home_score').notNull(),
  awayScore: integer('away_score').notNull(),
  lineup: text('lineup'),
  scorers: text('scorers').notNull().default('[]'),
  mvp: text('mvp'),
  publishedAt: integer('published_at').notNull(),
}, (table) => [
  uniqueIndex('idx_predictions_user_match').on(table.userId, table.matchId),
  index('idx_predictions_match_published').on(table.matchId, table.publishedAt),
]);
