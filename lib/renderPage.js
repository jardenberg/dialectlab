const { ASSET_VERSION, BASE_URL, getAlternateLinks, getCanonicalUrl, shared } = require('./locales');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function renderPage(locale, bundle) {
  const canonicalUrl = getCanonicalUrl(locale);
  const alternateLinks = getAlternateLinks()
    .map(({ locale: altLocale, href }) => `<link rel="alternate" hreflang="${altLocale}" href="${escapeHtml(href)}" />`)
    .join('\n    ');
  const xDefault = `<link rel="alternate" hreflang="x-default" href="${escapeHtml(getCanonicalUrl('sv'))}" />`;
  const ogImageUrl = `${BASE_URL}${shared.ogImagePath}`;
  const faviconUrl = `${shared.faviconPath}?v=${ASSET_VERSION}`;
  const stylesheetUrl = `/styles.css?v=${ASSET_VERSION}`;
  const scriptUrl = `/app.js?v=${ASSET_VERSION}`;
  const copy = bundle.copy;

  return `<!doctype html>
<html lang="${escapeHtml(bundle.htmlLang)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(bundle.meta.title)}</title>
    <meta name="description" content="${escapeHtml(bundle.meta.description)}" />
    <meta name="theme-color" content="#17130e" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    ${alternateLinks}
    ${xDefault}
    <link rel="icon" type="image/svg+xml" href="${escapeHtml(faviconUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(shared.siteName)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(bundle.meta.title)}" />
    <meta property="og:description" content="${escapeHtml(bundle.meta.description)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(bundle.meta.ogAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(bundle.meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(bundle.meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(bundle.meta.ogAlt)}" />
    <link rel="stylesheet" href="${escapeHtml(stylesheetUrl)}" />
  </head>
  <body>
    <div class="page-shell">
      <header class="hero-card">
        <div class="eyebrow">${escapeHtml(copy.eyebrow)}</div>
        <h1>${escapeHtml(copy.heroTitle)}</h1>
        <p class="hero-copy">${escapeHtml(copy.heroCopy)}</p>
        <div class="tag-row">
          ${copy.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
        </div>
      </header>

      <main class="content-grid">
        <section class="panel">
          <div class="panel-label">${escapeHtml(copy.startLabel)}</div>
          <h2>${escapeHtml(copy.startTitle)}</h2>

          <div class="record-card">
            <div>
              <div class="panel-label panel-label-dark">${escapeHtml(copy.recordingLabel)}</div>
              <p class="record-copy">${escapeHtml(copy.recordingCopy)}</p>
            </div>

            <button id="record-button" class="record-button" type="button">${escapeHtml(copy.recordButtonIdle)}</button>

            <div id="status-message" class="status-box">${escapeHtml(copy.statusIdle)}</div>
            <div id="progress-shell" class="progress-shell hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100">
              <div id="progress-bar" class="progress-bar"></div>
            </div>
            <div id="progress-hint" class="progress-hint hidden"></div>
          </div>

          <div class="settings-block settings-block-after-record">
            <div class="panel-label">${escapeHtml(copy.settingsLabel)}</div>
            <h3 class="settings-heading">${escapeHtml(copy.settingsTitle)}</h3>
          </div>

          <div class="settings-block">
            <div class="setting-title">${escapeHtml(copy.strengthTitle)}</div>
            <div class="option-grid" id="strength-options"></div>
          </div>

          <div class="settings-block">
            <div class="setting-title">${escapeHtml(copy.voiceTitle)}</div>
            <div class="voice-grid" id="voice-options"></div>
            <p class="hint-text" id="voice-hint"></p>
          </div>

          <div class="settings-block">
            <div class="setting-title">${escapeHtml(copy.tempoTitle)}</div>
            <div class="slider-card">
              <label class="slider-label" for="tempo-slider">
                <span>${escapeHtml(copy.tempoTitle)}</span>
                <strong id="tempo-value">0.76x</strong>
              </label>
              <input id="tempo-slider" type="range" min="0.7" max="1.15" step="0.01" />
              <p class="hint-text">${escapeHtml(copy.tempoHint)}</p>
            </div>
          </div>
        </section>

        <section class="panel panel-dark">
          <div class="panel-label panel-label-accent">${escapeHtml(copy.outputLabel)}</div>
          <h2>${escapeHtml(copy.outputTitle)}</h2>
          <p class="dark-copy">${escapeHtml(copy.outputCopy)}</p>

          <div class="audio-wrap">
            <audio id="result-audio" controls></audio>
            <button id="play-button" type="button" class="secondary-button hidden">${escapeHtml(copy.playNow)}</button>
          </div>

          <div id="meta-cards" class="meta-grid">
            <div class="meta-card">${escapeHtml(copy.noResult)}</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-label">${escapeHtml(copy.transcriptLabel)}</div>
          <h2>${escapeHtml(copy.transcriptTitle)}</h2>
          <div id="transcript-box" class="text-box">${escapeHtml(copy.transcriptPlaceholder)}</div>
        </section>

        <section class="panel panel-accent">
          <div class="panel-label panel-label-accent">${escapeHtml(copy.transformedLabel)}</div>
          <h2>${escapeHtml(copy.transformedTitle)}</h2>
          <div id="transformed-box" class="text-box text-box-dark">${escapeHtml(copy.transformedPlaceholder)}</div>
        </section>

        <section class="panel">
          <div class="panel-label">${escapeHtml(copy.ttsLabel)}</div>
          <h2>${escapeHtml(copy.ttsTitle)}</h2>
          <div id="tts-box" class="text-box">${escapeHtml(copy.ttsPlaceholder)}</div>
        </section>
      </main>
    </div>

    <script>window.__GORMIGSKANSK__ = ${serializeForScript({ locale, copy })};</script>
    <script src="${escapeHtml(scriptUrl)}" defer></script>
  </body>
</html>`;
}

module.exports = {
  renderPage,
};
