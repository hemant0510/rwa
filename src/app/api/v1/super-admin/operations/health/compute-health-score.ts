export function computeHealthScore(
  collectionRate: number,
  lastAdminLoginDaysAgo: number | null,
  residentGrowthPct: number,
  engagementCount: number,
  balance: number,
): number {
  const collectionComponent = Math.min(collectionRate, 100) * 0.3;

  let adminScore = 0;
  if (lastAdminLoginDaysAgo === null) {
    adminScore = 0;
  } else if (lastAdminLoginDaysAgo <= 3) {
    adminScore = 100;
  } else if (lastAdminLoginDaysAgo <= 7) {
    adminScore = 70;
  } else if (lastAdminLoginDaysAgo <= 14) {
    adminScore = 40;
  } else {
    adminScore = 10;
  }
  const adminComponent = adminScore * 0.25;

  const growthScore = Math.min(Math.max(residentGrowthPct, 0), 100);
  const growthComponent = growthScore * 0.15;

  const engagementScore = Math.min(engagementCount * 20, 100);
  const engagementComponent = engagementScore * 0.15;

  const balanceScore = balance > 0 ? 100 : balance === 0 ? 50 : 0;
  const balanceComponent = balanceScore * 0.15;

  return Math.round(
    collectionComponent + adminComponent + growthComponent + engagementComponent + balanceComponent,
  );
}
