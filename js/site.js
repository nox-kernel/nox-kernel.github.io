// The outer native drawer and its inner accordions have separate controls.
const menu = document.querySelector('.nox-menu');
const summary = menu?.querySelector(':scope > summary');
const parents = [...(menu?.querySelectorAll('.nav-parent') || [])];
const drawerBot = createDrawerBot(menu);

function setSection(button, expanded) {
  const children = document.getElementById(button.getAttribute('aria-controls'));
  button.setAttribute('aria-expanded', String(expanded));
  if (children) children.hidden = !expanded;
}

function syncMenu() {
  if (!menu || !summary) return;
  summary.setAttribute('aria-expanded', String(menu.open));
  summary.setAttribute('aria-label', menu.open ? 'Close navigation menu' : 'Navigation menu');
  drawerBot.sync(menu.open);
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

// The decorative drawer visitor has its own cancellable entry and reaction.
function createDrawerBot(drawer) {
  const stage = drawer?.querySelector('[data-drawer-bot]');
  const runner = stage?.querySelector('[data-bot-runner]');
  const image = stage?.querySelector('[data-bot-image]');
  if (!stage || !runner || !image) return { sync() {} };

  const still = image.getAttribute('src');
  const expressions = [...stage.querySelectorAll('[data-bot-expression]')].map(node => ({
    name: node.dataset.botExpression,
    src: node.dataset.src,
    duration: Number(node.dataset.duration)
  }));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const assets = new Map();
  const animations = new Set();
  let wasOpen = false;
  let run = 0;
  let finishTimer;
  let playbackUrl;
  let lastExpression;
  try { lastExpression = sessionStorage.getItem('nox-drawer-expression'); } catch (_) {}

  function park() {
    clearTimeout(finishTimer);
    image.onload = image.onerror = null;
    image.src = still;
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    playbackUrl = null;
    stage.dataset.state = drawer.open ? 'parked' : 'closed';
  }

  function stop() {
    ++run;
    delete stage.dataset.expression;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    park();
  }

  function assetFor(expression) {
    if (!assets.has(expression.src)) {
      const loading = fetch(expression.src, { cache: 'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error('Drawer expression unavailable');
          return response.blob();
        })
        .catch(() => {
          assets.delete(expression.src);
          return null;
        });
      assets.set(expression.src, loading);
    }
    return assets.get(expression.src);
  }

  const active = id => id === run && drawer.open && !reducedMotion.matches;

  async function enter(id) {
    const available = expressions.filter(expression => expression.name !== lastExpression);
    const expression = available[Math.floor(Math.random() * available.length)];
    if (!expression || typeof runner.animate !== 'function') return;
    const loading = assetFor(expression);
    stage.dataset.state = 'entering';
    // Mirror the left resting position so the full walk starts visibly at the right.
    const distance = Math.max(0, stage.clientWidth - runner.clientWidth - 2 * runner.offsetLeft);
    const travel = runner.animate([
      { transform: `translateX(${distance}px)` },
      { transform: 'translateX(0)' }
    ], { duration: 2400, easing: 'linear', fill: 'both' });
    const steps = image.animate([
      { transform: 'translateY(0) rotate(6deg)' },
      { transform: 'translateY(-3.5px) rotate(0deg)', offset: .5 },
      { transform: 'translateY(0) rotate(-6deg)' }
    ], { duration: 400, iterations: 6, direction: 'alternate', easing: 'ease-in-out' });
    animations.add(travel);
    animations.add(steps);
    steps.finished.catch(() => {});

    try {
      await travel.finished;
      if (!active(id)) return;
      travel.cancel();
      steps.cancel();
      animations.delete(travel);
      animations.delete(steps);
      stage.dataset.state = 'parked';
      await playExpression(expression, id, loading);
    } catch (_) {
      // Closing the drawer cancels the animation's finished promise.
      if (active(id)) park();
    }
  }
// Play an expression without moving the orb.
async function playExpression(expression, id, loading = assetFor(expression)) {
  stage.dataset.state = 'loading';

  try {
    const blob = await loading;
    if (!active(id)) return;

    if (!blob) {
      park();
      return;
    }

    // A fresh URL starts the animation again from its first frame.
    playbackUrl = URL.createObjectURL(blob);

    image.onload = () => {
      if (!active(id)) return;

      image.onload = image.onerror = null;
      lastExpression = expression.name;

      try {
        sessionStorage.setItem('nox-drawer-expression', expression.name);
      } catch (_) {}

      stage.dataset.expression = expression.name;
      stage.dataset.state = 'reacting';

      finishTimer = setTimeout(() => {
        if (active(id)) park();
      }, expression.duration + 50);
    };

    image.onerror = () => {
      if (active(id)) park();
    };

    image.src = playbackUrl;
  } catch (_) {
    if (active(id)) park();
  }
}

// Drawer NOX Bot: play Alert when the orb itself is hovered.
image.addEventListener('pointerenter', event => {
  if (
    !['mouse', 'pen'].includes(event.pointerType) ||
    !drawer.open ||
    reducedMotion.matches ||
    stage.dataset.state !== 'parked'
  ) return;

  const expression = expressions.find(
    expression => expression.name === 'alert'
  );

  if (expression) {
    void playExpression(expression, run);
  }
});

  const motionChanged = () => {
    if (reducedMotion.matches) stop();
  };
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', motionChanged);
  else reducedMotion.addListener(motionChanged);
  addEventListener('pagehide', stop);

  return {
    sync(open) {
      if (open === wasOpen) return;
      wasOpen = open;
      stop();
      if (open && !reducedMotion.matches) void enter(run);
    }
  };
}

// Reusable NOX Bot: show Alert while the pointer is over the orb.
document.querySelectorAll('[data-nox-alert]').forEach(bot => {
  const image = bot.querySelector('img');
  const animation = bot.querySelector('source[type="image/webp"]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  if (!image) return;

  const normalImage = image.getAttribute('src');
  const normalAnimation = animation?.getAttribute('srcset');

  function restoreNormalAnimation() {
    if (animation) animation.srcset = normalAnimation;
    image.src = normalImage;
  }

  bot.addEventListener('pointerenter', event => {
    if (
      reducedMotion.matches ||
      !['mouse', 'pen'].includes(event.pointerType)
    ) return;

    const alertAnimation = bot.dataset.noxAlert;

    if (animation) animation.srcset = alertAnimation;
    image.src = alertAnimation;
  });

  bot.addEventListener('pointerleave', restoreNormalAnimation);
  reducedMotion.addEventListener('change', restoreNormalAnimation);
});