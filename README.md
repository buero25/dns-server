# DNS-Server mit Web-Admin-Panel

[![GitHub Repo](https://img.shields.io/badge/GitHub-buero25%2Fdns--server-181717?logo=github)](https://github.com/buero25/dns-server)
[![CI](https://github.com/buero25/dns-server/actions/workflows/ci.yml/badge.svg)](https://github.com/buero25/dns-server/actions/workflows/ci.yml)
[![Docker](https://github.com/buero25/dns-server/actions/workflows/docker.yml/badge.svg)](https://github.com/buero25/dns-server/actions/workflows/docker.yml)
[![Stars](https://img.shields.io/github/stars/buero25/dns-server?style=social)](https://github.com/buero25/dns-server/stargazers)
[![Forks](https://img.shields.io/github/forks/buero25/dns-server?style=social)](https://github.com/buero25/dns-server/forks)
[![License](https://img.shields.io/github/license/buero25/dns-server)](LICENSE)

Ein selbst gehosteter DNS-Server (autoritativ + rekursiver Forwarder mit Cache) inklusive
DHCP-Server und webbasierter Admin-Oberfläche zur Konfiguration von Zonen, DNS-Records,
DHCP-Pools/Reservierungen und Upstream-Servern.

## Architektur

```
packages/
├── server/      Node.js + TypeScript: DNS-Engine, DHCP-Engine, REST-API, Auth
└── admin-ui/    React + Vite: Web-Oberfläche (wird vom server-Container mit ausgeliefert)
```

- **DNS:** eigener UDP/TCP-Server (Port 53) auf Basis von `dns-packet`. Anfragen für Domains,
  die als Zone angelegt sind, werden autoritativ aus PostgreSQL beantwortet. Alles andere wird
  an konfigurierbare Upstream-Server (Standard: 1.1.1.1 / 8.8.8.8) weitergeleitet und
  In-Memory nach TTL gecacht.
- **DHCP:** eigener UDP-Server (Port 67) implementiert DISCOVER/OFFER/REQUEST/ACK/RELEASE
  nach RFC 2131. IP-Vergabe respektiert feste Reservierungen (nach MAC-Adresse) vor
  dynamischer Pool-Vergabe. Leases werden in PostgreSQL persistiert.
- **Admin-API:** Express, Session-Auth (bcrypt + `express-session`, Session-Store in Postgres).
- **Admin-UI:** React-Dashboard für Zonen/Records, DHCP-Pools/Reservierungen/Leases,
  Upstream-Server und Passwortänderung.

## Lokale Entwicklung

Voraussetzungen: Node.js 20+, Docker (für PostgreSQL) oder eine lokale Postgres-Instanz.

```bash
cp .env.example .env
# .env anpassen: DATABASE_URL auf lokale Postgres-Instanz zeigen lassen, SESSION_SECRET setzen

npm install
npm run prisma:migrate     # wendet die Migrationen an
npm run dev:server         # startet DNS/DHCP/API mit Auto-Reload (benötigt ggf. sudo für Port 53/67)
npm run dev:ui             # separat: Vite-Dev-Server für das Admin-UI auf Port 5173
```

Das Admin-UI läuft im Dev-Modus auf `http://localhost:5173` und spricht die API über einen
Vite-Proxy zu `http://localhost:3000` an.

> **Hinweis Windows:** Die Ports 53 und 67 sind privilegiert. Für lokale Entwicklung ohne
> Admin-Rechte können `DNS_UDP_PORT` / `DNS_TCP_PORT` (z.B. auf 5300) bzw. `DHCP_SERVER_PORT`
> in der `.env` auf einen Port > 1024 gesetzt werden.

## Vorgefertigtes Docker-Image

Bei jedem Push auf `main` baut die [Docker-Workflow](.github/workflows/docker.yml) das
Server-Image automatisch und veröffentlicht es öffentlich auf GitHub Container Registry:

```bash
docker pull ghcr.io/buero25/dns-server-app:latest
```

Das Image enthält nur den `app`-Service (Server + gebautes Admin-UI); für PostgreSQL wird
weiterhin ein separater Container benötigt. Schneller lokaler Test ohne `docker compose`:

```bash
docker network create dns-test

docker run -d --name dns-postgres --network dns-test \
  -e POSTGRES_USER=dns_admin -e POSTGRES_PASSWORD=changeme -e POSTGRES_DB=dns_server \
  postgres:16-alpine

docker run -d --name dns-app --network dns-test \
  -e DATABASE_URL="postgresql://dns_admin:changeme@dns-postgres:5432/dns_server" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e ADMIN_DEFAULT_USERNAME=admin -e ADMIN_DEFAULT_PASSWORD=changeme \
  -p 53:53/udp -p 53:53/tcp -p 67:67/udp -p 3000:3000/tcp \
  ghcr.io/buero25/dns-server-app:latest
```

Für den produktiven Einsatz (mit `docker compose`, Migrationen, DHCP-Host-Networking etc.)
siehe die folgenden Abschnitte — dort baut `docker compose up -d --build` das Image bei Bedarf
auch lokal aus dem Quellcode.

## Produktions-Deployment (Docker, Linux-VPS)

```bash
cp .env.example .env
# .env mit echten Werten befüllen: DATABASE_URL (Postgres-Service-Name "postgres" verwenden),
# SESSION_SECRET (z.B. `openssl rand -hex 32`), ADMIN_DEFAULT_PASSWORD, POSTGRES_* Variablen

docker compose up -d --build
```

Das legt zwei Container an: `postgres` (Datenbank) und `app` (DNS + DHCP + API + Admin-UI in
einem Container/Prozess). Beim ersten Start wird automatisch ein Admin-Account aus
`ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD` angelegt (nur falls noch kein User
existiert) — **danach das Passwort im Admin-UI unter „Einstellungen“ ändern.**

Die Admin-Oberfläche ist danach unter `http://<server-ip>:3000` erreichbar. Für den
produktiven Einsatz sollte davor ein Reverse-Proxy mit TLS (z.B. Caddy oder nginx +
Let's Encrypt) stehen, damit `secure: true` bei den Session-Cookies greift und der
Login nicht unverschlüsselt übertragen wird.

### DHCP im Produktivbetrieb

Damit DHCP-Broadcasts (Port 67/udp) das physische LAN erreichen, muss der Container mit
Host-Networking laufen (Docker-Bridge-Networking blockiert Broadcast-Verkehr ins LAN):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Falls die `!reset`-Merge-Syntax in `docker-compose.prod.yml` von der installierten
Docker-Compose-Version nicht unterstützt wird (benötigt Compose v2.24+), im `app`-Service
von `docker-compose.yml` manuell `network_mode: host` setzen und den `ports`-Block entfernen.

Falls kein DHCP benötigt wird, `DHCP_ENABLED=false` in `.env` setzen — dann reicht das
normale Bridge-Networking aus `docker-compose.yml` für DNS und Admin-API.

### Port 53 / 67 als privilegierte Ports

Im Container läuft der Prozess als root (Standard-`node`-Image), daher ist das Binden an
Port 53/67 kein Problem. Läuft die App stattdessen direkt auf dem Host (ohne Docker), braucht
der Node-Prozess `CAP_NET_BIND_SERVICE`:

```bash
sudo setcap 'cap_net_bind_service=+ep' $(which node)
```

## Verifikation

1. `docker compose up -d --build` — Postgres und App starten fehlerfrei, Migrationen laufen
   automatisch (`prisma migrate deploy` im Container-Start-Command).
2. Login unter `http://<server-ip>:3000` mit dem Seed-Admin-Account.
3. Im Admin-UI eine Zone anlegen (z.B. `test.local`) mit einem A-Record (`www` → `203.0.113.10`).
4. `dig @<server-ip> www.test.local` liefert die konfigurierte IP autoritativ zurück.
5. `dig @<server-ip> google.com` liefert eine Antwort über den Forwarder; eine zweite Anfrage
   kommt aus dem Cache (im Dashboard an `source: CACHE` in den Query-Logs erkennbar).
6. Im Admin-UI einen DHCP-Pool anlegen; ein Client im selben Subnetz erhält beim nächsten
   DHCP-Request eine Lease, sichtbar unter „DHCP → Aktive Leases“.
7. Dashboard zeigt Live-Statistiken (Anfragen der letzten 24h, Cache-Größe, aktive Leases).

## Sicherheitshinweise

- Admin-Login läuft über Session-Cookies (`httpOnly`, `sameSite=strict`, in Produktion
  `secure`) — daher HTTPS über einen Reverse-Proxy einrichten.
- `SESSION_SECRET` muss ein langer, zufälliger Wert sein und darf nicht öffentlich werden.
- `ADMIN_DEFAULT_PASSWORD` nur für den allerersten Start verwenden und danach im UI ändern
  oder aus der `.env` entfernen.
