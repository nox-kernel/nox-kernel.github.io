// Journal pages use ordinary HTML links and remain readable without JavaScript.
const journalHeader = document.querySelector('.journal-site .top');

if (journalHeader) {
  const measureJournalHeader = () => {
    document.body.style.setProperty(
      '--header-height',
      `${Math.ceil(journalHeader.getBoundingClientRect().height)}px`
    );
  };

  measureJournalHeader();
  new ResizeObserver(measureJournalHeader).observe(journalHeader);
}

const filterGroup = document.querySelector('[data-journal-filters]');

if (filterGroup) {
  const status = document.querySelector('[data-journal-status]');
  const applyFilter = (value, updateUrl = false) => {
    const buttons = [...filterGroup.querySelectorAll('button[data-project-filter]')];
    const entries = [...document.querySelectorAll('[data-journal-project]')];
    const chosen = buttons.find(button => button.dataset.projectFilter === value);
    const selected = chosen ? value : 'all';
    const selectedButton = chosen || buttons.find(button => button.dataset.projectFilter === 'all');
    const label = selected === 'all' ? 'all projects' :
      (selectedButton?.dataset.projectLabel || selectedButton?.textContent || 'selected project');
    let visible = 0;

    entries.forEach(entry => {
      entry.hidden = selected !== 'all' && entry.dataset.journalProject !== selected;
      if (!entry.hidden) visible += 1;
    });

    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.projectFilter === selected));
    });

    if (status) status.textContent = `${visible} ${visible === 1 ? 'entry' : 'entries'} · ${label}`;

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (selected === 'all') url.searchParams.delete('project');
      else url.searchParams.set('project', selected);
      window.history.replaceState(null, '', url);
    }
  };

  filterGroup.addEventListener('click', event => {
    const button = event.target.closest('button[data-project-filter]');
    if (button && filterGroup.contains(button)) applyFilter(button.dataset.projectFilter, true);
  });
  const refreshFilters = () => {
    applyFilter(new URL(window.location.href).searchParams.get('project') || 'all');
    filterGroup.hidden = false;
    if (status) status.hidden = false;
  };
  document.addEventListener('nox:journal-content', refreshFilters);
  refreshFilters();
}

document.querySelectorAll('[data-current-year]').forEach(node => {
  node.textContent = new Date().getFullYear();
});
