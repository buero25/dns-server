import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client.js';

export const zonesRouter = Router();

const zoneSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9.-]+$/i, 'Domain enthält ungültige Zeichen'),
});

zonesRouter.get('/', async (_req, res) => {
  const zones = await prisma.zone.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { records: true } } },
  });
  res.json(zones);
});

zonesRouter.post('/', async (req, res) => {
  const parsed = zoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const name = parsed.data.name.toLowerCase().replace(/\.$/, '');
  const existing = await prisma.zone.findUnique({ where: { name } });
  if (existing) {
    res.status(409).json({ error: 'Zone existiert bereits' });
    return;
  }

  const zone = await prisma.zone.create({ data: { name } });
  res.status(201).json(zone);
});

zonesRouter.get('/:id', async (req, res) => {
  const zone = await prisma.zone.findUnique({
    where: { id: req.params.id },
    include: { records: { orderBy: [{ name: 'asc' }, { type: 'asc' }] } },
  });
  if (!zone) {
    res.status(404).json({ error: 'Zone nicht gefunden' });
    return;
  }
  res.json(zone);
});

zonesRouter.delete('/:id', async (req, res) => {
  await prisma.zone.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});
