import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../db/client.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    username?: string;
  }
}

const SALT_ROUNDS = 12;

export async function verifyLogin(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    next();
    return;
  }
  res.status(401).json({ error: 'Not authenticated' });
}

/**
 * Ensures a default admin account exists on first startup, using
 * ADMIN_DEFAULT_USERNAME / ADMIN_DEFAULT_PASSWORD from the environment.
 * No-ops once at least one user exists.
 */
export async function seedDefaultAdmin(username: string, password?: string) {
  const count = await prisma.user.count();
  if (count > 0) return;

  if (!password) {
    console.warn(
      '[auth] No users exist and ADMIN_DEFAULT_PASSWORD is not set — skipping admin seed. ' +
        'Set ADMIN_DEFAULT_PASSWORD and restart, or create a user manually.'
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({ data: { username, passwordHash } });
  console.log(`[auth] Seeded default admin user "${username}"`);
}
