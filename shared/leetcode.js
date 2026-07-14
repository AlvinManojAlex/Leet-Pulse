export const GRAPHQL_ENDPOINT = 'https://leetcode.com/graphql';

export function extractUsername(input) {
  const trimmed = input.trim();
  const match = trimmed.match(/leetcode\.com\/(?:u\/)?([^/?#]+)/i);
  const username = match ? match[1] : trimmed;
  return username.replace(/\/$/, '');
}

async function graphqlRequest(query, variables) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) return { data: null, error: `HTTP ${response.status}` };
    const json = await response.json();
    if (json.errors) return { data: null, error: json.errors[0]?.message ?? 'GraphQL error' };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

const MATCHED_USER_QUERY = `
  query userProfile($username: String!) {
    matchedUser(username: $username) {
      username
      submitStats {
        acSubmissionNum { difficulty count }
      }
    }
  }
`;

export async function fetchMatchedUser(username) {
  const { data } = await graphqlRequest(MATCHED_USER_QUERY, { username });
  const user = data?.matchedUser;
  if (!user) return null;

  const counts = { easy: 0, medium: 0, hard: 0, total: 0 };
  for (const entry of user.submitStats?.acSubmissionNum ?? []) {
    const difficulty = entry.difficulty.toLowerCase();
    if (difficulty === 'all') counts.total = entry.count;
    else if (difficulty in counts) counts[difficulty] = entry.count;
  }
  return { username: user.username, ...counts };
}

const RECENT_AC_SUBMISSIONS_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      title
      titleSlug
      timestamp
    }
  }
`;

export async function fetchRecentAcSubmissions(username, limit = 20) {
  const { data } = await graphqlRequest(RECENT_AC_SUBMISSIONS_QUERY, { username, limit });
  const submissions = data?.recentAcSubmissionList ?? [];
  return submissions.map((s) => ({
    title: s.title,
    titleSlug: s.titleSlug,
    timestamp: Number(s.timestamp),
  }));
}
