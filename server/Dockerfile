FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/package.json app/package.json
COPY management/package.json management/package.json
COPY server/package.json server/package.json
RUN pnpm install --filter @isyen/server --frozen-lockfile
COPY server ./server
RUN pnpm --filter @isyen/server build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/package.json app/package.json
COPY management/package.json management/package.json
COPY server/package.json server/package.json
RUN pnpm install --prod --filter @isyen/server --frozen-lockfile
COPY --from=build /repo/server/dist ./server/dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "--filter", "@isyen/server", "start"]
