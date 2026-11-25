import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const base = __ENV.BASE_URL || 'http://localhost:8080';
const json = { 'Content-Type': 'application/json' };

export const options = {
  vus: 3,
  duration: '15s',
  thresholds: { checks: ['rate==1'] }
};

export function setup() {
  const login = http.post(`${base}/api/auth/login`, JSON.stringify({
    email: __ENV.TEST_EMAIL || 'student1@example.test',
    password: __ENV.TEST_PASSWORD || 'DemoPass2026!'
  }), { headers: json });

  if (!check(login, { 'login succeeded': res => res.status === 200 })) {
    fail(`Login returned ${login.status}`);
  }
  return { token: login.json('token'), runId: __ENV.TEST_RUN_ID || Date.now() };
}

export default function ({ token, runId }) {
  const response = http.post(`${base}/api/complaints`, JSON.stringify({
    title: `k6 ${runId} VU ${__VU} iteration ${__ITER}`,
    description: 'Synthetic complaint created by the local load test.',
    categoryId: 1
  }), { headers: { ...json, Authorization: `Bearer ${token}` } });

  check(response, { 'complaint created': res => res.status === 201 });
  sleep(0.5);
}
