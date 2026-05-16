// lib/weightage.ts
// Smart Weightage Auto-Rebalancer — unique differentiator.

export function suggestRebalance(
  goals: { id: string; weightage: number }[],
  changedId: string,
  newWeightage: number
): { id: string; suggestedWeightage: number }[] {
  const others = goals.filter((g) => g.id !== changedId);
  const remaining = 100 - newWeightage;
  const totalOthers = others.reduce((sum, g) => sum + g.weightage, 0);
  if (totalOthers === 0 || others.length === 0) return [];

  return others.map((g) => ({
    id: g.id,
    suggestedWeightage:
      Math.round((g.weightage / totalOthers) * remaining * 10) / 10,
  }));
}
