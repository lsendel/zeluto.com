FROM node:20-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY dist/ ./dist/

ENV PORT=8090
EXPOSE 8090

CMD ["node", "dist/index.js"]
