# Hostel Complaint System

Students register, submit complaints for their rooms, and track status. Wardens and admins can triage complaints, assign staff, update status, publish announcements, and read daily reports.

## Run locally

Run the following command from this directory with Docker Compose available.

```sh
docker compose up --build --wait
```

Open **http://localhost:8080**. Compose runs PostgreSQL and all 16 application services. The browser and API share the same address. The category service is also available at http://localhost:3001/categories.

If another process already uses port 8080, choose an available port. This example uses port 18080.

```sh
FRONTEND_PORT=18080 docker compose up --build --wait
```

The seeded accounts are `admin@example.test`, `warden@example.test`, and `student1@example.test` through `student3@example.test`. All five use `DemoPass2026!`. Database passwords and the default JWT key are for local development. Set `JWT_SECRET` to override the key. Each service that accesses PostgreSQL uses its own role.

PostgreSQL initializes both SQL files when its data volume is empty. If you kept a volume from before the CronJobs were added, apply their grants once:

```sh
docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U hostel_owner -d hostel < db/02-cronjobs.sql
```

Use `docker compose down` to stop the stack and retain the data volume.

## Build images

```sh
make build
make build-jobs
```

The first target builds all 16 application images as `hostel-complaint-system-<service>:<git-short-sha>`. The second builds the shared `hostel-complaint-system/cronjobs:<git-short-sha>` image. Use the same tag to start the images you built.

```sh
IMAGE_TAG="$(git rev-parse --short HEAD)" docker compose up --no-build --wait
```

## Try the API

The examples use a POSIX shell, `curl`, and `jq`. Use port 18080 in `API` if you set the override above.

```sh
API=http://localhost:8080/api
EMAIL="student-$(date +%s)@example.test"
PASS='DemoPass2026!'

curl -fsS "$API/hostels" | jq
curl -fsS "$API/categories" | jq

post() { curl -fsS -H 'Content-Type: application/json' -d "$2" "$API$1"; }
post /auth/register "$(jq -nc --arg email "$EMAIL" --arg password "$PASS" \
  '{name:"Demo Student",email:$email,password:$password,roomId:1}')" | jq

LOGIN=$(post /auth/login "$(jq -nc --arg email "$EMAIL" --arg password "$PASS" \
  '{email:$email,password:$password}')")
STUDENT=$(echo "$LOGIN" | jq -r .token)
STUDENT_ID=$(echo "$LOGIN" | jq -r .user.id)
WARDEN=$(post /auth/login '{"email":"warden@example.test","password":"DemoPass2026!"}' | jq -r .token)

student() { curl -fsS -H "Authorization: Bearer $STUDENT" -H 'Content-Type: application/json' "$@"; }
warden() { curl -fsS -H "Authorization: Bearer $WARDEN" -H 'Content-Type: application/json' "$@"; }

student "$API/users/me" | jq
ID=$(student -d '{"categoryId":1,"title":"Leaking tap","description":"The sink tap drips continuously."}' \
  "$API/complaints" | jq -r .id)
student "$API/complaints" | jq

ITEM="$API/complaints/$ID"
warden -X PATCH -d '{"priority":"high"}' "$ITEM/priority" | jq
STAFF_ID=$(warden "$API/staff?categoryId=1" | jq -r '.[0].id')
warden -X PUT -d "{\"staffId\":$STAFF_ID}" "$ITEM/assignment" | jq
for state in assigned in_progress resolved; do
  warden -X PATCH -d "{\"status\":\"$state\"}" "$ITEM/status" | jq
done

NOTICE_ID=$(warden -d "{\"userId\":$STUDENT_ID,\"complaintId\":$ID,\"message\":\"The tap has been repaired.\"}" \
  "$API/notifications" | jq -r .id)
student "$API/notifications" | jq
student -X PATCH "$API/notifications/$NOTICE_ID/read" | jq
student -d '{"rating":5,"comment":"The tap works now."}' "$ITEM/feedback" | jq

warden -X PATCH -d '{"status":"closed"}' "$ITEM/status" | jq
student "$ITEM" | jq
student "$ITEM/status-history" | jq

warden -d '{"hostelId":1,"title":"Water maintenance","body":"Service is restored."}' \
  "$API/announcements" | jq
student "$API/announcements?hostelId=1" | jq
```

Complaints start open and at normal priority. Students can read their own complaints. Wardens and admins can read all complaints and change priority while work is active. A complaint moves through `open → assigned → in_progress → resolved → closed`. Assign a staff member before changing the status to `assigned`. The student who filed the complaint can submit one rating after resolution.

## Scheduled jobs

Run each job manually in Compose. To backfill or inspect a specific report day, pass `REPORT_DATE`.

```sh
docker compose run --rm --build escalate
docker compose run --rm --build -e REPORT_DATE="$(TZ=Asia/Thimphu date +%F)" daily-report
warden "$API/reports/daily" | jq
```

- **Escalation** runs every 30 minutes in Kubernetes. It raises each eligible open complaint one priority level once and adds an in-app notification for each warden. The minimum age defaults to 24 hours and can be set with `ESCALATION_HOURS`.
- **Daily report** runs at 00:05 Asia/Thimphu and summarizes the previous local day. It counts complaints filed and status changes to assigned, in progress, resolved, and closed. Rerunning a day updates its report. Set `REPORT_TIME_ZONE` if your reporting day uses a different time zone.

The Kubernetes manifests are in `cronjobs/cronjobs.yml`. Build and load the jobs image into your cluster or replace its image reference with the tag you pushed. In the target namespace, supply Secrets named `hostel-escalate-db` and `hostel-daily-report-db`, each with `PGHOST`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` for its respective database role. Apply the manifests with `kubectl apply -f cronjobs/cronjobs.yml`. A Kubernetes cluster needs its own reachable PostgreSQL instance initialized with both SQL files.

## Tests and observability

Run Jest and the k6 load test against a running demo stack. Both submit synthetic complaints.

```sh
npm ci --prefix tests
npm test --prefix tests
k6 run k6/complaints.js
```

Set `BASE_URL=http://localhost:18080` before the test command or pass it to k6 with `-e BASE_URL=http://localhost:18080` when using that port.

Start the optional observability profile with trace export enabled.

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318 \
  docker compose --profile observability up --build --wait
```

Use Jaeger at http://localhost:16686, Prometheus at http://localhost:9090, and Grafana at http://localhost:3002. Grafana starts with its default local sign-in and a preconfigured Prometheus data source.
# AS2025_DSO202_Finals
