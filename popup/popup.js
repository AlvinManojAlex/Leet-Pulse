import { extractUsername } from '../shared/leetcode.js';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await render();
  document.getElementById('add-user-form').addEventListener('submit', onAddUser);
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
      <span class="stats">${s ? `Easy: ${s.easy} Medium: ${s.medium} Hard: ${s.hard}` : 'pending...'}</span>
      <button class="remove-btn" data-username="${escapeHtml(user.username)}">&times;</button>
    `;
    container.appendChild(el);
  }
  container.querySelectorAll('.remove-btn').forEach((btn) => btn.addEventListener('click', onRemoveUser));
}

function renderFeed(feed) {
  const container = document.getElementById('feed-list');
  container.innerHTML = '';
  if (!feed || feed.length === 0) {
    container.innerHTML = '<p class="feed-empty">No activity yet.</p>';
    return;
  }
  for (const entry of feed) {
    const entryEl = document.createElement('div');
    entryEl.className = 'feed-entry';
    const time = new Date(entry.polledAt).toLocaleString();
    const items = entry.updates.map((u) => `<li>${escapeHtml(u.text)}</li>`).join('');
    entryEl.innerHTML = `<time>${time}</time><ul>${items}</ul>`;
    container.appendChild(entryEl);
  }
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
  const { trackedUsers, stats, lastSeen } = await chrome.storage.local.get(['trackedUsers', 'stats', 'lastSeen']);
  const updated = trackedUsers.filter((u) => u.username !== username);
  delete stats[username];
  delete lastSeen[username];
  await chrome.storage.local.set({ trackedUsers: updated, stats, lastSeen });
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
