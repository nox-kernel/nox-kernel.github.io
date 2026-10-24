// The outer native drawer and its inner accordions have separate controls.
const menu = document.querySelector('.nox-menu');
const summary = menu?.querySelector(':scope > summary');
const parents = [...(menu?.querySelectorAll('.nav-parent') || [])];

function setSection(button, expanded) {
  const children = document.getElementById(button.getAttribute('aria-controls'));
  button.setAttribute('aria-expanded', String(expanded));
  if (children) children.hidden = !expanded;
}

function syncMenu() {
  if (!menu || !summary) return;
  summary.setAttribute('aria-expanded', String(menu.open));
  summary.setAttribute('aria-label', menu.open ? 'Close navigation menu' : 'Navigation menu');
  if (!menu.open) parents.forEach(button => setSection(button, false));
}

parents.forEach(button => button.addEventListener('click', () => {
  setSection(button, button.getAttribute('aria-expanded') !== 'true');
}));

menu?.addEventListener('toggle', event => { if (event.target === menu) syncMenu(); });
menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  menu.open = false;
  syncMenu();
}));

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !menu?.open) return;
  const group = document.activeElement?.closest('.nav-group');
  const parent = group?.querySelector('.nav-parent[aria-expanded="true"]');
  if (parent) {
    setSection(parent, false);
    parent.focus();
  } else {
    menu.open = false;
    syncMenu();
    summary?.focus();
  }
  event.preventDefault();
});

document.addEventListener('click', event => {
  if (menu?.open && (!menu.contains(event.target) || event.target === menu)) {
    menu.open = false;
    syncMenu();
  }
});
// Keep same-page anchors local, including from nested routes and under a baseurl.
const base = document.querySelector('meta[name="nox-baseurl"]')?.content || '';
const onHome = location.pathname === base + '/' || location.pathname === base + '/index.html';
if (onHome) menu?.querySelectorAll('a[href]').forEach(link => {
  const url = new URL(link.href);
  if (url.origin === location.origin && url.pathname === base + '/' && url.hash) link.setAttribute('href', url.hash);
});
function currentAnchor() {
  if (!onHome) return;
  menu?.querySelectorAll('[data-nav-key]').forEach(link => {
    const active = link.dataset.navKey === (location.hash === '#network' && link.getAttribute('href') === '#network' ? 'network' : 'home');
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}
addEventListener('hashchange', currentAnchor);
currentAnchor();
if (menu) syncMenu();
document.querySelectorAll('[data-current-year]').forEach(node => { node.textContent = new Date().getFullYear(); });
