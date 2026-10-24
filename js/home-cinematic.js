// NOX Kernel — Cinematic chapter navigation

document.documentElement.classList.add("js");

const story = document.querySelector(".story");
const chapters = [...document.querySelectorAll(".story .chapter")];
const header = document.querySelector(".top, .topbar");

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);

let current = -1;
let lastWheel = 0;
let navigatingUntil = 0;
let touch = null;
let scrollFrame = 0;

function headerHeight() {
  return header?.offsetHeight ?? 80;
}

// Activate a chapter and its background lighting.
function activateChapter(index) {
  current = index;

  chapters.forEach((chapter, i) => {
    chapter.classList.toggle("is-active", i === index);
  });

  document.body.dataset.scene = chapters[index].dataset.scene;
}

// Navigate to a chapter using one shared controller.
function goToChapter(index) {
  if (index < 0 || index >= chapters.length) return;

  activateChapter(index);

  navigatingUntil = performance.now() + 850;

  const target =
    window.scrollY +
    chapters[index].getBoundingClientRect().top -
    headerHeight();

  window.scrollTo({
    top: Math.max(0, target),
    behavior: reducedMotion.matches ? "instant" : "smooth"
  });
}

// Keep the active scene correct during ordinary scrolling.
function syncScene() {
  scrollFrame = 0;

  if (performance.now() < navigatingUntil) return;

  const centre =
    headerHeight() +
    (window.innerHeight - headerHeight()) / 2;

  let nearest = 0;
  let distance = Infinity;

  chapters.forEach((chapter, i) => {
    const rect = chapter.getBoundingClientRect();
    const middle = rect.top + rect.height / 2;
    const difference = Math.abs(middle - centre);

    if (difference < distance) {
      distance = difference;
      nearest = i;
    }
  });

  if (nearest !== current) activateChapter(nearest);
}

window.addEventListener("scroll", () => {
  if (!scrollFrame) {
    scrollFrame = requestAnimationFrame(syncScene);
  }
}, { passive: true });

// DESKTOP — Mouse wheel
window.addEventListener("wheel", event => {
  if (document.querySelector(".nox-menu")?.open || event.ctrlKey || Math.abs(event.deltaY) < 8) return;

  const rect = story.getBoundingClientRect();

  if (rect.bottom <= headerHeight() ||
      rect.top >= window.innerHeight) return;

  const direction = Math.sign(event.deltaY);
  const next = current + direction;

  if (next < 0 || next >= chapters.length) return;

  event.preventDefault();

  const now = performance.now();

  if (now - lastWheel < 450) return;

  lastWheel = now;
  goToChapter(next);

}, { passive: false });



// Start at the chapter nearest the current scroll position.
requestAnimationFrame(() => {
  requestAnimationFrame(syncScene);
});

// Mobile swipe navigation

if (window.matchMedia("(pointer: coarse)").matches) {

  let swipe = null;

  story.addEventListener("touchstart", event => {
    if (event.touches.length !== 1 ||
        event.target.closest("a, button, input, textarea")) {
      return;
    }

    swipe = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      captured: false
    };
  }, { passive: true });

  story.addEventListener("touchmove", event => {
    if (!swipe) return;

    const dx = event.touches[0].clientX - swipe.x;
    const dy = event.touches[0].clientY - swipe.y;

    if (Math.abs(dy) < 10 ||
        Math.abs(dy) < Math.abs(dx) * 1.2) return;

    const next = current + (dy < 0 ? 1 : -1);

    if (next < 0 || next >= chapters.length) return;

    const available = window.innerHeight - headerHeight();

    // Don't trap scrolling when a chapter is too tall.
    if (chapters[current]?.scrollHeight > available + 24) return;

    if (event.cancelable) {
      event.preventDefault();
      swipe.captured = true;
    }
  }, { passive: false });

  story.addEventListener("touchend", event => {
    if (!swipe) return;

    const dx = event.changedTouches[0].clientX - swipe.x;
    const dy = event.changedTouches[0].clientY - swipe.y;

    if (swipe.captured &&
        Math.abs(dy) > 55 &&
        Math.abs(dy) > Math.abs(dx) * 1.2) {
      goToChapter(current + (dy < 0 ? 1 : -1));
    }

    swipe = null;
  }, { passive: true });

  story.addEventListener("touchcancel", () => {
    swipe = null;
  });
}