// Public repositories are the Projects source. Add `nox-hidden` on GitHub to opt out.
// The website, profile, .github, private and forked repositories are excluded.
export const GITHUB_PROJECTS_CONFIG = Object.freeze({
  owner: 'nox-kernel', cacheKey: 'nox:github-projects:v1',
  hiddenTopic: 'nox-hidden', excludedNames: Object.freeze(['nox-kernel.github.io', 'nox-kernel', '.github']),
  perPage: 100, maxPages: 10, timeoutMs: 15000
});
const { owner, cacheKey, hiddenTopic, excludedNames, perPage, maxPages, timeoutMs } = GITHUB_PROJECTS_CONFIG;
const MAX_PAGE_BYTES = 2000000;
const MAX_CACHE_CHARS = 600000;
const statusTopics = Object.freeze({
  'status-planned': 'exploring', 'status-exploring': 'exploring',
  'status-building': 'building', 'status-ongoing': 'building',
  'status-prototype': 'prototype', 'status-paused': 'paused', 'status-complete': 'complete'
});
const statuses = new Set(['exploring', 'building', 'ongoing', 'prototype', 'paused', 'complete']);
const acronyms = { nox: 'NOX', usb: 'USB', ai: 'AI', api: 'API', cli: 'CLI', gui: 'GUI', cpu: 'CPU', os: 'OS', iot: 'IoT', html: 'HTML', css: 'CSS', js: 'JS', wsl: 'WSL' };
const text = (value, max) => typeof value === 'string' && value.length <= max;
const validName = value => text(value, 100) && /^[a-zA-Z0-9_.-]+$/.test(value) && !['.', '..'].includes(value);
const validDate = value => text(value, 40) && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const humanize = value => value.split(/[-_.\s]+/).filter(Boolean).map(word => acronyms[word.toLowerCase()] || word[0].toUpperCase() + word.slice(1).toLowerCase()).join(' ');
const incomplete = () => new Error('GitHub returned incomplete project details. Please try again.');
let pending;
let generation = 0;

export class GitHubRateLimitError extends Error {
  constructor(retryAt, status) {
    super('GitHub is limiting public requests. Please try again shortly.');
    this.name = 'GitHubRateLimitError';
    this.retryAt = retryAt; // Unix time in milliseconds, for a localized retry message.
    this.status = status;
  }
}

function repositoryUrl(value, name) {
  if (!text(value, 2048)) return null;
  try {
    const url = new URL(value);
    return url.origin === 'https://github.com' && !url.username && !url.password &&
      url.pathname === `/${owner}/${name}` && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}

function toProject(repo) {
  if (!repo || !Number.isSafeInteger(repo.id) || repo.id <= 0 || !validName(repo.name) ||
      !text(repo.owner?.login, 100) || repo.owner.login.toLowerCase() !== owner || repo.full_name !== `${repo.owner.login}/${repo.name}` ||
      !repositoryUrl(repo.html_url, repo.name) || typeof repo.private !== 'boolean' ||
      typeof repo.fork !== 'boolean' || typeof repo.archived !== 'boolean' ||
      !(repo.description === null || text(repo.description, 2000)) ||
      !(repo.language === null || text(repo.language, 100)) ||
      !validDate(repo.created_at) || !validDate(repo.updated_at) ||
      !Array.isArray(repo.topics) || repo.topics.length > 50 ||
      !repo.topics.every(topic => text(topic, 50) && /^[a-z0-9][a-z0-9-]*$/.test(topic))) throw incomplete();
  if (repo.private || repo.fork || excludedNames.includes(repo.name.toLowerCase()) || repo.topics.includes(hiddenTopic)) return null;
  const category = [...new Set(repo.topics.filter(topic => topic !== hiddenTopic && !topic.startsWith('status-')).map(humanize))];
  if (!category.length && repo.language) category.push(repo.language);
  return {
    _id: `github-${repo.id}`, slug: repo.name, name: repo.name, title: humanize(repo.name) || repo.name,
    summary: repo.description?.trim() || 'Repository details will be added on GitHub.',
    sourceUrl: repositoryUrl(repo.html_url, repo.name),
    status: repo.archived ? 'paused' : repo.topics.map(topic => statusTopics[topic]).find(Boolean) || 'building',
    category, createdAt: repo.created_at, updatedAt: repo.updated_at
  };
}

function validateProjects(projects) {
  if (!Array.isArray(projects) || projects.length > perPage * maxPages) throw incomplete();
  const ids = new Set(); const names = new Set();
  for (const project of projects) {
    if (!project || !validName(project.name) || project.slug !== project.name ||
        !/^github-[1-9]\d*$/.test(project._id) || !Number.isSafeInteger(Number(project._id.slice(7))) ||
        !text(project.title, 150) || !project.title.trim() || !text(project.summary, 2000) ||
        !repositoryUrl(project.sourceUrl, project.name) || !statuses.has(project.status) ||
        excludedNames.includes(project.name.toLowerCase()) ||
        !validDate(project.createdAt) || !validDate(project.updatedAt) ||
        !Array.isArray(project.category) || project.category.length > 50 ||
        !project.category.every(value => text(value, 100) && value.trim()) ||
        ids.has(project._id) || names.has(project.name.toLowerCase())) throw incomplete();
    ids.add(project._id); names.add(project.name.toLowerCase());
  }
  return projects.map(project => project.status === 'ongoing' ? { ...project, status: 'building' } : project);
}

function readCache() {
  try {
    const raw = globalThis.localStorage?.getItem(cacheKey);
    if (!raw || raw.length > MAX_CACHE_CHARS) return null;
    const cached = JSON.parse(raw);
    if (cached.version !== 1 || !validDate(cached.fetchedAt) || Date.parse(cached.fetchedAt) > Date.now() + 60000) return null;
    return { projects: validateProjects(cached.projects), fetchedAt: cached.fetchedAt };
  } catch { return null; }
}

function writeCache(data) {
  try {
    const raw = JSON.stringify({ version: 1, projects: data.projects, fetchedAt: data.fetchedAt });
    if (raw.length <= MAX_CACHE_CHARS) globalThis.localStorage?.setItem(cacheKey, raw);
  } catch { /* Storage may be unavailable or full; the live result remains usable. */ }
}

async function readPage(response) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_PAGE_BYTES) throw incomplete();
  let body;
  if (response.body?.getReader) {
    const reader = response.body.getReader(); const decoder = new TextDecoder();
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PAGE_BYTES) { await reader.cancel(); throw incomplete(); }
        chunks.push(decoder.decode(value, { stream: true }));
      }
      body = chunks.join('') + decoder.decode();
    } finally { reader.releaseLock(); }
  } else {
    body = await response.text();
    if (body.length > MAX_PAGE_BYTES) throw incomplete();
  }
  let repos;
  try { repos = JSON.parse(body); } catch { throw incomplete(); }
  if (!Array.isArray(repos) || repos.length > perPage) throw incomplete();
  return repos;
}

function rateLimitError(response) {
  const now = Date.now();
  const retry = response.headers.get('retry-after');
  const retryTime = retry && (/^\d+$/.test(retry) ? now + Number(retry) * 1000 : Date.parse(retry));
  const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
  const retryAt = Number.isFinite(retryTime) && retryTime > now ? retryTime :
    Number.isFinite(reset) && reset > now ? reset : now + 60000;
  return new GitHubRateLimitError(retryAt, response.status);
}

async function fetchProjects() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const projects = []; const seen = new Set();
  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const endpoint = new URL(`https://api.github.com/users/${owner}/repos`);
      endpoint.search = new URLSearchParams({ type: 'owner', sort: 'created', direction: 'desc', per_page: String(perPage), page: String(page) });
      const response = await fetch(endpoint, {
        credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
      });
      if (response.status === 403 || response.status === 429) throw rateLimitError(response);
      if (!response.ok) throw new Error('The GitHub project index could not connect. Please try again.');
      const repos = await readPage(response);
      for (const repo of repos) {
        const project = toProject(repo);
        if (seen.has(repo.id)) throw incomplete();
        seen.add(repo.id);
        if (project) projects.push(project);
      }
      const hasNext = /<[^>]+>;\s*rel="next"/.test(response.headers.get('link') || '');
      if (hasNext && !repos.length) throw incomplete();
      if (repos.length < perPage && !hasNext) {
        return { projects: validateProjects(projects), source: 'github', fetchedAt: new Date().toISOString(), stale: false };
      }
    }
    throw new Error('The GitHub project index exceeded its page limit. Please try again later.');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('GitHub took too long to respond. Please try again.');
    if (error instanceof TypeError) throw new Error('The GitHub project index could not connect. Please try again.');
    throw error;
  } finally { clearTimeout(timer); }
}

// Recheck GitHub on every page load or manual refresh. Only simultaneous calls share work.
// `force` starts a fresh request; a validated older snapshot remains an offline fallback.
// Cached results carry `stale: true` and the connection `error` (including retryAt for limits).
export function loadGitHubProjects({ force = false } = {}) {
  if (!force && pending) return pending;
  const requestGeneration = ++generation;
  const request = fetchProjects().then(data => {
    if (requestGeneration === generation) writeCache(data);
    return data;
  }).catch(error => {
    const cached = readCache();
    if (cached) return { ...cached, source: 'cache', stale: true, error };
    throw error;
  }).finally(() => { if (pending === request) pending = undefined; });
  pending = request;
  return request;
}
