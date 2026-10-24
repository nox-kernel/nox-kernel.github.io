# NOX Kernel website

The NOX development, projects and community website, built with Jekyll and hosted on [GitHub Pages](https://nox-kernel.github.io/).

## Local preview

Install Ruby and Bundler using the [Jekyll installation guide](https://jekyllrb.com/docs/installation/), then run these commands from the repository root:

```sh
bundle install
bundle exec jekyll serve --host 127.0.0.1 --port 4000
```

Open **http://127.0.0.1:4000/**. Jekyll rebuilds when source files change; refresh the browser to see saved edits. Preview through the server rather than opening an HTML file directly.

For a build without a preview server, use `bundle exec jekyll build`. Generated output goes to `_site/`, which is ignored by Git. Always edit the source files outside `_site/`.

The Gemfile uses the GitHub Pages-compatible Jekyll 3.10 series. See [GitHub's local testing guide](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/testing-your-github-pages-site-locally-with-jekyll) for more setup details.

## Source structure

| Path | Purpose |
| --- | --- |
| `_layouts/base.html` | Shared page document, typography and asset loading |
| `_includes/header.html` | NOX branding, drawer and expandable menu groups |
| `_data/navigation.yml` | Menu labels, destinations, keys and children |
| `_includes/background.html`, `css/shared.css` | Shared space background |
| `css/navigation.css`, `js/site.js` | Header, drawer and submenu behaviour |
| `index.html` | Homepage content |
| `css/home-cinematic.css`, `js/home-cinematic.js` | Homepage-only chapter effects |
| `projects/index.html`, `css/projects.css`, `js/projects.js` | Projects viewer, search and filters |
| `js/projects-scene.js` | NOX orb, outlined folders, network paths and camera controls |
| `js/github-projects.js` | Public GitHub repository discovery and saved-list fallback |
| `journal/index.html`, `css/journal.css`, `js/journal.js` | Journal inbox and reader |
| `js/workbench-data.js`, `js/journal-content.js` | Published Sanity content and rendering |
| `noxiverse/index.html`, `collaborate/index.html`, `css/network.css` | Network pages |
| `about/index.html`, `css/about.css` | About NOX content and styling |
| `404.html`, `css/not-found.css` | Custom page-not-found screen |

The shared layout loads page-specific `styles`, `scripts` and `modules` from front matter. Keep homepage effects on the homepage. The mobile drawer begins below the header so the branding and close control remain visible; preserve this arrangement when changing navigation styles.

Three.js and OrbitControls are vendored locally under `vendor/`. Their versions, provenance and licenses are recorded there.

## Add a page or menu item

Create a folder such as `example/`, then add `index.html` beginning with:

```html
---
layout: base
title: Example — NOX Kernel
nav_key: example
---
<main class="wrap">
  <h1>Example</h1>
  <p>Your page content.</p>
</main>
```

Add its label, URL (`/example/`) and matching key to `_data/navigation.yml`. An item with `children` becomes an expandable heading; opening it pushes later menu items downward. Use `relative_url` for internal links and asset paths, for example `{{ '/projects/' | relative_url }}`.

Workbench is the menu group for Projects and Journal. Network contains NoxiVerse and Collaborate. The old `/workbench/` addresses remain as compatibility redirects to the new Projects or Journal views; keep them while older links still exist.

## Projects: managed through GitHub

The Projects viewer automatically reads public, original repositories under [`nox-kernel`](https://github.com/nox-kernel). A new repository appears on the next page load or when **Refresh projects** is selected in the Project index. Adding a repository requires no website rebuild or Sanity record.

Manage each repository's displayed information on GitHub:

- **Name** becomes the folder title, with separators converted to spaces and common acronyms preserved.
- **About description** becomes the short overview.
- **Topics** become filters. Without topics, the detected programming language is used.
- An optional status topic selects the status: `status-planned` or `status-exploring` (Exploring), `status-building` or `status-ongoing` (In progress), `status-prototype`, `status-paused`, or `status-complete`. Choose one. The default is In progress; archived repositories show Paused.
- Add `nox-hidden` to keep another public repository out of the viewer.

The website repository, profile repository, `.github`, forks and private repositories are excluded. No GitHub sign-in or token is used. The browser checks on page load and manual refresh, without background polling.

The [public GitHub API](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user) is paginated and [rate limited](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api). If it cannot be reached, a previously saved complete list can be shown with a visible notice. That browser snapshot can contain previously public repository details until a successful refresh.

## Journal: managed through Sanity

Open [NOX Content Editor](https://nox-kernel-workbench.sanity.studio/) and sign in with an authorized Sanity account. Add a journal title, address, date, entry type, summary and body, then publish when ready. Types are Note, Update, Learning, Fix and Release; older entries without a type display Note.

Choose an optional **Project** directly from the public GitHub repository picker, or choose **General**. Its list follows the same exclusions as the Projects viewer; adding a repo does not require a Sanity Project record. Journal filters and project labels use the current GitHub names. Existing legacy references resolve to matching repos; website-history notes are General, and old `?project=website` links still open those General notes. Entry text and addresses remain intact.

The old Sanity Project schema remains only for earlier references. GitHub discovery does not create Sanity project documents. If GitHub cannot be reached, the Journal still opens and shows a project-list notice; the existing saved list is used when available.

Drafts stay in the editor. Published writing is shared content, so it can appear on the live site after a refresh without a website rebuild. Website JavaScript contains only public configuration and anonymous reads; keep API tokens, passwords and private editor configuration out of the repository.

## Community links and placeholders

The NoxiVerse **Register interest** button opens the public Brevo signup form. Its confirmation and welcome emails are managed in Brevo. The site contains no email-service credentials.

Discord and collaboration enquiry links currently use `/404.html` as a placeholder. Replace the marked links when their external destinations are ready. The NoxiVerse hero image is concept artwork; community plans are described as future work.

The custom not-found page is available at `/404.html`; GitHub Pages also uses it for missing addresses. A local preview server may handle missing routes differently.
