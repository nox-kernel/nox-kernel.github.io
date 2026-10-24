import { loadWorkbench, siteUrl, safeUrl, renderPortableText, entryUrl, ENTRY_TYPES } from './workbench-data.js';

const list = document.getElementById('journal-entry-list');
const pane = document.getElementById('journal-reading-pane');
const mailbox = document.querySelector('.journal-mailbox');
const count = document.getElementById('journal-count');
const search = document.getElementById('journal-search');
const projectFilter = document.getElementById('journal-project-filter');
const typeFilter = document.getElementById('journal-type-filter');
const shell = document.getElementById('journal-main');
const filters = document.getElementById('journal-filters');
const filtersToggle = document.getElementById('journal-filters-toggle');
const filtersClose = document.getElementById('journal-filters-close');
const filtersBackdrop = document.getElementById('journal-filters-backdrop');
const clearFilters = document.getElementById('journal-clear-filters');
const narrow = window.matchMedia('(max-width: 760px)');
const indexCanonical = document.querySelector('link[rel="canonical"]')?.href || 'https://nox-kernel.github.io/journal/';
const indexDescription = document.querySelector('meta[name="description"]')?.content || '';
let entries = [];
let selectedSlug = null;
let loadSequence = 0;
let ready = false;
let filtersOpen = false;
let returnSlug = null;
let inboxScroll = 0;
let rememberTimer;
const viewStateKey = 'noxJournalView';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function readerBody() {
  return pane.querySelector('.journal-reader, .journal-reader-placeholder');
}

function inboxPosition(value) {
  if (value !== undefined) {
    inboxScroll = Math.max(0, Number(value) || 0);
    if (list.getClientRects().length) list.scrollTop = inboxScroll;
  } else if (list.getClientRects().length) inboxScroll = list.scrollTop;
  return inboxScroll;
}

function viewSnapshot() {
  return {
    search: search.value, project: projectFilter.value, type: typeFilter.value,
    inboxScroll: inboxPosition(), readerScroll: readerBody()?.scrollTop || 0,
    returnSlug
  };
}

function rememberView() {
  if (!ready) return;
  const previous = history.state && typeof history.state === 'object' ? history.state : {};
  history.replaceState({ ...previous, [viewStateKey]: viewSnapshot() }, '', location.href);
}

function queueRemember() {
  clearTimeout(rememberTimer);
  rememberTimer = setTimeout(rememberView, 100);
}

function setFiltersOpen(open, focus = false) {
  filtersOpen = narrow.matches && Boolean(open);
  shell.classList.toggle('is-filters-open', filtersOpen);
  filtersToggle.setAttribute('aria-expanded', String(filtersOpen));
  filtersToggle.setAttribute('aria-label', filtersOpen ? 'Close journal filters' : 'Open journal filters');
  filters.inert = narrow.matches && !filtersOpen;
  mailbox.inert = filtersOpen;
  filters.setAttribute('aria-hidden', String(narrow.matches && !filtersOpen));
  if (focus) {
    if (filtersOpen) search.focus({ preventScroll: true });
    else filtersToggle.focus({ preventScroll: true });
  }
}

function syncFilterState() {
  const active = Boolean(search.value.trim() || projectFilter.value || typeFilter.value);
  clearFilters.hidden = !active;
  filtersToggle.classList.toggle('has-active-filters', active);
  document.querySelector('.journal-inbox-heading h2').textContent = active ? 'Filtered entries' : 'All entries';
}

function focusInboxRow() {
  const matching = returnSlug && list.querySelector(`[data-entry-slug="${CSS.escape(returnSlug)}"]`);
  (matching || list.querySelector('a'))?.focus({ preventScroll: true });
}

function typeOf(entry) {
  return Object.hasOwn(ENTRY_TYPES, entry.entryType) ? entry.entryType : 'note';
}

function typeBadge(entry) {
  const badge = element('span', 'journal-entry-type', ENTRY_TYPES[typeOf(entry)] || 'Note');
  badge.dataset.type = typeOf(entry);
  return badge;
}

function dateNode(value, long = false) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return element('span', '', 'Undated');
  const node = element('time');
  node.dateTime = date.toISOString();
  node.textContent = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
  return node;
}

function entryNumber(entry) {
  return Number.isInteger(entry.entryNumber) && entry.entryNumber > 0 ? `ENTRY ${String(entry.entryNumber).padStart(2, '0')}` : '';
}

function message(title, body, retry = false) {
  const box = element('li', 'journal-list-message');
  box.append(element('h3', '', title), element('p', '', body));
  if (retry) {
    const button = element('button', 'journal-retry', 'Try again');
    button.type = 'button';
    button.addEventListener('click', load);
    box.append(button);
  }
  return box;
}

function visibleEntries() {
  const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry => {
    const projectSlug = entry.project?.slug || '__general';
    if (projectFilter.value && projectSlug !== projectFilter.value) return false;
    if (typeFilter.value && typeOf(entry) !== typeFilter.value) return false;
    const text = [entry.title, entry.summary, entry.project?.title, ENTRY_TYPES[typeOf(entry)]].filter(Boolean).join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}

function entryRow(entry) {
  const row = element('li');
  const link = element('a', 'journal-entry-link');
  link.href = entryUrl(entry);
  link.dataset.entrySlug = entry.slug;
  if (entry.slug === selectedSlug) link.setAttribute('aria-current', 'true');
  const top = element('div', 'journal-row-top');
  top.append(typeBadge(entry), dateNode(entry.publishedAt));
  link.append(top, element('span', 'journal-entry-title', entry.title));
  if (entry.summary) link.append(element('p', 'journal-entry-summary', entry.summary));
  const bottom = element('div', 'journal-row-bottom');
  bottom.append(element('span', 'journal-row-project', entry.project?.title || 'General'));
  if (entryNumber(entry)) bottom.append(element('span', 'journal-row-number', entryNumber(entry)));
  link.append(bottom);
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    returnSlug = entry.slug;
    rememberView();
    const snapshot = { ...viewSnapshot(), readerScroll: 0 };
    const url = new URL(location.href);
    url.searchParams.set('entry', entry.slug);
    if (url.href !== location.href) history.pushState({ [viewStateKey]: snapshot }, '', url);
    setFiltersOpen(false);
    selectEntry(entry.slug, true, snapshot);
    rememberView();
  });
  row.append(link);
  return row;
}

function renderList({ resetScroll = false } = {}) {
  const scrollTop = resetScroll ? 0 : inboxPosition();
  const filtered = visibleEntries();
  count.textContent = filtered.length === entries.length
    ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
    : `${filtered.length} of ${entries.length} entries`;
  if (!entries.length) list.replaceChildren(message('The notebook is open.', 'Published journal entries will appear here.'));
  else if (!filtered.length) list.replaceChildren(message('No matching entries.', 'Try another search or change the project and type filters.'));
  else list.replaceChildren(...filtered.map(entryRow));
  inboxPosition(scrollTop);
  syncFilterState();
}

function backToInbox() {
  returnSlug = selectedSlug || returnSlug;
  rememberView();
  const snapshot = { ...viewSnapshot(), readerScroll: 0 };
  const url = new URL(location.href);
  url.searchParams.delete('entry');
  history.pushState({ [viewStateKey]: snapshot }, '', url);
  selectEntry(null, false, snapshot);
  focusInboxRow();
  rememberView();
}

function toolbar(entry) {
  const bar = element('div', 'journal-reader-toolbar');
  const back = element('button', 'journal-back');
  back.type = 'button';
  const arrow = element('span', '', '←');
  arrow.setAttribute('aria-hidden', 'true');
  back.append(arrow, document.createTextNode('All entries'));
  back.addEventListener('click', backToInbox);
  bar.append(back);
  if (entry) {
    const permalink = element('a', 'journal-permalink', 'Entry link ↗');
    permalink.href = entryUrl(entry);
    permalink.setAttribute('aria-label', 'Permanent link to this entry');
    bar.append(permalink);
  }
  return bar;
}

function coverFigure(cover) {
  const src = safeUrl(cover?.asset?.url || cover?.url, true);
  if (!src) return null;
  const figure = element('figure', 'journal-cover');
  const image = element('img');
  image.src = siteUrl(src);
  image.alt = typeof cover.alt === 'string' ? cover.alt : '';
  image.loading = 'lazy';
  image.decoding = 'async';
  figure.append(image);
  if (cover.caption) figure.append(element('figcaption', '', cover.caption));
  return figure;
}

function renderReader(entry, unavailable = false) {
  if (!entry) {
    const placeholder = element('div', 'journal-reader-placeholder');
    const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mark.setAttribute('viewBox', '0 0 72 72');
    mark.setAttribute('class', 'journal-notebook-mark');
    mark.setAttribute('fill', 'none');
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = '<path d="M17 13h38v48H17ZM26 13v48M35 27h12M35 36h12M35 45h8M13 24h8M13 36h8M13 48h8"/>';
    placeholder.append(mark);
    placeholder.append(element('p', 'journal-kicker', 'NOX / JOURNAL'));
    placeholder.append(element('h2', '', unavailable ? 'This entry isn’t available.' : entries.length ? 'Every build has a story.' : 'The next note is on its way.'));
    placeholder.append(element('p', '', unavailable ? 'It may still be a draft, or its address may have changed.' : 'Choose a published entry to open the notebook.'));
    pane.replaceChildren(toolbar(null), placeholder);
    return;
  }
  const article = element('article', 'journal-reader');
  article.setAttribute('aria-labelledby', 'journal-reader-title');
  const metadata = element('div', 'journal-reader-meta');
  metadata.append(typeBadge(entry), dateNode(entry.publishedAt, true));
  if (entry.retrospective) metadata.append(element('span', '', 'Looking back'));
  const heading = element('h2', 'journal-reader-title', entry.title);
  heading.id = 'journal-reader-title';
  heading.tabIndex = -1;
  article.append(metadata, heading);
  article.append(element('p', 'journal-reader-project', entry.project?.title || 'General'));
  if (entry.summary) article.append(element('p', 'journal-reader-summary', entry.summary));
  const cover = coverFigure(entry.cover);
  if (cover) article.append(cover);
  const content = element('div', 'journal-reader-content');
  if (Array.isArray(entry.body) && entry.body.length) content.append(renderPortableText(entry.body));
  else content.append(element('p', '', 'There is no additional text in this entry.'));
  article.append(content);
  const stamp = [entryNumber(entry), 'WRITTEN FROM THE BENCH / NOX'].filter(Boolean).join(' · ');
  article.append(element('div', 'journal-reader-footer', stamp));
  pane.replaceChildren(toolbar(entry), article);
}

function selectEntry(slug, userInitiated = false, snapshot = null) {
  const inboxTop = snapshot ? Number(snapshot.inboxScroll) || 0 : inboxPosition();
  const entry = entries.find(item => item.slug === slug);
  selectedSlug = entry?.slug || null;
  mailbox.dataset.readerOpen = String(Boolean(slug));
  renderList();
  renderReader(entry, Boolean(slug && !entry));
  inboxPosition(inboxTop);
  const body = readerBody();
  if (body) body.scrollTop = snapshot ? Number(snapshot.readerScroll) || 0 : 0;
  const explicitEntry = entry && new URL(location.href).searchParams.has('entry');
  document.title = explicitEntry ? `${entry.title} — NOX Journal` : 'Journal — NOX Kernel';
  const canonical = new URL(indexCanonical);
  if (explicitEntry) canonical.searchParams.set('entry', entry.slug);
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  if (canonicalLink) canonicalLink.href = canonical.href;
  const metadata = {
    'meta[name="description"]': explicitEntry ? entry.summary || indexDescription : indexDescription,
    'meta[property="og:title"]': document.title,
    'meta[property="og:description"]': explicitEntry ? entry.summary || indexDescription : indexDescription,
    'meta[property="og:type"]': explicitEntry ? 'article' : 'website',
    'meta[property="og:url"]': canonical.href
  };
  for (const [selector, content] of Object.entries(metadata)) {
    const meta = document.querySelector(selector);
    if (meta) meta.content = content;
  }
  if (userInitiated && narrow.matches) {
    pane.querySelector('#journal-reader-title')?.focus({ preventScroll: true });
  }
}

function readLocation({ restoreFocus = false } = {}) {
  const snapshot = history.state?.[viewStateKey];
  const params = new URL(location.href).searchParams;
  if (snapshot) {
    search.value = typeof snapshot.search === 'string' ? snapshot.search : '';
    projectFilter.value = snapshot.project || '';
    typeFilter.value = snapshot.type || '';
    returnSlug = snapshot.returnSlug || null;
  } else {
    search.value = '';
    projectFilter.value = params.get('project') || '';
    typeFilter.value = '';
  }
  const requested = params.get('entry');
  selectEntry(requested || (!narrow.matches ? visibleEntries()[0]?.slug : null), false, snapshot);
  setFiltersOpen(false);
  if (restoreFocus && narrow.matches) {
    if (requested) pane.querySelector('#journal-reader-title, .journal-back')?.focus({ preventScroll: true });
    else focusInboxRow();
  }
  rememberView();
}

function filterEntries() {
  renderList({ resetScroll: true });
  const url = new URL(location.href);
  if (projectFilter.value) url.searchParams.set('project', projectFilter.value);
  else url.searchParams.delete('project');
  history.replaceState(history.state, '', url);
  rememberView();
}

function populateFilters(projects) {
  const slugs = new Set(entries.map(entry => entry.project?.slug));
  const knownProjects = new Map();
  [...projects, ...entries.map(entry => entry.project)].forEach(project => {
    if (project?.slug && slugs.has(project.slug)) knownProjects.set(project.slug, project.title || project.slug);
  });
  if (entries.some(entry => !entry.project?.slug)) knownProjects.set('__general', 'General');
  projectFilter.replaceChildren(new Option('All projects', ''), ...[...knownProjects].sort((a, b) => a[1].localeCompare(b[1])).map(([slug, title]) => new Option(title, slug)));
  const requestedProject = new URL(location.href).searchParams.get('project');
  if (knownProjects.has(requestedProject)) projectFilter.value = requestedProject;
  const types = new Set(entries.map(typeOf));
  typeFilter.replaceChildren(new Option('All entries', ''), ...Object.entries(ENTRY_TYPES).filter(([key]) => types.has(key)).map(([key, title]) => new Option(title, key)));
  for (const input of [search, projectFilter, typeFilter]) input.disabled = false;
}

async function load() {
  const sequence = ++loadSequence;
  ready = false;
  mailbox.setAttribute('aria-busy', 'true');
  count.textContent = 'Opening notebook…';
  list.replaceChildren(message('Opening the notebook…', 'Loading published entries.'));
  for (const input of [search, projectFilter, typeFilter]) input.disabled = true;
  try {
    const result = await loadWorkbench();
    if (sequence !== loadSequence) return;
    entries = Array.isArray(result.entries) ? result.entries.filter(entry => typeof entry.slug === 'string' && entry.slug) : [];
    entries.sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0) || (b.entryNumber || 0) - (a.entryNumber || 0));
    populateFilters(Array.isArray(result.projects) ? result.projects : []);
    ready = true;
    readLocation();
  } catch {
    if (sequence !== loadSequence) return;
    count.textContent = 'Temporarily unavailable';
    list.replaceChildren(message('The notebook couldn’t open.', 'Please try again in a moment. No sign-in is needed to read the published journal.', true));
  } finally {
    if (sequence === loadSequence) mailbox.removeAttribute('aria-busy');
  }
}

search.addEventListener('input', filterEntries);
projectFilter.addEventListener('change', filterEntries);
typeFilter.addEventListener('change', filterEntries);
clearFilters.addEventListener('click', () => {
  search.value = ''; projectFilter.value = ''; typeFilter.value = '';
  filterEntries();
  search.focus({ preventScroll: true });
});
filtersToggle.addEventListener('click', () => setFiltersOpen(!filtersOpen, true));
filtersClose.addEventListener('click', () => setFiltersOpen(false, true));
filtersBackdrop.addEventListener('click', () => setFiltersOpen(false, true));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && filtersOpen && !document.querySelector('.nox-menu[open]')) {
    setFiltersOpen(false, true);
    event.preventDefault();
  }
});
list.addEventListener('scroll', queueRemember, { passive: true });
pane.addEventListener('scroll', queueRemember, { passive: true, capture: true });
window.addEventListener('popstate', () => readLocation({ restoreFocus: true }));
window.addEventListener('pagehide', rememberView);
narrow.addEventListener('change', () => {
  rememberView();
  setFiltersOpen(false);
  if (!new URL(location.href).searchParams.has('entry')) readLocation();
});
setFiltersOpen(false);
load();
