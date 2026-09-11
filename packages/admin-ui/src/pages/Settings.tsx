import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Upstream } from '../api/client';

export function Settings() {
  const [upstreams, setUpstreams] = useState<Upstream[]>([]);
  const [newUpstream, setNewUpstream] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setUpstreams(await api.get<Upstream[]>('/settings/upstreams'));
  }

  async function handleAddUpstream(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/settings/upstreams', { address: newUpstream, order: upstreams.length });
      setNewUpstream('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Fehler beim Hinzufügen');
    }
  }

  async function handleDeleteUpstream(id: string) {
    await api.del(`/settings/upstreams/${id}`);
    await load();
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    try {
      await api.post('/settings/change-password', { currentPassword, newPassword });
      setPwMessage('Passwort erfolgreich geändert.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwMessage(err instanceof ApiError ? err.message : 'Fehler beim Ändern');
    }
  }

  return (
    <div>
      <h2>Einstellungen</h2>

      <h3>Upstream-DNS-Server</h3>
      <p>Anfragen für nicht-lokale Domains werden an diese Server weitergeleitet. Ohne Eintrag wird 1.1.1.1 / 8.8.8.8 verwendet.</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Adresse</th>
            <th>Port</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {upstreams.map((u) => (
            <tr key={u.id}>
              <td>{u.address}</td>
              <td>{u.port}</td>
              <td>
                <button className="danger" onClick={() => handleDeleteUpstream(u.id)}>
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={handleAddUpstream} className="inline-form">
        <input
          value={newUpstream}
          onChange={(e) => setNewUpstream(e.target.value)}
          placeholder="8.8.4.4"
          required
        />
        <button type="submit">Hinzufügen</button>
      </form>
      {error && <p className="error-text">{error}</p>}

      <h3>Passwort ändern</h3>
      <form onSubmit={handleChangePassword} className="stacked-form">
        <label>
          Aktuelles Passwort
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </label>
        <label>
          Neues Passwort
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
        </label>
        {pwMessage && <p className={pwMessage.startsWith('Passwort erfolgreich') ? 'success-text' : 'error-text'}>{pwMessage}</p>}
        <button type="submit">Passwort ändern</button>
      </form>
    </div>
  );
}
