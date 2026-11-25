FROM public.ecr.aws/docker/library/node:22-alpine
COPY shared/package*.json /app/shared/
RUN npm ci --omit=dev --no-audit --prefix /app/shared
COPY shared/ /app/shared/
WORKDIR /app/services/hostel
COPY services/hostel/package*.json ./
RUN npm ci --omit=dev --no-audit
COPY services/hostel/src/ ./src/
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
