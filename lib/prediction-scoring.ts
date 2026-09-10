import { levanteMatchReports, levanteMatches, levantePlayers } from '@/lib/levante-data';
import type { PredictionDraft } from '@/lib/prediction-types';
import { predictionPoints } from '@/lib/scoring-rules';

const [formationPoints, lineupPoints, resultPoints, scorerPoints, mvpPoints] = predictionPoints.map(([, points]) => points);

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

const sameMultiset = (left: string[], right: string[]) => {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => value === sortedRight[index]);
};

export interface PredictionScoreBreakdown {
  formation: number;
  lineup: number;
  result: number;
  scorers: number;
  mvp: number;
}

const emptyBreakdown = (): PredictionScoreBreakdown => ({
  formation: 0,
  lineup: 0,
  result: 0,
  scorers: 0,
  mvp: 0,
});

export function scorePredictionBreakdown(prediction: PredictionDraft): PredictionScoreBreakdown {
  const breakdown = emptyBreakdown();
  const match = levanteMatches.find((item) => item.id === prediction.matchId);
  if (!match || match.status !== 'FINISHED' || match.homeScore === null || match.awayScore === null) return breakdown;
  const report = levanteMatchReports[match.matchday];
  if (!report) return breakdown;

  if (prediction.lineup?.formation === report.formation) breakdown.formation = formationPoints;

  const actualNames = [
    ...report.lineup.goalkeeper,
    ...report.lineup.defenders,
    ...report.lineup.midfielders,
    ...report.lineup.attackers,
  ].map(normalize).sort();
  const predictedNames = (prediction.lineup?.players ?? [])
    .map((id) => levantePlayers.find((player) => player.id === id)?.displayName)
    .filter((name): name is string => Boolean(name))
    .map(normalize)
    .sort();
  if (sameMultiset(predictedNames, actualNames)) breakdown.lineup = lineupPoints;

  if (prediction.predictedScore?.home === match.homeScore && prediction.predictedScore.away === match.awayScore) breakdown.result = resultPoints;

  const actualScorers = report.levanteGoals.flatMap((goal) => Array(goal.minutes.length).fill(normalize(goal.playerName)) as string[]);
  const predictedScorers = prediction.scorers
    .map((id) => levantePlayers.find((player) => player.id === id)?.displayName)
    .filter((name): name is string => Boolean(name))
    .map(normalize);
  if (sameMultiset(predictedScorers, actualScorers)) breakdown.scorers = scorerPoints;

  const predictedMvp = levantePlayers.find((player) => player.id === prediction.mvp)?.displayName;
  if (predictedMvp && normalize(predictedMvp) === normalize(report.mvp.playerName)) breakdown.mvp = mvpPoints;
  return breakdown;
}

export function scorePrediction(prediction: PredictionDraft): number {
  const breakdown = scorePredictionBreakdown(prediction);
  return breakdown.formation + breakdown.lineup + breakdown.result + breakdown.scorers + breakdown.mvp;
}
