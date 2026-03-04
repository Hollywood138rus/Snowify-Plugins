// ─── Internet Radio Plugin for Snowify ───
// Self-contained plugin: fetches radio-browser.info API, manages own audio,
// injects nav button + view via DOM, integrates with NP bar via observers.
(function () {
  'use strict';

  // Guard against double-load
  if (document.querySelector('#view-radio')) return;

  // ═══════ Constants ═══════
  const API = 'https://de1.api.radio-browser.info';
  const GEO_URL = 'http://ip-api.com/json/?fields=country,countryCode,city';
  const VOLUME_SCALE = 0.3;
  const SEARCH_DEBOUNCE = 400;
  const PLAY_TIMEOUT = 15000;
  const STORAGE_KEY = 'snowify_radio';

  const FALLBACK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const FALLBACK_SVG = '<svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" style="color:var(--text-subdued)"><path d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707m2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708m5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708m2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707zM6 8a2 2 0 1 1 2.5 1.937V15.5a.5.5 0 0 1-1 0V9.937A2 2 0 0 1 6 8"/></svg>';
  const NAV_ICON_SVG = '<svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor"><path d="M3.05 3.05a7 7 0 0 0 0 9.9.5.5 0 0 1-.707.707 8 8 0 0 1 0-11.314.5.5 0 0 1 .707.707m2.122 2.122a4 4 0 0 0 0 5.656.5.5 0 1 1-.708.708 5 5 0 0 1 0-7.072.5.5 0 0 1 .708.708m5.656-.708a.5.5 0 0 1 .708 0 5 5 0 0 1 0 7.072.5.5 0 1 1-.708-.708 4 4 0 0 0 0-5.656.5.5 0 0 1 0-.708m2.122-2.12a.5.5 0 0 1 .707 0 8 8 0 0 1 0 11.313.5.5 0 0 1-.707-.707 7 7 0 0 0 0-9.9.5.5 0 0 1 0-.707zM6 8a2 2 0 1 1 2.5 1.937V15.5a.5.5 0 0 1-1 0V9.937A2 2 0 0 1 6 8"/></svg>';
  const GENRE_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393', '#00cec9', '#fd79a8', '#6c5ce7', '#00b894'];

  // i18n helper with English fallbacks
  const FALLBACKS = {
    'nav.radio': 'Radio',
    'radio.title': 'Radio',
    'radio.searchStations': 'Search stations',
    'radio.searchPlaceholder': 'Search radio stations...',
    'radio.yourStations': 'Your Stations',
    'radio.popularInCity': 'Popular in {{city}}, {{country}}',
    'radio.popularInCountry': 'Popular in {{country}}',
    'radio.popularStations': 'Popular Stations',
    'radio.trendingIn': 'Trending in {{country}}',
    'radio.trendingWorldwide': 'Trending Worldwide',
    'radio.yourCountry': 'Your Country',
    'radio.browseByTag': 'Browse by Tag',
    'radio.allTagStations': 'All "{{tag}}" Stations',
    'radio.allResults': 'All Results',
    'radio.resultsFor': 'Results for "{{query}}"',
    'radio.noStationsFor': 'No stations found for "{{query}}".',
    'radio.couldNotLoad': 'Could not load radio stations.',
    'radio.liveRadio': 'Live Radio',
    'radio.noQueue': 'Live Radio — no queue',
    'player.play': 'Play',
    'toast.radioNoStreamUrl': 'No stream URL for this station',
    'toast.radioTuningIn': 'Tuning in: {{name}}',
    'toast.radioUnavailable': 'Station unavailable — try another',
    'toast.radioStationRemoved': 'Removed: {{name}}',
    'toast.radioStationAdded': 'Added: {{name}}',
    'toast.radioStreamEnded': 'Radio stream ended — try another station',
    'toast.radioStreamLost': 'Radio stream lost — try another station',
    'toast.radioStreamStalled': 'Radio stream stalled — try another station',
  };

  function t(key, params) {
    if (typeof I18n !== 'undefined' && I18n.t) {
      const result = I18n.t(key, params);
      if (result !== key) return result;
    }
    let str = FALLBACKS[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), v);
      });
    }
    return str;
  }

  // ═══════ Helpers ═══════
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function $(sel) { return document.querySelector(sel); }

  // ═══════ Plugin State ═══════
  let _state = { favoriteStations: [] };
  let _active = false;
  let _station = null;
  let _geo = null;
  let _generation = 0;
  let _stationsCache = [];
  let _searchTimer = null;
  let _audioEl = null;
  let _toastTimeout = null;
  let _savedNP = null;    // original NP state before radio took over
  let _radioBtn = null;
  let _radioView = null;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.favoriteStations) _state.favoriteStations = saved.favoriteStations;
    } catch (_) {}
    // Migrate favorites from old built-in state if present
    if (!_state.favoriteStations.length) {
      try {
        const old = JSON.parse(localStorage.getItem('snowify_state'));
        if (old && old.favoriteStations && old.favoriteStations.length) {
          _state.favoriteStations = old.favoriteStations;
          saveState();
        }
      } catch (_) {}
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  }

  // ═══════ API Layer (direct fetch — no IPC) ═══════
  async function radioFetch(path) {
    const res = await fetch(API + path, {
      headers: { 'User-Agent': 'Snowify/1.0' }
    });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function detectGeo() {
    try {
      const res = await fetch(GEO_URL);
      if (!res.ok) throw new Error();
      return await res.json();
    } catch (_) {
      // Fallback to app locale
      const locale = typeof window.snowify !== 'undefined' && window.snowify.getLocale
        ? await window.snowify.getLocale()
        : (navigator.language || 'en');
      const cc = locale.includes('-') ? locale.split('-')[1] : '';
      return { country: '', countryCode: cc, city: '' };
    }
  }

  function apiByCountry(cc, limit) {
    return radioFetch('/json/stations/bycountrycodeexact/' + encodeURIComponent(cc) + '?limit=' + (limit || 20) + '&order=votes&reverse=true&hidebroken=true');
  }
  function apiTrendingByCountry(cc, limit) {
    return radioFetch('/json/stations/bycountrycodeexact/' + encodeURIComponent(cc) + '?limit=' + (limit || 20) + '&order=clickcount&reverse=true&hidebroken=true');
  }
  function apiTopClick(count) {
    return radioFetch('/json/stations/topclick/' + (count || 20));
  }
  function apiByTag(tag, limit) {
    return radioFetch('/json/stations/bytagexact/' + encodeURIComponent(tag) + '?limit=' + (limit || 30) + '&order=votes&reverse=true&hidebroken=true');
  }
  function apiSearch(query, limit) {
    return radioFetch('/json/stations/search?name=' + encodeURIComponent(query) + '&limit=' + (limit || 30) + '&order=votes&reverse=true&hidebroken=true');
  }
  function apiTags() {
    return radioFetch('/json/tags?limit=50&order=stationcount&reverse=true&hidebroken=true');
  }
  function apiClick(uuid) {
    return radioFetch('/json/url/' + encodeURIComponent(uuid)).catch(() => {});
  }

  // ═══════ Toast (reuse app's toast element) ═══════
  function showToast(msg) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(_toastTimeout);
    requestAnimationFrame(() => toast.classList.add('show'));
    _toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
  }

  // ═══════ Audio Element ═══════
  function createAudio() {
    _audioEl = new Audio();
    _audioEl.crossOrigin = 'anonymous';
    _audioEl.addEventListener('ended', () => {
      showToast(t('toast.radioStreamEnded'));
      cleanup();
    });
    _audioEl.addEventListener('error', () => {
      if (!_active) return;
      showToast(t('toast.radioStreamLost'));
      cleanup();
    });
    _audioEl.addEventListener('stalled', () => {
      if (!_active) return;
      showToast(t('toast.radioStreamStalled'));
    });
    _audioEl.addEventListener('waiting', () => {
      if (!_active) return;
      $('#progress-bar')?.classList.add('radio-buffering');
      $('#max-np-progress-bar')?.classList.add('radio-buffering');
    });
    _audioEl.addEventListener('playing', () => {
      $('#progress-bar')?.classList.remove('radio-buffering');
      $('#max-np-progress-bar')?.classList.remove('radio-buffering');
    });
  }

  // ═══════ DOM Injection ═══════
  function injectNavButton() {
    const libraryBtn = $('[data-view="library"]');
    if (!libraryBtn) return null;

    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.view = 'radio';
    btn.innerHTML = NAV_ICON_SVG + '<span>' + t('nav.radio') + '</span>';
    libraryBtn.after(btn);
    return btn;
  }

  function injectView() {
    const viewsContainer = $('.views-container') || $('main') || $('body');
    const view = document.createElement('section');
    view.className = 'view';
    view.id = 'view-radio';
    view.innerHTML = `
      <div class="view-header radio-header">
        <h1>${t('radio.title')}</h1>
        <div class="radio-search-bar">
          <div class="radio-search-wrap" id="radio-search-wrap">
            <div class="radio-search-label" id="radio-search-label">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M16 16l4.5 4.5" stroke-linecap="round"/></svg>
              <span>${t('radio.searchStations')}</span>
            </div>
            <div class="radio-search-input-wrap hidden" id="radio-search-input-wrap">
              <svg class="radio-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M16 16l4.5 4.5" stroke-linecap="round"/></svg>
              <input type="text" id="radio-search-input" placeholder="${t('radio.searchPlaceholder')}" spellcheck="false" autocomplete="off" />
              <button class="search-clear hidden" id="radio-search-clear">
                <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div id="radio-content" class="explore-content">
        <div class="loading"><div class="spinner"></div></div>
      </div>`;
    viewsContainer.appendChild(view);
    return view;
  }

  // ═══════ View Switching ═══════
  function initViewSwitching() {
    _radioBtn.addEventListener('click', () => {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      _radioView.classList.add('active');
      _radioBtn.classList.add('active');
      resetSearchPill();
      render();
    });

    // When any app view becomes active, deactivate radio view
    document.querySelectorAll('.view').forEach(v => {
      if (v === _radioView) return;
      new MutationObserver(() => {
        if (v.classList.contains('active')) {
          _radioView.classList.remove('active');
          _radioBtn.classList.remove('active');
          cancelSearch();
        }
      }).observe(v, { attributes: true, attributeFilter: ['class'] });
    });
  }

  // ═══════ Card Builders ═══════
  function buildCard(station) {
    const hasFavicon = station.favicon && station.favicon.trim();
    const coverHtml = hasFavicon
      ? '<div class="station-cover-wrap"><img class="album-card-cover station-card-cover" src="' + escapeHtml(station.favicon) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'\'" /><div class="station-cover-fallback station-fallback-icon" style="display:none">' + FALLBACK_SVG + '</div></div>'
      : '<div class="album-card-cover station-fallback-icon">' + FALLBACK_SVG + '</div>';
    const meta = [station.tags, station.country, station.bitrate ? station.bitrate + ' kbps' : ''].filter(Boolean).join(' · ');
    return '<div class="album-card station-card" data-station-uuid="' + escapeHtml(station.stationuuid) + '">' +
      coverHtml +
      '<button class="album-card-play" title="' + t('player.play') + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg></button>' +
      '<div class="album-card-name" title="' + escapeHtml(station.name) + '">' + escapeHtml(station.name) + '</div>' +
      '<div class="album-card-meta">' + escapeHtml(meta) + '</div></div>';
  }

  function buildScrollSection(title, stations) {
    const cards = stations.map(s => buildCard(s)).join('');
    return '<div class="explore-section"><h2>' + escapeHtml(title) + '</h2>' +
      '<div class="scroll-container">' +
      '<button class="scroll-arrow scroll-arrow-left" data-dir="left"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
      '<div class="album-scroll">' + cards + '</div>' +
      '<button class="scroll-arrow scroll-arrow-right" data-dir="right"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>' +
      '</div></div>';
  }

  function buildTrendingSection(title, stations) {
    const items = stations.map((s, i) => {
      const hasFav = s.favicon && s.favicon.trim();
      const thumbHtml = hasFav
        ? '<img class="top-song-thumb" src="' + escapeHtml(s.favicon) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'\'" /><div class="top-song-thumb station-trending-fallback" style="display:none">' + FALLBACK_SVG + '</div>'
        : '<div class="top-song-thumb station-trending-fallback">' + FALLBACK_SVG + '</div>';
      const meta = [s.country, s.bitrate ? s.bitrate + ' kbps' : ''].filter(Boolean).join(' · ');
      return '<div class="top-song-item station-trending-item" data-station-uuid="' + escapeHtml(s.stationuuid) + '">' +
        '<div class="top-song-rank">' + (i + 1) + '</div>' +
        '<div class="top-song-thumb-wrap">' + thumbHtml +
        '<div class="top-song-play"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg></div></div>' +
        '<div class="top-song-info"><div class="top-song-title">' + escapeHtml(s.name) + '</div>' +
        '<div class="top-song-artist">' + escapeHtml(meta) + '</div></div></div>';
    }).join('');
    return '<div class="explore-section"><h2>' + escapeHtml(title) + '</h2><div class="top-songs-grid">' + items + '</div></div>';
  }

  function buildGenreGrid(tags) {
    const items = tags.map((tg, i) => {
      const bg = GENRE_COLORS[i % GENRE_COLORS.length];
      return '<div class="mood-card radio-genre-card" data-tag="' + escapeHtml(tg.name) + '" style="border-left-color:' + bg + '">' + escapeHtml(tg.name) + ' <span style="opacity:0.5;font-size:11px">' + tg.stationcount + '</span></div>';
    }).join('');
    return '<div class="explore-section"><h2>' + t('radio.browseByTag') + '</h2><div class="mood-grid">' + items + '</div></div>';
  }

  // ═══════ Station Lookup ═══════
  function findByUuid(uuid) {
    return _state.favoriteStations.find(s => s.stationuuid === uuid)
      || _stationsCache.find(s => s.stationuuid === uuid)
      || null;
  }

  // ═══════ Attach Listeners ═══════
  function attachListeners(content) {
    // Scroll arrows
    content.querySelectorAll('.scroll-container').forEach(container => {
      const scrollEl = container.querySelector('.album-scroll');
      if (!scrollEl) return;
      container.querySelectorAll('.scroll-arrow').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = btn.dataset.dir === 'left' ? -400 : 400;
          scrollEl.scrollBy({ left: dir, behavior: 'smooth' });
        });
      });
    });

    // Station card clicks
    content.querySelectorAll('.station-card').forEach(card => {
      const handler = () => {
        const station = findByUuid(card.dataset.stationUuid);
        if (station) play(station);
      };
      card.addEventListener('click', handler);
      const playBtn = card.querySelector('.album-card-play');
      if (playBtn) {
        playBtn.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
      }
    });

    // Trending item clicks
    content.querySelectorAll('.station-trending-item').forEach(item => {
      item.addEventListener('click', () => {
        const station = findByUuid(item.dataset.stationUuid);
        if (station) play(station);
      });
    });

    // Genre card clicks
    content.querySelectorAll('.radio-genre-card').forEach(card => {
      card.addEventListener('click', async () => {
        const tag = card.dataset.tag;
        if (!tag) return;
        const contentEl = $('#radio-content');
        contentEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        try {
          const stations = await apiByTag(tag);
          _stationsCache = stations;
          let html = '<button class="radio-back-btn" id="radio-back-btn">&larr; ' + t('radio.title') + '</button>';
          if (stations.length) {
            html += buildScrollSection(tag, stations);
            html += buildTrendingSection(t('radio.allTagStations', { tag }), stations);
          } else {
            html += '<div class="empty-state"><p>' + t('radio.noStationsFor', { query: escapeHtml(tag) }) + '</p></div>';
          }
          contentEl.innerHTML = html;
          attachListeners(contentEl);
          $('#radio-back-btn')?.addEventListener('click', () => render());
        } catch (err) {
          contentEl.innerHTML = '<div class="empty-state"><p>' + t('radio.couldNotLoad') + '</p></div>';
        }
      });
    });
  }

  // ═══════ Render Radio View ═══════
  async function render() {
    const content = $('#radio-content');
    if (!content) return;
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      if (!_geo) _geo = await detectGeo();
      const hasGeo = !!_geo.countryCode;

      const [local, trendingCountry, trendingWorld, tags] = await Promise.all([
        hasGeo ? apiByCountry(_geo.countryCode) : Promise.resolve([]),
        hasGeo ? apiTrendingByCountry(_geo.countryCode, 20) : Promise.resolve([]),
        apiTopClick(20),
        apiTags(),
      ]);

      let html = '';

      if (_state.favoriteStations.length)
        html += buildScrollSection(t('radio.yourStations'), _state.favoriteStations);

      if (local.length) {
        const label = _geo.city
          ? t('radio.popularInCity', { city: _geo.city, country: _geo.country })
          : (_geo.country ? t('radio.popularInCountry', { country: _geo.country }) : t('radio.popularStations'));
        html += buildScrollSection(label, local);
      }

      if (trendingCountry.length) {
        const countryLabel = _geo.country || t('radio.yourCountry');
        html += buildTrendingSection(t('radio.trendingIn', { country: countryLabel }), trendingCountry);
      }

      if (trendingWorld.length)
        html += buildTrendingSection(t('radio.trendingWorldwide'), trendingWorld);

      if (tags.length)
        html += buildGenreGrid(tags.slice(0, 30));

      _stationsCache = [..._state.favoriteStations, ...local, ...trendingCountry, ...trendingWorld];
      content.innerHTML = html || '<div class="empty-state"><p>' + t('radio.couldNotLoad') + '</p></div>';
      attachListeners(content);
    } catch (err) {
      console.error('[Radio Plugin] render error:', err);
      content.innerHTML = '<div class="empty-state"><p>' + t('radio.couldNotLoad') + '</p></div>';
    }
  }

  // ═══════ Search ═══════
  function initSearch() {
    const input = $('#radio-search-input');
    const clearBtn = $('#radio-search-clear');
    const label = $('#radio-search-label');
    const inputWrap = $('#radio-search-input-wrap');
    if (!input || !clearBtn) return;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearBtn.classList.toggle('hidden', !q);
      clearTimeout(_searchTimer);
      if (!q) {
        render();
        return;
      }
      _searchTimer = setTimeout(async () => {
        const contentEl = $('#radio-content');
        contentEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        try {
          const results = await apiSearch(q);
          _stationsCache = results;
          if (!results.length) {
            contentEl.innerHTML = '<div class="empty-state"><p>' + t('radio.noStationsFor', { query: escapeHtml(q) }) + '</p></div>';
            return;
          }
          let html = buildScrollSection(t('radio.resultsFor', { query: q }), results);
          html += buildTrendingSection(t('radio.allResults'), results);
          contentEl.innerHTML = html;
          attachListeners(contentEl);
        } catch (err) {
          contentEl.innerHTML = '<div class="empty-state"><p>' + t('radio.couldNotLoad') + '</p></div>';
        }
      }, SEARCH_DEBOUNCE);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('hidden');
      inputWrap.classList.add('hidden');
      label.classList.remove('hidden');
      render();
    });

    label.addEventListener('click', () => {
      label.classList.add('hidden');
      inputWrap.classList.remove('hidden');
      input.focus();
    });

    input.addEventListener('blur', () => {
      if (!input.value.trim()) {
        inputWrap.classList.add('hidden');
        label.classList.remove('hidden');
      }
    });
  }

  function cancelSearch() {
    if (_searchTimer) { clearTimeout(_searchTimer); _searchTimer = null; }
  }

  function resetSearchPill() {
    const ri = $('#radio-search-input');
    const rl = $('#radio-search-label');
    const rw = $('#radio-search-input-wrap');
    const rc = $('#radio-search-clear');
    if (ri) ri.value = '';
    if (rl) rl.classList.remove('hidden');
    if (rw) rw.classList.add('hidden');
    if (rc) rc.classList.add('hidden');
  }

  // ═══════ Main App Integration ═══════
  function pauseMainApp() {
    const playBtn = $('#btn-play-pause');
    if (!playBtn) return;
    const pauseIcon = playBtn.querySelector('.icon-pause');
    if (pauseIcon && !pauseIcon.classList.contains('hidden')) {
      playBtn.click(); // triggers app's togglePlay() → pause
    }
  }

  function getAppVolume() {
    const fill = document.querySelector('#volume-fill') || document.querySelector('.volume-fill');
    if (fill) {
      const w = parseFloat(fill.style.width);
      if (!isNaN(w)) return (w / 100) * VOLUME_SCALE;
    }
    return 0.5 * VOLUME_SCALE;
  }

  function syncPlayButton(isPlaying) {
    const btn = $('#btn-play-pause');
    if (!btn) return;
    const playIcon = btn.querySelector('.icon-play');
    const pauseIcon = btn.querySelector('.icon-pause');
    if (playIcon) playIcon.classList.toggle('hidden', isPlaying);
    if (pauseIcon) pauseIcon.classList.toggle('hidden', !isPlaying);

    // Maximized NP play button
    const maxBtn = $('#max-np-play');
    if (maxBtn) {
      const mp = maxBtn.querySelector('.icon-play');
      const mpp = maxBtn.querySelector('.icon-pause');
      if (mp) mp.classList.toggle('hidden', isPlaying);
      if (mpp) mpp.classList.toggle('hidden', !isPlaying);
    }
  }

  // ═══════ Now Playing Takeover ═══════
  function saveNP() {
    _savedNP = {
      thumbnail: $('#np-thumbnail')?.src || '',
      title: $('#np-title')?.textContent || '',
      artist: $('#np-artist')?.textContent || '',
    };
  }

  function showRadioNP(station) {
    if (!_savedNP) saveNP();
    document.body.classList.add('radio-plugin-active');

    const bar = $('#now-playing-bar');
    if (bar) bar.classList.remove('hidden');
    const app = $('#app');
    if (app) app.classList.remove('no-player');

    const npThumb = $('#np-thumbnail');
    if (npThumb) {
      npThumb.src = station.favicon || FALLBACK_IMG;
      if (station.favicon) {
        npThumb.onerror = () => { npThumb.src = FALLBACK_IMG; npThumb.onerror = null; };
      }
    }

    const npTitle = $('#np-title');
    if (npTitle) {
      npTitle.textContent = station.name;
      npTitle.classList.remove('clickable');
      npTitle.onclick = null;
    }

    const npArtist = $('#np-artist');
    if (npArtist) {
      const meta = [station.tags, station.country, station.bitrate ? station.bitrate + ' kbps' : ''].filter(Boolean).join(' · ');
      npArtist.textContent = meta || t('radio.liveRadio');
      npArtist.classList.remove('clickable');
      npArtist.onclick = null;
    }

    // Like button state
    const isFav = _state.favoriteStations.some(s => s.stationuuid === station.stationuuid);
    $('#np-like')?.classList.toggle('liked', isFav);

    // LIVE badge
    const timeTotal = $('#time-total');
    if (timeTotal) { timeTotal.textContent = 'LIVE'; timeTotal.classList.add('radio-live-badge'); }
    const maxTimeTotal = $('#max-np-time-total');
    if (maxTimeTotal) { maxTimeTotal.textContent = 'LIVE'; maxTimeTotal.classList.add('radio-live-badge'); }

    // Progress bar to 0
    const pf = document.querySelector('.progress-fill');
    if (pf) pf.style.width = '0%';
    const mpf = document.querySelector('.max-np-progress-fill');
    if (mpf) mpf.style.width = '0%';

    // Time current
    const timeCurrent = $('#time-current');
    if (timeCurrent) timeCurrent.textContent = '0:00';

    updateMediaSession(station);
  }

  function cleanupNP() {
    document.body.classList.remove('radio-plugin-active');

    const timeTotal = $('#time-total');
    if (timeTotal) { timeTotal.classList.remove('radio-live-badge'); timeTotal.textContent = '0:00'; }
    const maxTimeTotal = $('#max-np-time-total');
    if (maxTimeTotal) { maxTimeTotal.classList.remove('radio-live-badge'); maxTimeTotal.textContent = '0:00'; }

    $('#progress-bar')?.classList.remove('radio-buffering');
    $('#max-np-progress-bar')?.classList.remove('radio-buffering');

    if (_savedNP) {
      const npThumb = $('#np-thumbnail');
      if (npThumb) npThumb.src = _savedNP.thumbnail || FALLBACK_IMG;
      const npTitle = $('#np-title');
      if (npTitle) npTitle.textContent = _savedNP.title;
      const npArtist = $('#np-artist');
      if (npArtist) npArtist.textContent = _savedNP.artist;
      _savedNP = null;
    }

    // Clear Discord presence
    if (window.snowify && window.snowify.clearPresence) {
      window.snowify.clearPresence().catch(() => {});
    }
  }

  // ═══════ Playback ═══════
  async function play(station) {
    const streamUrl = station.url_resolved || station.url;
    if (!streamUrl) {
      showToast(t('toast.radioNoStreamUrl'));
      return;
    }

    const gen = ++_generation;

    // Pause main app's playback
    pauseMainApp();

    _active = true;
    _station = station;

    showRadioNP(station);
    syncPlayButton(true);
    apiClick(station.stationuuid);

    try {
      showToast(t('toast.radioTuningIn', { name: station.name }));
      _audioEl.src = streamUrl;
      _audioEl.load();
      _audioEl.volume = getAppVolume();

      const playPromise = _audioEl.play();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), PLAY_TIMEOUT)
      );
      await Promise.race([playPromise, timeoutPromise]);

      if (gen !== _generation) return;
      syncPlayButton(true);
      updateDiscordPresence(station);
      updateMediaSession(station);
    } catch (err) {
      if (gen !== _generation) return;
      if (err && err.name === 'AbortError') return;
      console.error('[Radio Plugin] play error:', err);
      showToast(t('toast.radioUnavailable'));
      cleanup();
    }
  }

  function cleanup() {
    if (!_active) return;
    _audioEl.pause();
    _audioEl.removeAttribute('src');
    _audioEl.load();
    _active = false;
    _station = null;
    syncPlayButton(false);
    cleanupNP();
  }

  function radioTogglePlay() {
    if (!_active || !_audioEl) return;
    if (_audioEl.paused) {
      _audioEl.play().catch(() => {});
      syncPlayButton(true);
    } else {
      _audioEl.pause();
      syncPlayButton(false);
    }
  }

  // ═══════ Favorites ═══════
  function toggleFavorite(station) {
    if (!station) return;
    const idx = _state.favoriteStations.findIndex(s => s.stationuuid === station.stationuuid);
    if (idx >= 0) {
      _state.favoriteStations.splice(idx, 1);
      showToast(t('toast.radioStationRemoved', { name: station.name }));
    } else {
      _state.favoriteStations.push({
        stationuuid: station.stationuuid, name: station.name,
        url: station.url || '', url_resolved: station.url_resolved || '', favicon: station.favicon || '',
        tags: station.tags || '', country: station.country || '',
        countrycode: station.countrycode || '', bitrate: station.bitrate || 0,
        codec: station.codec || ''
      });
      showToast(t('toast.radioStationAdded', { name: station.name }));
    }
    const isFav = idx < 0;
    $('#np-like')?.classList.toggle('liked', isFav);
    $('#max-np-like')?.classList.toggle('liked', isFav);
    saveState();
    if (_radioView && _radioView.classList.contains('active')) render();
    return isFav;
  }

  // ═══════ Discord RPC + MediaSession ═══════
  function updateDiscordPresence(station) {
    if (!station || !window.snowify || !window.snowify.updatePresence) return;
    window.snowify.updatePresence({
      title: station.name,
      artist: t('radio.liveRadio'),
      thumbnail: station.favicon || '',
      startTimestamp: Date.now()
    }).catch(() => {});
  }

  function updateMediaSession(station) {
    if (!('mediaSession' in navigator) || !station) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: t('radio.liveRadio'),
      artwork: station.favicon ? [{ src: station.favicon, sizes: '96x96' }] : []
    });
    navigator.mediaSession.setActionHandler('play', () => radioTogglePlay());
    navigator.mediaSession.setActionHandler('pause', () => radioTogglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
    navigator.mediaSession.setActionHandler('seekto', null);
  }

  // ═══════ Interceptors ═══════
  function initInterceptors() {
    // Play/pause button: capturing listener fires BEFORE app's bubbling listener
    const playBtn = $('#btn-play-pause');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        if (!_active) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        radioTogglePlay();
      }, true);
    }

    // Maximized NP play button
    const maxPlayBtn = $('#max-np-play');
    if (maxPlayBtn) {
      maxPlayBtn.addEventListener('click', (e) => {
        if (!_active) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        radioTogglePlay();
      }, true);
    }

    // Like button intercept for radio favorites
    const likeBtn = $('#np-like');
    if (likeBtn) {
      likeBtn.addEventListener('click', (e) => {
        if (!_active || !_station) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        toggleFavorite(_station);
      }, true);
    }

    // Maximized NP like button
    const maxLikeBtn = $('#max-np-like');
    if (maxLikeBtn) {
      maxLikeBtn.addEventListener('click', (e) => {
        if (!_active || !_station) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        toggleFavorite(_station);
      }, true);
    }

    // Volume slider — observe style changes to sync radio volume
    const volumeFill = document.querySelector('#volume-fill') || document.querySelector('.volume-fill');
    if (volumeFill) {
      new MutationObserver(() => {
        if (!_active || !_audioEl) return;
        _audioEl.volume = getAppVolume();
      }).observe(volumeFill, { attributes: true, attributeFilter: ['style'] });
    }

    // Time update for elapsed display
    if (_audioEl) {
      _audioEl.addEventListener('timeupdate', () => {
        if (!_active) return;
        const secs = Math.floor(_audioEl.currentTime);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        const str = m + ':' + (s < 10 ? '0' : '') + s;
        const tc = $('#time-current');
        if (tc) tc.textContent = str;
        const mtc = $('#max-np-time-current');
        if (mtc) mtc.textContent = str;
      });
    }

    // Detect when app starts playing music → cleanup radio
    // Observe the play button state: if pause icon appears and we didn't cause it, app is playing
    const appPlayObserver = new MutationObserver(() => {
      if (!_active) return;
      const pauseIcon = playBtn?.querySelector('.icon-pause');
      // If pause icon is visible but we didn't set it (our audio is paused or we just cleaned up)
      // This handles the case where user clicks a music track while radio is playing
      if (pauseIcon && !pauseIcon.classList.contains('hidden') && _audioEl.paused) {
        // App took over playback — stop radio silently
        _active = false;
        _station = null;
        cleanupNP();
      }
    });
    if (playBtn) {
      const icons = playBtn.querySelectorAll('svg');
      icons.forEach(icon => {
        appPlayObserver.observe(icon, { attributes: true, attributeFilter: ['class'] });
      });
    }
  }

  // ═══════ Init ═══════
  function init() {
    loadState();
    createAudio();

    _radioBtn = injectNavButton();
    _radioView = injectView();
    if (!_radioBtn || !_radioView) {
      console.error('[Radio Plugin] Failed to inject DOM elements');
      return;
    }

    initViewSwitching();
    initSearch();
    initInterceptors();

    console.log('[Radio Plugin] Initialized');
  }

  init();
})();
