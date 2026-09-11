import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import { z } from 'zod';
import { config } from '../config.js';
import { verifyLogin, requireAuth, seedDefaultAdmin } from './auth.js';
import { zonesRouter } from './routes/zones.js';
import { recordsRouter } from './routes/records.js';
import { dhcpRouter } from './routes/dhcp.js';
import { settingsRouter } from './routes/settings.js';
import { statsRouter } from './routes/stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PgSession = connectPgSimple(session);

export async function createApp() {
  await seedDefaultAdmin(config.admin.defaultUsername, config.admin.defaultPassword);

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(
    cors({
      origin: config.isProduction ? true : 'http://localhost:5173',
      credentials: true,
    })
  );

  app.use(
    session({
      store: new PgSession({ conString: config.databaseUrl, createTableIfMissing: true }),
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 12, // 12h
      },
    })
  );

  const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

  app.post('/api/auth/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
      return;
    }

    const user = await verifyLogin(parsed.data.username, parsed.data.password);
    if (!user) {
      res.status(401).json({ error: 'Ungültige Zugangsdaten' });
      return;
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ username: user.username });
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.status(204).end());
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.session.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.json({ username: req.session.username });
  });

  app.use('/api/zones', requireAuth, zonesRouter);
  app.use('/api/records', requireAuth, recordsRouter);
  app.use('/api/dhcp', requireAuth, dhcpRouter);
  app.use('/api/settings', requireAuth, settingsRouter);
  app.use('/api/stats', requireAuth, statsRouter);

  // Serve the built admin UI as static files (single-container deployment).
  const uiDist = path.resolve(__dirname, '../../../admin-ui/dist');
  app.use(express.static(uiDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(path.join(uiDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  return app;
}
