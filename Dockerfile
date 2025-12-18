FROM oven/bun:1.2.20
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY ./ ./

CMD ["bun", "run", "dist/index.js"]

EXPOSE 3005