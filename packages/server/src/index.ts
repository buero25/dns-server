import { config } from './config.js';
import { startDnsUdpServer, startDnsTcpServer } from './dns/server.js';
import { startDhcpServer } from './dhcp/server.js';
import { createApp } from './api/app.js';
import { prisma } from './db/client.js';

async function main() {
  await prisma.$connect();
  console.log('[db] connected to PostgreSQL');

  startDnsUdpServer();
  startDnsTcpServer();
  startDhcpServer();

  const app = await createApp();
  app.listen(config.api.port, () => {
    console.log(`[api] listening on :${config.api.port}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
