import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { hashPassword, verifyLogin } from '../auth.js';

export const settingsRouter = Router();

const upstreamSchema = z.object({
  address: z.string().ip(),
  port: z.number().int().min(1).max(65535).default(53),
  order: z.number().int().min(0).default(0),
});

settingsRouter.get('/upstreams', async (_req, res) => {
  const upstreams = await prisma.upstream.findMany({ orderBy: { order: 'asc' } });
  res.json(upstreams);
});

settingsRouter.post('/upstreams', async (req, res) => {
  const parsed = upstreamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const upstream = await prisma.upstream.create({ data: parsed.data });
  res.status(201).json(upstream);
});

settingsRouter.delete('/upstreams/:id', async (req, res) => {
  await prisma.upstream.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Neues Passwort muss mindestens 8 Zeichen lang sein'),
});

settingsRouter.post('/change-password', async (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const username = req.session.username;
  if (!username) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = await verifyLogin(username, parsed.data.currentPassword);
  if (!user) {
    res.status(400).json({ error: 'Aktuelles Passwort ist falsch' });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.status(204).end();
});
