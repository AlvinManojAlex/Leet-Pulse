<p align="center">
  <img src="icons/logo.svg" alt="Leet-Pulse logo" width="128" />
</p>

<h1 align="center">Leet-Pulse</h1>

Chrome extension. Tracks LeetCode activity for watchlist of usernames. Polls hourly, shows feed in popup ("user1 solved 2 mediums"). No notifications and Local storage only.

## Setup

1. Clone repo:
   ```
   git clone https://github.com/AlvinManojAlex/Leet-Pulse.git
   ```
2. Open Chrome, go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**, select cloned `Leet-Pulse` folder
5. Leet-Pulse icon appears in toolbar. Pin it for easy access (puzzle-piece icon → pin).

## Usage

- Click toolbar icon to open popup
- **Add user**: type LeetCode username or full profile URL (`https://leetcode.com/u/username/`) into input, hit Add
  - Invalid username → inline error, not added
  - Already tracked → inline error, not added
- Fresh install starts empty — no default/pre-populated users
- Extension polls every 60 min in background, diffs new accepted submissions per user
- Popup feed shows per-user summaries since last poll (e.g. "user1 solved 2 mediums")

## Notes

- Only talks to `leetcode.com` — no other network access
- All data stored locally (`chrome.storage.local`), never leaves your machine
- No account/login needed — tracks public profile data only