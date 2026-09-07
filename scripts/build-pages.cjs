// Generates the GitHub Pages files for the project, based on the site content in docs/site-content.json.
// This script is run as part of the build process, and can also be run manually to regenerate the pages.

const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const rootDir = join(__dirname, '..');
const docsDir = join(rootDir, 'docs');
const contentPath = join(docsDir, 'site-content.json');
const localesPath = join(rootDir, 'src', 'types', 'settings.ts');
const logoPath = join(rootDir, 'src', 'assets', 'logo.svg');
const iconsDir = join(rootDir, 'src', 'assets', 'icons');
const checkOnly = process.argv.includes('--check');

const FLAG_FILES = {
  it: 'flag-it.svg',
  en: 'flag-gb.svg',
  fr: 'flag-fr.svg',
  es: 'flag-es.svg',
  de: 'flag-de.svg',
};

const content = JSON.parse(readFileSync(contentPath, 'utf8'));
const siteLocales = Object.keys(content.locales);
const appLocales = readAppLocales();

assertSameLocales(siteLocales, appLocales);

const site = content.site;
const defaultLocale = site.defaultLocale;

if (!siteLocales.includes(defaultLocale)) {
  throw new Error(`Default locale "${defaultLocale}" is not present in docs/site-content.json.`);
}

// Replaced, once a page is rendered, with a policy naming that page's own scripts.
const CSP_PLACEHOLDER = '<!--csp-->';

/**
 * The content security policy of a generated page.
 *
 * The site is static and takes no input, so this is a second line rather than the first
 * one - but it is a page anybody can land on, and it costs a tag. The scripts are inline
 * and stay inline: each one is named by the hash of its own text, so a script that is not
 * one of ours does not run even if it finds its way into the markup.
 *
 * `frame-ancestors` is left out on purpose: a browser ignores it in a meta tag, and a
 * directive that does nothing is worse than no directive at all. GitHub Pages serves no
 * headers of ours, so that one is out of reach.
 */
function contentSecurityPolicy(html) {
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(([, body]) => createHash('sha256').update(body, 'utf8').digest('base64'))
    .map((hash) => `'sha256-${hash}'`)
    .join(' ');

  return [
    "default-src 'self'",
    `script-src ${hashes}`.trim(),
    "style-src 'self'",
    "img-src 'self' data:",
    // The download button asks GitHub which release is the latest one.
    'connect-src https://api.github.com',
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ');
}

/** Puts the policy of a page into the page, once its scripts are known. */
function withContentSecurityPolicy(html) {
  if (!html.includes(CSP_PLACEHOLDER)) {
    return html;
  }

  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(html)}">`;

  return html.replace(CSP_PLACEHOLDER, meta);
}

const generatedFiles = new Map();
const logoSvg = readFileSync(logoPath, 'utf8');

generatedFiles.set(join(docsDir, 'index.html'), renderRootPage());
generatedFiles.set(join(docsDir, 'logo.svg'), logoSvg);

const flagsDir = join(docsDir, 'flags');
for (const file of Object.values(FLAG_FILES)) {
  generatedFiles.set(join(flagsDir, file), readFileSync(join(iconsDir, file), 'utf8'));
}

for (const locale of siteLocales) {
  generatedFiles.set(join(docsDir, locale, 'index.html'), renderLocalePage(locale));
}

const changed = [];

for (const [filePath, rendered] of generatedFiles.entries()) {
  const html = filePath.endsWith('.html') ? withContentSecurityPolicy(rendered) : rendered;
  let current;

  try {
    current = readFileSync(filePath, 'utf8');
  } catch {
    current = '';
  }

  if (current !== html) {
    changed.push(filePath);
  }

  if (!checkOnly) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, html, 'utf8');
  }
}

if (checkOnly && changed.length > 0) {
  console.error('Generated GitHub Pages files are not up to date:');
  for (const filePath of changed) {
    console.error(`- ${filePath}`);
  }

  console.error('Run: npm run build:pages');
  process.exit(1);
}

if (!checkOnly) {
  console.log(`Generated ${generatedFiles.size} GitHub Pages files.`);
}

// The site and the app must offer the same languages: the locales are read back from the
// single list the interface itself uses, so the two cannot drift apart unnoticed.
function readAppLocales() {
  const source = readFileSync(localesPath, 'utf8');
  const match = source.match(/export const LOCALES = \[([^\]]+)\]/m);

  if (!match) {
    throw new Error('Could not find LOCALES in src/types/settings.ts.');
  }

  return [...match[1].matchAll(/'([^']+)'/g)].map((locale) => locale[1]);
}

function assertSameLocales(docsLocales, locales) {
  const docsSorted = [...docsLocales].sort();
  const appSorted = [...locales].sort();

  if (docsSorted.join(',') !== appSorted.join(',')) {
    throw new Error(
      `Docs locales (${docsSorted.join(', ')}) do not match app locales (${appSorted.join(', ')}).`,
    );
  }
}

function renderRootPage() {
  const localeLinks = siteLocales
    .map((locale) => {
      const page = content.locales[locale];
      return `<a href="./${locale}/" lang="${locale}" hreflang="${locale}">${escapeHtml(page.languageName)}</a>`;
    })
    .join('\n       ');

  const alternates = renderAlternateLinks('./');
  const defaultPage = content.locales[defaultLocale];

  return `<!doctype html>
<html lang="${defaultLocale}">
  <head>
    <meta charset="utf-8">
    <!--csp-->
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(defaultPage.pageTitle)}</title>
    <meta name="description" content="${escapeHtml(defaultPage.metaDescription)}">
    <link rel="icon" href="./logo.svg" type="image/svg+xml">
    <link rel="stylesheet" href="./styles.css">
${indent(alternates, 4)}
    <script>
      // The visitor lands on their own language when the browser asks for one we publish,
      // and on the default language otherwise.
      (function () {
        var supported = [${siteLocales.map((locale) => `'${locale}'`).join(', ')}];
        var preferences =
          navigator.languages && navigator.languages.length
            ? navigator.languages
            : [navigator.language];
        var target = '${defaultLocale}';

        for (var index = 0; index < preferences.length; index += 1) {
          var language = String(preferences[index] || '')
            .split('-')[0]
            .toLowerCase();

          if (supported.indexOf(language) !== -1) {
            target = language;
            break;
          }
        }

        window.location.replace('./' + target + '/');
      })();
    </script>
  </head>
  <body>
    <main class="locale_gate" aria-labelledby="language-title">
      <a class="brand" href="./${defaultLocale}/" aria-label="${escapeHtml(site.name)}">
        <span class="brand_mark" aria-hidden="true"><img src="./logo.svg" alt=""></span>
        <span>${escapeHtml(site.name)}</span>
      </a>
      <section>
        <p class="eyebrow">${escapeHtml(defaultPage.languageLabel)}</p>
        <h1 id="language-title">${escapeHtml(site.name)}</h1>
        <div class="language_grid">
        ${localeLinks}
        </div>
      </section>
    </main>
  </body>
</html>
`;
}

function renderLocalePage(locale) {
  const page = content.locales[locale];
  const alternates = renderAlternateLinks('../');
  const languageOptions = renderLanguageSelector(locale);
  const summary = page.summary
    .map(
      (item) => `
            <div>
              <dt>${escapeHtml(item.term)}</dt>
              <dd>${escapeHtml(item.detail)}</dd>
            </div>`,
    )
    .join('');
  const features = page.features
    .map(
      (feature) => `
          <article class="card">
            <h3>${escapeHtml(feature.title)}</h3>
            <p>${escapeHtml(feature.body)}</p>
          </article>`,
    )
    .join('');
  const formats = page.formats
    .map((format) => `<span>${escapeHtml(format)}</span>`)
    .join('\n          ');

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8">
    <!--csp-->
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(page.pageTitle)}</title>
    <meta name="description" content="${escapeHtml(page.metaDescription)}">
    <link rel="canonical" href="${escapeHtml(site.basePath)}${locale}/">
    <link rel="icon" href="../logo.svg" type="image/svg+xml">
    <link rel="stylesheet" href="../styles.css">
${indent(alternates, 4)}
  </head>
  <body>
    <header class="site_header">
      <nav class="site_nav" aria-label="${escapeHtml(page.navLabel)}">
        <a class="brand" href="#top" aria-label="${escapeHtml(site.name)}">
          <span class="brand_mark" aria-hidden="true"><img src="../logo.svg" alt=""></span>
          <span>${escapeHtml(site.name)}</span>
        </a>
        <div class="nav_cluster">
          <div class="nav_links">
            <a href="#download">${escapeHtml(page.downloadNav)}</a>
            <a href="#features">${escapeHtml(page.featuresNav)}</a>
            <a href="#formats">${escapeHtml(page.formatsNav)}</a>
            <a href="${escapeHtml(site.repositoryUrl)}">${escapeHtml(page.githubNav)}</a>
          </div>
          <div class="language_switcher">
${indent(languageOptions, 12)}
          </div>
        </div>
      </nav>

      <section id="top" class="hero">
        <div class="hero_copy">
          <p class="eyebrow">${escapeHtml(page.heroKicker)}</p>
          <h1>${escapeHtml(page.heroTitle)}</h1>
          <p class="lead">
            ${escapeHtml(page.heroLead)}
          </p>
          <div class="hero_actions">
            <a class="button button_primary" href="${escapeHtml(site.repositoryUrl)}">${escapeHtml(page.repoButton)}</a>
            <a class="button" href="#download">${escapeHtml(page.downloadNav)}</a>
          </div>
        </div>
        <aside class="hero_panel" aria-label="${escapeHtml(page.summaryLabel)}">
          <dl>${summary}
          </dl>
        </aside>
      </section>
    </header>

    <main>
${indent(renderDownloadSection(locale), 6)}

      <section id="features" class="section">
        <div class="section_header">
          <p class="eyebrow">${escapeHtml(page.featuresKicker)}</p>
          <h2>${escapeHtml(page.featuresTitle)}</h2>
        </div>
        <div class="card_grid">${features}
        </div>
      </section>

      <section id="formats" class="section">
        <div class="section_header">
          <p class="eyebrow">${escapeHtml(page.formatsKicker)}</p>
          <h2>${escapeHtml(page.formatsTitle)}</h2>
        </div>
        <div class="format_list" aria-label="${escapeHtml(page.formatsLabel)}">
          ${formats}
        </div>
        <p class="note">
          ${escapeHtml(page.formatsNote)}
        </p>
      </section>

      <section class="section section_split">
        <div>
          <p class="eyebrow">${escapeHtml(page.privacyKicker)}</p>
          <h2>${escapeHtml(page.privacyTitle)}</h2>
          <p>
            ${escapeHtml(page.privacyBody)}
          </p>
        </div>
        <div class="callout">
          <h3>${escapeHtml(page.smartScreenTitle)}</h3>
          <p>
            ${escapeHtml(page.smartScreenBody)}
          </p>
        </div>
      </section>
    </main>

    <footer class="site_footer">
      <span>${escapeHtml(site.name)}</span>
      <a href="${escapeHtml(site.repositoryUrl)}">${escapeHtml(page.footerRepo)}</a>
    </footer>
    <script>
      document.addEventListener('click', function (e) {
        document.querySelectorAll('.lang_picker[open]').forEach(function (d) {
          if (!d.contains(e.target)) d.removeAttribute('open');
        });
      });
    </script>
  </body>
</html>
`;
}

function renderDownloadSection(locale) {
  const page = content.locales[locale];
  const repoPath = site.repositoryUrl.replace('https://github.com/', '');
  const releasesUrl = `${site.repositoryUrl}/releases/latest`;
  const apiUrl = `https://api.github.com/repos/${repoPath}/releases/latest`;

  const strFor = JSON.stringify(page.downloadFor);
  const strAll = JSON.stringify(page.downloadAll);
  const strVersion = JSON.stringify(page.downloadVersion);
  const strCopied = JSON.stringify(page.downloadHashCopied);

  return `<section id="download" class="download_section">
  <div class="section_header">
    <p class="eyebrow">${escapeHtml(page.downloadKicker)}</p>
    <h2>${escapeHtml(page.downloadTitle)}</h2>
  </div>
  <div class="download_btns">
    <div id="dl_primary_card" class="dl_card">
      <a id="dl_primary" class="button button_primary button_lg" href="${escapeHtml(releasesUrl)}">${escapeHtml(page.downloadLoading)}</a>
    </div>
    <div id="dl_others" class="download_btns"></div>
  </div>
  <p class="download_meta" id="dl_meta">
    <a href="${escapeHtml(releasesUrl)}">${escapeHtml(page.downloadAll)}</a>
  </p>
  <script>
    (function () {
      var API = ${JSON.stringify(apiUrl)};
      var RELEASES = ${JSON.stringify(releasesUrl)};
      var STR_FOR    = ${strFor};
      var STR_ALL    = ${strAll};
      var STR_VER    = ${strVersion};
      var STR_COPIED = ${strCopied};

      function detectOS() {
        var pl = (navigator.platform || '').toLowerCase();
        if (/win/.test(pl)) return 'windows';
        if (/linux/.test(pl)) return 'linux';
        return null;
      }

      function makeHashEl(full) {
        var el = document.createElement('code');
        el.className = 'dl_hash';
        el.title = 'SHA-256: ' + full;
        el.textContent = 'SHA-256\u00a0' + full.slice(0, 12) + '\u2026';
        el.addEventListener('click', function () {
          navigator.clipboard.writeText(full).then(function () {
            var prev = el.textContent;
            el.textContent = STR_COPIED;
            setTimeout(function () { el.textContent = prev; }, 1500);
          }).catch(function () {});
        });
        return el;
      }

      var primaryCard = document.getElementById('dl_primary_card');
      var primary     = document.getElementById('dl_primary');
      var others      = document.getElementById('dl_others');
      var meta        = document.getElementById('dl_meta');

      fetch(API)
        .then(function (r) { return r.json(); })
        .then(function (release) {
          var version = release.tag_name || '';
          var assets  = release.assets || [];

          var platforms = [
            { key: 'windows', label: 'Windows', asset: assets.find(function (a) { return /\\.exe$/i.test(a.name); }) },
            { key: 'linux',   label: 'Linux',   asset: assets.find(function (a) { return /\\.AppImage$/i.test(a.name); }) },
          ].filter(function (p) { return !!p.asset; });

          if (!platforms.length) return;

          var detected = detectOS();
          var main = platforms.find(function (p) { return p.key === detected; }) || platforms[0];
          var rest = platforms.filter(function (p) { return p !== main; });

          // Primary button
          if (primary) {
            primary.href = main.asset.browser_download_url;
            primary.textContent = STR_FOR + ' ' + main.label;
          }

          // Secondary buttons
          var cardMap = {};
          cardMap[main.key] = primaryCard;

          if (others) {
            others.innerHTML = '';
            rest.forEach(function (p) {
              var card = document.createElement('div');
              card.className = 'dl_card';
              var a = document.createElement('a');
              a.href = p.asset.browser_download_url;
              a.className = 'button';
              a.textContent = p.label;
              card.appendChild(a);
              others.appendChild(card);
              cardMap[p.key] = card;
            });
          }

          // Version + releases link
          if (meta && version) {
            meta.innerHTML = '';
            var span = document.createElement('span');
            span.textContent = STR_VER + ' ' + version + ' · ';
            var link = document.createElement('a');
            link.href = RELEASES;
            link.textContent = STR_ALL;
            meta.appendChild(span);
            meta.appendChild(link);
          }

          // Fetch SHA256SUMS.txt and attach hashes to each card
          var sumsAsset = assets.find(function (a) { return a.name === 'SHA256SUMS.txt'; });
          if (!sumsAsset) return;

          fetch(sumsAsset.browser_download_url)
            .then(function (r) { return r.text(); })
            .then(function (text) {
              var hashMap = {};
              text.split('\\n').forEach(function (line) {
                var parts = line.trim().split(/\\s+/);
                if (parts.length >= 2) hashMap[parts[1]] = parts[0];
              });
              platforms.forEach(function (p) {
                var hash = hashMap[p.asset.name];
                var card = cardMap[p.key];
                if (hash && card) card.appendChild(makeHashEl(hash));
              });
            })
            .catch(function () { /* checksums unavailable, silently skip */ });
        })
        .catch(function () { /* keep static fallback link */ });
    }());
  </script>
</section>`;
}

function renderLanguageSelector(activeLocale) {
  const activePage = content.locales[activeLocale];
  const activeFlag = FLAG_FILES[activeLocale];

  const items = siteLocales
    .map((locale) => {
      const lp = content.locales[locale];
      const flag = FLAG_FILES[locale];
      const ariaCurrent = locale === activeLocale ? ' aria-current="page"' : '';
      return `<li><a${ariaCurrent} href="../${locale}/" lang="${locale}" hreflang="${locale}"><img src="../flags/${flag}" alt="" class="lang_flag" width="20" height="15"> ${escapeHtml(lp.languageName)}</a></li>`;
    })
    .join('\n    ');

  return `<details class="lang_picker">
  <summary class="lang_picker_btn" aria-label="${escapeHtml(activePage.languageLabel)}">
    <img src="../flags/${activeFlag}" alt="${escapeHtml(activePage.languageName)}" class="lang_flag" width="20" height="15">
    <span>${escapeHtml(activePage.shortName)}</span>
  </summary>
  <ul class="lang_picker_menu">
    ${items}
  </ul>
</details>`;
}

/**
 * Renders the `<link rel="alternate">` tags for a page, so search engines know which languages are available.
 * @param {*} prefix - The prefix to prepend to the locale path, e.g. `./` for the root page or `../` for a locale page.
 * @returns {string} - The HTML string containing the `<link rel="alternate">` tags.
 */
function renderAlternateLinks(prefix) {
  const links = siteLocales.map((locale) => {
    return `<link rel="alternate" hreflang="${locale}" href="${prefix}${locale}/">`;
  });

  links.push(`<link rel="alternate" hreflang="x-default" href="${prefix}${defaultLocale}/">`);

  return links.join('\n');
}

function indent(value, spaces) {
  const padding = ' '.repeat(spaces);
  return value
    .split('\n')
    .map((line) => `${padding}${line}`)
    .join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
