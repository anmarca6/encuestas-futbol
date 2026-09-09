import { LEVANTE_TEAM, levanteMatchReports, levanteMatches, levantePlayers } from '@/lib/levante-data';
import type { PredictionDraft } from '@/lib/prediction-types';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

const sameMultiset = (left: string[], right: string[]) => {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => value === sortedRight[index]);
};

export function scorePrediction(prediction: PredictionDraft): number {
  const match = levanteMatches.find((item) => item.id === prediction.matchId);
  if (!match || match.status !== 'FINISHED' || match.homeScore === null || match.awayScore === null) return 0;
  const report = levanteMatchReports[match.matchday];
  if (!report) return 0;

  let points = 0;
  if (prediction.lineup?.formation === report.formation) points += 10;

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
  if (sameMultiset(predictedNames, actualNames)) points += 35;

  if (prediction.predictedScore?.home === match.homeScore && prediction.predictedScore.away === match.awayScore) points += 25;

  const actualScorers = report.levanteGoals.flatMap((goal) => Array(goal.minutes.length).fill(normalize(goal.playerName)) as string[]);
  const predictedScorers = prediction.scorers
    .map((id) => levantePlayers.find((player) => player.id === id)?.displayName)
    .filter((name): name is string => Boolean(name))
    .map(normalize);
  if (sameMultiset(predictedScorers, actualScorers)) points += 20;

  const predictedMvp = levantePlayers.find((player) => player.id === prediction.mvp)?.displayName;
  if (predictedMvp && normalize(predictedMvp) === normalize(report.mvp.playerName)) points += 10;
  return points;
}
