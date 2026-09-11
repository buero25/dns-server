import { useEffect, useState } from 'react';
import { api, type StatsSummary } from '../api/client';

interface QueryLogEntry {
  id: string;
  timestamp: string;
  queryName: string;
  queryType: string;
  clientIp: string;
  responseCode: string;
  source: string;
}

export function Dashboard() {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [recent, setRecent] = useState<QueryLogEntry[]>([]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  async function refresh() {
    const [summary, queries] = await Promise.all([
      api.get<StatsSummary>('/stats/summary'),
      api.get<QueryLogEntry[]>('/stats/recent-queries?limit=25'),
    ]);
    setStats(summary);
    setRecent(queries);
  }

  return (
    <div>
      <h2>Dashboard</h2>
      {stats && (
        <div className="stat-grid">
          <StatCard label="Anfragen (24h)" value={stats.totalQueries24h} />
          <StatCard label="Zonen" value={stats.zoneCount} />
          <StatCard label="Records" value={stats.recordCount} />
          <StatCard label="DHCP-Pools" value={stats.poolCount} />
          <StatCard label="Aktive Leases" value={stats.activeLeaseCount} />
          <StatCard label="Cache-Einträge" value={stats.cacheSize} />
        </div>
      )}

      <h3>Letzte Anfragen</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Zeit</th>
            <th>Name</th>
            <th>Typ</th>
            <th>Client</th>
            <th>Quelle</th>
            <th>Antwort</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((q) => (
            <tr key={q.id}>
              <td>{new Date(q.timestamp).toLocaleTimeString('de-DE')}</td>
              <td>{q.queryName}</td>
              <td>{q.queryType}</td>
              <td>{q.clientIp}</td>
              <td>{q.source}</td>
              <td>{q.responseCode}</td>
            </tr>
          ))}
          {recent.length === 0 && (
            <tr>
              <td colSpan={6}>Noch keine Anfragen protokolliert.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
