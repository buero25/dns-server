import dgram from 'node:dgram';
import { config } from '../config.js';
import { decode, encode } from './packet.js';
import { resolveLeaseIp, commitLease, releaseLease, findPoolForInterface } from './leases.js';
import { subnetMaskFromCidr } from './pool.js';

const BROADCAST_ADDR = '255.255.255.255';
const CLIENT_PORT = 68;

export function startDhcpServer(): dgram.Socket | null {
  if (!config.dhcp.enabled) {
    console.log('[dhcp] disabled via config, skipping');
    return null;
  }

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('message', async (msg) => {
    const packet = decode(msg);
    if (!packet) return;

    try {
      const pool = await findPoolForInterface();
      if (!pool) return; // no DHCP pool configured — nothing to offer

      const serverId = pool.gateway;
      const subnetMask = subnetMaskFromCidr(pool.subnet);

      if (packet.messageType === 'DISCOVER') {
        const ip = await resolveLeaseIp(pool, packet.chaddr);
        if (!ip) {
          console.warn('[dhcp] pool exhausted, cannot offer address');
          return;
        }
        const response = encode({
          xid: packet.xid,
          messageType: 'OFFER',
          yiaddr: ip,
          chaddr: packet.chaddr,
          serverId,
          subnetMask,
          router: pool.gateway,
          dnsServers: pool.dnsServers,
          leaseSeconds: pool.leaseSeconds,
        });
        socket.send(response, CLIENT_PORT, BROADCAST_ADDR);
      } else if (packet.messageType === 'REQUEST') {
        const ip = packet.requestedIp ?? packet.ciaddr;
        if (!ip || ip === '0.0.0.0') return;

        await commitLease(pool, packet.chaddr, ip, packet.hostname);

        const response = encode({
          xid: packet.xid,
          messageType: 'ACK',
          yiaddr: ip,
          chaddr: packet.chaddr,
          serverId,
          subnetMask,
          router: pool.gateway,
          dnsServers: pool.dnsServers,
          leaseSeconds: pool.leaseSeconds,
        });
        socket.send(response, CLIENT_PORT, BROADCAST_ADDR);
      } else if (packet.messageType === 'RELEASE') {
        await releaseLease(packet.chaddr, packet.ciaddr);
      }
    } catch (err) {
      console.error('[dhcp] error handling packet:', err);
    }
  });

  socket.on('error', (err) => {
    console.error('[dhcp] socket error:', err);
  });

  socket.bind(config.dhcp.port, config.dhcp.bindAddress, () => {
    socket.setBroadcast(true);
    console.log(`[dhcp] listening on ${config.dhcp.bindAddress}:${config.dhcp.port}`);
  });

  return socket;
}
