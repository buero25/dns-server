/**
 * Minimal DHCP (RFC 2131) packet encoder/decoder — just enough of BOOTP +
 * the DHCP options we need (53 message type, 50 requested IP, 54 server id,
 * 1 subnet mask, 3 router, 6 DNS, 51 lease time, 55 param request list).
 */

export type DhcpMessageType = 'DISCOVER' | 'OFFER' | 'REQUEST' | 'ACK' | 'NAK' | 'RELEASE' | 'DECLINE' | 'INFORM';

const MESSAGE_TYPE_BY_CODE: Record<number, DhcpMessageType> = {
  1: 'DISCOVER',
  2: 'OFFER',
  3: 'REQUEST',
  4: 'DECLINE',
  5: 'ACK',
  6: 'NAK',
  7: 'RELEASE',
  8: 'INFORM',
};

const CODE_BY_MESSAGE_TYPE: Record<DhcpMessageType, number> = {
  DISCOVER: 1,
  OFFER: 2,
  REQUEST: 3,
  DECLINE: 4,
  ACK: 5,
  NAK: 6,
  RELEASE: 7,
  INFORM: 8,
};

const MAGIC_COOKIE = Buffer.from([99, 130, 83, 99]);

export interface DhcpPacket {
  op: number;
  xid: number;
  ciaddr: string;
  yiaddr: string;
  siaddr: string;
  giaddr: string;
  chaddr: string; // MAC address, e.g. "aa:bb:cc:dd:ee:ff"
  messageType: DhcpMessageType;
  requestedIp?: string;
  serverId?: string;
  hostname?: string;
}

function ipToBuffer(ip: string): Buffer {
  const parts = ip.split('.').map(Number);
  return Buffer.from(parts.length === 4 ? parts : [0, 0, 0, 0]);
}

function bufferToIp(buf: Buffer): string {
  return `${buf[0]}.${buf[1]}.${buf[2]}.${buf[3]}`;
}

function macToBuffer(mac: string): Buffer {
  const bytes = mac.split(':').map((b) => parseInt(b, 16));
  const buf = Buffer.alloc(16);
  Buffer.from(bytes).copy(buf);
  return buf;
}

function bufferToMac(buf: Buffer): string {
  return Array.from(buf.subarray(0, 6))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

export function decode(msg: Buffer): DhcpPacket | null {
  if (msg.length < 240) return null;
  if (!msg.subarray(236, 240).equals(MAGIC_COOKIE)) return null;

  const packet: DhcpPacket = {
    op: msg.readUInt8(0),
    xid: msg.readUInt32BE(4),
    ciaddr: bufferToIp(msg.subarray(12, 16)),
    yiaddr: bufferToIp(msg.subarray(16, 20)),
    siaddr: bufferToIp(msg.subarray(20, 24)),
    giaddr: bufferToIp(msg.subarray(24, 28)),
    chaddr: bufferToMac(msg.subarray(28, 44)),
    messageType: 'DISCOVER',
  };

  let offset = 240;
  while (offset < msg.length) {
    const code = msg.readUInt8(offset);
    if (code === 255) break; // end option
    if (code === 0) {
      offset += 1;
      continue;
    }
    const len = msg.readUInt8(offset + 1);
    const value = msg.subarray(offset + 2, offset + 2 + len);

    if (code === 53 && len === 1) {
      packet.messageType = MESSAGE_TYPE_BY_CODE[value.readUInt8(0)] ?? 'DISCOVER';
    } else if (code === 50 && len === 4) {
      packet.requestedIp = bufferToIp(value);
    } else if (code === 54 && len === 4) {
      packet.serverId = bufferToIp(value);
    } else if (code === 12) {
      packet.hostname = value.toString('utf8');
    }

    offset += 2 + len;
  }

  return packet;
}

export interface EncodeParams {
  xid: number;
  messageType: DhcpMessageType;
  yiaddr: string;
  chaddr: string;
  serverId: string;
  subnetMask: string;
  router: string;
  dnsServers: string[];
  leaseSeconds: number;
}

export function encode(params: EncodeParams): Buffer {
  const header = Buffer.alloc(240);
  header.writeUInt8(2, 0); // op: BOOTREPLY
  header.writeUInt8(1, 1); // htype: Ethernet
  header.writeUInt8(6, 2); // hlen
  header.writeUInt8(0, 3); // hops
  header.writeUInt32BE(params.xid, 4);
  header.writeUInt16BE(0, 8); // secs
  header.writeUInt16BE(0, 10); // flags
  ipToBuffer('0.0.0.0').copy(header, 12); // ciaddr
  ipToBuffer(params.yiaddr).copy(header, 16); // yiaddr
  ipToBuffer(params.serverId).copy(header, 20); // siaddr
  ipToBuffer('0.0.0.0').copy(header, 24); // giaddr
  macToBuffer(params.chaddr).copy(header, 28); // chaddr (16 bytes)
  MAGIC_COOKIE.copy(header, 236);

  const options: Buffer[] = [];

  options.push(Buffer.from([53, 1, CODE_BY_MESSAGE_TYPE[params.messageType]]));
  options.push(Buffer.concat([Buffer.from([54, 4]), ipToBuffer(params.serverId)]));
  options.push(Buffer.concat([Buffer.from([51, 4]), int32(params.leaseSeconds)]));
  options.push(Buffer.concat([Buffer.from([1, 4]), ipToBuffer(params.subnetMask)]));
  options.push(Buffer.concat([Buffer.from([3, 4]), ipToBuffer(params.router)]));

  if (params.dnsServers.length > 0) {
    const dnsBuf = Buffer.concat(params.dnsServers.map(ipToBuffer));
    options.push(Buffer.concat([Buffer.from([6, dnsBuf.length]), dnsBuf]));
  }

  options.push(Buffer.from([255]));

  return Buffer.concat([header, ...options]);
}

function int32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value, 0);
  return buf;
}
