import { extractUsername } from '../shared/leetcode.js';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await initTheme();
  await render();
  document.getElementById('add-user-form').addEventListener('submit', onAddUser);
  document.getElementById('theme-toggle').addEventListener('click', onToggleTheme);
  chrome.action.setBadgeText({ text: '' });
}

async function initTheme() {
  const { theme } = await chrome.storage.local.get('theme');
  applyTheme(theme === 'dark' ? 'dark' : 'light');
}

async function onToggleTheme() {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await chrome.storage.local.set({ theme: next });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}

async function render() {
  const { trackedUsers, feed, stats } = await chrome.storage.local.get(['trackedUsers', 'feed', 'stats']);
  const emptyState = document.getElementById('empty-state');
  const usersList = document.getElementById('tracked-users-list');
  const feedList = document.getElementById('feed-list');

  if (!trackedUsers || trackedUsers.length === 0) {
    emptyState.hidden = false;
    usersList.hidden = true;
    feedList.hidden = true;
    return;
  }
  emptyState.hidden = true;
  usersList.hidden = false;
  feedList.hidden = false;

  renderTrackedUsers(trackedUsers, stats ?? {});
  renderFeed(feed ?? []);
}

function renderTrackedUsers(trackedUsers, stats) {
  const container = document.getElementById('tracked-users-list');
  container.innerHTML = '';
  for (const user of trackedUsers) {
    const s = stats[user.username];
    const el = document.createElement('div');
    el.className = 'tracked-user';
    el.innerHTML = `
      <span class="username">${escapeHtml(user.username)}</span>
      <span class="stats">${s ? `<span class="stat-easy">Easy: ${s.easy}</span><span class="stat-medium">Medium: ${s.medium}</span><span class="stat-hard">Hard: ${s.hard}</span>` : 'pending...'}</span>
      <span class="contest-stat">${s && typeof s.contestCount === 'number' ? buildContestText(user.username, s.contestCount) : ''}</span>
      <button class="remove-btn" data-username="${escapeHtml(user.username)}">&times;</button>
    `;
    container.appendChild(el);
  }
  container.querySelectorAll('.remove-btn').forEach((btn) => btn.addEventListener('click', onRemoveUser));
}

function buildContestText(username, contestCount) {
  return `${escapeHtml(username)} has participated in ${contestCount} contest${contestCount === 1 ? '' : 's'}`;
}

function renderFeed(feed) {
  const container = document.getElementById('feed-list');
  container.innerHTML = '';
  if (!feed || feed.length === 0) {
    container.innerHTML = '<p class="feed-empty">No activity yet.</p>';
    return;
  }

  let currentDay = null;
  for (const entry of feed) {
    const entryDate = new Date(entry.polledAt);
    const dayKey = entryDate.toDateString();
    if (dayKey !== currentDay) {
      currentDay = dayKey;
      const dateEl = document.createElement('div');
      dateEl.className = 'feed-date';
      dateEl.textContent = entryDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      container.appendChild(dateEl);
    }

    const time = entryDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    for (const u of entry.updates) {
      const rowEl = document.createElement('div');
      rowEl.className = 'feed-row';
      rowEl.innerHTML = `<span class="feed-text">${buildColoredSummary(u)}</span><span class="feed-time">${time}</span>`;
      container.appendChild(rowEl);
    }
  }
}

function buildColoredSummary(u) {
  if (u.type === 'contest') {
    const contestName = `<span class="contest-name">${escapeHtml(u.contestTitle)}</span>`;
    if (u.problemsSolved === 0 && u.finishTimeInSeconds === 0) {
      return `${escapeHtml(u.username)} has participated in ${contestName}`;
    }
    const n = u.problemsSolved;
    return `${escapeHtml(u.username)} has participated in ${contestName} with ${n} solve${n === 1 ? '' : 's'}`;
  }
  const { easy, medium, hard } = u.summary;
  const parts = [];
  if (easy > 0) parts.push(`<span class="stat-easy">${easy} easy</span>`);
  if (medium > 0) parts.push(`<span class="stat-medium">${medium} medium${medium > 1 ? 's' : ''}</span>`);
  if (hard > 0) parts.push(`<span class="stat-hard">${hard} hard</span>`);
  return `${escapeHtml(u.username)} solved ${parts.join(', ')}`;
}

async function onAddUser(e) {
  e.preventDefault();
  const input = document.getElementById('username-input');
  const errorEl = document.getElementById('add-user-error');
  errorEl.hidden = true;

  const raw = input.value;
  if (!raw || !raw.trim()) return;
  const username = extractUsername(raw);

  const { trackedUsers } = await chrome.storage.local.get('trackedUsers');
  if (trackedUsers.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    showError(errorEl, 'Already tracking this user.');
    return;
  }

  setFormDisabled(true);
  try {
    const matched = await chrome.runtime.sendMessage({ type: 'VALIDATE_USERNAME', username });
    if (!matched) {
      showError(errorEl, 'User not found. Check the username and try again.');
      return;
    }
    trackedUsers.push({ username, addedAt: Date.now() });
    await chrome.storage.local.set({ trackedUsers });
    input.value = '';
    await render();
    chrome.runtime.sendMessage({ type: 'FETCH_INITIAL_STATS', username }).then(render);
  } catch (err) {
    showError(errorEl, 'Something went wrong. Please try again.');
  } finally {
    setFormDisabled(false);
  }
}

async function onRemoveUser(e) {
  const username = e.target.dataset.username;
  const { trackedUsers, stats, lastSeen, lastContest } = await chrome.storage.local.get([
    'trackedUsers',
    'stats',
    'lastSeen',
    'lastContest',
  ]);
  const updated = trackedUsers.filter((u) => u.username !== username);
  delete stats[username];
  delete lastSeen[username];
  delete lastContest[username];
  await chrome.storage.local.set({ trackedUsers: updated, stats, lastSeen, lastContest });
  await render();
}

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = false;
}

function setFormDisabled(disabled) {
  document.getElementById('username-input').disabled = disabled;
  document.querySelector('#add-user-form button').disabled = disabled;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') render();
});
