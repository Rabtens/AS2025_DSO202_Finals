const account = document.querySelector('#account');
const dashboard = document.querySelector('#dashboard');
const login = document.querySelector('#login');
const register = document.querySelector('#register');
const complaint = document.querySelector('#complaint');
const signOut = document.querySelector('#sign-out');
const switchMode = document.querySelector('#switch-mode');
const categories = complaint.elements.categoryId;
let token = sessionStorage.getItem('hostel-token');
let categoryNames = new Map();
const statusLabels = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed'
};

function notify(text = '', error = false) {
  const message = document.querySelector('#message');
  message.textContent = text;
  message.hidden = !text;
  message.classList.toggle('error', error);
}

function endSession() {
  token = null;
  sessionStorage.removeItem('hostel-token');
  dashboard.hidden = signOut.hidden = true;
  account.hidden = false;
  complaint.reset();
  document.querySelector('#complaints').replaceChildren();
}

async function api(path, body) {
  const requestToken = token;
  const headers = {};
  if (requestToken) headers.authorization = `Bearer ${requestToken}`;
  if (body) headers['content-type'] = 'application/json';
  const response = await fetch(`/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && requestToken && requestToken === token) endSession();
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function setMode(isRegister) {
  login.hidden = isRegister;
  register.hidden = !isRegister;
  document.querySelector('#account-heading').textContent = isRegister ? 'Create a student account' : 'Sign in';
  document.querySelector('#account-description').textContent = isRegister
    ? 'Use the room ID assigned to you by your hostel.'
    : 'Use your hostel account to access the portal.';
  switchMode.textContent = isRegister ? 'Back to sign in' : 'Create a student account';
}

function badge(label, tone) {
  const element = document.createElement('span');
  element.className = 'badge';
  element.dataset.tone = tone;
  element.textContent = label;
  return element;
}

async function refreshComplaints() {
  const requestToken = token;
  const complaints = await api('/complaints');
  if (requestToken !== token) return;
  const complete = complaints.filter(({ status }) => status === 'resolved' || status === 'closed').length;
  document.querySelector('#total-count').textContent = complaints.length;
  document.querySelector('#active-count').textContent = complaints.length - complete;
  document.querySelector('#complete-count').textContent = complete;
  document.querySelector('#empty').hidden = complaints.length > 0;
  document.querySelector('#complaints').replaceChildren(...complaints.map(item => {
    const row = document.createElement('li');
    const title = document.createElement('h3');
    const meta = document.createElement('small');
    const description = document.createElement('p');
    const badges = document.createElement('div');
    title.textContent = item.title;
    const category = categoryNames.get(item.categoryId) || `Category ${item.categoryId}`;
    meta.textContent = `#${item.id} · ${category}`;
    description.textContent = item.description;
    badges.className = 'badges';
    badges.append(
      badge(statusLabels[item.status] || item.status, item.status),
      badge(`${item.priority[0].toUpperCase()}${item.priority.slice(1)} priority`, item.priority)
    );
    row.append(meta, title, description, badges);
    return row;
  }));
}

async function openDashboard() {
  const [user, available] = await Promise.all([api('/users/me'), api('/categories')]);
  categoryNames = new Map(available.map(({ id, name }) => [id, name]));
  const isStudent = user.role === 'student';
  document.querySelector('#create-complaint').hidden = !isStudent;
  document.querySelector('#dashboard-heading').textContent = `Welcome, ${user.name}`;
  document.querySelector('#room').hidden = !isStudent;
  document.querySelector('#room').textContent = `Room ID ${user.roomId ?? 'unassigned'}`;
  document.querySelector('#complaints-heading').textContent = isStudent ? 'My complaints' : 'All complaints';
  categories.replaceChildren(...available.map(({ id, name }) => new Option(name, id)));
  await refreshComplaints();
  account.hidden = true;
  dashboard.hidden = signOut.hidden = false;
}

function onSubmit(form, action) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    notify();
    try {
      await action(Object.fromEntries(new FormData(form)));
    } catch (err) {
      notify(err.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

onSubmit(login, async values => {
  const result = await api('/auth/login', values);
  token = result.token;
  sessionStorage.setItem('hostel-token', token);
  try {
    await openDashboard();
    login.reset();
  } catch (err) {
    endSession();
    throw err;
  }
});

onSubmit(register, async values => {
  await api('/auth/register', { ...values, roomId: Number(values.roomId) });
  register.reset();
  login.elements.email.value = values.email;
  setMode(false);
  notify('Account created. Sign in to submit a complaint.');
});

onSubmit(complaint, async values => {
  const saved = await api('/complaints', { ...values, categoryId: Number(values.categoryId) });
  complaint.reset();
  notify(`Complaint #${saved.id} submitted.`);
  await refreshComplaints();
});

switchMode.addEventListener('click', () => {
  notify();
  setMode(register.hidden);
});
signOut.addEventListener('click', () => {
  endSession();
  setMode(false);
  notify();
});
document.querySelector('#refresh').addEventListener('click', () => {
  notify();
  refreshComplaints().catch(err => notify(err.message, true));
});

if (token) openDashboard().catch(err => {
  endSession();
  notify(err.message, true);
});
