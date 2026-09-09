export const predictionPoints = [
  ['Formación correcta', 2],
  ['XI titular', 7],
  ['Resultado', 5],
  ['Goleadores', 4],
  ['MVP', 2],
] as const;

export const MAX_POINTS_PER_MATCH = predictionPoints.reduce(
  (total, [, points]) => total + points,
  0,
);
