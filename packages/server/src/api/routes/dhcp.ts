import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client.js';

export const dhcpRouter = Router();

const poolSchema = z.object({
  name: z.string().min(1),
  iface: z.string().min(1),
  subnet: z.string().min(1),
  rangeStart: z.string().ip({ version: 'v4' }),
  rangeEnd: z.string().ip({ version: 'v4' }),
  gateway: z.string().ip({ version: 'v4' }),
  dnsServers: z.array(z.string().ip({ version: 'v4' })).default([]),
  leaseSeconds: z.number().int().min(60).default(86400),
  enabled: z.boolean().default(true),
});

dhcpRouter.get('/pools', async (_req, res) => {
  const pools = await prisma.dhcpPool.findMany({
    include: { _count: { select: { leases: true, reservations: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(pools);
});

dhcpRouter.post('/pools', async (req, res) => {
  const parsed = poolSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const pool = await prisma.dhcpPool.create({ data: parsed.data });
  res.status(201).json(pool);
});

dhcpRouter.put('/pools/:id', async (req, res) => {
  const parsed = poolSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const pool = await prisma.dhcpPool
    .update({ where: { id: req.params.id }, data: parsed.data })
    .catch(() => null);
  if (!pool) {
    res.status(404).json({ error: 'Pool nicht gefunden' });
    return;
  }
  res.json(pool);
});

dhcpRouter.delete('/pools/:id', async (req, res) => {
  await prisma.dhcpPool.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

const reservationSchema = z.object({
  poolId: z.string().uuid(),
  macAddress: z
    .string()
    .regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i, 'MAC-Adresse muss Format aa:bb:cc:dd:ee:ff haben'),
  ip: z.string().ip({ version: 'v4' }),
  hostname: z.string().optional(),
});

dhcpRouter.get('/reservations', async (req, res) => {
  const poolId = typeof req.query.poolId === 'string' ? req.query.poolId : undefined;
  const reservations = await prisma.dhcpReservation.findMany({
    where: poolId ? { poolId } : undefined,
  });
  res.json(reservations);
});

dhcpRouter.post('/reservations', async (req, res) => {
  const parsed = reservationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const reservation = await prisma.dhcpReservation.create({
    data: { ...parsed.data, macAddress: parsed.data.macAddress.toLowerCase() },
  });
  res.status(201).json(reservation);
});

dhcpRouter.delete('/reservations/:id', async (req, res) => {
  await prisma.dhcpReservation.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

dhcpRouter.get('/leases', async (req, res) => {
  const poolId = typeof req.query.poolId === 'string' ? req.query.poolId : undefined;
  const leases = await prisma.dhcpLease.findMany({
    where: poolId ? { poolId } : undefined,
    orderBy: { expiresAt: 'desc' },
  });
  res.json(leases);
});

dhcpRouter.delete('/leases/:id', async (req, res) => {
  await prisma.dhcpLease.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});
