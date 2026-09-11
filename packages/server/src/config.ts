import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load the repo-root .env regardless of the process's working directory
// (npm workspace scripts run with cwd = packages/server). In Docker, env
// vars are injected directly via env_file, so this is a harmless no-op
// there (no .env file present in the image).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',

  dns: {
    udpPort: Number(process.env.DNS_UDP_PORT ?? 53),
    tcpPort: Number(process.env.DNS_TCP_PORT ?? 53),
    bindAddress: process.env.DNS_BIND_ADDRESS ?? '0.0.0.0',
    defaultUpstreams: (process.env.DNS_UPSTREAM_SERVERS ?? '1.1.1.1,8.8.8.8')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    forwardTimeoutMs: Number(process.env.DNS_FORWARD_TIMEOUT_MS ?? 4000),
  },

  dhcp: {
    enabled: (process.env.DHCP_ENABLED ?? 'true') === 'true',
    port: Number(process.env.DHCP_SERVER_PORT ?? 67),
    bindAddress: process.env.DHCP_BIND_ADDRESS ?? '0.0.0.0',
  },

  api: {
    port: Number(process.env.API_PORT ?? 3000),
  },

  admin: {
    defaultUsername: process.env.ADMIN_DEFAULT_USERNAME ?? 'admin',
    defaultPassword: process.env.ADMIN_DEFAULT_PASSWORD,
  },
};
