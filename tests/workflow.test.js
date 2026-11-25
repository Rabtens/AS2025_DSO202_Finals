const request = require('supertest');
const http = require('node:http');
const https = require('node:https');

jest.setTimeout(60000);

const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
const transport = new URL(baseUrl).protocol === 'https:' ? https : http;
const connection = new transport.Agent({ keepAlive: true });
const api = request.agent(baseUrl)
  .use(req => req.agent(connection))
  .timeout({ response: 15000, deadline: 20000 });
const runId = process.env.TEST_RUN_ID || Date.now();
const password = 'DemoPass2026!';
const complaint = { title: `Jest ${runId} leaking tap`, description: 'Water is dripping.', categoryId: 1 };
let student;
let anotherStudent;
let warden;

async function login(email) {
  const { body } = await api.post('/api/auth/login').send({ email, password }).expect(200);
  return body.token;
}

beforeAll(async () => {
  [student, anotherStudent, warden] = await Promise.all([
    login('student1@example.test'),
    login('student2@example.test'),
    login('warden@example.test')
  ]);
});

afterAll(() => connection.destroy());

async function submit() {
  const { body } = await api.post('/api/complaints').auth(student, { type: 'bearer' }).send(complaint).expect(201);
  return body;
}

function priority(id, token, value) {
  return api.patch(`/api/complaints/${id}/priority`).auth(token, { type: 'bearer' }).send({ priority: value });
}

function status(id, token, value) {
  return api.patch(`/api/complaints/${id}/status`).auth(token, { type: 'bearer' }).send({ status: value });
}

describe('complaints', () => {
  test('create with the assigned room and default workflow values', async () => {
    const { body } = await api.post('/api/complaints').auth(student, { type: 'bearer' })
      .send({ ...complaint, roomId: 5, priority: 'urgent', status: 'closed' }).expect(201);
    expect(body).toMatchObject({ roomId: 1, priority: 'normal', status: 'open' });
    await api.get(`/api/complaints/${body.id}`).auth(anotherStudent, { type: 'bearer' }).expect(404);
    await api.get(`/api/complaints/${body.id}`).auth(warden, { type: 'bearer' }).expect(200);
  });

  test('rejects blank titles, unknown categories, and submissions by a warden', async () => {
    await api.post('/api/complaints').auth(student, { type: 'bearer' })
      .send({ ...complaint, title: ' ' }).expect(400);
    await api.post('/api/complaints').auth(student, { type: 'bearer' })
      .send({ ...complaint, categoryId: 2147483647 }).expect(400);
    await api.post('/api/complaints').auth(warden, { type: 'bearer' }).send(complaint).expect(403);
  });
});

describe('priority', () => {
  test('requires a manager and accepts only known priorities', async () => {
    const { id } = await submit();
    await priority(id, student, 'high').expect(403);
    await priority(id, warden, 'critical').expect(400);
    await priority(id, warden, 'high').expect(200, { id, priority: 'high' });
    const { body } = await api.get(`/api/complaints/${id}`).auth(student, { type: 'bearer' }).expect(200);
    expect(body.priority).toBe('high');
  });
});

describe('status', () => {
  test('requires an assignment and records only successful transitions', async () => {
    const { id } = await submit();
    await status(id, student, 'assigned').expect(403);
    await status(id, warden, 'resolved').expect(409);
    await status(id, warden, 'assigned').expect(409);
    await api.put(`/api/complaints/${id}/assignment`).auth(warden, { type: 'bearer' })
      .send({ staffId: 1 }).expect(200);
    await status(id, warden, 'assigned').expect(200);
    const racing = await Promise.all([status(id, warden, 'in_progress'), status(id, warden, 'in_progress')]);
    expect(racing.map(res => res.status).sort()).toEqual([200, 409]);
    await status(id, warden, 'resolved').expect(200);
    await priority(id, warden, 'urgent').expect(409);
    await status(id, warden, 'closed').expect(200);
    await status(id, warden, 'assigned').expect(409);

    const { body } = await api.get(`/api/complaints/${id}/status-history`)
      .auth(student, { type: 'bearer' }).expect(200);
    expect(body.map(entry => [entry.previousStatus, entry.status])).toEqual([
      ['open', 'assigned'], ['assigned', 'in_progress'], ['in_progress', 'resolved'], ['resolved', 'closed']
    ]);
  });
});
