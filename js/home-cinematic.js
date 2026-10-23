// NOX Scroll Lab - Chapter navigation

document.documentElement.classList.add("js");

const chapters = [...document.querySelectorAll(".chapter")];
const header = document.querySelector(".top, .topbar");

let current = 0;
let moving = false;

function goToChapter(index) {
  if (index < 0 || index >= chapters.length) return;

  current = index;
  moving = true;

  // Activate the selected chapter
  chapters.forEach((chapter, i) => {
    chapter.classList.toggle("is-active", i === current);
  });

  // Update the animated background
  document.body.dataset.scene = chapters[current].dataset.scene;

  // Calculate the destination below the sticky header
  const headerHeight = header?.offsetHeight ?? 80;
  const target =
    window.scrollY +
    chapters[current].getBoundingClientRect().top -
    headerHeight;

  // Move smoothly into position
  window.scrollTo({
    top: Math.max(0, target),
    behavior: "smooth"
  });

  // Allow another movement after the transition
  setTimeout(() => {
    moving = false;
  }, 650);
}

// Listen for mouse-wheel scrolling
window.addEventListener("wheel", event => {
  if (event.ctrlKey || Math.abs(event.deltaY) < 5) return;

  const direction = event.deltaY > 0 ? 1 : -1;
  const next = current + direction;

  if (next < 0 || next >= chapters.length) return;

  event.preventDefault();

  if (!moving) {
    goToChapter(next);
  }
}, { passive: false });

// Start with the introduction
goToChapter(0);