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