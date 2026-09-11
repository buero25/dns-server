import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type Zone } from '../api/client';
import { Modal } from '../components/Modal';

export function Zones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setZones(await api.get<Zone[]>('/zones'));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/zones', { name });
      setName('');
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Fehler beim Anlegen');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Zone inklusive aller Records wirklich löschen?')) return;
    await api.del(`/zones/${id}`);
    await load();
  }

  return (
    <div>
      <div className="page-header">
        <h2>Zonen</h2>
        <button onClick={() => setShowCreate(true)}>+ Neue Zone</button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Domain</th>
            <th>Records</th>
            <th>Serial</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id}>
              <td>
                <Link to={`/zones/${z.id}`}>{z.name}</Link>
              </td>
              <td>{z._count?.records ?? 0}</td>
              <td>{z.soaSerial}</td>
              <td>
                <button className="danger" onClick={() => handleDelete(z.id)}>
                  Löschen
                </button>
              </td>
            </tr>
          ))}
          {zones.length === 0 && (
            <tr>
              <td colSpan={4}>Noch keine Zonen angelegt.</td>
            </tr>
          )}
        </tbody>
      </table>

      {showCreate && (
        <Modal title="Neue Zone" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <label>
              Domain
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="beispiel.de"
                required
                autoFocus
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button type="submit">Anlegen</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
