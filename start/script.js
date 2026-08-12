const searchEngines = {
  bing: { search: 'https://www.bing.com/search?q=', suggest: 'https://www.bing.com/osjson.aspx?query=' },
  baidu: { search: 'https://www.baidu.com/s?wd=', suggest: 'https://suggestion.baidu.com/su?wd=' },
  google: { search: 'https://www.google.com/search?q=', suggest: 'https://suggestqueries.google.com/complete/search?client=chrome&q=' },
  duckduckgo: { search: 'https://duckduckgo.com/?q=', suggest: 'https://duckduckgo.com/ac/?q=' },
  yandex: { search: 'https://yandex.com/search/?text=', suggest: 'https://suggest.yandex.com/suggest-ff.cgi?part=' }
};

let debounceTimer = null, currentScript = null, selectedSuggestionIndex = -1, currentSuggestions = [];
let currentEngine = 'bing';
const WALLPAPER_SOURCES = [
  { type: 'json', url: 'https://bing.biturl.top/?resolution=1920&format=json&index=0&mkt=zh-CN' },
  { type: 'json', url: 'https://bing.biturl.top/?resolution=1920&format=json&index=8&mkt=zh-CN' }
];
let wallpaperCachedUrl = '', wallpaperLoadSeq = 0;
const WALLPAPER_TIMEOUT = 8000;
let autoThemeMode = 'system'; 
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
let autoThemeTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  preloadWallpaper();
  loadPreferences();
  bindEvents();
  initClock();
  initAutoTheme();
  updateToolLinks(getCurrentMode(), getCurrentColor());
});

function preloadWallpaper() {
  // 提前抓今日壁纸 URL + 预下载图片进浏览器缓存，开启壁纸时秒显示
  fetch(WALLPAPER_SOURCES[0].url, { signal: AbortSignal.timeout(WALLPAPER_TIMEOUT) })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('bad status'))))
    .then(d => {
      const u = (d && d.url) || (d && d.data && d.data.url);
      if (!u) throw new Error('no url');
      wallpaperCachedUrl = u;
      const pre = new Image();
      pre.src = normalizeImgUrl(u);
    })
    .catch(() => {});
}

function loadPreferences() {
  let saved = {};
  try { saved = JSON.parse(storageGet('asys_theme_prefs') || '{}'); } catch (e) { console.warn('[prefs] localStorage 不可用，使用默认值:', e); }
  const mode = saved.mode ?? 'light';
  const color = saved.color ?? 'neutral';
  const wallpaper = saved.wallpaper ?? false;
  const engine = saved.engine ?? 'bing';
  const position = saved.position ?? 25;
  autoThemeMode = saved.autoTheme ?? 'system';

  currentEngine = engine;
  storageSet('asys_engine', engine);

  applyTheme(mode, color);
  updateToggleState(mode);
  updateColorActive(color, false);
  updateWallpaperToggle(wallpaper);
  updateAutoThemeUI(autoThemeMode);
  setActiveEngine(engine);
  updateSearchPosition(position);
  const slider = document.getElementById('positionSlider');
  if (slider) slider.value = position;
  updatePositionDisplay(position);

  if (wallpaper) { document.body.classList.add('wallpaper-enabled'); loadWallpaper(); }
  else { document.body.classList.remove('wallpaper-enabled'); }
  const refreshBtn = document.getElementById('wallpaperRefresh');
  if (refreshBtn) refreshBtn.classList.toggle('show', wallpaper);

  // 快捷链接
  const ql = getQuicklinks();
  const qlToggle = document.getElementById('quicklinksToggle');
  const qlEditor = document.getElementById('quicklinksEditor');
  const qlBar = document.getElementById('quicklinksBar');
  if (qlToggle) qlToggle.checked = ql.enabled;
  if (qlEditor) qlEditor.classList.toggle('show', ql.enabled);
  if (ql.enabled) {
    if (qlBar) { qlBar.classList.add('show'); renderQuicklinks(ql.links); }
    const qlInput = document.getElementById('quicklinksInput');
    if (qlInput && ql.links.length) { qlInput.value = ql.links.map(l => `${l.name} ${l.url}`).join('\n'); updateQuicklinksLines(); }
  }

  document.getElementById('darkTime').value = saved.darkTime ?? '18:00';
  document.getElementById('lightTime').value = saved.lightTime ?? '06:00';
}

let memStore = null;
function storageGet(k) {
  try { return localStorage.getItem(k); } catch (e) { return memStore ? memStore[k] : null; }
}
function storageSet(k, v) {
  try { localStorage.setItem(k, v); } catch (e) {
    console.warn('[prefs] localStorage 写入失败，降级为内存保存（刷新后失效）:', e);
    if (!memStore) memStore = {};
    memStore[k] = v;
  }
}

function normalizeImgUrl(u) {
  // Bing 国际版域名国内访问慢，统一换 cn.bing.com（国内 CDN）
  try {
    const url = new URL(u);
    if (url.hostname === 'www.bing.com' || url.hostname === 'bing.com') url.hostname = 'cn.bing.com';
    return url.toString();
  } catch (e) { return u; }
}

function loadWallpaper() {
  const bg = document.getElementById('wallpaperBg'), img = document.getElementById('wallpaperImg');
  if (!img) return;
  const seq = ++wallpaperLoadSeq;
  const fail = (err) => {
    if (seq !== wallpaperLoadSeq) return;
    console.error('[wallpaper] 所有数据源均失败:', err);
    document.body.classList.remove('wallpaper-enabled');
    if (bg) bg.classList.remove('show');
    const t = document.getElementById('wallpaperToggle');
    if (t && t.checked) { t.checked = false; savePreferences(getCurrentMode(), getCurrentColor(), false); }
  };
  const setImg = (src, onFail) => {
    const timer = setTimeout(() => {
      img.onload = null; img.onerror = null;
      console.error('[wallpaper] 图片加载超时:', src);
      onFail();
    }, WALLPAPER_TIMEOUT);
    img.onload = () => { clearTimeout(timer); if (seq === wallpaperLoadSeq) bg.classList.add('show'); };
    img.onerror = () => { clearTimeout(timer); if (seq === wallpaperLoadSeq) { console.error('[wallpaper] 图片加载失败:', src); onFail(); } };
    img.src = normalizeImgUrl(src);
  };
  const tryIndex = (i) => {
    if (seq !== wallpaperLoadSeq) return;
    if (i >= WALLPAPER_SOURCES.length) { fail(new Error('exhausted')); return; }
    const s = WALLPAPER_SOURCES[i];
    fetch(s.url, { signal: AbortSignal.timeout(WALLPAPER_TIMEOUT) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('bad status ' + r.status))))
      .then(d => {
        if (seq !== wallpaperLoadSeq) return;
        const u = (d && d.url) || (d && d.data && d.data.url);
        if (!u) throw new Error('no url');
        setImg(u, () => tryIndex(i + 1));
      })
      .catch(err => { if (seq === wallpaperLoadSeq) { console.error('[wallpaper] fetch 失败:', s.url, err); tryIndex(i + 1); } });
  };
  if (wallpaperCachedUrl) setImg(wallpaperCachedUrl, () => tryIndex(0));
  else tryIndex(0);
}

function initAutoTheme() {
  updateAutoThemeUI(autoThemeMode);
  applyAutoThemeLogic();
  setupAutoThemeListeners();
}

function updateAutoThemeUI(mode) {
  document.querySelectorAll('input[name="autoTheme"]').forEach(r => r.checked = r.value === mode);
  const toggle = document.getElementById('darkModeToggle');
  const timeSettings = document.getElementById('timeSettings');
  const disabled = mode !== 'off';
  toggle.disabled = disabled;
  toggle.parentElement.style.opacity = disabled ? '0.4' : '1';
  toggle.parentElement.style.pointerEvents = disabled ? 'none' : 'auto';
  if (mode === 'time') timeSettings.classList.add('show');
  else timeSettings.classList.remove('show');
}

function applyAutoThemeLogic() {
  // 手动模式（关闭）不干预主题，保留用户手动选择
  if (autoThemeMode === 'off') return;
  let isDark = false;
  if (autoThemeMode === 'system') {
      isDark = darkModeMediaQuery.matches;
  } else if (autoThemeMode === 'time') {
      const darkTime = document.getElementById('darkTime').value || '18:00';
      const lightTime = document.getElementById('lightTime').value || '06:00';
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [dH, dM] = darkTime.split(':').map(Number);
      const [lH, lM] = lightTime.split(':').map(Number);
      const darkStart = dH * 60 + dM;
      const lightStart = lH * 60 + lM;
      if (darkStart === lightStart) isDark = false; 
      else if (darkStart < lightStart) isDark = currentMinutes >= darkStart && currentMinutes < lightStart;
      else isDark = currentMinutes >= darkStart || currentMinutes < lightStart;
  }
  const toggle = document.getElementById('darkModeToggle');
  toggle.checked = isDark;
  applyTheme(isDark ? 'dark' : 'light', getCurrentColor());
  if (document.getElementById('wallpaperToggle').checked) updateWallpaperBrightness();
}

function setupAutoThemeListeners() {
  darkModeMediaQuery.addEventListener('change', () => { if (autoThemeMode === 'system') applyAutoThemeLogic(); });
  document.querySelectorAll('input[name="autoTheme"]').forEach(r => {
    r.addEventListener('change', (e) => {
      autoThemeMode = e.target.value;
      updateAutoThemeUI(autoThemeMode);
      applyAutoThemeLogic();
      savePreferences(getCurrentMode(), getCurrentColor());
    });
  });
  const updateTime = () => { if(autoThemeMode === 'time') applyAutoThemeLogic(); savePreferences(getCurrentMode(), getCurrentColor()); };
  document.getElementById('darkTime').addEventListener('input', updateTime);
  document.getElementById('lightTime').addEventListener('input', updateTime);
  if (autoThemeTimer) clearInterval(autoThemeTimer);
  autoThemeTimer = setInterval(() => { if (autoThemeMode === 'time') applyAutoThemeLogic(); }, 60000);
}

function bindEvents() {
  const themeToggle = document.getElementById('themeToggle');
  const themePanel = document.getElementById('themePanel');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const wallpaperToggle = document.getElementById('wallpaperToggle');
  const positionSlider = document.getElementById('positionSlider');
  const searchInput = document.getElementById('searchInput');
  const searchIconBtn = document.getElementById('searchIconBtn');
  const suggestionsContainer = document.getElementById('suggestionsContainer');
  const wallpaperBg = document.getElementById('wallpaperBg');
  
  themeToggle.addEventListener('click', (e) => { e.stopPropagation(); const isExpanded = themeToggle.getAttribute('aria-expanded') === 'true'; themeToggle.setAttribute('aria-expanded', !isExpanded); themePanel.classList.toggle('show', !isExpanded); if (!isExpanded) { const ind = document.getElementById('colorIndicator'); if (ind) ind.style.opacity = '0'; } });
  const toolboxToggle = document.getElementById('toolboxToggle');
  const toolboxPanel = document.getElementById('toolboxPanel');
  if (toolboxToggle && toolboxPanel) {
    toolboxToggle.addEventListener('click', (e) => { e.stopPropagation(); const isExpanded = toolboxToggle.getAttribute('aria-expanded') === 'true'; toolboxToggle.setAttribute('aria-expanded', !isExpanded); toolboxPanel.classList.toggle('show', !isExpanded); });
  }
  themePanel.addEventListener('animationend', (e) => { if (e.animationName !== 'slideDown' && e.animationName !== 'slideUp') return; const active = document.querySelector('.color-btn.active'); if (active) moveColorIndicator(active, false); const ind = document.getElementById('colorIndicator'); if (ind) ind.style.opacity = '1'; });
  document.addEventListener('click', (e) => { if (!themeToggle.contains(e.target) && !themePanel.contains(e.target)) { themePanel.classList.remove('show'); themeToggle.setAttribute('aria-expanded', 'false'); } if (toolboxToggle && toolboxPanel && !toolboxToggle.contains(e.target) && !toolboxPanel.contains(e.target)) { toolboxPanel.classList.remove('show'); toolboxToggle.setAttribute('aria-expanded', 'false'); } if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) hideSuggestions(); });
  darkModeToggle.addEventListener('change', (e) => { if (autoThemeMode !== 'off') return; const mode = e.target.checked ? 'dark' : 'light'; applyTheme(mode, getCurrentColor()); savePreferences(mode, getCurrentColor()); if (wallpaperToggle.checked) updateWallpaperBrightness(); });
  wallpaperToggle.addEventListener('change', (e) => { const enabled = e.target.checked; savePreferences(getCurrentMode(), getCurrentColor(), enabled); const refreshBtn = document.getElementById('wallpaperRefresh'); if (refreshBtn) refreshBtn.classList.toggle('show', enabled); if (enabled) { document.body.classList.add('wallpaper-enabled'); loadWallpaper(); } else { document.body.classList.remove('wallpaper-enabled'); wallpaperBg.classList.remove('show'); wallpaperLoadSeq++; const i = document.getElementById('wallpaperImg'); if(i){ i.onload=null; i.onerror=null; i.src=''; } } });
  const wallpaperRefresh = document.getElementById('wallpaperRefresh');
  if (wallpaperRefresh) wallpaperRefresh.addEventListener('click', () => { refreshWallpaper(); });
  const quicklinksToggle = document.getElementById('quicklinksToggle');
  ['clockDate','clockWeek','clockLunar','clockTerm','clock24h','clockSeconds'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { syncClockPrefsFromUI(); saveClockPrefs(); const d = new Date(); const c = document.getElementById('clockDisplay'); if (c) c.textContent = formatClock(d); renderClockInfo(d); });
  });
  const quicklinksEditor = document.getElementById('quicklinksEditor');
  const quicklinksInput = document.getElementById('quicklinksInput');
  const quicklinksSave = document.getElementById('quicklinksSave');
  const quicklinksBar = document.getElementById('quicklinksBar');
  if (quicklinksToggle) quicklinksToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    const ql = getQuicklinks();
    ql.enabled = enabled;
    saveQuicklinks(ql);
    if (quicklinksEditor) quicklinksEditor.classList.toggle('show', enabled);
    if (enabled) {
      if (!ql.links.length && quicklinksInput) { quicklinksInput.value = 'ASYS 官网 asystech.cn\nGitHub github.com'; updateQuicklinksLines(); }
      if (quicklinksBar) { quicklinksBar.classList.add('show'); renderQuicklinks(ql.links); }
    } else if (quicklinksBar) quicklinksBar.classList.remove('show');
  });
  if (quicklinksSave) quicklinksSave.addEventListener('click', () => {
    const links = parseQuicklinksInput(quicklinksInput ? quicklinksInput.value : '');
    const ql = getQuicklinks();
    ql.links = links; ql.enabled = true;
    saveQuicklinks(ql);
    if (quicklinksBar) { quicklinksBar.classList.add('show'); renderQuicklinks(links); }
  });
  if (quicklinksInput) {
    quicklinksInput.addEventListener('input', updateQuicklinksLines);
    quicklinksInput.addEventListener('scroll', () => { const lines = document.getElementById('quicklinksLines'); if (lines) lines.scrollTop = quicklinksInput.scrollTop; });
    updateQuicklinksLines();
  }
  positionSlider.addEventListener('input', (e) => { const v = parseInt(e.target.value); updateSearchPosition(v); updatePositionDisplay(v); });
  positionSlider.addEventListener('change', (e) => { savePreferences(getCurrentMode(), getCurrentColor(), null, null, parseInt(e.target.value)); });
  document.querySelectorAll('.color-btn').forEach(btn => { btn.addEventListener('click', (e) => { const c = e.currentTarget.dataset.color; applyTheme(getCurrentMode(), c); savePreferences(getCurrentMode(), c); updateColorActive(c); }); });
  document.querySelectorAll('.engine-btn').forEach(btn => { btn.addEventListener('click', (e) => { currentEngine = btn.dataset.engine; storageSet('asys_engine', currentEngine); setActiveEngine(currentEngine); savePreferences(getCurrentMode(), getCurrentColor(), null, currentEngine); if (searchInput.value.trim()) fetchSuggestions(searchInput.value.trim()); }); });
  searchInput.addEventListener('input', (e) => { const q = e.target.value.trim(); if (debounceTimer) clearTimeout(debounceTimer); cleanupScript(); if (!q.length) { hideSuggestions(); return; } debounceTimer = setTimeout(() => fetchSuggestions(q), 300); });
  searchInput.addEventListener('focus', () => { wallpaperBg.classList.add('blurred'); const q = searchInput.value.trim(); if (q.length > 0 && currentSuggestions.length > 0) showSuggestions(); });
  searchInput.addEventListener('blur', () => wallpaperBg.classList.remove('blurred'));
  searchInput.addEventListener('keydown', (e) => { if (!currentSuggestions.length) return; if (e.key === 'ArrowDown') { e.preventDefault(); selectedSuggestionIndex = Math.min(selectedSuggestionIndex+1, currentSuggestions.length-1); updateSuggestionHighlight(true); } else if (e.key === 'ArrowUp') { e.preventDefault(); selectedSuggestionIndex = Math.max(selectedSuggestionIndex-1, -1); updateSuggestionHighlight(true); } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) { e.preventDefault(); executeSearch(currentSuggestions[selectedSuggestionIndex]); } else if (e.key === 'Escape') { hideSuggestions(); searchInput.blur(); } });
  searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && selectedSuggestionIndex < 0) { e.preventDefault(); executeSearch(searchInput.value.trim()); } });
  searchIconBtn.addEventListener('click', () => executeSearch(searchInput.value.trim()));
}

function updateSearchPosition(p) { document.getElementById('mainContent').style.setProperty('--search-vertical-position', `${p}vh`); }
function updatePositionDisplay(p) { document.getElementById('positionValue').textContent = `${p}%${p===25?' (默认)':''}`; }
function updateWallpaperBrightness() {}

function fetchSuggestions(query) {
  const engine = currentEngine, list = document.getElementById('suggestionsList'), box = document.getElementById('suggestionsContainer');
  cleanupScript();
  list.innerHTML = `<div class="suggestions-loading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>加载中...</div>`;
  box.classList.add('show');
  const cb = `s_${engine}_${Date.now()}`;
  window[cb] = (data) => { cleanupScript(); delete window[cb]; let s = []; if(engine==='baidu') s=data.s||[]; else if(engine==='google'||engine==='bing') s=Array.isArray(data[1])?data[1]:[]; else if(engine==='duckduckgo') s=data.map(i=>i.phrase||i); else if(engine==='yandex') s=Array.isArray(data[1])?data[1].map(i=>i[0]||i):[]; currentSuggestions=s.slice(0,10); selectedSuggestionIndex=-1; if(currentSuggestions.length){ renderSuggestions(currentSuggestions, query); box.classList.add('show'); } else hideSuggestions(); };
  let u='';
  if(engine==='baidu') u=`https://suggestion.baidu.com/su?wd=${encodeURIComponent(query)}&cb=${cb}`;
  else if(engine==='google') u=`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}&callback=${cb}`;
  else if(engine==='bing') u=`https://www.bing.com/osjson.aspx?query=${encodeURIComponent(query)}&JsonType=callback&JsonCallback=${cb}`;
  else if(engine==='duckduckgo') u=`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&callback=${cb}`;
  else if(engine==='yandex') u=`https://suggest.yandex.com/suggest-ff.cgi?part=${encodeURIComponent(query)}&callback=${cb}`;
  const script = document.createElement('script'); script.src = u; script.onerror = () => { cleanupScript(); delete window[cb]; hideSuggestions(); }; currentScript = script; document.body.appendChild(script);
  setTimeout(() => { if(currentScript===script){ cleanupScript(); delete window[cb]; hideSuggestions(); } }, 5000);
}
function cleanupScript() { if(currentScript&&currentScript.parentNode){ document.body.removeChild(currentScript); currentScript=null; } }
function renderSuggestions(s, q) { const l = document.getElementById('suggestionsList'); l.innerHTML = s.map((t,i) => `<div class="suggestion-item" data-index="${i}" data-suggestion="${escapeHtml(t)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span>${highlightMatch(t,q)}</span></div>`).join(''); l.querySelectorAll('.suggestion-item').forEach(el => { el.onclick = (e) => { e.stopPropagation(); executeSearch(el.dataset.suggestion); }; el.onmouseenter = () => { selectedSuggestionIndex=parseInt(el.dataset.index); updateSuggestionHighlight(false); }; }); }
function highlightMatch(t, q) { if(!q) return escapeHtml(t); return escapeHtml(t).replace(new RegExp(`(${escapeRegex(q)})`,'gi'),'<span class="highlight">$1</span>'); }
function updateSuggestionHighlight(fillInput) { const items = document.getElementById('suggestionsList').querySelectorAll('.suggestion-item'); items.forEach((el,i) => { if(i===selectedSuggestionIndex){ el.classList.add('active'); el.scrollIntoView({block:'nearest'}); } else el.classList.remove('active'); }); if(fillInput && selectedSuggestionIndex>=0 && selectedSuggestionIndex<currentSuggestions.length) document.getElementById('searchInput').value = currentSuggestions[selectedSuggestionIndex]; }
function showSuggestions() { document.getElementById('suggestionsContainer').classList.add('show'); }
function hideSuggestions() { document.getElementById('suggestionsContainer').classList.remove('show'); selectedSuggestionIndex=-1; currentSuggestions=[]; }
function escapeHtml(t) { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const QUICKLINKS_KEY = 'asys_quicklinks';
function getQuicklinks() { try { return JSON.parse(storageGet(QUICKLINKS_KEY) || 'null') || { enabled: false, links: [] }; } catch (e) { return { enabled: false, links: [] }; } }
function saveQuicklinks(q) { storageSet(QUICKLINKS_KEY, JSON.stringify(q)); }
function parseQuicklinksInput(text) {
  const links = [];
  (text || '').split('\n').forEach(line => {
    line = line.trim();
    if (!line) return;
    // 名称 + 地址（地址可带或不带协议，探查行尾 xxx.xxx 连续串）
    const m = line.match(/^(.*?)\s+(\S+\.\S+)$/);
    if (m) {
      let url = m[2];
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      links.push({ name: m[1].trim(), url });
      return;
    }
    // 纯地址（无名称）
    if (/^\S+\.\S+$/.test(line)) {
      let url = line;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      const name = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      links.push({ name, url });
    }
  });
  return links;
}
function renderQuicklinks(links) {
  const bar = document.getElementById('quicklinksBar');
  if (!bar) return;
  bar.innerHTML = links.map(l => `<a class="quicklink-item" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(l.url)}"><span class="ql-icon">${escapeHtml((l.name || l.url).charAt(0).toUpperCase())}</span><span>${escapeHtml(l.name)}</span></a>`).join('');
}
function updateQuicklinksLines() {
  const ta = document.getElementById('quicklinksInput');
  const lines = document.getElementById('quicklinksLines');
  if (!ta || !lines) return;
  const count = ta.value.split('\n').length;
  lines.innerHTML = Array.from({ length: count }, (_, i) => i + 1).join('<br>');
  lines.scrollTop = ta.scrollTop;
}
function refreshWallpaper() {
  const bg = document.getElementById('wallpaperBg'), img = document.getElementById('wallpaperImg');
  if (!img) return;
  const btn = document.getElementById('wallpaperRefresh');
  if (btn) btn.classList.add('spinning');
  const seq = ++wallpaperLoadSeq;
  const done = () => { if (btn) btn.classList.remove('spinning'); };
  // 随机取一张历史 Bing 图（biturl index: 0=今天，数字越大越旧）
  const idx = Math.floor(Math.random() * 9);
  const url = `https://bing.biturl.top/?resolution=1920&format=json&index=${idx}&mkt=zh-CN`;
  const timer = setTimeout(() => { console.error('[wallpaper] 换一张超时'); done(); loadWallpaper(); }, WALLPAPER_TIMEOUT);
  fetch(url, { signal: AbortSignal.timeout(WALLPAPER_TIMEOUT) })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('bad status ' + r.status))))
    .then(d => {
      if (seq !== wallpaperLoadSeq) { clearTimeout(timer); done(); return; }
      const u = (d && d.url) || (d && d.data && d.data.url);
      if (!u) throw new Error('no url');
      img.onload = () => { clearTimeout(timer); done(); if (seq === wallpaperLoadSeq) bg.classList.add('show'); };
      img.onerror = () => { clearTimeout(timer); done(); if (seq === wallpaperLoadSeq) { console.error('[wallpaper] 换一张图片加载失败'); loadWallpaper(); } };
      img.src = normalizeImgUrl(u);
    })
    .catch(err => { clearTimeout(timer); done(); if (seq === wallpaperLoadSeq) { console.error('[wallpaper] 换一张失败:', err); loadWallpaper(); } });
}

const CLOCK_DEFAULT = { date: false, week: false, lunar: false, term: false, hour24: true, seconds: false };
const CLOCK_ID_MAP = { clockDate:'date', clockWeek:'week', clockLunar:'lunar', clockTerm:'term', clock24h:'hour24', clockSeconds:'seconds' };
let clockPrefs = Object.assign({}, CLOCK_DEFAULT);
function loadClockPrefs() {
  try { clockPrefs = Object.assign({}, CLOCK_DEFAULT, JSON.parse(storageGet('asys_clock_prefs') || '{}')); } catch (e) { clockPrefs = Object.assign({}, CLOCK_DEFAULT); }
  for (const id in CLOCK_ID_MAP) {
    const el = document.getElementById(id);
    if (el) el.checked = !!clockPrefs[CLOCK_ID_MAP[id]];
  }
}
function syncClockPrefsFromUI() {
  const map = { clockDate:'date', clockWeek:'week', clockLunar:'lunar', clockTerm:'term', clock24h:'hour24', clockSeconds:'seconds' };
  for (const id in map) { const el = document.getElementById(id); if (el) clockPrefs[map[id]] = el.checked; }
}
function saveClockPrefs() { storageSet('asys_clock_prefs', JSON.stringify(clockPrefs)); }
function pad2(n) { return String(n).padStart(2, '0'); }
function periodOfHour(h) { if (h < 5) return '凌晨'; if (h < 11) return '上午'; if (h < 13) return '中午'; if (h < 18) return '下午'; return '晚上'; }
function formatClock(d) {
  const h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
  let timeStr;
  if (clockPrefs.hour24) {
    timeStr = pad2(h) + ':' + pad2(m) + (clockPrefs.seconds ? ':' + pad2(s) : '');
  } else {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    timeStr = periodOfHour(h) + ' ' + h12 + ':' + pad2(m) + (clockPrefs.seconds ? ':' + pad2(s) : '');
  }
  return timeStr;
}
function renderClockInfo(d) {
  const parts = [];
  if (clockPrefs.date) parts.push(d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日');
  if (clockPrefs.week) parts.push('星期' + '日一二三四五六'[d.getDay()]);
  if ((clockPrefs.lunar || clockPrefs.term) && window.LunarCalendar) {
    try {
      const l = window.LunarCalendar.solarToLunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
      if (l && !l.error) {
        if (clockPrefs.lunar) parts.push('农历' + l.lunarMonthName + l.lunarDayName);
        if (clockPrefs.term) {
          const fest = l.lunarFestival || (l.solarFestival ? l.solarFestival.split(' ')[0] : '');
          if (fest) parts.push('<span class="ci-term">' + fest + '</span>');
          else if (l.term) parts.push('<span class="ci-term">' + l.term + '</span>');
        }
      }
    } catch (e) {}
  }
  const el = document.getElementById('clockInfo');
  if (el) el.innerHTML = parts.join('<span class="ci-sep">·</span>');
}
function initClock() {
  const c = document.getElementById('clockDisplay');
  loadClockPrefs();
  const upd = (d) => { const now = d || new Date(); c.textContent = formatClock(now); renderClockInfo(now); };
  upd();
  setInterval(() => upd(), 1000);
  fetch('https://worldtimeapi.org/api/ip', { signal: AbortSignal.timeout(3000) }).then(r=>r.ok?r.json():Promise.reject()).then(d=>upd(new Date(d.datetime))).catch(()=>{});
}

function applyTheme(mode, color) { document.documentElement.setAttribute('data-theme', `${mode}-${color}`); updateToolLinks(mode, color); }
// 工具箱链接携带当前主题参数（工具页据此应用主题，file:// 下也可靠）
function updateToolLinks(mode, color) {
  const theme = `${mode}-${color}`;
  document.querySelectorAll('.tool-item').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    const base = href.split('?')[0];
    a.setAttribute('href', `${base}?theme=${theme}`);
  });
}
function getCurrentMode() { return document.documentElement.getAttribute('data-theme')?.startsWith('dark')?'dark':'light'; }
function getCurrentColor() { return document.documentElement.getAttribute('data-theme')?.split('-')[1]||'neutral'; }
function updateToggleState(mode) { document.getElementById('darkModeToggle').checked = (mode==='dark'); }
function moveColorIndicator(btn, animate) {
  if (!btn) return;
  const options = document.getElementById('colorOptions');
  const ind = document.getElementById('colorIndicator');
  if (!options || !ind) return;
  const oRect = options.getBoundingClientRect();
  const bRect = btn.getBoundingClientRect();
  const x = bRect.left - oRect.left + (bRect.width - ind.offsetWidth) / 2;
  const y = bRect.top - oRect.top + (bRect.height - ind.offsetHeight) / 2;
  ind.style.transition = animate === false ? 'none' : '';
  ind.style.transform = `translate(${x}px, ${y}px)`;
  if (animate === false) { void ind.offsetWidth; ind.style.transition = ''; }
}
function updateColorActive(color, animate) { let activeBtn = null; document.querySelectorAll('.color-btn').forEach(b=>{ const a=b.dataset.color===color; b.classList.toggle('active',a); if(a) activeBtn=b; }); moveColorIndicator(activeBtn, animate); }
function updateWallpaperToggle(en) { document.getElementById('wallpaperToggle').checked = en; }
function setActiveEngine(engine) { document.querySelectorAll('.engine-btn').forEach(b=>{ const a=b.dataset.engine===engine; b.classList.toggle('active',a); b.setAttribute('aria-selected',a); }); }

function savePreferences(mode, color, wallpaper, engine, position) {
  let s = {};
  try { s = JSON.parse(storageGet('asys_theme_prefs')||'{}'); } catch (e) {}
  const p = { mode: mode??s.mode??'light', color: color??s.color??'neutral', wallpaper: wallpaper??s.wallpaper??false, engine: engine??s.engine??'bing', position: position??s.position??25, autoTheme: autoThemeMode, darkTime: document.getElementById('darkTime')?.value || '18:00', lightTime: document.getElementById('lightTime')?.value || '06:00' };
  storageSet('asys_theme_prefs', JSON.stringify(p));
  if(engine) storageSet('asys_engine', engine);
}

function executeSearch(q) { if(!q) return; window.open(searchEngines[currentEngine].search + encodeURIComponent(q), '_blank', 'noopener,noreferrer'); document.getElementById('searchInput').blur(); hideSuggestions(); }
