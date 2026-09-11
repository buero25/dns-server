import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client.js';

export const recordsRouter = Router();

const recordSchema = z.object({
  zoneId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'SRV']),
  value: z.string().min(1),
  ttl: z.number().int().min(0).default(3600),
  priority: z.number().int().min(0).optional(),
});

recordsRouter.post('/', async (req, res) => {
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const zone = await prisma.zone.findUnique({ where: { id: parsed.data.zoneId } });
  if (!zone) {
    res.status(404).json({ error: 'Zone nicht gefunden' });
    return;
  }

  const record = await prisma.record.create({
    data: { ...parsed.data, name: parsed.data.name.toLowerCase().replace(/\.$/, '') },
  });

  await prisma.zone.update({
    where: { id: zone.id },
    data: { soaSerial: { increment: 1 } },
  });

  res.status(201).json(record);
});

recordsRouter.put('/:id', async (req, res) => {
  const parsed = recordSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const record = await prisma.record.update({
    where: { id: req.params.id },
    data: parsed.data,
  }).catch(() => null);

  if (!record) {
    res.status(404).json({ error: 'Record nicht gefunden' });
    return;
  }

  res.json(record);
});

recordsRouter.delete('/:id', async (req, res) => {
  await prisma.record.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});
