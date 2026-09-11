import dgram from 'node:dgram';
import net from 'node:net';
import dnsPacket, { type Packet } from 'dns-packet';
import { config } from '../config.js';
import { resolveQuestion, logQuery } from './resolver.js';

// RCODE occupies the low 4 bits of the DNS flags word (RFC 1035 §4.1.1).
const RCODE = { NOERROR: 0, SERVFAIL: 2, NXDOMAIN: 3 } as const;

async function buildResponse(query: Packet, clientIp: string): Promise<Buffer> {
  const question = query.questions?.[0];

  if (!question) {
    return dnsPacket.encode({
      type: 'response',
      id: query.id,
      flags: dnsPacket.RECURSION_AVAILABLE,
      questions: [],
      answers: [],
    });
  }

  try {
    const result = await resolveQuestion(question.name, question.type);
    const rcode = result.source === 'NXDOMAIN' ? 'NXDOMAIN' : 'NOERROR';

    await logQuery({
      queryName: question.name,
      queryType: question.type,
      clientIp,
      responseCode: rcode,
      source: result.source,
    });

    return dnsPacket.encode({
      type: 'response',
      id: query.id,
      flags:
        dnsPacket.RECURSION_AVAILABLE |
        (result.authoritative ? dnsPacket.AUTHORITATIVE_ANSWER : 0) |
        RCODE[rcode],
      questions: query.questions,
      answers: result.answers,
    });
  } catch (err) {
    console.error(`[dns] resolve error for ${question.name}:`, err);
    await logQuery({
      queryName: question.name,
      queryType: question.type,
      clientIp,
      responseCode: 'SERVFAIL',
      source: 'NXDOMAIN',
    });
    return dnsPacket.encode({
      type: 'response',
      id: query.id,
      flags: dnsPacket.RECURSION_AVAILABLE | RCODE.SERVFAIL,
      questions: query.questions,
      answers: [],
    });
  }
}

export function startDnsUdpServer(): dgram.Socket {
  const socket = dgram.createSocket('udp4');

  socket.on('message', async (msg, rinfo) => {
    try {
      const query = dnsPacket.decode(msg);
      const response = await buildResponse(query, rinfo.address);
      socket.send(response, rinfo.port, rinfo.address);
    } catch (err) {
      console.error('[dns] failed to handle UDP message:', err);
    }
  });

  socket.on('error', (err) => {
    console.error('[dns] UDP socket error:', err);
  });

  socket.bind(config.dns.udpPort, config.dns.bindAddress, () => {
    console.log(`[dns] UDP listening on ${config.dns.bindAddress}:${config.dns.udpPort}`);
  });

  return socket;
}

export function startDnsTcpServer(): net.Server {
  const server = net.createServer((socket) => {
    socket.on('data', async (data) => {
      try {
        // TCP DNS messages are prefixed with a 2-byte length.
        const message = data.subarray(2);
        const query = dnsPacket.decode(message);
        const response = await buildResponse(query, socket.remoteAddress ?? 'unknown');
        const lengthPrefix = Buffer.alloc(2);
        lengthPrefix.writeUInt16BE(response.length, 0);
        socket.write(Buffer.concat([lengthPrefix, response]));
      } catch (err) {
        console.error('[dns] failed to handle TCP message:', err);
        socket.destroy();
      }
    });
  });

  server.listen(config.dns.tcpPort, config.dns.bindAddress, () => {
    console.log(`[dns] TCP listening on ${config.dns.bindAddress}:${config.dns.tcpPort}`);
  });

  return server;
}
