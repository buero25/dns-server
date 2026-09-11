import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, type DnsRecord, type ZoneDetail as ZoneDetailType } from '../api/client';
import { Modal } from '../components/Modal';

const RECORD_TYPES: DnsRecord['type'][] = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'SRV'];

export function ZoneDetail() {
  const { id } = useParams<{ id: string }>();
  const [zone, setZone] = useState<ZoneDetailType | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'A' as DnsRecord['type'], value: '', ttl: 3600, priority: 10 });

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    if (!id) return;
    setZone(await api.get<ZoneDetailType>(`/zones/${id}`));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/records', {
        zoneId: id,
        name: form.name,
        type: form.type,
        value: form.value,
        ttl: Number(form.ttl),
        ...(form.type === 'MX' || form.type === 'SRV' ? { priority: Number(form.priority) } : {}),
      });
      setShowCreate(false);
      setForm({ name: '', type: 'A', value: '', ttl: 3600, priority: 10 });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Fehler beim Anlegen');
    }
  }

  async function handleDelete(recordId: string) {
    if (!confirm('Record löschen?')) return;
    await api.del(`/records/${recordId}`);
    await load();
  }

  if (!zone) return <p>Lädt…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/zones">← Zonen</Link>
          <h2>{zone.name}</h2>
        </div>
        <button onClick={() => setShowCreate(true)}>+ Neuer Record</button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Typ</th>
            <th>Wert</th>
            <th>TTL</th>
            <th>Priorität</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {zone.records.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.type}</td>
              <td>{r.value}</td>
              <td>{r.ttl}</td>
              <td>{r.priority ?? '–'}</td>
              <td>
                <button className="danger" onClick={() => handleDelete(r.id)}>
                  Löschen
                </button>
              </td>
            </tr>
          ))}
          {zone.records.length === 0 && (
            <tr>
              <td colSpan={6}>Noch keine Records in dieser Zone.</td>
            </tr>
          )}
        </tbody>
      </table>

      {showCreate && (
        <Modal title="Neuer Record" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <label>
              Name (Subdomain oder @ für Root)
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={`www.${zone.name}`}
                required
                autoFocus
              />
            </label>
            <label>
              Typ
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DnsRecord['type'] })}>
                {RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Wert
              <input
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === 'A' ? '203.0.113.10' : ''}
                required
              />
            </label>
            <label>
              TTL (Sekunden)
              <input
                type="number"
                value={form.ttl}
                onChange={(e) => setForm({ ...form, ttl: Number(e.target.value) })}
                min={0}
              />
            </label>
            {(form.type === 'MX' || form.type === 'SRV') && (
              <label>
                Priorität
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                  min={0}
                />
              </label>
            )}
            {error && <p className="error-text">{error}</p>}
            <button type="submit">Anlegen</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
