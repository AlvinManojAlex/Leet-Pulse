import { fetchMatchedUser, fetchRecentAcSubmissions } from './shared/leetcode.js';

const ALARM_NAME = 'leetpulse-poll';
const POLL_INTERVAL_MINUTES = 60;
const STAGGER_MS_MIN = 500;
const STAGGER_MS_MAX = 1000;
const FEED_MAX_AGE_DAYS = 30;
const FEED_HARD_CAP = 1000;

chrome.runtime.onInstalled.addListener(async () => {
  await initStorageDefaults();
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MINUTES });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) runPollCycle();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VALIDATE_USERNAME') {
    fetchMatchedUser(message.username).then(sendResponse);
    return true;
  }
  if (message.type === 'FETCH_INITIAL_STATS') {
    fetchInitialStatsForUser(message.username).then(sendResponse);
    return true;
  }
});

async function initStorageDefaults() {
  const existing = await chrome.storage.local.get(['trackedUsers', 'lastSeen', 'stats', 'feed']);
  await chrome.storage.local.set({
    trackedUsers: existing.trackedUsers ?? [],
    lastSeen: existing.lastSeen ?? {},
    stats: existing.stats ?? {},
    feed: existing.feed ?? [],
  });
}

async function runPollCycle() {
  const { trackedUsers, lastSeen, stats, feed } = await chrome.storage.local.get([
    'trackedUsers',
    'lastSeen',
    'stats',
    'feed',
  ]);
  const updates = [];

  for (const user of trackedUsers) {
    const result = await pollSingleUser(user.username, lastSeen, stats);
    if (result) updates.push(result);
    await sleep(randomBetween(STAGGER_MS_MIN, STAGGER_MS_MAX));
  }

  if (updates.length > 0) {
    feed.unshift({ polledAt: Date.now(), updates });
  }

  const prunedFeed = pruneFeed(feed);
  await chrome.storage.local.set({ lastSeen, stats, feed: prunedFeed });
  updateBadge(updates);
}

async function pollSingleUser(username, lastSeenMap, statsMap) {
  const matched = await fetchMatchedUser(username);
  if (!matched) return null;

  const prevStats = statsMap[username] ?? { easy: 0, medium: 0, hard: 0, total: 0 };
  const delta = {
    easy: matched.easy - prevStats.easy,
    medium: matched.medium - prevStats.medium,
    hard: matched.hard - prevStats.hard,
  };
  statsMap[username] = matched;

  const recent = await fetchRecentAcSubmissions(username);
  if (recent.length > 0) {
    lastSeenMap[username] = Math.max(recent[0].timestamp, lastSeenMap[username] ?? 0);
  }

  const hasNewSolves = delta.easy > 0 || delta.medium > 0 || delta.hard > 0;
  if (!hasNewSolves) return null;

  return {
    username,
    summary: { easy: delta.easy, medium: delta.medium, hard: delta.hard },
    text: buildSummaryText(username, delta),
  };
}

function buildSummaryText(username, delta) {
  const parts = [];
  if (delta.easy > 0) parts.push(`${delta.easy} easy`);
  if (delta.medium > 0) parts.push(`${delta.medium} medium${delta.medium > 1 ? 's' : ''}`);
  if (delta.hard > 0) parts.push(`${delta.hard} hard`);
  return `${username} solved ${parts.join(', ')}`;
}

function pruneFeed(feed) {
  const cutoff = Date.now() - FEED_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  let pruned = feed.filter((entry) => entry.polledAt >= cutoff);
  if (pruned.length > FEED_HARD_CAP) pruned = pruned.slice(0, FEED_HARD_CAP);
  return pruned;
}

function updateBadge(updates) {
  const count = updates.length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}

async function fetchInitialStatsForUser(username) {
  const { stats, lastSeen } = await chrome.storage.local.get(['stats', 'lastSeen']);
  const matched = await fetchMatchedUser(username);
  if (matched) {
    stats[username] = matched;
    const recent = await fetchRecentAcSubmissions(username);
    if (recent.length > 0) lastSeen[username] = recent[0].timestamp;
    await chrome.storage.local.set({ stats, lastSeen });
  }
  return matched;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
