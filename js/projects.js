import { projectRepoUrl } from './workbench-data.js';
import { loadGitHubProjects, GitHubRateLimitError } from './github-projects.js';

const viewer = document.getElementById('project-viewer');
const canvasHost = document.getElementById('project-scene');
const labels = document.getElementById('project-labels');
const orbLabel = document.getElementById('nox-bot-label');
const panel = document.getElementById('project-controls');
const toggle = document.getElementById('project-index-toggle');
const search = document.getElementById('project-search');
const statusFilter = document.getElementById('project-status');
const topicFilter = document.getElementById('project-topic');
const clearButton = document.getElementById('project-clear');
const list = document.getElementById('project-list');
const state = document.getElementById('viewer-state');
const counter = document.getElementById('project-count');
const results = document.getElementById('project-results');
const announcement = document.getElementById('viewer-announcement');
const motionButton = document.getElementById('viewer-motion');
const refreshButton = document.getElementById('project-refresh');
const syncMessage = document.getElementById('project-sync-message');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const touch = matchMedia('(pointer: coarse)');
const statuses = { exploring: 'Exploring', building: 'In progress', ongoing: 'In progress', prototype: 'Prototype', paused: 'Paused', complete: 'Complete' };
let projects = [];
let visibleProjects = [];
let scene;
let sceneState = 'loading';
let loaded = false;
let loadFailed = false;
let loadErrorMessage = '';
let panelOpen = false;
let previewId = null;
let pinnedId = null;
let clearTimer;
let animationPaused = reducedMotion.matches;
const markers = new Map();
const rows = new Map();
const positions = new Map();

const idOf = project => String(project._id || project.slug);
const topicsOf = project => (Array.isArray(project.category) ? project.category : String(project.category || '').split(/[/,]/)).map(item => String(item).trim()).filter(Boolean);
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function repoLink(project, className, text) {
  const url = projectRepoUrl(project);
  if (!url) return null;
  const link = node('a', className, text);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
function openRepository(project) {
  const url = projectRepoUrl(project);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}
function setPanel(open, returnFocus = false) {
  panelOpen = Boolean(open);
  panel.hidden = !panelOpen;
  viewer.classList.toggle('is-panel-open', panelOpen);
  toggle.setAttribute('aria-expanded', String(panelOpen));
  toggle.setAttribute('aria-label', panelOpen ? 'Close project index' : 'Open project index');
  if (!panelOpen && returnFocus) toggle.focus();
}
function setPreview(id, pin = false) {
  clearTimeout(clearTimer);
  if (pin) pinnedId = id;
  const next = id || pinnedId;
  previewId = next && markers.has(next) ? next : null;
  markers.forEach((marker, key) => marker.classList.toggle('is-preview', key === previewId));
  rows.forEach((row, key) => row.classList.toggle('is-selected', key === previewId));
  scene?.setHovered(previewId);
}
function clearPreview() {
  pinnedId = null;
  setPreview(null);
}
function deferClear() {
  clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    const current = markers.get(previewId);
    if (current?.matches(':hover, :focus-within')) scene?.setHovered(previewId);
    else setPreview(null);
  }, 120);
}
function inspectProject(project) {
  const id = idOf(project);
  setPreview(id, true);
  scene?.focusProject(id);
  announcement.textContent = `${project.title}. ${project.summary || ''}${projectRepoUrl(project) ? '' : ' Repository not linked yet.'}`;
  if (innerWidth < 700) setPanel(false);
}
function makeMarker(project) {
  const id = idOf(project);
  const marker = node('div', 'project-marker');
  marker.dataset.projectId = id;
  const title = repoLink(project, 'project-title', project.title || 'Untitled project') || node('button', 'project-title', project.title || 'Untitled project');
  title.title = project.title || 'Untitled project';
  if (title.tagName === 'BUTTON') title.type = 'button';
  title.setAttribute('aria-label', `${project.title || 'Untitled project'}${projectRepoUrl(project) ? ' — open GitHub repository' : ' — show project details; repository not linked'}`);
  title.addEventListener('click', event => {
    if (touch.matches && pinnedId !== id) { event.preventDefault(); setPreview(id, true); }
    else if (!projectRepoUrl(project)) setPreview(id, true);
  });
  const preview = node('div', 'project-preview');
  if (project.summary) preview.append(node('p', '', project.summary));
  const open = repoLink(project, '', 'Open repository ↗');
  if (open) preview.append(open);
  else preview.append(node('small', '', 'Repository not linked yet'));
  marker.append(title, preview);
  marker.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') setPreview(id); });
  marker.addEventListener('pointerleave', deferClear);
  marker.addEventListener('focusin', () => setPreview(id));
  marker.addEventListener('focusout', deferClear);
  marker.addEventListener('click', event => {
    if (event.target !== marker) return;
    if (touch.matches && pinnedId !== id) setPreview(id, true);
    else if (projectRepoUrl(project)) openRepository(project);
    else setPreview(id, true);
  });
  marker.hidden = true;
  return marker;
}
function makeRow(project) {
  const id = idOf(project);
  const row = node('li', 'index-project');
  row.dataset.projectId = id;
  const inspect = node('button');
  inspect.type = 'button';
  inspect.setAttribute('aria-label', `Inspect ${project.title} in the project viewer`);
  // Fixed icon geometry; GitHub titles and descriptions are inserted as plain text.
  inspect.innerHTML = '<svg viewBox="0 0 28 22" aria-hidden="true"><path d="M2 20V3h9l3 4h12v13Z"/><path d="M2 9h24"/></svg>';
  const copy = node('span');
  copy.append(node('strong', '', project.title || 'Untitled project'));
  copy.append(node('small', '', statuses[project.status] || project.status || 'Project'));
  if (project.summary) copy.append(node('span', 'index-summary', project.summary));
  inspect.append(copy);
  inspect.addEventListener('click', () => inspectProject(project));
  row.append(inspect);
  const link = repoLink(project, '', '↗');
  if (link) {
    link.setAttribute('aria-label', `Open ${project.title} GitHub repository`);
    row.append(link);
  }
  return row;
}
function renderState() {
  const indexNotice = loadFailed || sceneState === 'unavailable';
  viewer.classList.toggle('scene-unavailable', sceneState === 'unavailable');
  state.classList.toggle('is-index-notice', indexNotice);
  if (indexNotice) panel.insertBefore(state, list);
  else if (state.parentElement !== viewer) viewer.append(state);
  state.classList.toggle('is-notice', loaded && !loadFailed);
  if (loadFailed) {
    state.replaceChildren(node('p', '', loadErrorMessage));
    const retry = node('button', '', 'Reconnect');
    retry.type = 'button'; retry.addEventListener('click', () => loadProjects(true));
    state.append(retry); state.hidden = false;
  } else if (!loaded) {
    state.hidden = false;
  } else if (!visibleProjects.length) {
    state.replaceChildren(node('p', '', projects.length ? 'No projects match those filters.' : 'The next project connection starts here.'));
    state.hidden = false;
  } else if (sceneState === 'unavailable') {
    state.replaceChildren(node('p', '', 'The 3D view is unavailable in this browser. Explore the project index instead.'));
    state.hidden = false;
  } else if (sceneState === 'ready') state.hidden = true;
}
function render() {
  const query = search.value.trim().toLocaleLowerCase();
  visibleProjects = projects.filter(project => {
    const searchable = [project.title, project.summary, ...topicsOf(project), project.status, project.sourceUrl].join(' ').toLocaleLowerCase();
    return (!query || searchable.includes(query)) && (!statusFilter.value || project.status === statusFilter.value) && (!topicFilter.value || topicsOf(project).includes(topicFilter.value));
  });
  clearPreview();
  markers.clear(); rows.clear(); positions.clear();
  labels.replaceChildren(); list.replaceChildren();
  visibleProjects.forEach(project => {
    const id = idOf(project);
    const marker = makeMarker(project); const row = makeRow(project);
    markers.set(id, marker); rows.set(id, row);
    labels.append(marker); list.append(row);
  });
  if (!visibleProjects.length) list.append(node('li', 'index-empty', projects.length ? 'No matches. Try another name, status or topic.' : 'Public GitHub projects will appear here.'));
  const count = visibleProjects.length;
  viewer.classList.toggle('is-dense', count > 12);
  counter.textContent = `${String(count).padStart(2, '0')} ${count === 1 ? 'PROJECT' : 'PROJECTS'}`;
  results.textContent = `${count} of ${projects.length} projects`;
  clearButton.hidden = !query && !statusFilter.value && !topicFilter.value;
  announcement.textContent = `${count} ${count === 1 ? 'project' : 'projects'} shown.`;
  scene?.setProjects(visibleProjects);
  renderState();
}
function addOptions(select, values, label) {
  const selected = select.value;
  select.replaceChildren(new Option(label, ''));
  values.forEach(value => select.append(new Option(select === statusFilter ? statuses[value] || value : value, value)));
  if (values.includes(selected)) select.value = selected;
}
function connectionMessage(error) {
  if (error instanceof GitHubRateLimitError) {
    const retry = new Date(error.retryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `GitHub is limiting requests. Try again after ${retry}.`;
  }
  return 'The GitHub project index could not connect. Please try again.';
}
async function loadProjects(force = false) {
  if (refreshButton.disabled) return;
  loaded = false; loadFailed = false;
  syncMessage.hidden = true;
  refreshButton.disabled = true;
  refreshButton.textContent = 'Refreshing…';
  state.classList.remove('is-notice'); state.hidden = false;
  state.replaceChildren(node('span', 'viewer-spinner'), node('p', '', 'Connecting to the project network…'));
  counter.textContent = 'CONNECTING';
  [search, statusFilter, topicFilter].forEach(control => { control.disabled = true; });
  try {
    const data = await loadGitHubProjects({ force });
    projects = data.projects;
    addOptions(statusFilter, [...new Set(projects.map(project => project.status).filter(Boolean))].sort(), 'All statuses');
    addOptions(topicFilter, [...new Set(projects.flatMap(topicsOf))].sort(), 'All topics');
    loaded = true;
    if (data.stale) {
      const saved = new Date(data.fetchedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      syncMessage.textContent = `Showing the saved list from ${saved}. ${connectionMessage(data.error)}`;
      syncMessage.hidden = false;
    }
    render();
    if (data.stale) setPanel(true);
  } catch (error) {
    loadErrorMessage = connectionMessage(error);
    if (projects.length) {
      loaded = true;
      syncMessage.textContent = `Showing the previous project list. ${loadErrorMessage}`;
      syncMessage.hidden = false;
      render();
      setPanel(true);
    } else {
      loadFailed = true;
      results.textContent = 'Connection unavailable'; counter.textContent = 'OFFLINE';
      renderState(); setPanel(true);
    }
  } finally {
    [search, statusFilter, topicFilter].forEach(control => { control.disabled = !loaded; });
    refreshButton.disabled = false;
    refreshButton.textContent = 'Refresh projects';
  }
}
function updatePositions(projected, frame) {
  if (sceneState === 'unavailable') return;
  projected.forEach(point => {
    positions.set(point.id, point);
    const marker = markers.get(point.id);
    if (!marker) return;
    const visible = point.visible && point.x > 12 && point.x < frame.width - 12 && point.y > 40 && point.y < frame.height - 45;
    marker.hidden = !visible;
    if (visible) {
      const halfWidth = marker.offsetWidth / 2 + 8;
      const x = Math.max(halfWidth, Math.min(frame.width - halfWidth, point.x));
      // Keep the title and its description together, above the viewer tools.
      const bottomSpace = frame.width <= 700 ? 108 : 64;
      const labelHeight = marker.classList.contains('is-preview') ? marker.offsetHeight : marker.firstElementChild.offsetHeight;
      const y = Math.max(78, Math.min(frame.height - bottomSpace - labelHeight, point.y));
      marker.style.setProperty('--preview-bridge', `${Math.max(labelHeight, point.y - y + marker.firstElementChild.offsetHeight).toFixed(2)}px`);
      marker.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
    }
  });
  orbLabel.hidden = !frame.orb.visible;
  if (frame.orb.visible) orbLabel.style.transform = `translate3d(${frame.orb.x.toFixed(2)}px,${frame.orb.y.toFixed(2)}px,0)`;
}
async function startScene() {
  try {
    const { createProjectScene } = await import('./projects-scene.js');
    scene = createProjectScene({
      container: canvasHost,
      onProjectHover: id => { if (id) setPreview(id); else deferClear(); },
      onProjectClick: (id, event) => {
        const project = visibleProjects.find(item => idOf(item) === id);
        if (!project) return;
        if (event?.pointerType === 'touch' && pinnedId !== id) setPreview(id, true);
        else if (projectRepoUrl(project)) openRepository(project);
        else setPreview(id, true);
      },
      onBackgroundClick: () => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.closest('.project-marker')) active.blur();
        clearPreview();
      },
      onFrame: updatePositions,
      onStatus: status => {
        if (status.type === 'context-lost') {
          sceneState = 'unavailable';
          setPanel(true); renderState();
        }
      }
    });
    sceneState = 'ready';
    scene.setMotion(!animationPaused);
    if (loaded) scene.setProjects(visibleProjects);
    renderState();
  } catch (error) {
    sceneState = 'unavailable';
    viewer.classList.add('scene-unavailable');
    setPanel(true); renderState();
    console.warn('The 3D project scene could not start.', error instanceof Error ? error.message : 'WebGL unavailable');
  }
}
function syncMotion() {
  if (reducedMotion.matches) animationPaused = true;
  scene?.setMotion(!animationPaused);
  motionButton.disabled = reducedMotion.matches;
  motionButton.setAttribute('aria-pressed', String(animationPaused));
  const label = reducedMotion.matches ? 'Animation paused by reduced motion preference' : animationPaused ? 'Play signal animation' : 'Pause signal animation';
  motionButton.setAttribute('aria-label', label);
  motionButton.title = label;
}
toggle.addEventListener('click', () => setPanel(!panelOpen));
refreshButton.addEventListener('click', () => loadProjects(true));
search.addEventListener('input', render);
statusFilter.addEventListener('change', render);
topicFilter.addEventListener('change', render);
clearButton.addEventListener('click', () => { search.value = ''; statusFilter.value = ''; topicFilter.value = ''; render(); search.focus(); });
document.getElementById('viewer-zoom-in').addEventListener('click', () => scene?.zoomBy(.82));
document.getElementById('viewer-zoom-out').addEventListener('click', () => scene?.zoomBy(1.22));
document.getElementById('viewer-reset').addEventListener('click', () => { clearPreview(); scene?.resetView(); });
motionButton.addEventListener('click', () => { animationPaused = !animationPaused; syncMotion(); });
reducedMotion.addEventListener('change', () => { animationPaused = reducedMotion.matches; syncMotion(); });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || document.querySelector('.nox-menu[open]')) return;
  if (panelOpen) { setPanel(false, true); event.preventDefault(); }
  else if (previewId) { clearPreview(); event.preventDefault(); }
});
window.addEventListener('pagehide', event => { if (!event.persisted) scene?.destroy(); });
syncMotion();
loadProjects();
startScene();
