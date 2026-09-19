import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const communities = sqliteTable('communities', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  nickname: text('nickname').notNull(),
  createdAt: integer('created_at').notNull(),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  communitySlug: text('community_slug').notNull().default('granota').references(() => communities.slug),
}, (table) => [
  uniqueIndex('idx_users_community_nickname').on(table.communitySlug, table.nickname),
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
