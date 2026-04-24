FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY api/package.json ./api/

RUN pnpm install --filter @nameforge/api --frozen-lockfile=false

COPY api ./api

WORKDIR /app/api

RUN pnpm exec prisma generate

EXPOSE 3002

CMD ["pnpm", "dev"]
