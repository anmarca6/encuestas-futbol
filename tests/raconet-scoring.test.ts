import test from 'node:test';
import assert from 'node:assert/strict';

import { levanteMatchReports, levanteMatches } from '../lib/levante-data.ts';

test('Levante vs Barcelona matchday 5 must use the official 4-4-2 lineup and the correct 2-4 result', () => {
  const match = levanteMatches.find((item) => item.matchday === 5);
  assert.ok(match, 'Matchday 5 should exist');
  assert.equal(match.status, 'FINISHED');
  assert.equal(match.homeScore, 2);
  assert.equal(match.awayScore, 4);

  const report = levanteMatchReports[5];
  assert.ok(report, 'Matchday 5 should have a completed report');
  assert.equal(report.formation, '4-4-2');

  const homeTeamScorers = report.levanteGoals.map((goal) => goal.playerName);
  assert.deepEqual(homeTeamScorers, ['Iván Romero', 'Roger Brugué']);

  const lineupNames = [
    ...report.lineup.goalkeeper,
    ...report.lineup.defenders,
    ...report.lineup.midfielders,
    ...report.lineup.attackers,
  ];

  assert.ok(lineupNames.includes('Petar Ratkov'));
  assert.ok(lineupNames.includes('Mathew Ryan'));
  assert.ok(lineupNames.includes('Roger Brugué'));
});
