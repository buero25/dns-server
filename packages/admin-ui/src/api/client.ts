const BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ? JSON.stringify(body.error) : message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface Zone {
  id: string;
  name: string;
  soaSerial: number;
  _count?: { records: number };
}

export interface DnsRecord {
  id: string;
  zoneId: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'PTR' | 'SRV';
  value: string;
  ttl: number;
  priority?: number | null;
}

export interface ZoneDetail extends Zone {
  records: DnsRecord[];
}

export interface DhcpPool {
  id: string;
  name: string;
  iface: string;
  subnet: string;
  rangeStart: string;
  rangeEnd: string;
  gateway: string;
  dnsServers: string[];
  leaseSeconds: number;
  enabled: boolean;
  _count?: { leases: number; reservations: number };
}

export interface DhcpReservation {
  id: string;
  poolId: string;
  macAddress: string;
  ip: string;
  hostname?: string | null;
}

export interface DhcpLease {
  id: string;
  poolId: string;
  macAddress: string;
  ip: string;
  hostname?: string | null;
  expiresAt: string;
}

export interface Upstream {
  id: string;
  address: string;
  port: number;
  order: number;
}

export interface StatsSummary {
  totalQueries24h: number;
  bySource: Record<string, number>;
  zoneCount: number;
  recordCount: number;
  poolCount: number;
  activeLeaseCount: number;
  cacheSize: number;
}
