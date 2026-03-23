FROM node:lts-slim

# Install pnpm
RUN npm install -g pnpm

# Create paperclip home directory
RUN mkdir -p /paperclip && chown node:node /paperclip

WORKDIR /app

# Copy monorepo source (node_modules excluded via .dockerignore)
COPY . .

# Hoist all packages to /app/node_modules so Node.js ESM can resolve
# external deps (zod, drizzle-orm, etc.) from the CLI bundle at runtime
RUN echo "shamefully-hoist=true" >> .npmrc

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# Build workspace deps in order (server depends on shared + plugin-sdk)
RUN pnpm --filter @paperclipai/shared build
RUN pnpm --filter @paperclipai/plugin-sdk build

# Build UI and embed into server
RUN pnpm --filter @paperclipai/ui build
RUN cp -r ui/dist server/ui-dist

# Build server and CLI
RUN pnpm --filter @paperclipai/server build
RUN pnpm --filter paperclipai build

ENV NODE_ENV=production \
  HOME=/paperclip \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  PAPERCLIP_HOME=/paperclip \
  PAPERCLIP_INSTANCE_ID=default \
  PAPERCLIP_CONFIG=/paperclip/instances/default/config.json \
  PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  PAPERCLIP_DEPLOYMENT_EXPOSURE=private

EXPOSE 3100

CMD ["node", "/app/cli/dist/index.js", "onboard", "--yes"]
