FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY web/package.json ./web/

RUN pnpm install --filter @nameforge/web --frozen-lockfile=false

COPY web ./web

WORKDIR /app/web

EXPOSE 5180

CMD ["pnpm", "dev"]
