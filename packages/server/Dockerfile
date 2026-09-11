FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json ./
COPY packages/server/package.json packages/server/package.json
COPY packages/admin-ui/package.json packages/admin-ui/package.json
RUN npm install

COPY packages/server packages/server
COPY packages/admin-ui packages/admin-ui

RUN npm run build -w packages/admin-ui
RUN npx prisma generate --schema packages/server/prisma/schema.prisma
RUN npm run build -w packages/server

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /repo/package.json ./
COPY --from=build /repo/packages/server/package.json packages/server/package.json
RUN npm install --omit=dev -w packages/server

COPY --from=build /repo/packages/server/dist packages/server/dist
COPY --from=build /repo/packages/server/prisma packages/server/prisma
COPY --from=build /repo/packages/admin-ui/dist packages/admin-ui/dist

WORKDIR /app/packages/server
RUN npx prisma generate

EXPOSE 53/udp 53/tcp 67/udp 3000/tcp
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
