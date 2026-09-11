const searchEngines = {
  bing: { search: 'https://www.bing.com/search?q=', suggest: 'https://www.bing.com/osjson.aspx?query=' },
  baidu: { search: 'https://www.baidu.com/s?wd=', suggest: 'https://suggestion.baidu.com/su?wd=' },
  google: { search: 'https://www.google.com/search?q=', suggest: 'https://suggestqueries.google.com/complete/search?client=chrome&q=' },
  duckduckgo: { search: 'https://duckduckgo.com/?q=', suggest: 'https://duckduckgo.com/ac/?q=' },
  yandex: { search: 'https://yandex.com/search/?text=', suggest: 'https://suggest.yandex.com/suggest-ff.cgi?part=' }
};

let debounceTimer = null, currentScript = null, selectedSuggestionIndex = -1, currentSuggestions = [];
let currentEngine = 'bing';
// 壁纸分辨率按视口自适应（高分屏 1920 / 普通 1366 / 小屏 1080），减少移动端流量
const WALLPAPER_RES = (() => { const w = Math.max((window.screen && screen.width) || 0, window.innerWidth || 0); return w >= 1920 ? 1920 : w >= 1366 ? 1366 : 1080; })();
function wallpaperJsonUrl(index) { return `https://bing.biturl.top/?resolution=${WALLPAPER_RES}&format=json&index=${index}&mkt=zh-CN`; }
const WALLPAPER_SOURCES = [
  { type: 'json', url: wallpaperJsonUrl(0) },
  { type: 'json', url: wallpaperJsonUrl(8) }
];
let wallpaperCachedUrl = '', wallpaperLoadSeq = 0;
const WALLPAPER_TIMEOUT = 8000;
const BG_URL_CACHE_KEY = 'asys_bg_url_cache'; // 当日壁纸 URL 缓存（同日二次打开免请求）
const BG_LIB_KEY = 'asys_bg_library';
const BG_MAX_CHARS = 3500000; // 图库 localStorage 安全水位（字符，约 5MB 上限）
const BG_MAX_EDGE = 1920;     // 上传图片最长边（超出等比压缩）
const BG_JPEG_Q = 0.85;
const BG_MAX_FILE = 20 * 1024 * 1024;
let autoThemeMode = 'system'; 
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
let autoThemeTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  // 仅在使用 Bing 壁纸时才发起网络请求（默认 off → 首屏零外部请求）；当日有缓存则直接用缓存 URL
  if (readInitialBg() === 'bing') wallpaperCachedUrl = readBgUrlCache();
  loadPreferences();
  bindEvents();
  initClock();
  initAutoTheme();
  updateToolLinks(getCurrentMode(), getCurrentColor());
  // 壁纸管理页等其它页面改了背景偏好 → 本页实时同步（storage 事件不触发于本页自身写入）
  window.addEventListener('storage', (e) => {
    if (e.key !== 'asys_theme_prefs') return;
    const p = readBgPrefs();
    const bg = p.background || 'off';
    updateBgToggles(bg);
    applyBackground(bg);
    updateRefreshBtn();
    updateCustomBgSection();
  });
});

// 背景偏好读取（提前判断是否需要网络请求；background: off|bing|custom）
function readInitialBg() {
  const p = readBgPrefs();
  return p.background || (p.wallpaper ? 'bing' : 'off');
}
function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function readBgUrlCache() {
  try {
    const c = JSON.parse(storageGet(BG_URL_CACHE_KEY) || 'null');
    if (c && c.date === todayKey() && c.url) return c.url;
  } catch (e) {}
  return '';
}
function saveBgUrlCache(url) {
  try { storageSet(BG_URL_CACHE_KEY, JSON.stringify({ date: todayKey(), url })); } catch (e) {}
}

function loadPreferences() {
  let saved = {};
  try { saved = JSON.parse(storageGet('asys_theme_prefs') || '{}'); } catch (e) { console.warn('[prefs] localStorage 不可用，使用默认值:', e); }
  const mode = saved.mode ?? 'light';
  const color = saved.color ?? 'neutral';
  const bg = saved.background || (saved.wallpaper ? 'bing' : 'off'); // background: off|bing|custom（旧 wallpaper 布尔自动迁移）
  const engine = saved.engine ?? 'bing';
  const position = saved.position ?? 25;
  autoThemeMode = saved.autoTheme ?? 'system';

  currentEngine = engine;
  storageSet('asys_engine', engine);

  applyTheme(mode, color);
  updateToggleState(mode);
  updateColorActive(color, false);
  updateBgToggles(bg);
  updateAutoThemeUI(autoThemeMode);
  setActiveEngine(engine);
  updateSearchPosition(position);
  const slider = document.getElementById('positionSlider');
  if (slider) slider.value = position;
  updatePositionDisplay(position);

  applyBackground(bg);
  updateRefreshBtn();

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
    if (t && t.checked) { setBgOff(); }
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
        if (i === 0) saveBgUrlCache(u); // 缓存当日 Bing 图 URL，同日再打开免请求
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
  const onBgToggle = (me) => {
    const other = me === wallpaperToggle ? document.getElementById('customBgToggle') : wallpaperToggle;
    if (me.checked && other && other.checked) other.checked = false; // 互斥：两开关不可同开（可同关）
    const bgNow = currentBg();
    savePreferences(getCurrentMode(), getCurrentColor(), bgNow);
    applyBackground(bgNow);
    updateRefreshBtn();
    updateCustomBgSection();
  };
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
  wallpaperToggle.addEventListener('change', (e) => { onBgToggle(wallpaperToggle); });
  const customBgToggle = document.getElementById('customBgToggle');
  if (customBgToggle) customBgToggle.addEventListener('change', (e) => { onBgToggle(customBgToggle); });
  const wallpaperRefresh = document.getElementById('wallpaperRefresh');
  if (wallpaperRefresh) wallpaperRefresh.addEventListener('click', () => { refreshWallpaper(); });
  const bgSub = document.getElementById('customBgSub');
  if (bgSub) {
    bgSub.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cb-action]');
      if (!btn) return;
      const act = btn.dataset.cbAction;
      if (act === 'upload') { const fi = document.getElementById('customBgFile'); if (fi) fi.click(); }
      else if (act === 'activate') {
        const id = btn.dataset.id;
        const lib = getBgLib();
        if (!lib.some(x => x.id === id)) return;
        const s = readBgPrefs(); s.customBgId = id; s.background = 'custom';
        storageSet('asys_theme_prefs', JSON.stringify(s));
        const t = document.getElementById('wallpaperToggle'); if (t) t.checked = false;
        const c = document.getElementById('customBgToggle'); if (c) c.checked = true;
        applyBackground('custom'); updateRefreshBtn();
      }
    });
    bgSub.addEventListener('change', (e) => {
      const fi = e.target.closest('input[type="file"]');
      if (!fi || !fi.files || !fi.files.length) return;
      const file = fi.files[0];
      fi.value = '';
      handleCustomUpload(file);
    });
  }
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
  if (currentBg() === 'custom') { randomCustomWallpaper(); return; }
  const bg = document.getElementById('wallpaperBg'), img = document.getElementById('wallpaperImg');
  if (!img) return;
  const btn = document.getElementById('wallpaperRefresh');
  if (btn) btn.classList.add('spinning');
  const seq = ++wallpaperLoadSeq;
  const done = () => { if (btn) btn.classList.remove('spinning'); };
  // 随机取一张历史 Bing 图（biturl index: 0=今天，数字越大越旧）
  const idx = Math.floor(Math.random() * 9);
  const url = wallpaperJsonUrl(idx);
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
let clockOffset = 0; // 与服务器时间的偏差（毫秒）
function clockNow() { return new Date(Date.now() + clockOffset); }
function initClock() {
  const c = document.getElementById('clockDisplay');
  loadClockPrefs();
  let lastInfoDate = '';
  const tick = (d) => {
    const now = d || clockNow();
    c.textContent = formatClock(now);
    const key = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    if (key !== lastInfoDate) { lastInfoDate = key; renderClockInfo(now); } // 农历/节气仅日期变化时重算，避免每秒空转
  };
  tick();
  setInterval(tick, 1000);
  // 时钟校准：读官网自身服务器 Date 头（同源，零 CORS；Cloudflare 时间准确），空闲时执行不抢首屏
  const calibrate = () => {
    fetch(location.href, { method: 'HEAD', cache: 'no-store' })
      .then(r => {
        const dv = r.headers.get('date');
        if (!dv) throw new Error('no date');
        const t = new Date(dv);
        if (isNaN(t.getTime())) throw new Error('bad date');
        clockOffset = t.getTime() - Date.now();
        tick();
      })
      .catch(() => {});
  };
  if ('requestIdleCallback' in window) requestIdleCallback(calibrate, { timeout: 2000 });
  else setTimeout(calibrate, 800);
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
function updateBgToggles(bg) {
  const b = document.getElementById('wallpaperToggle'), c = document.getElementById('customBgToggle');
  if (b) b.checked = (bg === 'bing');
  if (c) c.checked = (bg === 'custom');
}
function currentBg() {
  const b = document.getElementById('wallpaperToggle'), c = document.getElementById('customBgToggle');
  return (b && b.checked) ? 'bing' : (c && c.checked) ? 'custom' : 'off';
}
function readBgPrefs() { try { return JSON.parse(storageGet('asys_theme_prefs') || '{}'); } catch (e) { return {}; } }
function getCustomBgId() { return readBgPrefs().customBgId || null; }
function getBgLib() { try { return JSON.parse(storageGet(BG_LIB_KEY) || '[]'); } catch (e) { return []; } }
function saveBgLib(lib) {
  const s = JSON.stringify(lib);
  if (s.length > BG_MAX_CHARS) return 'FULL';
  try { localStorage.setItem(BG_LIB_KEY, s); return 'OK'; }
  catch (e) { return 'FAIL'; }
}
function uid() { return 'bg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
function stripExt(name) { return String(name || '').replace(/\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i, ''); }
function bgSizeCss(fit) {
  switch (fit) {
    case 'contain': return { size: 'contain', repeat: 'no-repeat', pos: 'center center' };
    case 'stretch': return { size: '100% 100%', repeat: 'no-repeat', pos: 'center center' };
    case 'tile': return { size: 'auto', repeat: 'repeat', pos: 'left top' };
    case 'center': return { size: 'auto', repeat: 'no-repeat', pos: 'center center' };
    default: return { size: 'cover', repeat: 'no-repeat', pos: 'center center' };
  }
}
function applyBackground(bg) {
  const bgEl = document.getElementById('wallpaperBg');
  const img = document.getElementById('wallpaperImg');
  const cEl = document.getElementById('wallpaperCustom');
  wallpaperLoadSeq++; // 作废进行中的网络壁纸加载
  if (img) { img.onload = null; img.onerror = null; img.src = ''; }
  if (bg === 'bing') {
    if (img) img.style.display = '';
    if (cEl) cEl.style.display = 'none';
    document.body.classList.add('wallpaper-enabled');
    loadWallpaper();
  } else if (bg === 'custom') {
    if (img) img.style.display = 'none';
    if (cEl) cEl.style.display = 'block'; // 覆盖 CSS 默认 display:none（custom 层默认隐藏，与 Bing 图层共存）
    document.body.classList.add('wallpaper-enabled');
    loadCustomWallpaper();
  } else {
    document.body.classList.remove('wallpaper-enabled');
    if (bgEl) bgEl.classList.remove('show');
    if (cEl) { cEl.style.backgroundImage = ''; cEl.style.display = 'none'; }
    if (img) img.style.display = '';
  }
}
function loadCustomWallpaper() {
  const bgEl = document.getElementById('wallpaperBg');
  const cEl = document.getElementById('wallpaperCustom');
  const lib = getBgLib();
  const found = lib.find(x => x.id === getCustomBgId());
  if (!found || !cEl) {
    if (bgEl) bgEl.classList.remove('show');
    updateCustomBgSection();
    return;
  }
  const css = bgSizeCss(readBgPrefs().customBgFit || 'cover');
  cEl.style.backgroundImage = 'url("' + found.dataUrl + '")';
  cEl.style.backgroundSize = css.size;
  cEl.style.backgroundRepeat = css.repeat;
  cEl.style.backgroundPosition = css.pos;
  // DataURL 本地即取即用，无需网络加载，直接显示
  if (bgEl) bgEl.classList.add('show');
  updateCustomBgSection();
}
function setBgOff() {
  const b = document.getElementById('wallpaperToggle'), c = document.getElementById('customBgToggle');
  if (b) b.checked = false;
  if (c) c.checked = false;
  savePreferences(getCurrentMode(), getCurrentColor(), 'off');
  applyBackground('off');
  updateRefreshBtn();
}
function updateRefreshBtn() {
  const btn = document.getElementById('wallpaperRefresh');
  if (!btn) return;
  const bg = currentBg();
  const n = getBgLib().length;
  btn.classList.toggle('show', bg === 'bing' || (bg === 'custom' && n >= 2));
  btn.title = bg === 'custom' ? '从我的图片里随机换一张' : '换一张壁纸';
}
function randomCustomWallpaper() {
  const lib = getBgLib(), cur = getCustomBgId();
  const pool = lib.filter(x => x.id !== cur);
  if (!pool.length) return;
  const s = readBgPrefs();
  s.customBgId = pool[Math.floor(Math.random() * pool.length)].id;
  storageSet('asys_theme_prefs', JSON.stringify(s));
  applyBackground('custom');
  updateRefreshBtn();
}
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth, h0 = img.naturalHeight;
      let w = w0, h = h0;
      if (!w || !h) { URL.revokeObjectURL(url); reject(new Error('无法读取图片尺寸')); return; }
      if (w > BG_MAX_EDGE) { h = Math.round(h * BG_MAX_EDGE / w); w = BG_MAX_EDGE; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // 白底合成，防透明 PNG 黑块
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => {
        const fr = new FileReader();
        fr.onload = () => resolve({ dataUrl: fr.result, w: w, h: h, bytes: blob.size });
        fr.readAsDataURL(blob);
      }, 'image/jpeg', BG_JPEG_Q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片解码失败，请换一张试试')); };
    img.src = url;
  });
}
function handleCustomUpload(file) {
  if (!/^image\//.test(file.type)) { alert('只能上传图片文件'); return; }
  if (file.size > BG_MAX_FILE) { alert('图片超过 20MB，请先压缩再上传'); return; }
  compressImage(file).then(r => {
    const lib = getBgLib();
    lib.push({ id: uid(), name: stripExt(file.name), dataUrl: r.dataUrl, w: r.w, h: r.h, bytes: r.bytes, ts: Date.now() });
    const res = saveBgLib(lib);
    if (res !== 'OK') {
      alert(res === 'FULL' ? '本地图库已满（浏览器约 5MB 限制），请到壁纸管理页删除部分图片后再试' : '保存失败：浏览器本地存储不可用');
      return;
    }
    updateCustomBgSection();
  }).catch(err => alert('图片处理失败：' + (err.message || '未知错误')));
}
function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
function updateCustomBgSection() {
  const sub = document.getElementById('customBgSub');
  if (!sub) return;
  const c = document.getElementById('customBgToggle');
  const on = !!(c && c.checked);
  sub.hidden = !on;
  if (!on) return;
  const lib = getBgLib(), id = getCustomBgId();
  const active = lib.find(x => x.id === id);
  const latest = lib.length ? lib[lib.length - 1] : null;
  const theme = document.documentElement.getAttribute('data-theme') || 'light-neutral';
  const manageUrl = './tools/wallpaper/index.html?theme=' + encodeURIComponent(theme);
  let html = '';
  if (active) {
    html += '<div class="cb-line"><span class="cb-thumb" style="background-image:url(&quot;' + active.dataUrl + '&quot;)"></span><span class="cb-name">使用中：' + escapeHtml(active.name) + '</span></div>';
  }
  if (!lib.length) {
    html += '<div class="cb-empty">还没有图片。上传一张并点「启用」，图片只存本机浏览器。</div>';
  } else if (!active && latest) {
    html += '<div class="cb-empty">图库有 ' + lib.length + ' 张图，尚未启用。</div>';
    html += '<button type="button" class="mini-btn wide cb-activate" data-cb-action="activate" data-id="' + latest.id + '">启用「' + escapeHtml(truncate(latest.name, 14)) + '」</button>';
  } else if (latest && latest.id !== id) {
    html += '<button type="button" class="mini-btn wide cb-activate" data-cb-action="activate" data-id="' + latest.id + '">改用最新上传的「' + escapeHtml(truncate(latest.name, 14)) + '」</button>';
  }
  html += '<div class="cb-actions">';
  html += '<button type="button" class="mini-btn" data-cb-action="upload">＋ 上传图片</button>';
  html += '<a class="mini-btn cb-manage" href="' + manageUrl + '">管理图片库</a>';
  html += '<input type="file" id="customBgFile" accept="image/*" hidden>';
  html += '</div>';
  sub.innerHTML = html;
}
function setActiveEngine(engine) { document.querySelectorAll('.engine-btn').forEach(b=>{ const a=b.dataset.engine===engine; b.classList.toggle('active',a); b.setAttribute('aria-selected',a); }); }

function savePreferences(mode, color, background, engine, position) {
  let s = {};
  try { s = JSON.parse(storageGet('asys_theme_prefs')||'{}'); } catch (e) {}
  const p = { mode: mode??s.mode??'light', color: color??s.color??'neutral', background: background ?? s.background ?? 'off', customBgId: s.customBgId ?? null, customBgFit: s.customBgFit ?? 'cover', engine: engine??s.engine??'bing', position: position??s.position??25, autoTheme: autoThemeMode, darkTime: document.getElementById('darkTime')?.value || '18:00', lightTime: document.getElementById('lightTime')?.value || '06:00' };
  storageSet('asys_theme_prefs', JSON.stringify(p));
  if(engine) storageSet('asys_engine', engine);
}

function executeSearch(q) { if(!q) return; window.open(searchEngines[currentEngine].search + encodeURIComponent(q), '_blank', 'noopener,noreferrer'); document.getElementById('searchInput').blur(); hideSuggestions(); }
