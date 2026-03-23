FROM node:lts-slim

# Install paperclipai globally
RUN npm install -g paperclipai@latest

# Create paperclip home directory with full permissions
RUN mkdir -p /paperclip/instances/default && chmod -R 777 /paperclip

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

USER node
WORKDIR /paperclip

CMD ["npx", "paperclipai", "onboard", "--yes"]
