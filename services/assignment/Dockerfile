FROM public.ecr.aws/docker/library/node:22-alpine
COPY shared/package*.json /app/shared/
RUN npm ci --omit=dev --no-audit --prefix /app/shared
COPY shared/ /app/shared/
WORKDIR /app/services/assignment
COPY services/assignment/package*.json ./
RUN npm ci --omit=dev --no-audit
COPY services/assignment/src/ ./src/
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
