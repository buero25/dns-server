import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type DhcpPool, type DhcpReservation, type DhcpLease } from '../api/client';
import { Modal } from '../components/Modal';

export function Dhcp() {
  const [pools, setPools] = useState<DhcpPool[]>([]);
  const [reservations, setReservations] = useState<DhcpReservation[]>([]);
  const [leases, setLeases] = useState<DhcpLease[]>([]);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [showCreateReservation, setShowCreateReservation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [poolForm, setPoolForm] = useState({
    name: '',
    iface: 'eth0',
    subnet: '192.168.1.0/24',
    rangeStart: '192.168.1.100',
    rangeEnd: '192.168.1.200',
    gateway: '192.168.1.1',
    dnsServers: '192.168.1.1',
    leaseSeconds: 86400,
  });

  const [reservationForm, setReservationForm] = useState({ macAddress: '', ip: '', hostname: '' });

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selectedPool) void loadPoolDetails(selectedPool);
  }, [selectedPool]);

  async function load() {
    const data = await api.get<DhcpPool[]>('/dhcp/pools');
    setPools(data);
    if (!selectedPool && data.length > 0) setSelectedPool(data[0].id);
  }

  async function loadPoolDetails(poolId: string) {
    const [res, lea] = await Promise.all([
      api.get<DhcpReservation[]>(`/dhcp/reservations?poolId=${poolId}`),
      api.get<DhcpLease[]>(`/dhcp/leases?poolId=${poolId}`),
    ]);
    setReservations(res);
    setLeases(lea);
  }

  async function handleCreatePool(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/dhcp/pools', {
        ...poolForm,
        dnsServers: poolForm.dnsServers.split(',').map((s) => s.trim()).filter(Boolean),
        leaseSeconds: Number(poolForm.leaseSeconds),
      });
      setShowCreatePool(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Fehler beim Anlegen');
    }
  }

  async function handleDeletePool(id: string) {
    if (!confirm('DHCP-Pool wirklich löschen?')) return;
    await api.del(`/dhcp/pools/${id}`);
    if (selectedPool === id) setSelectedPool(null);
    await load();
  }

  async function handleCreateReservation(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedPool) return;
    try {
      await api.post('/dhcp/reservations', { ...reservationForm, poolId: selectedPool });
      setShowCreateReservation(false);
      setReservationForm({ macAddress: '', ip: '', hostname: '' });
      await loadPoolDetails(selectedPool);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Fehler beim Anlegen');
    }
  }

  async function handleDeleteReservation(id: string) {
    await api.del(`/dhcp/reservations/${id}`);
    if (selectedPool) await loadPoolDetails(selectedPool);
  }

  return (
    <div>
      <div className="page-header">
        <h2>DHCP</h2>
        <button onClick={() => setShowCreatePool(true)}>+ Neuer Pool</button>
      </div>

      <div className="dhcp-pool-list">
        {pools.map((p) => (
          <button
            key={p.id}
            className={`pool-tab ${selectedPool === p.id ? 'active' : ''}`}
            onClick={() => setSelectedPool(p.id)}
          >
            {p.name} ({p.subnet})
          </button>
        ))}
      </div>

      {pools.length === 0 && <p>Noch keine DHCP-Pools angelegt.</p>}

      {selectedPool && (
        <>
          {(() => {
            const pool = pools.find((p) => p.id === selectedPool);
            if (!pool) return null;
            return (
              <div className="pool-detail">
                <p>
                  Interface: <strong>{pool.iface}</strong> · Bereich:{' '}
                  <strong>
                    {pool.rangeStart} – {pool.rangeEnd}
                  </strong>{' '}
                  · Gateway: <strong>{pool.gateway}</strong> · Lease:{' '}
                  <strong>{pool.leaseSeconds}s</strong>
                  <button className="danger" style={{ marginLeft: '1rem' }} onClick={() => handleDeletePool(pool.id)}>
                    Pool löschen
                  </button>
                </p>
              </div>
            );
          })()}

          <div className="page-header">
            <h3>Reservierungen</h3>
            <button onClick={() => setShowCreateReservation(true)}>+ Reservierung</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>MAC-Adresse</th>
                <th>IP</th>
                <th>Hostname</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id}>
                  <td>{r.macAddress}</td>
                  <td>{r.ip}</td>
                  <td>{r.hostname ?? '–'}</td>
                  <td>
                    <button className="danger" onClick={() => handleDeleteReservation(r.id)}>
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={4}>Keine Reservierungen.</td>
                </tr>
              )}
            </tbody>
          </table>

          <h3>Aktive Leases</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>MAC-Adresse</th>
                <th>IP</th>
                <th>Hostname</th>
                <th>Läuft ab</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((l) => (
                <tr key={l.id}>
                  <td>{l.macAddress}</td>
                  <td>{l.ip}</td>
                  <td>{l.hostname ?? '–'}</td>
                  <td>{new Date(l.expiresAt).toLocaleString('de-DE')}</td>
                </tr>
              ))}
              {leases.length === 0 && (
                <tr>
                  <td colSpan={4}>Keine aktiven Leases.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {showCreatePool && (
        <Modal title="Neuer DHCP-Pool" onClose={() => setShowCreatePool(false)}>
          <form onSubmit={handleCreatePool}>
            <label>
              Name
              <input value={poolForm.name} onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })} required autoFocus />
            </label>
            <label>
              Interface
              <input value={poolForm.iface} onChange={(e) => setPoolForm({ ...poolForm, iface: e.target.value })} required />
            </label>
            <label>
              Subnetz (CIDR)
              <input value={poolForm.subnet} onChange={(e) => setPoolForm({ ...poolForm, subnet: e.target.value })} required />
            </label>
            <label>
              Bereich Start
              <input value={poolForm.rangeStart} onChange={(e) => setPoolForm({ ...poolForm, rangeStart: e.target.value })} required />
            </label>
            <label>
              Bereich Ende
              <input value={poolForm.rangeEnd} onChange={(e) => setPoolForm({ ...poolForm, rangeEnd: e.target.value })} required />
            </label>
            <label>
              Gateway
              <input value={poolForm.gateway} onChange={(e) => setPoolForm({ ...poolForm, gateway: e.target.value })} required />
            </label>
            <label>
              DNS-Server (kommagetrennt)
              <input value={poolForm.dnsServers} onChange={(e) => setPoolForm({ ...poolForm, dnsServers: e.target.value })} />
            </label>
            <label>
              Lease-Dauer (Sekunden)
              <input
                type="number"
                value={poolForm.leaseSeconds}
                onChange={(e) => setPoolForm({ ...poolForm, leaseSeconds: Number(e.target.value) })}
                min={60}
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button type="submit">Anlegen</button>
          </form>
        </Modal>
      )}

      {showCreateReservation && (
        <Modal title="Neue Reservierung" onClose={() => setShowCreateReservation(false)}>
          <form onSubmit={handleCreateReservation}>
            <label>
              MAC-Adresse
              <input
                value={reservationForm.macAddress}
                onChange={(e) => setReservationForm({ ...reservationForm, macAddress: e.target.value })}
                placeholder="aa:bb:cc:dd:ee:ff"
                required
                autoFocus
              />
            </label>
            <label>
              IP-Adresse
              <input
                value={reservationForm.ip}
                onChange={(e) => setReservationForm({ ...reservationForm, ip: e.target.value })}
                required
              />
            </label>
            <label>
              Hostname
              <input
                value={reservationForm.hostname}
                onChange={(e) => setReservationForm({ ...reservationForm, hostname: e.target.value })}
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
