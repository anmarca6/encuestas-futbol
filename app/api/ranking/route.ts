import { NextRequest, NextResponse } from 'next/server';
import { ensureCommunitySchema, getDatabase } from '@/lib/db';
import { resolveCommunity } from '@/lib/community';
import { scorePredictionBreakdown } from '@/lib/prediction-scoring';
import { levanteMatchReports, levanteMatches, levantePlayers } from '@/lib/levante-data';
import type { CommunityRankingEntry } from '@/lib/community-types';
import type { SavedLineup } from '@/lib/formations';

interface RankingPredictionRow {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  matchId: string;
  homeScore: number;
  awayScore: number;
  lineup: string | null;
  scorers: string;
  mvp: string | null;
}

interface OfficialReportRow {
  matchday: number;
  homeScore: number;
  awayScore: number;
  formation: string;
  lineup: string;
  scorers: string;
  mvp: string;
  reason: string;
}

function reportFromOfficialInput(row: OfficialReportRow) {
  const lineup = JSON.parse(row.lineup) as { formation: string; players: string[] };
  return {
    formation: row.formation,
    lineup: {
      goalkeeper: lineup.players.slice(0, 1),
      defenders: lineup.players.slice(1, 5),
      midfielders: lineup.players.slice(5, 9),
      attackers: lineup.players.slice(9, 11),
    },
    levanteGoals: (JSON.parse(row.scorers) as string[]).map((playerId) => ({
      playerName: levantePlayers.find((player) => player.id === playerId)?.displayName ?? playerId,
      minutes: [0],
    })),
    mvp: {
      playerName: levantePlayers.find((player) => player.id === row.mvp)?.displayName ?? row.mvp,
      reason: row.reason,
    },
  };
}

export async function GET(request: NextRequest) {
  await ensureCommunitySchema();
  const community = await resolveCommunity(request);
  if (!community) return NextResponse.json({ ranking: [] });
  const rows = await getDatabase().prepare(`
    SELECT u.id AS userId, u.nickname, u.avatar_url AS avatarUrl, p.match_id AS matchId,
      p.home_score AS homeScore, p.away_score AS awayScore,
      p.lineup, p.scorers, p.mvp
    FROM predictions p
    JOIN users u ON u.id = p.user_id
    WHERE u.community_slug = ?
    ORDER BY u.nickname COLLATE NOCASE ASC
  `).bind(community.slug).all<RankingPredictionRow>();
  const officialRows = await getDatabase().prepare(`
    SELECT matchday, home_score AS homeScore, away_score AS awayScore,
      formation, lineup, scorers, mvp, reason
    FROM official_match_reports
  `).bind().all<OfficialReportRow>();
  const officialReports = new Map<number, ReturnType<typeof reportFromOfficialInput>>();
  const officialResultByMatchday = new Map<number, { homeScore: number; awayScore: number }>();
  for (const official of officialRows.results) {
    officialReports.set(official.matchday, reportFromOfficialInput(official));
    officialResultByMatchday.set(official.matchday, {
      homeScore: official.homeScore,
      awayScore: official.awayScore,
    });
  }

  const entries = new Map<string, CommunityRankingEntry>();
  for (const row of rows.results) {
    const match = levanteMatches.find((item) => item.id === row.matchId);
    const current = entries.get(row.userId) ?? {
      userId: row.userId,
      nickname: row.nickname,
      avatarUrl: row.avatarUrl,
      points: 0,
      predictions: 0,
      breakdown: { formation: 0, lineup: 0, result: 0, scorers: 0, mvp: 0 },
      matchBreakdowns: [],
    };
    current.predictions += 1;
    const reportOverride = match ? officialReports.get(match.matchday) ?? levanteMatchReports[match.matchday] : null;
    const officialResult = match ? officialResultByMatchday.get(match.matchday) ?? {
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    } : null;
    const breakdown = scorePredictionBreakdown({
      matchId: row.matchId,
      predictedScore: { home: row.homeScore, away: row.awayScore },
      lineup: row.lineup ? JSON.parse(row.lineup) as SavedLineup : null,
      scorers: JSON.parse(row.scorers) as string[],
      mvp: row.mvp,
    });
    const actualGoalMinutes = reportOverride?.levanteGoals ?? [];
    if (match && reportOverride && actualGoalMinutes.length > 0) {
      const actualScorers = actualGoalMinutes.map((goal) => goal.playerName);
      const actualNames = actualGoalMinutes.flatMap((goal) => Array(goal.minutes.length).fill(goal.playerName));
      const predictedScorers = (JSON.parse(row.scorers) as string[]).map((id) => levantePlayers.find((player) => player.id === id)?.displayName).filter(Boolean) as string[];
      const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
      const samePlayers = predictedScorers.length === actualScorers.length && predictedScorers.every((value, index) => normalized(value) === normalized(actualScorers[index]));
      if (samePlayers) {
        breakdown.scorers = 4;
      }
      const reportLineup = reportOverride.lineup;
      const actualLineup = [...reportLineup.goalkeeper, ...reportLineup.defenders, ...reportLineup.midfielders, ...reportLineup.attackers].map(normalized).sort();
      const predictedLineup = row.lineup ? (JSON.parse(row.lineup) as SavedLineup).players.map((id) => levantePlayers.find((player) => player.id === id)?.displayName ?? '').filter(Boolean).map(normalized).sort() : [];
      if (predictedLineup.length === actualLineup.length && predictedLineup.every((value, index) => value === actualLineup[index])) {
        breakdown.lineup = 7;
      }
      if (officialResult && row.homeScore === officialResult.homeScore && row.awayScore === officialResult.awayScore) breakdown.result = 5;
      const predictedMvp = row.mvp ? levantePlayers.find((player) => player.id === row.mvp)?.displayName ?? '' : '';
      if (predictedMvp && normalized(predictedMvp) === normalized(reportOverride.mvp.playerName)) breakdown.mvp = 2;
      if (row.lineup && (JSON.parse(row.lineup) as SavedLineup).formation === reportOverride.formation) breakdown.formation = 2;
    }
    current.points += breakdown.formation + breakdown.lineup + breakdown.result + breakdown.scorers + breakdown.mvp;
    current.breakdown.formation += breakdown.formation;
    current.breakdown.lineup += breakdown.lineup;
    current.breakdown.result += breakdown.result;
    current.breakdown.scorers += breakdown.scorers;
    current.breakdown.mvp += breakdown.mvp;
    if (match) {
      current.matchBreakdowns.push({
        matchday: match.matchday,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        points: breakdown.formation + breakdown.lineup + breakdown.result + breakdown.scorers + breakdown.mvp,
        breakdown,
      });
    }
    entries.set(row.userId, current);
  }

  const ranking = [...entries.values()].sort(
    (a, b) => b.points - a.points || a.nickname.localeCompare(b.nickname, 'es', { sensitivity: 'base' }),
  );
  return NextResponse.json({ ranking });
}
