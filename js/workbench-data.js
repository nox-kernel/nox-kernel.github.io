import { SANITY } from './sanity-config.js';
import { safeUrl, validSlug, renderPortableText } from './journal-content.js';
import { loadGitHubProjects } from './github-projects.js';
import { reconcileJournalProjects } from './journal-projects.js';

export { safeUrl, renderPortableText };
export const STUDIO_URL = SANITY.studioUrl;
export const ENTRY_TYPES = Object.freeze({
  note: 'Note', update: 'Update', learning: 'Learning', fix: 'Fix', release: 'Release'
});

const base = document.querySelector('meta[name="nox-baseurl"]')?.content || '';
export const siteUrl = path => typeof path === 'string' && /^\/(?!\/)/.test(path) ? base + path : path;
export const entryUrl = entry => validSlug(entry?.slug)
  ? siteUrl(`/journal/?entry=${encodeURIComponent(entry.slug)}`) : siteUrl('/journal/');

export function projectRepoUrl(project) {
  const source = safeUrl(project?.sourceUrl);
  if (!source) return null;
  const url = new URL(source);
  if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2 || parts.some(part => !/^[a-zA-Z0-9_.-]+$/.test(part))) return null;
  if (['.', '..'].includes(parts[0]) || ['.', '..'].includes(parts[1])) return null;
  const name = parts[1].replace(/\.git$/, '');
  if (!name || ['.', '..'].includes(name)) return null;
  return `https://github.com/${parts[0]}/${name}`;
}

const image = 'alt,caption,asset->{url,metadata{dimensions}}';
const query = `{
  "entries": *[_type == "journalEntry" && defined(slug.current) && defined(publishedAt)
    && publishedAt <= now() && !(_id in path("drafts.**"))]
    | order(publishedAt desc, entryNumber desc){
      _id,title,"slug":slug.current,summary,publishedAt,entryNumber,retrospective,
      "entryType":coalesce(entryType,"note"),githubRepo,
      "project":project->{_id,title,"slug":slug.current,sourceUrl},
      "cover":coverImage{${image}},
      body[]{...,_type == "journalImage" => {...,asset->{url,metadata{dimensions}}}}
    }
}`;

let pending;
export function loadWorkbench({ force = false } = {}) {
  if (force) pending = undefined;
  if (pending) return pending;
  pending = (async () => {
    if (!/^[a-z0-9]+$/.test(SANITY.projectId) || !/^[a-z0-9_-]+$/.test(SANITY.dataset)) {
      throw new Error('The public content configuration is unavailable.');
    }
    const endpoint = new URL(`https://${SANITY.projectId}.api.sanity.io/v${SANITY.apiVersion}/data/query/${SANITY.dataset}`);
    endpoint.searchParams.set('perspective', 'published');
    endpoint.searchParams.set('query', query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const githubRequest = loadGitHubProjects({ force }).catch(() => null);
    try {
      const response = await fetch(endpoint, { credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error('The published content could not be reached.');
      const { result } = await response.json();
      if (!Array.isArray(result?.entries)) {
        throw new Error('The content response was incomplete.');
      }
      const github = await githubRequest;
      return {
        ...reconcileJournalProjects(result.entries.filter(entry => validSlug(entry.slug)), github?.projects || [], Boolean(github)),
        projectNotice: !github ? 'GitHub is temporarily unavailable. Repository names are shown until the project list can refresh.' :
          github.stale ? 'Using the saved GitHub project list. Refresh later for the latest projects.' : ''
      };
    } finally {
      clearTimeout(timer);
    }
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
