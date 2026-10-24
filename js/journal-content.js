import { SANITY } from './sanity-config.js';

const siteBase = document.querySelector('meta[name="nox-baseurl"]')?.content || '';
const localUrl = value => value?.startsWith('/') && !value.startsWith('//') ? siteBase + value : value;

// Only published, anonymous reads belong in this module. Studio handles all writing.
const IMAGE_FIELDS = `alt, caption, asset->{url, metadata{dimensions}}`;
const PROJECT_LIST_FIELDS = `
  _id, title, "slug": slug.current, summary, status, category,
  "question": workingQuestion,
  "cover": coalesce(coverImage{${IMAGE_FIELDS}}, legacyCover{"url": path, alt, caption})
`;
const PROJECT_FIELDS = `${PROJECT_LIST_FIELDS}, introduction, projectFacts,
  sourceUrl, demoUrl,
  nextSteps[]{..., _type == "journalImage" => {..., asset->{url, metadata{dimensions}}}}
`;
const ENTRY_FIELDS = `
  _id, title, "slug": slug.current, summary, publishedAt,
  "legacyAnchor": slug.current,
  entryNumber, retrospective,
  "project": project->{_id, title, "slug": slug.current}
`;
const BODY_FIELDS = `body[]{..., _type == "journalImage" => {..., asset->{url, metadata{dimensions}}}}`;
const PROJECT_FILTER = `_type == "project" && defined(slug.current)`;
const ENTRY_FILTER = `_type == "journalEntry" && defined(slug.current) &&
  defined(project->slug.current) && defined(publishedAt) && publishedAt <= now()`;
const STATUS_LABELS = {
  exploring: 'Exploring', building: 'In progress', paused: 'Paused',
  complete: 'Complete', ongoing: 'Ongoing', prototype: 'Working prototype'
};

export function validSlug(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 100;
}

export function safeUrl(value, allowLocal = false) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  if (allowLocal && /^\/(?!\/)/.test(input) && !/[\\\u0000-\u001f]/.test(input)) return input;
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function projectHref(slug) {
  if (!validSlug(slug)) return '/workbench/';
  if (slug === 'website' || slug === 'project-relay') return `/workbench/${slug}/`;
  return `/workbench/project/?slug=${encodeURIComponent(slug)}`;
}

export function entryHref(entry, useLegacy = true) {
  if (useLegacy && validSlug(entry.project?.slug) && validSlug(entry.legacyAnchor)) {
    return `${projectHref(entry.project.slug)}#${entry.legacyAnchor}`;
  }
  return validSlug(entry.slug) ? `/workbench/entry/?slug=${encodeURIComponent(entry.slug)}` : '/workbench/';
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function link(text, href, className = '', external = false) {
  const node = element('a', className, text);
  node.href = localUrl(href);
  if (external) {
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  }
  return node;
}

function arrowLink(text, href, external = false) {
  const node = link(text, href, 'wb-link', external);
  const arrow = element('span', '', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  node.append(' ', arrow);
  return node;
}

function dateNode(value, prefix = '', short = false) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) return element('span', '', 'Journal note');
  const node = element('time');
  node.dateTime = parsed.toISOString();
  node.textContent = prefix + new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC'
  }).format(parsed);
  return node;
}

function imageFigure(image, className = 'wb-cover') {
  const url = safeUrl(image?.asset?.url || image?.url, true);
  if (!url) return null;
  const figure = element('figure', className);
  const img = element('img');
  img.src = localUrl(url);
  img.alt = typeof image.alt === 'string' ? image.alt : '';
  img.loading = 'lazy';
  img.decoding = 'async';
  const dimensions = image.asset?.metadata?.dimensions;
  if (dimensions?.width > 0 && dimensions?.height > 0) {
    img.width = Math.min(40000, Math.round(dimensions.width));
    img.height = Math.min(40000, Math.round(dimensions.height));
  }
  figure.append(img);
  if (image.caption) figure.append(element('figcaption', '', image.caption));
  return figure;
}

function appendSpanText(parent, value) {
  String(value || '').split('\n').forEach((part, index) => {
    if (index) parent.append(document.createElement('br'));
    parent.append(document.createTextNode(part));
  });
}

function appendInline(parent, block) {
  const definitions = new Map((block.markDefs || []).map(mark => [mark._key, mark]));
  for (const span of block.children || []) {
    if (span._type !== 'span' || typeof span.text !== 'string') continue;
    let content = document.createDocumentFragment();
    appendSpanText(content, span.text);
    for (const mark of [...(span.marks || [])].reverse()) {
      const tags = { strong: 'strong', em: 'em', code: 'code', underline: 'u', 'strike-through': 's' };
      let wrapper;
      if (Object.hasOwn(tags, mark)) wrapper = element(tags[mark]);
      else {
        const definition = definitions.get(mark);
        const href = definition?._type === 'link' ? safeUrl(definition.href) : null;
        if (href) wrapper = link('', href, '', true);
      }
      if (wrapper) {
        wrapper.append(content);
        content = wrapper;
      }
    }
    parent.append(content);
  }
}

export function renderPortableText(blocks) {
  const output = document.createDocumentFragment();
  let lists = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (block._type === 'block' && ['bullet', 'number'].includes(block.listItem)) {
      const requested = Number.isInteger(block.level) ? block.level : 1;
      const level = Math.max(1, Math.min(6, requested, lists.length + 1));
      lists = lists.slice(0, level);
      const tag = block.listItem === 'number' ? 'ol' : 'ul';
      if (lists[level - 1] && lists[level - 1].tag !== tag) lists = lists.slice(0, level - 1);
      if (!lists[level - 1]) {
        const list = element(tag);
        const parent = level === 1 ? output : lists[level - 2]?.item || output;
        parent.append(list);
        lists[level - 1] = { tag, list, item: null };
      }
      const item = element('li');
      appendInline(item, block);
      lists[level - 1].list.append(item);
      lists[level - 1].item = item;
      continue;
    }
    lists = [];
    if (block._type === 'block') {
      const styles = { normal: 'p', h2: 'h2', h3: 'h3', h4: 'h4', blockquote: 'blockquote' };
      const tag = Object.hasOwn(styles, block.style) ? styles[block.style] : 'p';
      const node = element(tag, tag === 'blockquote' ? 'wb-pullquote' : '');
      appendInline(node, block);
      output.append(node);
    } else if (['image', 'journalImage'].includes(block._type)) {
      const figure = imageFigure(block, 'wb-cover wb-inline-image');
      if (figure) output.append(figure);
    } else if (['code', 'codeBlock'].includes(block._type) && typeof block.code === 'string') {
      const pre = element('pre');
      pre.append(element('code', '', block.code));
      output.append(pre);
    }
  }
  return output;
}

function entryStamp(entry, index) {
  const stamp = element('div', 'wb-entry-stamp');
  const number = entry.entryNumber || index + 1;
  stamp.append(element('span', '', `ENTRY ${String(number).padStart(2, '0')}`), dateNode(entry.publishedAt, 'Written '));
  if (entry.retrospective) stamp.append(element('span', '', 'Looking back'));
  return stamp;
}

function entryArticle(entry, index) {
  const article = element('article', 'wb-log-entry');
  article.id = validSlug(entry.legacyAnchor) ? entry.legacyAnchor : `entry-${entry.slug}`;
  const heading = element('h2', '', entry.title);
  heading.id = `${article.id}-title`;
  article.setAttribute('aria-labelledby', heading.id);
  article.append(entryStamp(entry, index), heading, renderPortableText(entry.body));
  article.append(arrowLink('Open this entry', entryHref(entry, false)));
  return article;
}

function projectCard(project, index) {
  const article = element('article', 'wb-project');
  const side = element('div', 'wb-project-index');
  side.append(element('span', 'wb-project-number', String(index + 1).padStart(2, '0')));
  side.append(element('span', 'wb-state', STATUS_LABELS[project.status] || project.status || 'On the bench'));
  const content = element('div');
  const category = Array.isArray(project.category) ? project.category.join(' / ') : project.category;
  if (category) content.append(element('span', 'wb-kicker', category));
  const title = element('h3');
  title.append(link(project.title, projectHref(project.slug)));
  content.append(title);
  if (project.summary) content.append(element('p', '', project.summary));
  if (project.question) {
    const question = element('p', 'wb-question');
    question.append(element('span', 'wb-label', 'The question I am working on'), document.createTextNode(project.question));
    content.append(question);
  }
  content.append(arrowLink('Open the project journal', projectHref(project.slug)));
  article.append(side, content);
  const figure = imageFigure(project.cover, 'wb-project-visual');
  if (figure) {
    const image = figure.querySelector('img');
    if (project.slug === 'project-relay' && project.cover?.url === '/images/workbench/relay-study.svg') {
      figure.classList.add('wb-relay-visual');
      image.classList.add('wb-relay-drawing');
    }
    const imageLink = link('', projectHref(project.slug));
    imageLink.setAttribute('aria-label', `See the ${project.title} project`);
    imageLink.append(image);
    figure.replaceChildren(imageLink);
    article.append(figure);
  }
  return article;
}

function entryListItem(entry) {
  const item = element('li', 'wb-entry');
  item.dataset.journalProject = entry.project.slug;
  const meta = element('div', 'wb-entry-meta');
  meta.append(dateNode(entry.publishedAt, '', true), element('span', '', entry.project.title));
  const content = element('div');
  const title = element('h3');
  title.append(link(entry.title, entryHref(entry)));
  content.append(title);
  if (entry.summary) content.append(element('p', '', entry.summary));
  const arrow = element('span', 'wb-entry-arrow', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  item.append(meta, content, arrow);
  return item;
}

function emptyMessage(title, text, retry = false) {
  const box = element('div', 'wb-content-message');
  box.setAttribute('role', 'status');
  box.append(element('h2', '', title), element('p', '', text));
  if (retry) {
    const button = element('button', 'button secondary', 'Try again');
    button.type = 'button';
    button.addEventListener('click', () => loadContent());
    box.append(button);
  }
  return box;
}

function renderIndex(result) {
  const projects = (result.projects || []).filter(project => validSlug(project.slug));
  const entries = (result.entries || []).filter(entry => validSlug(entry.slug) && validSlug(entry.project?.slug));
  const projectRoot = document.querySelector('[data-journal-projects]');
  const entryRoot = document.getElementById('journal-entries');
  if (projectRoot) projectRoot.replaceChildren(...projects.map(projectCard));
  if (projectRoot && !projects.length) projectRoot.append(emptyMessage('A new page is waiting.', 'Published projects will appear here.'));
  if (entryRoot) entryRoot.replaceChildren(...entries.map(entryListItem));
  if (entryRoot && !entries.length) {
    const item = element('li');
    item.append(emptyMessage('The next note is still on the bench.', 'Published journal entries will appear here.'));
    entryRoot.append(item);
  }
  const count = document.querySelector('[data-journal-project-count]');
  if (count) count.textContent = `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} on the bench`;
  const filters = document.querySelector('[data-journal-filters]');
  if (filters) {
    const buttons = [{ slug: 'all', title: 'All projects' }, ...projects].map(project => {
      const button = element('button', '', project.title);
      button.type = 'button';
      button.dataset.projectFilter = project.slug;
      button.dataset.projectLabel = project.title;
      button.setAttribute('aria-pressed', String(project.slug === 'all'));
      button.setAttribute('aria-controls', 'journal-entries');
      return button;
    });
    filters.replaceChildren(...buttons);
    filters.hidden = projects.length < 2;
  }
}

function setMetadata(title, summary, canonical, image) {
  document.title = `${title} — NOX Kernel`;
  const updateMeta = (attribute, name, value) => {
    let meta = document.head.querySelector(`meta[${attribute}="${name}"]`);
    if (!meta) {
      meta = element('meta');
      meta.setAttribute(attribute, name);
      document.head.append(meta);
    }
    meta.content = value;
  };
  updateMeta('name', 'description', summary || '');
  updateMeta('property', 'og:description', summary || '');
  updateMeta('property', 'og:title', document.title);
  updateMeta('property', 'og:type', 'article');
  updateMeta('property', 'og:url', `https://nox-kernel.github.io${canonical}`);
  let canonicalLink = document.head.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = element('link');
    canonicalLink.rel = 'canonical';
    document.head.append(canonicalLink);
  }
  canonicalLink.href = `https://nox-kernel.github.io${canonical}`;
  const imageUrl = safeUrl(image?.asset?.url || image?.url, true);
  if (imageUrl) updateMeta('property', 'og:image', new URL(imageUrl, 'https://nox-kernel.github.io').href);
}

function facts(project) {
  const aside = element('aside', 'wb-intro-side');
  aside.setAttribute('aria-label', 'Project details');
  const list = element('dl', 'wb-project-facts');
  const items = Array.isArray(project.projectFacts) && project.projectFacts.length
    ? project.projectFacts.map(fact => [fact.label, fact.value])
    : [['On the bench', STATUS_LABELS[project.status] || project.status || 'Ongoing']];
  for (const [label, value] of items) {
    if (!value) continue;
    const row = element('div');
    row.append(element('dt', '', label), element('dd', '', Array.isArray(value) ? value.join(', ') : value));
    list.append(row);
  }
  aside.append(list);
  return aside;
}

function renderProject(root, result) {
  const project = result.project;
  if (!project || !validSlug(project.slug)) {
    root.replaceChildren(link('← Back to the workbench', '/workbench/', 'wb-back'), emptyMessage('This notebook is not available.', 'The project may still be a draft, or its address may have changed.'));
    document.title = 'Project unavailable — NOX Kernel';
    return;
  }
  const entries = (result.entries || []).filter(entry => validSlug(entry.slug));
  const intro = element('div', 'wb-intro wb-project-intro');
  const heading = element('div');
  heading.append(element('span', 'wb-kicker', 'NOX / Project journal'), element('h1', '', project.title), element('p', 'wb-deck', project.introduction || project.summary));
  const demo = safeUrl(project.demoUrl);
  if (demo) heading.append(arrowLink('See the project', demo, true));
  intro.append(heading, facts(project));
  const children = [link('← Back to the workbench', '/workbench/', 'wb-back'), intro];
  const cover = imageFigure(project.cover);
  if (cover) {
    if (project.slug === 'project-relay' && project.cover?.url === '/images/workbench/relay-study.svg') {
      cover.classList.add('wb-relay-cover');
      cover.querySelector('img').classList.add('wb-relay-drawing');
    }
    children.push(cover);
  }
  const layout = element('div', 'wb-reading-layout');
  const contents = element('aside', 'wb-contents');
  contents.setAttribute('aria-label', 'In this project journal');
  contents.append(element('span', 'wb-label', 'In this notebook'));
  const nav = element('nav');
  nav.setAttribute('aria-label', 'Project entries');
  entries.forEach((entry, index) => nav.append(link(`${String(entry.entryNumber || index + 1).padStart(2, '0')} / ${entry.title}`, `#${validSlug(entry.legacyAnchor) ? entry.legacyAnchor : `entry-${entry.slug}`}`)));
  contents.append(nav, element('p', '', 'Notes from an ongoing build. I will update them as my understanding improves.'));
  const source = safeUrl(project.sourceUrl);
  if (source) contents.append(arrowLink('Project source', source, true));
  const prose = element('div', 'wb-prose');
  entries.forEach((entry, index) => prose.append(entryArticle(entry, index)));
  if (!entries.length) prose.append(emptyMessage('The first note is still on the bench.', 'The project is open; journal entries will follow.'));
  if (Array.isArray(project.nextSteps) && project.nextSteps.length) {
    const next = element('section', 'wb-log-entry');
    next.id = 'next';
    next.append(element('span', 'wb-kicker', 'Next on the bench'), renderPortableText(project.nextSteps));
    prose.append(next);
  }
  layout.append(contents, prose);
  children.push(layout);
  root.replaceChildren(...children);
  setMetadata(project.title, project.summary, projectHref(project.slug), project.cover);
}

function renderEntry(root, result) {
  const entry = result.entry;
  if (!entry || !validSlug(entry.slug) || !validSlug(entry.project?.slug)) {
    root.replaceChildren(link('← Back to the workbench', '/workbench/', 'wb-back'), emptyMessage('This entry is not available.', 'It may still be a draft, or its address may have changed.'));
    document.title = 'Entry unavailable — NOX Kernel';
    return;
  }
  const intro = element('div', 'wb-intro wb-project-intro');
  const heading = element('div');
  heading.append(element('span', 'wb-kicker', entry.project.title), element('h1', '', entry.title));
  if (entry.summary) heading.append(element('p', 'wb-deck', entry.summary));
  const aside = element('aside', 'wb-intro-side');
  aside.append(dateNode(entry.publishedAt, 'Written '), element('p', 'wb-margin-note', 'By NOX · learning as I go'));
  intro.append(heading, aside);
  const layout = element('div', 'wb-reading-layout');
  const contents = element('aside', 'wb-contents');
  contents.append(element('span', 'wb-label', 'From the project journal'), arrowLink(entry.project.title, projectHref(entry.project.slug)));
  const prose = element('div', 'wb-prose');
  const article = element('article', 'wb-log-entry');
  article.append(renderPortableText(entry.body));
  prose.append(article);
  layout.append(contents, prose);
  const nodes = [link(`← Back to ${entry.project.title}`, projectHref(entry.project.slug), 'wb-back'), intro];
  const cover = imageFigure(entry.cover);
  if (cover) nodes.push(cover);
  nodes.push(layout);
  root.replaceChildren(...nodes);
  setMetadata(entry.title, entry.summary, entryHref(entry, false), entry.cover);
}

async function queryPublished(query, params = {}) {
  if (!/^[a-z0-9]+$/.test(SANITY.projectId) || !/^[a-z0-9_-]+$/.test(SANITY.dataset)) throw new Error('Invalid public journal configuration.');
  const version = /^\d{4}-\d{2}-\d{2}$/.test(SANITY.apiVersion || '') ? SANITY.apiVersion : '2026-10-01';
  const url = new URL(`https://${SANITY.projectId}.api.sanity.io/v${version}/data/query/${SANITY.dataset}`);
  url.searchParams.set('query', query);
  url.searchParams.set('perspective', 'published');
  for (const [name, value] of Object.entries(params)) url.searchParams.set(`$${name}`, JSON.stringify(value));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error(`Journal request failed (${response.status}).`);
    const data = await response.json();
    if (!Object.hasOwn(data, 'result')) throw new Error('The journal response was incomplete.');
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}
export async function getLatestPublishedEntries() {
  if (!SANITY.projectId) return [];
  const query = `*[${ENTRY_FILTER}] | order(publishedAt desc, entryNumber desc)[0...3]{${ENTRY_FIELDS}}`;
  return queryPublished(query, {});
}

function clearPublishedRoots(page) {
  const roots = page === 'index'
    ? [...document.querySelectorAll('[data-journal-projects], #journal-entries')]
    : [...document.querySelectorAll('main[data-journal-page-root]')];
  roots.forEach(root => {
    root.replaceChildren();
    root.setAttribute('aria-busy', 'true');
    const loading = element('p', 'wb-content-message', 'Opening the published journal…');
    loading.setAttribute('role', 'status');
    if (root.tagName === 'OL') {
      const item = element('li'); item.append(loading); root.append(item);
    } else root.append(loading);
  });
  const filters = document.querySelector('[data-journal-filters]');
  if (filters) { filters.replaceChildren(); filters.hidden = true; }
  const status = document.querySelector('[data-journal-status]');
  if (status) { status.hidden = false; status.textContent = 'Opening the journal…'; }
  return roots;
}

async function loadContent() {
  const page = document.body.dataset.journalPage;
  if (!['index', 'project', 'entry'].includes(page) || !SANITY.projectId) return;
  const roots = clearPublishedRoots(page);
  let slug = document.body.dataset.journalSlug || new URL(window.location.href).searchParams.get('slug');
  try {
    if (page !== 'index' && !validSlug(slug)) {
      roots.forEach(root => root.replaceChildren(link('← Back to the workbench', '/workbench/', 'wb-back'), emptyMessage('Choose a notebook to open.', 'This address is missing a valid project or entry name.')));
      return;
    }
    let query;
    if (page === 'index') query = `{
      "projects": *[${PROJECT_FILTER}] | order(order asc, title asc){${PROJECT_LIST_FIELDS}},
      "entries": *[${ENTRY_FILTER}] | order(publishedAt desc, entryNumber desc){${ENTRY_FIELDS}}
    }`;
    if (page === 'project') query = `{
      "project": *[${PROJECT_FILTER} && slug.current == $slug][0]{${PROJECT_FIELDS}},
      "entries": *[${ENTRY_FILTER} && project->slug.current == $slug] | order(publishedAt asc, entryNumber asc){${ENTRY_FIELDS}, ${BODY_FIELDS}}
    }`;
    if (page === 'entry') query = `{
      "entry": *[${ENTRY_FILTER} && slug.current == $slug][0]{${ENTRY_FIELDS}, ${BODY_FIELDS}, "cover": coverImage{${IMAGE_FIELDS}}}
    }`;
    const result = await queryPublished(query, page === 'index' ? {} : { slug });
    if (page === 'index') renderIndex(result);
    else if (page === 'project') roots.forEach(root => renderProject(root, result));
    else roots.forEach(root => renderEntry(root, result));
    const status = document.querySelector('[data-journal-status]');
    if (status) status.textContent = '';
    document.dispatchEvent(new CustomEvent('nox:journal-content'));
    const target = window.location.hash.slice(1);
    if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView());
  } catch {
    roots.forEach(root => {
      const message = emptyMessage('The journal could not open just now.', 'Please try again. Your published notes are safe; no sign-in is needed to read them.', true);
      if (root.tagName === 'OL') {
        const item = element('li'); item.append(message); root.replaceChildren(item);
      } else root.replaceChildren(message);
    });
    const status = document.querySelector('[data-journal-status]');
    if (status) status.textContent = 'The journal is temporarily unavailable.';
  } finally {
    roots.forEach(root => root.removeAttribute('aria-busy'));
  }
}

if (typeof document !== 'undefined') loadContent();
