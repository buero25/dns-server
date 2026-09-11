import { Router } from 'express';
import { prisma } from '../../db/client.js';
import { cacheSize } from '../../dns/cache.js';

export const statsRouter = Router();

statsRouter.get('/summary', async (_req, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalQueries24h, bySource, zoneCount, recordCount, poolCount, activeLeaseCount] =
    await Promise.all([
      prisma.queryLog.count({ where: { timestamp: { gte: since24h } } }),
      prisma.queryLog.groupBy({
        by: ['source'],
        where: { timestamp: { gte: since24h } },
        _count: true,
      }),
      prisma.zone.count(),
      prisma.record.count(),
      prisma.dhcpPool.count(),
      prisma.dhcpLease.count({ where: { expiresAt: { gt: new Date() } } }),
    ]);

  res.json({
    totalQueries24h,
    bySource: Object.fromEntries(bySource.map((s) => [s.source, s._count])),
    zoneCount,
    recordCount,
    poolCount,
    activeLeaseCount,
    cacheSize: cacheSize(),
  });
});

statsRouter.get('/recent-queries', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const queries = await prisma.queryLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  res.json(queries);
});
