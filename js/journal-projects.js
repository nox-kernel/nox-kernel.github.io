import { GITHUB_PROJECTS_CONFIG } from './github-projects.js';

const excluded = new Set(GITHUB_PROJECTS_CONFIG.excludedNames);
const repoName = value => typeof value === 'string' && value.length <= 100 &&
  /^[a-zA-Z0-9_.-]+$/.test(value) && !['.', '..'].includes(value) && !excluded.has(value.toLowerCase())
  ? value.toLowerCase() : null;

function legacyRepo(project) {
  if (!project || project.slug === 'website') return null;
  if (!project.sourceUrl) return repoName(project.slug);
  try {
    const url = new URL(project.sourceUrl);
    const parts = url.pathname.replace(/\/$/, '').split('/');
    return url.origin === 'https://github.com' && !url.username && !url.password && !url.search && !url.hash &&
      parts.length === 3 && parts[1].toLowerCase() === GITHUB_PROJECTS_CONFIG.owner
      ? repoName(parts[2].replace(/\.git$/, '')) : null;
  } catch { return null; }
}

// Resolve old references without changing entry text or inventing a GitHub repo.
export function reconcileJournalProjects(entries, githubProjects, available = true) {
  const projects = new Map(githubProjects.map(project => [project.name.toLowerCase(), project]));
  const aliases = new Map([['website', '__general']]);
  const resolved = entries.map(entry => {
    const name = typeof entry.githubRepo === 'string' ? repoName(entry.githubRepo === '__general' ? '' : entry.githubRepo) : legacyRepo(entry.project);
    const project = name ? projects.get(name) || (!available ? { slug: name, title: name } : null) : null;
    const legacySlug = entry.project?.slug;
    if (legacySlug && legacySlug !== 'website' && !projects.has(legacySlug.toLowerCase())) {
      const legacyName = legacyRepo(entry.project);
      aliases.set(legacySlug, projects.get(legacyName)?.slug || (!available && legacyName) || '__general');
    }
    return { ...entry, project };
  });
  const fallback = available ? githubProjects : [...new Map(resolved.filter(entry => entry.project).map(entry => [entry.project.slug, entry.project])).values()];
  return { entries: resolved, projects: fallback, projectAliases: aliases };
}
