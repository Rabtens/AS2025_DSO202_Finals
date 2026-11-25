FROM public.ecr.aws/docker/library/node:22-alpine
WORKDIR /app
COPY cronjobs/package*.json ./
RUN npm ci --omit=dev --no-audit
COPY cronjobs/db.js cronjobs/escalate.js cronjobs/daily-report.js ./
USER node
ENTRYPOINT ["node"]
CMD ["escalate.js"]
