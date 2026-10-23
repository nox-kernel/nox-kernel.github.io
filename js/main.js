// NOX SOCIAL LINKS. Only paste public NOX URLs that you have verified.
    // Empty values remain informational cards and are not clickable.
    // Discord: use an intentional public server invite or profile link, never a private invite.
    const SOCIAL_LINKS = {
      x: "https://x.com/NoxKernel",
      youtube: "https://www.youtube.com/@NoxKernelDev",
      reddit: "https://www.reddit.com/user/noxkernal/",
      discord: "",
      facebook: "https://www.facebook.com/profile.php?id=61595988410074"
    };

    const grid = document.getElementById('social-grid');
    const socialTitles = {
      x: ['X', 'Technical updates', 'X'],
      youtube: ['YouTube', 'Learning & videos', '▶'],
      reddit: ['Reddit', 'Technical discussions', 'r/'],
      discord: ['Discord', 'Community presence', '#'],
      facebook: ['Facebook', 'Community updates', 'f']
    };
    for (const [key, value] of Object.entries(SOCIAL_LINKS)) {
      if (!value) continue;
      let url;
      try { url = new URL(value); } catch { continue; }
      if (url.protocol !== 'https:') continue;
      const card = grid.querySelector('[data-social="' + key + '"]');
      if (card) {
        const link = document.createElement('a');
        link.className = 'nc-card';
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', 'Visit NOX on ' + socialTitles[key][0]);
        while (card.firstChild) link.appendChild(card.firstChild);
        const status = link.querySelector('.nc-status');
        if (status) status.textContent = '↗';
        card.replaceWith(link);
      } else if (key === 'facebook') {
        const link = document.createElement('a');
        link.className = 'nc-card';
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', 'Visit NOX on Facebook');
        const mark = document.createElement('span');
mark.className = 'nc-icon';
mark.setAttribute('aria-hidden', 'true');

const facebookLogo = document.createElement('img');
facebookLogo.src = './images/icons/facebook.png';
facebookLogo.alt = '';

mark.appendChild(facebookLogo);
        const info = document.createElement('span'); info.className = 'nc-info';
        const title = document.createElement('span'); title.className = 'nc-title'; title.textContent = 'Facebook';
        const desc = document.createElement('span'); desc.className = 'nc-desc'; desc.textContent = 'Community updates';
        const arrow = document.createElement('span'); arrow.className = 'nc-status'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
        info.append(title, desc); link.append(mark, info, arrow); grid.append(link);
      }
    }
    // Hide Discord until it has a valid public link.
const pendingDiscord = grid.querySelector(
  '.nc-card.pending[data-social="discord"]'
);

if (pendingDiscord) {
  pendingDiscord.remove();
}
    document.getElementById('year').textContent = new Date().getFullYear();
// Opening scene, followed by the transition into Focus.
customElements.whenDefined('nox-mascot').then(() => {
  const nox = document.getElementById('homepage-mascot');
  const main = document.getElementById('top');
  const focus = document.getElementById('focus');

  if (!nox || !main || !focus) return;

  const motion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  const clamp = value => Math.max(0, Math.min(1, value));

  let frame = 0;
  let request = 0;

  async function updateScene() {
    frame = 0;
    const currentRequest = ++request;

    const y = window.scrollY;
    const height = window.innerHeight;

    const start = main.getBoundingClientRect().top + y;
    const focusStart = focus.getBoundingClientRect().top + y;

    // Finish the opening as Focus reaches the upper screen area.
    const introEnd = Math.max(
      start + 1,
      focusStart - height * 0.25
    );

    const progress = clamp(
      (y - start) / (introEnd - start)
    );

    const reduced = nox.state.reducedMotion;
    const opening = reduced ? 1 : progress;

    main.style.setProperty('--intro-progress', opening);

    if (!nox.hasAttribute('data-loaded')) return;

    // Raise the head during the opening, then look around.
    const clip = opening < 1 ? 'PowerUp' : 'Scan';

    if (nox.state.clip !== clip) {
      const selected = await nox.playAnimation(clip);

      if (!selected) return;
    }

    // A newer scroll update takes priority.
    if (currentRequest !== request) return;

    const end = start + main.offsetHeight - height;

    const scan = clamp(
      (y - introEnd) / Math.max(1, end - introEnd)
    );

    nox.setScrollProgress(
      clip === 'PowerUp' ? opening : scan
    );

    const compactView =
  window.innerWidth <= 820 || window.innerHeight <= 700;

    const distance = compactView ? 105 : 90;

    nox.setCameraView(26, distance);
  }

  function requestUpdate() {
    if (!frame) {
      frame = requestAnimationFrame(updateScene);
    }
  }

  window.addEventListener('scroll', requestUpdate, {
    passive: true
  });

  window.addEventListener('resize', requestUpdate);
  motion.addEventListener('change', requestUpdate);
  nox.addEventListener('nox-ready', requestUpdate);

  requestUpdate();
});
// Measure the banner so NOX and section headings stay below it.
const siteHeader = document.querySelector('.top');

if (siteHeader) {
  const updateHeaderHeight = () => {
    const height = Math.ceil(
      siteHeader.getBoundingClientRect().height
    );

    document.documentElement.style.setProperty(
      '--header-height',
      `${height}px`
    );
  };

  const headerObserver = new ResizeObserver(updateHeaderHeight);

  headerObserver.observe(siteHeader);
  updateHeaderHeight();
}