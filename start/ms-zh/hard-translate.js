/* =========================================================
 * 巨硬中文翻译器 - 硬翻引擎 (JS 移植版)
 * 移植自 ~/Vantage/scripts/ms-zh/hard-translate.py
 * 风格：词对词直译 + 保持英文语序 + 不本地化（跑偏机翻）
 * 例：Vantage Browser → 优势浏览器
 *
 * 词典：ecdict-min.json（ECDICT 高频子集，4.2 万词）
 * 兜底：未登录词 → MyMemory 免费 API → localStorage 缓存
 * ========================================================= */

(function (global) {
  'use strict';

  // ---------- 覆盖词表（优先于词典）----------
  const OVERRIDES = {
    // 品牌/核心词
    "microsoft": "巨硬",
    "vantage": "优势",
    "browser": "浏览器",
    "computer": "计算机",
    "firefox": "火狐",
    "mozilla": "摩斯拉",
    // 经典烂梗（桶哥钦定：直接用梗，不走词典）
    "power": "功率",
    "edge": "边缘",
    "windows": "窗",
    "roll": "滚",
    "head": "头",
    "sit": "坐",
    "relax": "放宽",
    // 高频虚词（词典释义太抽象，固定成硬翻常用义）
    "a": "一个", "an": "一个",
    "is": "是", "are": "是", "was": "曾是", "were": "曾是", "be": "是",
    "at": "在", "for": "为了", "of": "的", "in": "在",
    "the": "那", "and": "和", "to": "到", "with": "与", "by": "由",
    "from": "从", "on": "在", "your": "你的", "you": "你",
    "this": "这", "that": "那", "it": "它", "we": "我们", "our": "我们的",
    "as": "作为", "mode": "模式", "open": "打开", "save": "保存",
    "way": "方式", "ways": "方式",
    "close": "关闭", "delete": "删除", "update": "更新", "download": "下载",
    "settings": "设置", "options": "选项", "search": "搜索", "privacy": "隐私",
    "security": "安全", "password": "***", "bookmark": "书签", "tab": "标签页",
    "about": "关于", "support": "支持",
    // 高频动词（固定准确词义）
    "want": "想要", "apply": "应用", "change": "更改", "action": "操作",
    "run": "运行", "install": "安装", "create": "创建", "print": "打印",
    "ask": "询问", "remember": "记住", "trust": "信任", "use": "使用",
    "allow": "允许", "block": "阻止", "enable": "启用", "disable": "禁用",
    "cancel": "取消", "confirm": "确认", "continue": "继续", "restart": "重新启动",
    "start": "启动", "stop": "停止", "view": "查看", "show": "显示",
    "manage": "管理", "edit": "编辑", "copy": "复制", "move": "移动",
    "add": "添加", "remove": "移除", "clear": "清除", "select": "选择",
    "enter": "输入", "submit": "提交", "accept": "接受", "deny": "拒绝",
    "keep": "保持", "provide": "提供", "recommend": "推荐", "notice": "注意",
    "get": "获得", "make": "使", "take": "采取",
    // 情态动词（句子骨架，必须准确）
    "can": "能", "will": "将", "would": "会", "could": "能够", "should": "应该",
    "must": "必须", "may": "可以", "might": "可能", "shall": "将",
    // 疑问词
    "what": "什么", "when": "何时", "where": "哪里", "why": "为什么",
    "how": "如何", "who": "谁", "which": "哪个", "whose": "谁的",
    // 否定/高频功能词
    "not": "不", "no": "无", "never": "从不", "always": "总是",
    "only": "仅", "just": "只是", "also": "也", "already": "已经",
    "still": "仍然", "please": "请",
    "they": "他们", "them": "他们", "their": "他们的", "those": "那些",
    "these": "这些", "there": "那里", "here": "这里",
    "news": "新闻",
    // 缩写词（词典里释义是注释如 abbr. you are 你（你们）是，直接固定翻译）
    "don't": "不要", "doesn't": "不", "can't": "不能", "won't": "将不", "it's": "它是",
    "you're": "你是", "we're": "我们是", "they're": "他们是",
    "you'll": "你将", "we'll": "我们将", "they'll": "他们将",
    "i'm": "我是", "i've": "我有", "we've": "我们有", "you've": "你有", "they've": "他们有",
    "that's": "那是", "there's": "那里是", "what's": "什么是", "here's": "这里是",
    "let's": "让我们", "he's": "他是", "she's": "她是",
    "aren't": "不是", "isn't": "不是", "wasn't": "不是", "weren't": "不是",
    "didn't": "没有", "wouldn't": "不会", "couldn't": "不能", "shouldn't": "不应该",
    "haven't": "没有", "hasn't": "没有", "hadn't": "没有",
    "i'd": "我将", "you'd": "你将", "he'd": "他将", "we'd": "我们将", "they'd": "他们将",
    // DOS 命令污染词（词典 [计] 段是 DOS 命令）
    "time": "时间", "include": "包含", "more": "更多", "shift": "移动", "home": "主页",
    "pause": "暂停", "vol": "卷", "echo": "回声", "if": "如果",
    "country": "国家", "date": "日期", "load": "加载", "break": "中断",
    "fix": "修复", "fixes": "修复", "fixed": "修复",
    // 经典烂梗词组（MEME_PHRASES 已覆盖整串；此处单词级兜底）
    "heads": "头", "ups": "抬起", "back": "回", "rolls": "滚"
  };

  // ---------- 经典烂梗固定词组（优先于一切，整词匹配）----------
  const MEME_PHRASES = [
    ["heads up", "头抬起"],
    ["head up", "头抬起"],
    ["sit and relax", "坐和放宽"],
    ["sit back and relax", "坐和放宽"],
    ["roll back", "滚回"],
    ["rolls back", "滚回"],
    ["rolled back", "滚回"],
    ["microsoft edge", "巨硬边缘"],
    ["windows 11", "窗11"],
    ["windows 10", "窗10"]
  ];

  // ---------- 词形还原（变形词 → 原形）----------
  const IRREGULAR = {
    "is": "be", "are": "be", "was": "be", "were": "be", "been": "be",
    "has": "have", "had": "have", "does": "do", "did": "do",
    "went": "go", "gone": "go", "made": "make", "took": "take", "taken": "take",
    "got": "get", "came": "come", "ran": "run", "saw": "see", "seen": "see",
    "gave": "give", "found": "find", "told": "tell", "said": "say",
    "used": "use", "written": "write", "wrote": "write", "bought": "buy",
    "built": "build", "sent": "send", "left": "leave", "kept": "keep",
    "held": "hold", "met": "meet", "lost": "lose", "paid": "pay",
    "shown": "show", "spent": "spend", "thought": "think", "tried": "try",
    "tries": "try", "running": "run", "runs": "run", "saving": "save",
    "saved": "save", "saves": "save", "changed": "change", "changes": "change",
    "changing": "change", "websites": "website", "files": "file", "tabs": "tab",
    "pages": "page", "bookmarks": "bookmark", "updates": "update",
    "downloads": "download", "extensions": "extension", "cookies": "cookie",
    "buttons": "button", "menus": "menu", "links": "link", "items": "item",
    "options": "option", "profiles": "profile", "sessions": "session",
    "permissions": "permission", "features": "feature", "folders": "folder",
    "searches": "search", "results": "result", "messages": "message",
    "settings": "setting", "windows": "window", "trying": "try",
    "browsing": "browse", "browsed": "browse", "applied": "apply",
    "applies": "apply", "installing": "install", "installed": "install",
    "created": "create", "creating": "create", "closed": "close", "closing": "close",
    "deleted": "delete", "deleting": "delete", "enabled": "enable",
    "disabled": "disable", "allowed": "allow", "blocked": "block",
    "restarted": "restart", "restarting": "restart", "started": "start",
    "stopped": "stop", "opened": "open", "opening": "open", "sure": "sure",
    "wants": "want", "needs": "need", "uses": "use", "allows": "allow",
    "requires": "require", "provides": "provide", "shows": "show",
    "opens": "open", "closes": "close", "saves": "save", "deletes": "delete",
    "blocks": "block", "enables": "enable", "disables": "disable",
    "installs": "install", "starts": "start", "stops": "stop", "keeps": "keep",
    "makes": "make", "takes": "take", "gets": "get", "knows": "know",
    "asks": "ask", "remembers": "remember", "trusts": "trust",
    "continues": "continue", "creates": "create", "applies": "apply",
    "works": "work", "means": "mean", "contains": "contain", "includes": "include",
    // 常见三单/复数（短词，len>3 规则不覆盖或避免误伤）
    "says": "say", "goes": "go", "saying": "say", "calls": "call",
    "helps": "help", "lets": "let", "tells": "tell", "finds": "find",
    "gives": "give", "sets": "set", "turns": "turn", "puts": "put",
    "seems": "seem", "looks": "look", "runs": "run", "pays": "pay",
    "stays": "stay", "plays": "play", "shows": "show", "hours": "hour",
    "years": "year", "days": "day", "words": "word", "ways": "way",
    "names": "name", "types": "type", "kinds": "kind", "parts": "part",
    "places": "place", "points": "point", "groups": "group", "areas": "area",
    "people": "person", "children": "child", "men": "man", "women": "woman",
    "feet": "foot", "teeth": "tooth", "mice": "mouse", "data": "datum",
  };

  // ---------- 词组表（长文本专用：常用词组 → 正常中文）----------
  const PHRASES = [
    ["working together", "共同努力"],
    ["keep the web open", "保持万维网开放"],
    ["global community", "全球社区"],
    ["accessible to", "对...可访问"],
    ["due to", "由于"],
    ["check for updates", "检查更新"],
    ["internal error", "内部错误"],
    ["by default", "默认情况下"],
    ["is designed by", "由...设计"],
    ["update available", "有可用更新"],
    ["new version", "新版本"],
    ["enhanced tracking protection", "增强跟踪保护"],
    ["tracking protection", "跟踪保护"],
    ["in strict mode", "在严格模式下"],
    ["state partitioning", "状态分区"],
    ["do not recommend", "不推荐"],
    ["one of the most", "最重要的"],
    ["in the browser", "在浏览器中"],
    ["privacy features", "隐私功能"],
    ["visit the official site", "访问官方网站"],
    ["official site", "官方网站"],
    ["restart to update", "重启以更新"],
    ["is made by", "由...制作"],
    ["open, public and accessible", "开放、公开和可访问"],
    ["to all", "对所有人"],
    ["a different mode", "不同的模式"],
    ["are you sure", "你确定"],
    ["you want", "你想要"],
    ["close all tabs", "关闭所有标签页"],
    ["this action", "此操作"],
    ["cannot be undone", "无法撤销"],
    ["do you want", "你是否想要"],
    ["save the changes", "保存更改"],
    ["delete all", "删除所有"],
    ["site data", "站点数据"],
    ["cookies and site data", "Cookie 和站点数据"],
    ["will restart", "将重启"],
    ["apply your changes", "应用你的更改"],
    ["to apply", "以应用"],
    ["create a new profile", "创建新配置文件"],
    ["this will close", "这将关闭"],
    ["the current session", "当前会话"],
    ["with your permission", "经你许可"],
    ["only with", "仅经"],
    ["up to date", "已是最新"],
    ["you are running", "你正在运行"],
    ["the latest version", "最新版本"],
    ["make sure", "确保"],
    ["before continuing", "继续之前"],
    ["open a new window", "打开新窗口"],
    ["always ask", "始终询问"],
    ["never remember", "从不记住"],
    ["browsing history", "浏览历史"],
    ["this site", "此站点"],
    ["you trust", "你信任"],
    ["in your browser", "在你的浏览器中"],
    ["when firefox starts", "当 Firefox 启动时"],
    ["is trying to", "正尝试"],
    ["install an add-on", "安装附加组件"],
    ["the current", "当前"],
    // 短句词组（随机模式：短句有时套用、有时不套用；长句同样受益）
    ["thank you", "谢谢你"],
    ["how are you", "你好吗"],
    ["good morning", "早上好"],
    ["good night", "晚安"],
    ["see you", "再见"],
    ["come here", "过来"],
    ["wait a moment", "等一下"],
    ["no problem", "没问题"],
    ["of course", "当然"],
    ["for example", "例如"],
    ["right now", "现在"],
    ["by the way", "顺便说一下"],
    ["what is this", "这是什么"],
    ["who are you", "你是谁"],
    ["where are you", "你在哪里"],
    ["what time is it", "现在几点"],
    ["i love you", "我爱你"],
    ["open the door", "打开门"],
    ["save the file", "保存文件"],
    ["close the window", "关闭窗口"],
    ["turn it on", "打开它"],
    ["turn it off", "关闭它"],
    ["excuse me", "打扰一下"],
    ["my name is", "我的名字是"],
    ["nice to meet you", "很高兴见到你"],
    ["take care", "保重"],
    ["welcome back", "欢迎回来"],
    ["come back", "回来"],
    ["go away", "走开"],
    ["keep going", "继续前进"],
    ["well done", "做得好"],
    ["good luck", "祝你好运"],
    ["happy birthday", "生日快乐"],
    ["merry christmas", "圣诞快乐"],
    ["happy new year", "新年快乐"],
    ["long time no see", "好久不见"],
    ["try again", "再试一次"],
    ["go back", "返回"],
    ["go to", "前往"],
    ["click here", "点击这里"],
    ["learn more", "了解更多"],
    ["read more", "阅读更多"],
    ["show more", "显示更多"],
    ["sign in", "登录"],
    ["log in", "登录"],
    ["log out", "登出"],
    ["close tab", "关闭标签页"],
    ["new window", "新窗口"],
    ["back to top", "回到顶部"],
  ];

  // ---------- 保护 ----------
  const PROTECT_RE = /\{[^{}]*\}|<[^>]*>|[A-Za-z_]+\([^)]*\)|add-on\b|min-width\b|max-width\b|\.[a-z]{2,4}\b|\b(?:Ctrl|Control|Shift|Alt|Esc|Cmd|Option|Meta|Tab|Enter|Return|Backspace|PageUp|PageDown|Arrow|⌘|⌃|⇧|⌥)\b(?:\+[A-Za-z0-9+ ]*)?|\b[A-Z]{2,}\b|\$[a-zA-Z][a-zA-Z0-9]*|-[a-z][a-z0-9-]*(?=[\s.}，。；：！？)])/g;

  // 前置词 → 推断后一个词的词性
  const POS_VERB_BEFORE = new Set(["to", "can", "will", "would", "could", "should", "may", "might", "must", "do", "does", "did", "please", "not"]);
  const POS_VERB_BEFORE_PRONOUN = new Set(["i", "you", "we", "they", "he", "she", "it"]);
  const POS_NOUN_BEFORE = new Set(["the", "a", "an", "this", "that", "these", "those", "my", "your", "our", "their", "its", "his", "her", "of", "in", "on", "at", "for", "with", "from", "by", "as", "into", "after", "before", "between", "all", "some", "any", "no", "every", "each"]);

  let DICT = null; // { word: translation }

  function setDict(d) { DICT = d; }
  function dictLoaded() { return !!DICT; }
  function dictSize() { return DICT ? Object.keys(DICT).length : 0; }

  // 优先用 <script> 全局词典（file:// 与 http 都可用）；否则 fetch
  function loadDict() {
    if (typeof window !== "undefined" && window.__HARD_DICT__) {
      DICT = window.__HARD_DICT__;
      return Promise.resolve(DICT);
    }
    return loadDictFromUrl("ecdict-min.json").catch(() => {
      // 兜底：再试一次 JS 版（某些部署只带了 ecdict-data.js）
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "ecdict-data.js";
        s.onload = () => { DICT = window.__HARD_DICT__ || null; DICT ? resolve(DICT) : reject(new Error("全局词典为空")); };
        s.onerror = () => reject(new Error("词典加载失败"));
        document.head.appendChild(s);
      });
    });
  }

  async function loadDictFromUrl(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error('词典加载失败: ' + r.status);
    DICT = await r.json();
    return DICT;
  }

  // ---------- 词性感知取义 ----------
  function parseSegments(translation) {
    const segs = [];
    for (let s of String(translation).split("\\n")) {
      s = s.trim();
      if (!s) continue;
      // 领域标签段：[计] xxx / [医] xxx（可多个标签）
      let m = s.match(/^(\[[^\]]*\]\s*)+(.*)$/);
      if (m && m[1].trim()) {
        const tags = Array.from(s.matchAll(/\[[^\]]*\]/g), x => x[0]);
        segs.push({ tags, text: m[2].trim() });
        continue;
      }
      // 词性段：n. xxx / vt. xxx
      m = s.match(/^((?:[a-z]+\.\s*)+)(.*)$/);
      if (m) {
        const tags = m[1].trim().split(/\s+/).map(t => t.replace(/\.$/, ''));
        segs.push({ tags, text: m[2].trim() });
      } else {
        segs.push({ tags: [], text: s });
      }
    }
    return segs;
  }

  function cleanDef(s) {
    return String(s).replace(/\[[^\]]*\]/g, "").trim();
  }

  // ---------- 词典词形注释清洗 ----------
  // ECDICT 里大量变形词条目的释义是词典注释而非真翻译：
  //   ( alternative的复数形式 ) / acute的比较级 / abbr. you are 你（你们）是
  //   （willy的复数） / （are not） / 参见：elementary school
  // 直接输出会污染译文，必须剔除；整条都是注释的词条视为未命中（保留原文）。
  const FORM_NOTE_RE = /[（(][^）)]*?(?:的复数(?:形式)?|的过去式|的过去分词|的现在分词|的第三人称单数|的比较级|的最高级|的常用口语形式?|的缩写|等于|复数|过去式|过去分词|现在分词|第三人称单数|比较级|最高级|缩写)[^）)]*[)）]|[a-zA-Z'\s-]+\s*的(?:复数(?:形式)?|过去式|过去分词|现在分词|第三人称单数|比较级|最高级|常用口语形式?|缩写)|(?:参见|同义词)\s*[:：]\s*[a-zA-Z'\s-]+|[（(][a-zA-Z][a-zA-Z' -]{1,}[)）]/g;

  function stripFormNotes(s) {
    let s2 = String(s).replace(FORM_NOTE_RE, "");
    s2 = s2.replace(/^[\s,;，；"']+|[\s,;，；"']+$/g, "");
    if (!s2 || /^(?:[a-z]+\.\s*)+$/.test(s2)) return "";
    return s2;
  }

  function firstDef(text) {
    return stripFormNotes(cleanDef(String(text).split(/[,;，；]/)[0]));
  }

  function pickDef(translation, pos) {
    const segs = parseSegments(translation);
    // [计] 段优先（UI 术语语境）——但 DOS 命令段跳过
    for (const seg of segs) {
      if (seg.tags.length && seg.tags[0] === "[计]" && !seg.text.includes("DOS")) {
        const v = firstDef(seg.text);
        if (v) return v;
      }
    }
    if (pos === "verb") {
      for (const seg of segs) {
        if (seg.tags.some(t => t === "vt" || t === "vi" || t === "v") && !seg.text.includes("DOS")) {
          const v = firstDef(seg.text);
          if (v) return v;
        }
      }
    } else if (pos === "noun") {
      for (const seg of segs) {
        if (seg.tags.includes("n")) {
          const v = firstDef(seg.text);
          if (v) return v;
        }
      }
    }
    // fallback：逐段尝试，跳过整条都是词形注释的段
    for (const seg of segs) {
      const v = firstDef(seg.text);
      if (v) return v;
    }
    return "";
  }

  function posHint(prev) {
    if (!prev) return null;
    const p = prev.toLowerCase();
    if (POS_VERB_BEFORE.has(p) || POS_VERB_BEFORE_PRONOUN.has(p)) return "verb";
    if (POS_NOUN_BEFORE.has(p)) return "noun";
    return null;
  }

  // ---------- 词形还原 ----------
  function lemmatizeCandidates(word) {
    // 生成词形还原候选（按优先级）。调用方必须用词典验证命中，
    // 避免 lemmatize 截错（如 alternatives → alternativ）把变形词误导向
    // 词典里的「词形注释词条」（释义 = XX的复数形式，不是真翻译）。
    const w = word.toLowerCase();
    if (IRREGULAR[w]) return [IRREGULAR[w]];
    const cands = [];
    if (w.length > 3) {
      if (w.endsWith("ies") && w !== "ties" && w !== "movies") {
        cands.push(w.slice(0, -3) + "y"); // possibilities → possibility
      } else if (w.endsWith("es")) {
        cands.push(w.slice(0, -1)); // alternatives → alternative（复数 +s 优先）
        cands.push(w.slice(0, -2)); // boxes → box（真正的 -es 复数）
      } else if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) {
        cands.push(w.slice(0, -1)); // browsers → browser
      }
    }
    const out = [];
    for (const c of cands) {
      if (c !== w && !out.includes(c)) out.push(c);
    }
    return out;
  }

  function lemmatize(word) {
    const cands = lemmatizeCandidates(word);
    return cands.length ? cands[0] : word.toLowerCase();
  }

  // ---------- 核心翻译 ----------
  // 返回 { text, missing: Set<原文词> }，missing 为未登录词（词典没有）
  function hardTranslate(text, phraseMode) {
    text = text.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
    const parts = [];

    // 经典烂梗整串替换（优先，任意长度文本都生效）
    for (const [ph, cn] of MEME_PHRASES) {
      text = text.replace(new RegExp("(?<!\\w)" + ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?!\\w)", "gi"), "\x02" + cn + "\x02");
    }

    // 词组替换（仅长文本模式）：\x02中文\x02 哨兵保护
    if (phraseMode) {
      const sorted = PHRASES.slice().sort((a, b) => b[0].split(" ").length - a[0].split(" ").length);
      for (const [ph, cn] of sorted) {
        text = text.replace(new RegExp("(?<!\\w)" + ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?!\\w)", "gi"), "\x02" + cn + "\x02");
      }
    }

    const repl = (m) => { parts.push(m); return "\x01" + (parts.length - 1) + "\x01"; };
    PROTECT_RE.lastIndex = 0;
    const text2 = text.replace(PROTECT_RE, repl);

    const tokens = text2.match(/\x02[^\x02]*\x02|\x01\d+\x01|[A-Za-z']+|[^A-Za-z']/g) || [];
    const alphaIdx = [];
    tokens.forEach((t, i) => { if (/^[A-Za-z']+$/.test(t)) alphaIdx.push(i); });

    const missing = new Set();
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.startsWith("\x02") && t.endsWith("\x02")) {
        out.push(t.slice(1, -1));
      } else if (t.startsWith("\x01") && t.endsWith("\x01")) {
        out.push(parts[parseInt(t.slice(1, -1), 10)]);
      } else if (/^[A-Za-z']+$/.test(t)) {
        let w = OVERRIDES[t.toLowerCase()];
        if (w === undefined) {
          const stem = lemmatize(t);
          w = OVERRIDES[stem];
          if (w === undefined) {
            // 变形词 → 按候选原形查词典（词典验证命中才算），
            // 避免命中「词形注释词条」（释义 = XX的复数形式，不是真翻译）
            let d = null;
            for (const cand of lemmatizeCandidates(t)) {
              d = DICT && DICT[cand];
              if (d) break;
            }
            if (!d) d = DICT && DICT[t.toLowerCase()];
            if (d) {
              const ai = alphaIdx.indexOf(i);
              const prev = ai > 0 ? tokens[alphaIdx[ai - 1]] : null;
              const pos = prev ? posHint(prev) : null;
              w = pickDef(d, pos);
            }
          }
        }
        if (w === undefined || w === null || w === "") {
          w = t; // 未登录词保留原文
          missing.add(t);
        }
        out.push(w);
      } else {
        out.push(t);
      }
    }

    let result = out.join("");
    // 删除词间空格（中文连写）：空格前后都是非 ASCII 时删除
    result = result.replace(/([^\x00-\x7f])\s+(?=[^\x00-\x7f])/g, "$1");
    return { text: result, missing };
  }

  function translate(text, opts) {
    const o = opts || {};
    const wordCount = (text.match(/[A-Za-z]+/g) || []).length;
    // 长句：词组 + 硬翻混合（可读性优先）
    if (wordCount > 4) return hardTranslate(text, true);
    // 短句：随机模式掷硬币决定是否套用词组表（有时正常中文，有时纯硬翻）
    if (o.random) return hardTranslate(text, Math.random() < 0.5);
    // 默认：短句纯硬翻（跑偏）
    return hardTranslate(text, false);
  }

  // ---------- MyMemory 兜底 ----------
  const CACHE_KEY = "asys_mszh_cache";
  const CACHE_MAX = 800;
  const API_URL = "https://api.mymemory.translated.net/get";

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveCache(cache) {
    try {
      const keys = Object.keys(cache);
      if (keys.length > CACHE_MAX) {
        for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete cache[k];
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) { /* 存不下就忽略 */ }
  }

  async function fetchWordZh(word) {
    const url = API_URL + "?q=" + encodeURIComponent(word) + "&langpair=en|zh-CN";
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error("http " + r.status);
    const d = await r.json();
    const t = d && d.responseData && d.responseData.translatedText;
    if (!t || d.responseStatus !== 200) throw new Error("bad response");
    // 取第一释义，避免整串多义词
    const first = String(t).split(/[;；,，]/)[0].trim();
    if (!first) throw new Error("empty");
    return first;
  }

  /**
   * 带兜底的完整翻译
   * @param {string} text 英文原文
   * @param {object} opts { online: 是否允许在线兜底(默认true), strict: 严格硬翻模式(默认false), onProgress: fn(done,total) }
   * @returns {Promise<{text, missing, onlineUsed, quota}>}
   */
  async function translateWithFallback(text, opts) {
    const o = opts || {};
    const allowOnline = o.online !== false;
    const { text: base, missing } = o.strict ? hardTranslate(text, false) : translate(text, o);
    const res = { text: base, missing: [], onlineUsed: 0, quota: false };

    if (!allowOnline || missing.size === 0) return res;

    const cache = loadCache();
    const map = {};       // 原文词 -> 中文
    const toFetch = [];
    for (const w of missing) {
      if (cache[w]) map[w] = cache[w];
      else toFetch.push(w);
    }

    let quota = false;
    const TOTAL_TIMEOUT = 8000; // 整体在线补全限时，防止慢网时无限等待
    const deadline = Date.now() + TOTAL_TIMEOUT;
    for (let i = 0; i < toFetch.length; i++) {
      const w = toFetch[i];
      if (Date.now() > deadline) { quota = true; res.missing.push(w); continue; }
      try {
        const t = await fetchWordZh(w);
        // API 翻不动（返回原文）视为该词无解：不缓存、不替换，保留原文
        if (t.toLowerCase() === w.toLowerCase()) {
          res.missing.push(w);
          continue;
        }
        map[w] = t;
        cache[w] = t;
        res.onlineUsed++;
      } catch (e) {
        quota = true; // 限流/网络问题：保留原文
        res.missing.push(w);
      }
      if (o.onProgress) o.onProgress(i + 1, toFetch.length);
      // 限速：避免触发 MyMemory 匿名限额
      if (i < toFetch.length - 1) await new Promise(r => setTimeout(r, 350));
    }
    saveCache(cache);
    res.quota = quota;

    // 把结果文本中的未登录原文词替换为中文（仅替换词典缺失的那些）
    let final = res.text;
    for (const [w, zh] of Object.entries(map)) {
      final = final.split(w).join(zh);
    }
    res.text = final;
    return res;
  }

  // ---------- 导出 ----------
  const api = {
    OVERRIDES, IRREGULAR, PHRASES,
    setDict, dictLoaded, dictSize, loadDict, loadDictFromUrl,
    lemmatize, lemmatizeCandidates, pickDef, parseSegments, stripFormNotes,
    hardTranslate, translate, translateWithFallback,
    _cache: { loadCache, saveCache, fetchWordZh }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.HardTranslate = api;

})(typeof window !== "undefined" ? window : globalThis);
