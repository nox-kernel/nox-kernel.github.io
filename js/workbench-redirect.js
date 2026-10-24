// Preserve bookmarked legacy addresses while the menu now opens two pages.
(() => {
const base = document.querySelector('meta[name="nox-baseurl"]')?.content || '';
const path = location.pathname.slice(base.length).replace(/index\.html$/, '');
const previous = new URLSearchParams(location.search);
let anchor = '';
try { anchor = decodeURIComponent(location.hash.slice(1)); } catch { /* Invalid old fragments open the project list. */ }
const valid = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 100;
let destination = '/projects/';
if (path !== '/workbench/') {
  const entry = path === '/workbench/entry/' ? previous.get('slug') : anchor;
  const project = path === '/workbench/project/' ? previous.get('slug') : path.split('/').filter(Boolean)[1];
  if (valid(entry) && entry !== 'next') destination = `/journal/?entry=${encodeURIComponent(entry)}`;
  else if (valid(project)) destination = `/journal/?project=${encodeURIComponent(project)}`;
  else destination = '/journal/';
} else if (anchor === 'entries') destination = '/journal/';
location.replace(base + destination);
})();
