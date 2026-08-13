/* =========================================
 * ASYS 工具箱 - 主题联动模块
 * 与起始页 start/index.html 主题完全同步：
 *  - 优先读取 URL 参数 ?theme=mode-color（工具箱链接动态携带，file:// 下也生效）
 *  - 其次读取起始页偏好 localStorage['asys_theme_prefs']
 *  - 支持 autoTheme: off / system / time（与起始页逻辑一致）
 *  - storage 事件实时联动（起始页切换主题，本页立即跟随）
 * 用法：<script src="theme.js"></script>（放在 </body> 前，CSS 之后）
 * ========================================= */
(function () {
  'use strict';

  var PREF_KEY = 'asys_theme_prefs';
  var mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  var timer = null;

  // URL 参数 ?theme=dark-blue（工具箱链接动态生成，最优先）
  function urlTheme() {
    try {
      var p = new URLSearchParams(location.search);
      var t = p.get('theme');
      if (t && /^(dark|light)-(neutral|blue|green|purple|orange)$/.test(t)) return t;
    } catch (e) {}
    return null;
  }

  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  // 计算当前应显示的主题（返回 'dark'/'light'）
  function resolveMode(prefs) {
    var auto = prefs.autoTheme ?? 'system';
    if (auto === 'off') return prefs.mode === 'dark' ? 'dark' : 'light';
    if (auto === 'time') {
      var darkTime = prefs.darkTime || '18:00';
      var lightTime = prefs.lightTime || '06:00';
      var now = new Date();
      var cur = now.getHours() * 60 + now.getMinutes();
      var ds = (darkTime.split(':').map(Number)[0] || 18) * 60 + (darkTime.split(':').map(Number)[1] || 0);
      var ls = (lightTime.split(':').map(Number)[0] || 6) * 60 + (lightTime.split(':').map(Number)[1] || 0);
      if (ds === ls) return 'light';
      if (ds < ls) return cur >= ds && cur < ls ? 'dark' : 'light';
      return cur >= ds || cur < ls ? 'dark' : 'light';
    }
    return mqDark.matches ? 'dark' : 'light';
  }

  function apply() {
    // URL 参数优先（工具箱链接携带，跨浏览器/协议可靠）
    var ut = urlTheme();
    if (ut) {
      document.documentElement.setAttribute('data-theme', ut);
      document.documentElement.classList.toggle('is-dark', ut.startsWith('dark'));
      return;
    }
    var prefs = readPrefs();
    var mode = resolveMode(prefs);
    var color = prefs.color || 'neutral';
    document.documentElement.setAttribute('data-theme', mode + '-' + color);
    // 同步给页面主题类（供 CSS 或 JS 用）
    document.documentElement.classList.toggle('is-dark', mode === 'dark');
  }

  function schedule() {
    // 定时模式下每分钟检查（与起始页一致）
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      var prefs = readPrefs();
      if (prefs.autoTheme === 'time') apply();
    }, 60000);
  }

  // 系统深浅色变化（system 模式实时跟随）
  try { mqDark.addEventListener('change', function () { var p = readPrefs(); if ((p.autoTheme ?? 'system') === 'system') apply(); }); } catch (e) {}

  // 起始页切换主题 → storage 事件实时联动
  window.addEventListener('storage', function (e) {
    if (e.key === PREF_KEY || e.key === null) apply();
  });

  // 页面可见时重新应用（覆盖时间流逝/系统变化）
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });

  apply();
  schedule();
})();
