/* =========================================
 * ASYS 工具箱 - 壁纸管理
 * 图库：localStorage['asys_bg_library']（多张，DataURL）
 * 偏好：localStorage['asys_theme_prefs']（与起始页共享）
 *   background: 'off' | 'bing' | 'custom'
 *   customBgId: 当前启用的图片 id
 *   customBgFit: 'cover' | 'contain' | 'stretch' | 'tile' | 'center'
 *   （起始页 script.js 同款字段，双方互操作）
 * ========================================= */
(function () {
  'use strict';

  var LIB_KEY = 'asys_bg_library';
  var PREF_KEY = 'asys_theme_prefs';
  // localStorage 安全水位（字符）。压缩后单张约 0.3~0.9MB（base64），
  // 3.5M 字符 ≈ 可存 4~8 张 1920px 图，留出其他偏好数据余量
  var MAX_CHARS = 3500000;
  var MAX_EDGE = 1920;   // 最长边上限（压缩到与 Bing 壁纸同级的 1920px）
  var JPEG_Q = 0.85;
  var MAX_FILE = 20 * 1024 * 1024;

  var FIT_LABELS = { cover: '填充（默认，铺满裁剪）', contain: '适应（完整显示，留边）', stretch: '拉伸（变形铺满）', tile: '平铺（原尺寸重复）', center: '居中（原尺寸显示）' };

  /* ---------- 存储 ---------- */
  function readPrefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (e) { return {}; } }
  function writePrefs(p) {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); return true; }
    catch (e) { alert('保存设置失败：浏览器本地存储不可用或已满'); return false; }
  }
  function readLib() { try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch (e) { return []; } }
  function writeLib(lib) {
    var s = JSON.stringify(lib);
    if (s.length > MAX_CHARS) { alert('图片库已满（浏览器本地存储约 5MB 限制），请先删除一些图片，或换更小的图。'); return false; }
    try { localStorage.setItem(LIB_KEY, s); return true; }
    catch (e) { alert('保存图片失败：浏览器本地存储不可用或已满，请删除一些图片后重试。'); return false; }
  }
  function fmtSize(bytes) { return bytes >= 1048576 ? (bytes / 1048576).toFixed(2) + ' MB' : Math.round(bytes / 1024) + ' KB'; }
  function fmtDate(ts) { var d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function uid() { return 'bg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  /* ---------- 图片压缩（全部本地，不上传） ---------- */
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片解码失败，请换一张试试')); };
      img.src = url;
    });
  }
  // 等比压缩到最长边 <= MAX_EDGE，JPEG 输出（白底合成，防透明 PNG 变黑块）
  function compressToDataUrl(file) {
    return loadImage(file).then(function (r) {
      var img = r.img, w0 = img.naturalWidth, h0 = img.naturalHeight;
      if (!w0 || !h0) { URL.revokeObjectURL(r.url); throw new Error('无法读取图片尺寸'); }
      var w = w0, h = h0;
      if (w > MAX_EDGE) { h = Math.round(h * MAX_EDGE / w); w = MAX_EDGE; }
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(r.url);
      return new Promise(function (resolve) {
        c.toBlob(function (blob) {
          var fr = new FileReader();
          fr.onload = function () { resolve({ dataUrl: fr.result, w: w, h: h, bytes: blob.size }); };
          fr.readAsDataURL(blob);
        }, 'image/jpeg', JPEG_Q);
      });
    });
  }

  /* ---------- 背景启用状态 ---------- */
  function getActive() {
    var p = readPrefs(), lib = readLib();
    if (p.background !== 'custom') return null;
    return lib.find(function (x) { return x.id === p.customBgId; }) || null;
  }
  // 启用某张图为当前背景（custom 模式，与 Bing 互斥——起始页开关会自动同步）
  function activate(id) {
    var lib = readLib(), img = lib.find(function (x) { return x.id === id; });
    if (!img) { alert('图片不存在，可能已被删除'); return false; }
    var p = readPrefs();
    p.background = 'custom';
    p.customBgId = id;
    if (!p.customBgFit) p.customBgFit = 'cover';
    return writePrefs(p);
  }
  function randomActivate() {
    var lib = readLib(), p = readPrefs();
    var pool = lib.filter(function (x) { return x.id !== p.customBgId; });
    if (!pool.length) return false;
    return activate(pool[Math.floor(Math.random() * pool.length)].id);
  }
  function activateNext() { // 没有启用图时启用最近一张
    var lib = readLib();
    if (!lib.length) return false;
    return activate(lib[lib.length - 1].id);
  }

  /* ---------- DOM ---------- */
  function $(id) { return document.getElementById(id); }

  function renderStatus() {
    var p = readPrefs();
    var el = $('bgStatus');
    if (!el) return;
    var html;
    if (p.background === 'bing') html = '当前背景：<strong>Bing 每日壁纸</strong>（网络图，点起始页右下角按钮可换一张）';
    else if (p.background === 'custom') {
      var act = getActive();
      html = act ? '当前背景：<strong>我的图片「' + esc(act.name) + '」</strong>' : '当前背景：我的图片模式，但<strong>还没有启用任何图片</strong>';
    } else html = '当前背景：<strong>未启用</strong>（纯色主题背景）';
    el.innerHTML = html;
  }

  function renderLib() {
    var lib = readLib(), act = getActive();
    var grid = $('libGrid'), empty = $('libEmpty');
    var randBtn = $('randBtn');
    if (randBtn) randBtn.style.display = lib.length > 1 ? '' : 'none';
    if (grid) {
      grid.innerHTML = lib.map(function (x) {
        var isActive = act && act.id === x.id;
        var preview = x.w && x.h ? x.w + '×' + x.h : '';
        return '<div class="bg-card' + (isActive ? ' active' : '') + '">' +
          '<div class="bg-thumb"><img src="' + x.dataUrl + '" alt="' + esc(x.name) + '" loading="lazy"></div>' +
          '<div class="bg-meta">' +
            '<div class="bg-name" title="' + esc(x.name) + '">' + esc(x.name) + (isActive ? ' <span class="bg-badge">使用中</span>' : '') + '</div>' +
            '<div class="bg-info">' + preview + (x.bytes ? ' · ' + fmtSize(x.bytes) : '') + '</div>' +
            '<div class="bg-info">' + fmtDate(x.ts) + '</div>' +
            '<div class="bg-ops">' +
              (isActive ? '<button class="btn secondary" data-act="deactivate">停用</button>' : '<button class="btn" data-act="activate" data-id="' + x.id + '">设为背景</button>') +
              '<button class="btn danger" data-act="remove" data-id="' + x.id + '">删除</button>' +
            '</div>' +
          '</div></div>';
      }).join('');
    }
    if (empty) empty.style.display = lib.length ? 'none' : 'block';
  }

  function renderFit() {
    var p = readPrefs(), fit = p.customBgFit || 'cover';
    var sel = $('fitSelect');
    if (!sel) return;
    sel.innerHTML = Object.keys(FIT_LABELS).map(function (k) {
      return '<option value="' + k + '"' + (k === fit ? ' selected' : '') + '>' + FIT_LABELS[k] + '</option>';
    }).join('');
  }

  function renderUsage() {
    var el = $('usageInfo');
    if (!el) return;
    var lib = readLib();
    var chars = 0;
    lib.forEach(function (x) { chars += x.dataUrl.length; });
    el.textContent = '已用约 ' + (chars / 1048576).toFixed(1) + ' MB / 上限约 5 MB（' + lib.length + ' 张）——图片只存在本机浏览器里，不会上传';
  }

  function refreshAll() { renderStatus(); renderLib(); renderFit(); renderUsage(); }

  /* ---------- 事件 ---------- */
  function bind() {
    var fileInput = $('fileInput'), uploadBtn = $('uploadBtn');
    if (fileInput && uploadBtn) uploadBtn.addEventListener('click', function () { fileInput.click(); });
    if (fileInput) fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      if (!files.length) return;
      var bad = files.filter(function (f) { return !/^image\//.test(f.type); });
      if (bad.length) { alert('只能上传图片文件'); fileInput.value = ''; return; }
      var big = files.filter(function (f) { return f.size > MAX_FILE; });
      if (big.length) { alert('有文件超过 20MB，请先压缩后再上传'); fileInput.value = ''; return; }
      uploadBtn.disabled = true;
      uploadBtn.textContent = '处理中…';
      var chain = Promise.resolve(), added = 0;
      files.forEach(function (f) {
        chain = chain.then(function () {
          return compressToDataUrl(f).then(function (r) {
            var lib = readLib();
            lib.push({ id: uid(), name: f.name.replace(/\.(png|jpe?g|webp|gif|bmp|avif)$/i, '') || f.name, dataUrl: r.dataUrl, w: r.w, h: r.h, bytes: r.bytes, ts: Date.now() });
            if (!writeLib(lib)) throw new Error('FULL');
            added++;
          });
        }).catch(function (err) {
          alert('「' + f.name + '」保存失败：' + (err && err.message ? err.message : '未知错误'));
        });
      });
      chain.then(function () {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '＋ 上传图片';
        fileInput.value = '';
        if (added) refreshAll();
      });
    });

    var grid = $('libGrid');
    if (grid) grid.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var act = btn.dataset.act, id = btn.dataset.id;
      if (act === 'activate') {
        if (activate(id)) { refreshAll(); showToast('已启用为背景，回起始页即可看到'); }
      } else if (act === 'deactivate') {
        var p = readPrefs();
        if (p.background === 'custom') { p.background = 'off'; delete p.customBgId; }
        if (writePrefs(p)) { refreshAll(); showToast('已停用自定义背景'); }
      } else if (act === 'remove') {
        var lib = readLib(), img = lib.find(function (x) { return x.id === id; });
        if (!img) return;
        if (!confirm('删除图片「' + img.name + '」？' + (getActive() && getActive().id === id ? '\n（这是当前使用中的背景，删除后将恢复纯色背景）' : ''))) return;
        lib = lib.filter(function (x) { return x.id !== id; });
        if (!writeLib(lib)) return;
        var p = readPrefs();
        if (p.customBgId === id) { delete p.customBgId; p.background = 'off'; writePrefs(p); }
        refreshAll();
        showToast('已删除');
      }
    });

    var randBtn = $('randBtn');
    if (randBtn) randBtn.addEventListener('click', function () {
      if (randomActivate()) { refreshAll(); showToast('已随机换一张（共 ' + readLib().length + ' 张）'); }
    });

    var fitSel = $('fitSelect');
    if (fitSel) fitSel.addEventListener('change', function () {
      var p = readPrefs();
      p.customBgFit = fitSel.value;
      if (writePrefs(p)) showToast('填充方式已保存：' + (FIT_LABELS[fitSel.value] || fitSel.value));
    });

    var actNextBtn = $('activateLatestBtn');
    if (actNextBtn) actNextBtn.addEventListener('click', function () {
      if (activateNext()) { refreshAll(); showToast('已启用为背景'); }
    });
  }

  /* ---------- 轻提示 ---------- */
  var toastTimer = null;
  function showToast(msg) {
    var t = $('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    refreshAll();
  });
})();
