/* ============================================================
 * 词峰 WordPeak · 高中英语单词集训系统（演示版）
 * 纯前端实现：无框架 / 无构建 / localStorage 持久化 / Web Speech API 发音
 * v2：设计系统化重做（深浅主题 / 动效 / 热力图 / 庆祝彩带）
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 词库索引 ---------------- */
  var UNITS = window.WT_UNITS || [];
  var ALL = [];
  UNITS.forEach(function (u, ui) {
    u.words.forEach(function (a, wi) {
      ALL.push({ id: ui + '-' + wi, u: ui, w: a[0], p: a[1], d: a[2], e: a[3] });
    });
  });
  var BY = {};
  ALL.forEach(function (x) { BY[x.w] = x; });
  window.WT_ALL = ALL; // 供演示/联调使用

  /* ---------------- 主题（跟随系统 + 手动切换） ---------------- */
  var UI_KEY = 'wordpeak_ui';
  function loadThemeMode() {
    try { var v = JSON.parse(localStorage.getItem(UI_KEY)); if (v && v.theme) return v.theme; } catch (e) {}
    return 'auto';
  }
  var themeMode = loadThemeMode();
  function resolvedTheme() {
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return themeMode === 'dark' || (themeMode === 'auto' && dark) ? 'dark' : 'light';
  }
  var THEME_NAME = { auto: '跟随系统', light: '浅色', dark: '深色' };
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', resolvedTheme());
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolvedTheme() === 'dark' ? '#0d1020' : '#5766f5');
    var b = document.getElementById('themeBtn');
    if (b) { b.innerHTML = ic(themeMode === 'light' ? 'sun' : themeMode === 'dark' ? 'moon' : 'monitor', 18); b.title = '主题：' + THEME_NAME[themeMode]; }
  }
  function setTheme(m) {
    themeMode = m;
    try { localStorage.setItem(UI_KEY, JSON.stringify({ theme: m })); } catch (e) {}
    applyTheme(); toast('外观：' + THEME_NAME[m]);
  }
  function cycleTheme() { setTheme(themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto'); }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onMQ = function () { if (themeMode === 'auto') applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onMQ); else if (mq.addListener) mq.addListener(onMQ);
  }

  /* ---------------- 持久化（兼容 v1 数据，不改结构） ---------------- */
  var KEY = 'wordpeak_v1';
  function loadS() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && v.states) return v; } catch (e) {}
    return null;
  }
  var S = loadS() || { states: {}, wrong: [], daily: {}, goal: 20 };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(t) { t = t || new Date(); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- 学习记录（含简化 SM-2） ----------------
   * 答对：间隔翻倍 1→2→4→8…天（上限 64 天）；答错：间隔重置为 1 天，次日重现并进入错词本 */
  function answer(word, ok) {
    var t = S.states[word];
    if (!t) t = S.states[word] = { n: 0, c: 0, w: 0, iv: 0, due: 0, last: '' };
    t.n++;
    if (ok) {
      t.c++; t.last = 'ok';
      t.iv = t.iv === 0 ? 1 : Math.min(t.iv * 2, 64);
      t.due = Date.now() + t.iv * 86400000;
      var i = S.wrong.indexOf(word);
      if (i > -1) S.wrong.splice(i, 1);
    } else {
      t.w++; t.last = 'bad';
      t.iv = 1; t.due = Date.now() + 86400000;
      if (S.wrong.indexOf(word) < 0) S.wrong.push(word);
    }
    var k = dayKey();
    var d = S.daily[k]; if (!d) d = S.daily[k] = { n: 0, c: 0 };
    d.n++; if (ok) d.c++;
    save();
  }
  function dueWords() {
    var now = Date.now();
    return ALL.filter(function (x) { var t = S.states[x.w]; return t && t.n > 0 && t.due && t.due <= now; });
  }
  function streak() {
    var s = 0, d = new Date();
    var t = S.daily[dayKey(d)];
    if (!(t && t.n > 0)) d.setDate(d.getDate() - 1); // 今天未学则从昨天回溯
    while (true) {
      var k = S.daily[dayKey(d)];
      if (k && k.n > 0) { s++; d.setDate(d.getDate() - 1); } else break;
    }
    return s;
  }
  function today() { return S.daily[dayKey()] || { n: 0, c: 0 }; }
  function learned() { return ALL.filter(function (x) { return S.states[x.w] && S.states[x.w].n > 0; }).length; }
  function mastered() { return ALL.filter(function (x) { var t = S.states[x.w]; return t && t.iv >= 4; }).length; }
  function unitWords(ui) { return ALL.filter(function (x) { return x.u === ui; }); }
  function unitLearned(ui) { return unitWords(ui).filter(function (x) { return S.states[x.w] && S.states[x.w].n > 0; }).length; }

  /* ---------------- 发音（Web Speech API） ---------------- */
  var VOICE = null;
  function pickVoice() {
    try {
      var vs = window.speechSynthesis.getVoices();
      VOICE = vs.filter(function (v) { return /^en[-_]us/i.test(v.lang); })[0] ||
              vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
    } catch (e) {}
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(w) {
    if (!window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(w);
      u.lang = 'en-US'; u.rate = 0.85;
      if (VOICE) u.voice = VOICE;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------------- 内联 SVG 图标（24px 网格 / 2px 描边 / 线性风格） ---------------- */
  function ic(n, s, sw) {
    s = s || 22; sw = sw || 2;
    var P = {
      home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
      refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
      chart: '<path d="M3 21h18"/><path d="M6 21v-8"/><path d="M12 21V4"/><path d="M18 21v-12"/>',
      eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
      sound: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
      pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
      bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
      check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
      x: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
      chev: '<path d="M9 18l6-6-6-6"/>',
      arr: '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
      flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
      target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M17.7 17.7l1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.9 19.1l1.4-1.4"/><path d="M17.7 6.3l1.4-1.4"/>',
      moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
      monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/>',
      trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v7a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 5"/><path d="M17 6h3a3 3 0 0 1-3 5"/>',
      spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
      layers: '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
    }[n] || '';
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P + '</svg>';
  }

  /* ---------------- 空状态插画（内联 SVG 场景） ---------------- */
  function illBook() {
    return '<svg class="empty-ill" width="150" height="110" viewBox="0 0 200 140" aria-hidden="true">' +
      '<circle cx="100" cy="72" r="52" fill="var(--ill-1)"/>' +
      '<circle cx="146" cy="38" r="12" fill="var(--ill-2)"/>' +
      '<path d="M100 54c-11-7-26-9-39-7v46c13-2 28 0 39 7z" fill="var(--card)" stroke="var(--pri)" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M100 54c11-7 26-9 39-7v46c-13-2-28 0-39 7z" fill="var(--card)" stroke="var(--pri)" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M100 54v46" stroke="var(--pri)" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M70 66h18M70 76h24M112 66h18M112 76h24" stroke="var(--pri)" stroke-width="2" stroke-linecap="round" opacity=".35"/>' +
      '<circle cx="140" cy="98" r="13" fill="#10b981"/><path d="M134.5 98l4 4 7-8" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M40 40l2 5.2 5.2 2-5.2 2-2 5.2-2-5.2-5.2-2 5.2-2z" fill="var(--violet)" opacity=".6"/>' +
      '<path d="M162 66l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="var(--violet)" opacity=".45"/></svg>';
  }
  function illTrophy() {
    return '<svg class="empty-ill" width="150" height="110" viewBox="0 0 200 140" aria-hidden="true">' +
      '<circle cx="100" cy="72" r="52" fill="var(--ill-1)"/>' +
      '<circle cx="54" cy="42" r="10" fill="var(--ill-2)"/>' +
      '<path d="M74 30h52v22a26 26 0 0 1-52 0z" fill="var(--card)" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M74 34H60a10 10 0 0 0 14 12M126 34h14a10 10 0 0 1-14 12" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>' +
      '<path d="M100 78v14M86 108h28M90 92h20l4 16H86z" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M100 44l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fbbf24"/>' +
      '<path d="M44 76l2 5.2 5.2 2-5.2 2-2 5.2-2-5.2-5.2-2 5.2-2z" fill="var(--violet)" opacity=".55"/>' +
      '<path d="M156 84l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="var(--violet)" opacity=".4"/></svg>';
  }

  /* ---------------- 环形进度 / 掌握环（SVG，加载后动画） ---------------- */
  var SVG_UID = 0;
  function ring(pct, size, sw, fg, track, fg2) {
    pct = Math.max(0, Math.min(100, pct));
    var r = (size - sw) / 2, c = 2 * Math.PI * r;
    var off = c * (1 - pct / 100);
    var id = 'rg' + (++SVG_UID);
    var defs = '';
    var stroke = fg;
    if (fg2) {
      defs = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="' + fg + '"/><stop offset="1" stop-color="' + fg2 + '"/></linearGradient></defs>';
      stroke = 'url(#' + id + ')';
    }
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + defs +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" style="stroke:' + track + '" stroke-width="' + sw + '" fill="none"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" style="stroke:' + stroke + '" stroke-width="' + sw + '" fill="none" stroke-linecap="round" ' +
      'stroke-dasharray="' + c + '" stroke-dashoffset="' + c + '" data-c="' + c + '" data-anim-ring="' + off + '"/></svg>';
  }
  function donut(segs, size, sw) {
    var r = (size - sw) / 2, c = 2 * Math.PI * r, cx = size / 2;
    var total = 0; segs.forEach(function (s) { total += s.v; });
    var id = 'dg' + (++SVG_UID);
    var html = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5766f5"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>';
    var angle = 0;
    segs.forEach(function (s, i) {
      var frac = total ? s.v / total : 0;
      var len = Math.max(0, frac * c - (frac > 0 && frac < 1 ? 3 : 0));
      html += '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" style="stroke:' + (s.g ? 'url(#' + id + ')' : s.c) + '" stroke-width="' + sw + '" fill="none" ' +
        'stroke-dasharray="0 ' + c + '" data-anim-donut="' + len + '" data-c="' + c + '" transform="rotate(' + angle + ' ' + cx + ' ' + cx + ')"/>';
      angle += frac * 360;
    });
    return html + '</svg>';
  }
  /* 注入 DOM 后触发环形/分段动画 */
  function animateSVG(root) {
    (root || document).querySelectorAll('[data-anim-ring]').forEach(function (el) {
      var final = el.getAttribute('data-anim-ring');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.style.transition = 'stroke-dashoffset .9s cubic-bezier(.25,.8,.3,1)';
          el.style.strokeDashoffset = final;
        });
      });
    });
    (root || document).querySelectorAll('[data-anim-donut]').forEach(function (el) {
      var len = el.getAttribute('data-anim-donut'), c = el.getAttribute('data-c');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.style.transition = 'stroke-dasharray .9s cubic-bezier(.25,.8,.3,1)';
          el.setAttribute('stroke-dasharray', len + ' ' + c);
        });
      });
    });
  }

  /* ---------------- 彩带庆祝（纯 CSS） ---------------- */
  function confettiHTML(n) {
    var cols = ['#5766f5', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#38bdf8'];
    var s = '';
    for (var i = 0; i < n; i++) {
      var c = cols[i % cols.length];
      s += '<span class="cf" style="--x:' + (Math.random() * 460 - 230).toFixed(0) + 'px;--c:' + c +
        ';--d:' + (1.7 + Math.random() * 1.5).toFixed(2) + 's;--dl:' + (Math.random() * .5).toFixed(2) +
        's;--r:' + (Math.random() * 720 - 360).toFixed(0) + 'deg;left:' + (Math.random() * 100).toFixed(1) +
        '%;width:' + (6 + Math.random() * 5).toFixed(0) + 'px;height:' + (8 + Math.random() * 8).toFixed(0) + 'px"></span>';
    }
    return '<div class="confetti" aria-hidden="true">' + s + '</div>';
  }

  /* ---------------- DOM 引用 ---------------- */
  var view = document.getElementById('view');
  var sessionEl = document.getElementById('session');
  var sheetWrap = document.getElementById('sheetWrap');
  var sheetEl = document.getElementById('sheet');
  var toastEl = document.getElementById('toast');
  var currentTab = 'home';
  var toastTimer = 0;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }
  function updateChrome() {
    document.getElementById('streakNum').textContent = streak();
    var n = dueWords().length, b = document.getElementById('dueBadge');
    if (n > 0) { b.textContent = n; b.classList.remove('hidden'); } else b.classList.add('hidden');
  }

  /* ================= 页面渲染 ================= */
  function greet() {
    var h = new Date().getHours();
    return h < 6 ? '夜深了，刷一组词就睡' : h < 12 ? '早安，从背单词开始' : h < 14 ? '中午好，碎片时间练一练' : h < 18 ? '下午好，保持手感' : '晚上好，今天也别落下';
  }
  function fmtDate() {
    var d = new Date(), w = ['日', '一', '二', '三', '四', '五', '六'];
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + w[d.getDay()];
  }

  function homeHTML() {
    var td = today(), pct = Math.min(100, Math.round(td.n / S.goal * 100));
    var acc = td.n ? Math.round(td.c / td.n * 100) + '%' : '—';
    var due = dueWords().length, wr = S.wrong.length, ln = learned();
    var rem = Math.max(0, S.goal - td.n);
    var st = streak();

    var modes = [
      { t: 'learn', n: '看词选义', d: '看单词 · 选出正确词义', i: 'eye', cls: 'm1', c: due > 0 ? '复习 ' + due : '智能推荐' },
      { t: 'listen', n: '听音识词', d: '听发音 · 选出对应词义', i: 'sound', cls: 'm2', c: '磨耳朵' },
      { t: 'spell', n: '拼写挑战', d: '看释义 · 逐字母默写', i: 'pen', cls: 'm3', c: '练字感' },
      { t: 'wrong', n: '错词冲刺', d: '专攻易错词 · 逐个击破', i: 'bolt', cls: 'm4', c: wr > 0 ? wr + ' 词' : '' }
    ].map(function (m) {
      return '<button class="mode ' + m.cls + '" data-act="mode" data-type="' + m.t + '">' +
        '<span class="mi">' + ic(m.i, 22) + (m.c ? '<span class="mc">' + m.c + '</span>' : '') + '</span>' +
        '<span class="m-txt"><b>' + m.n + '</b><i>' + m.d + '</i></span></button>';
    }).join('');

    var banner = due > 0 ?
      '<button class="review-banner" data-act="review-start">' +
      '<span class="ri">' + ic('clock', 22) + '</span>' +
      '<span><b>' + due + ' 个词到期待复习</b><i>隔得越久记得越牢，现在正是复习时机</i></span>' +
      '<span class="arr">' + ic('arr', 18) + '</span></button>' : '';

    var units = UNITS.map(function (u, ui) {
      var l = unitLearned(ui), tot = u.words.length, p = Math.round(l / tot * 100);
      var done = l >= tot;
      return '<button class="unit" data-act="unit" data-ui="' + ui + '">' +
        '<span class="u-badge' + (done ? ' done' : '') + '">' + (done ? ic('check', 20) : (ui + 1)) + '</span>' +
        '<span class="u-info"><b>' + esc(u.name) + '</b>' +
        '<span class="u-sub"><span class="pbar"><i style="width:' + p + '%"></i></span><span>' + l + '/' + tot + ' · ' + p + '%</span></span></span>' +
        '<span class="u-arrow">' + ic('chev', 18) + '</span></button>';
    }).join('');

    return '<div class="view-anim">' +
      '<div class="hero">' +
        '<div class="hero-top"><div><div class="hero-greet">' + greet() + '</div><div class="hero-date">' + fmtDate() + '</div></div>' +
        '<span class="hero-flame">' + ic('flame', 14) + (st > 0 ? st + ' 天连续' : '开始打卡') + '</span></div>' +
        '<div class="hero-main">' +
          '<div class="ring-box">' + ring(pct, 116, 10, '#ffffff', 'rgba(255,255,255,.24)', '#d8dcff') +
            '<div class="ring-c"><b>' + td.n + '<small>/' + S.goal + '</small></b><span>今日进度</span></div></div>' +
          '<div class="hero-stats">' +
            '<div class="hs"><span class="hs-ic">' + ic('target', 15) + '</span><em>今日正确率</em><b>' + acc + '</b></div>' +
            '<div class="hs"><span class="hs-ic">' + ic('layers', 15) + '</span><em>词库进度</em><b>' + ln + '/' + ALL.length + '</b></div>' +
            '<div class="hs"><span class="hs-ic">' + ic('refresh', 15) + '</span><em>待复习</em><b>' + due + ' 词</b></div>' +
          '</div></div>' +
        '<div class="hero-sub"><span class="dot"></span>' + (rem > 0 ? '今日还差 ' + rem + ' 词完成打卡，一组就能搞定' : '今日打卡已完成，为自己鼓个掌') + '</div>' +
      '</div>' +
      banner +
      '<div class="sec-title"><h2>训练模式</h2><span>到期词优先出题</span></div>' +
      '<div class="modes">' + modes + '</div>' +
      '<div class="sec-title"><h2>词书单元</h2><span>高考核心 ' + ALL.length + ' 词</span></div>' +
      '<div class="units">' + units + '</div></div>';
  }

  function reviewHTML() {
    var due = dueWords().slice().sort(function (a, b) { return S.states[a.w].due - S.states[b.w].due; });
    var upcoming = ALL.filter(function (x) { var t = S.states[x.w]; return t && t.due && t.due > Date.now(); })
      .sort(function (a, b) { return S.states[a.w].due - S.states[b.w].due; }).slice(0, 5);
    var rows = upcoming.map(function (x) {
      var dueDate = new Date(S.states[x.w].due);
      var now = new Date();
      var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      var dd = Math.ceil((dueDate - t0) / 86400000);
      var lbl = dd <= 1 ? '明天' : dd + ' 天后';
      return '<div class="due-row"><b>' + esc(x.w) + '</b><span>' + esc(x.d) + '</span><em>' + lbl + '</em></div>';
    }).join('');

    var hero;
    if (due.length) {
      hero = '<div class="card rv-hero"><span class="ri">' + ic('clock', 30) + '</span><h3>该复习了</h3>' +
        '<div class="rv-num">' + due.length + ' 词</div><p>答对间隔翻倍，答错明天重现——越背越省力</p>' +
        '<button class="btn block" data-act="review-start">开始复习</button></div>';
    } else {
      hero = '<div class="card rv-hero">' + illTrophy() +
        '<h3>复习任务已清空</h3><p style="margin-top:6px">到期的词都被你消灭了，新词到期会自动出现在这里</p></div>';
    }

    return '<div class="view-anim">' + hero +
      '<div class="sec-title"><h2>复习机制</h2><span>简化 SM-2</span></div>' +
      '<div class="card how">' +
        '<div class="how-item"><span class="n">1</span><span><b>答对 → 间隔翻倍</b><i>1 天 → 2 天 → 4 天 → 8 天……越熟练越省心</i></span></div>' +
        '<div class="how-item"><span class="n">2</span><span><b>答错 → 次日重现</b><i>间隔重置为 1 天，并自动收进错词本</i></span></div>' +
        '<div class="how-item"><span class="n">3</span><span><b>到期 → 优先出题</b><i>到期的词会优先进入智能推荐与复习队列</i></span></div>' +
      '</div>' +
      (rows ? '<div class="sec-title"><h2>复习日历</h2><span>最近到期 5 词</span></div><div class="card">' + rows + '</div>' : '') +
      '</div>';
  }

  function wrongHTML() {
    var words = S.wrong.map(function (w) { return BY[w]; }).filter(Boolean);
    var totalW = ALL.reduce(function (s, x) { var t = S.states[x.w]; return s + (t ? t.w : 0); }, 0);
    var body;
    if (!words.length) {
      body = '<div class="card empty">' + illBook() + '<b>错词本空空如也</b><p>练习中答错的单词会自动收进来，随时回来消灭它们</p>' +
        '<button class="btn sm" data-act="mode" data-type="learn">去练一组</button></div>';
    } else {
      var rows = words.map(function (x) {
        var t = S.states[x.w] || {};
        return '<div class="row"><div class="r-main"><div class="r-w">' + esc(x.w) + ' <small>' + esc(x.p) + '</small></div>' +
          '<div class="r-d">' + esc(x.d) + '</div></div>' +
          '<button class="r-spk" data-act="speak-word" data-w="' + esc(x.w) + '" aria-label="朗读 ' + esc(x.w) + '">' + ic('sound', 16) + '</button>' +
          '<span class="r-bad">错 ' + Math.max(1, t.w || 1) + ' 次</span></div>';
      }).join('');
      body = '<div class="rows">' + rows + '</div>';
    }
    return '<div class="view-anim">' +
      '<div class="wrong-head"><div class="wh-l"><b>错词本</b><p>' + (words.length ? words.length + ' 个词待消灭 · 答对一次自动移出' : '累计答错 ' + totalW + ' 次 · 本子干干净净') + '</p></div>' +
      '<button class="btn sm" data-act="wrong-start" ' + (words.length ? '' : 'disabled') + '>开始重练</button></div>' +
      body + '</div>';
  }

  /* 统计页：数据卡 + 柱状图（渐变柱+数值气泡）+ 掌握环 + 5 周热力图 */
  function statsHTML() {
    var td = today();
    var acc = td.n ? Math.round(td.c / td.n * 100) + '%' : '—';
    var m = mastered(), ln = learned(), rest = ALL.length - ln;

    var days = [], max = 1;
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var k = dayKey(d), e = S.daily[k] || { n: 0, c: 0 };
      days.push({ d: d, n: e.n, today: i === 0 });
      if (e.n > max) max = e.n;
    }
    var bars = days.map(function (x, idx) {
      var h = x.n ? Math.max(10, Math.round(x.n / max * 100)) : 4;
      return '<div class="bar-w' + (x.today ? ' today' : '') + '">' +
        (x.n ? '<span class="bar-tip">' + x.n + '</span>' : '<span class="bar-tip" style="visibility:hidden">0</span>') +
        '<div class="bar" style="height:' + h + '%;animation-delay:' + (idx * 0.06) + 's"></div>' +
        '<span class="bar-l">' + (x.d.getMonth() + 1) + '/' + x.d.getDate() + '</span></div>';
    }).join('');

    var donutHTML = '<div class="donut">' + donut([{ v: m, g: 1 }, { v: ln - m, c: 'var(--chart-2)' }, { v: rest, c: 'var(--chart-3)' }], 148, 16) +
      '<div class="donut-c"><div><b>' + m + '</b><span>已掌握 / ' + ALL.length + '</span></div></div></div>' +
      '<div class="legend">' +
        '<div class="lg-item"><span class="lg-dot g1"></span>已掌握<i>' + pctStr(m) + '</i><b>' + m + '</b></div>' +
        '<div class="lg-item"><span class="lg-dot g2"></span>学习中<i>' + pctStr(ln - m) + '</i><b>' + (ln - m) + '</b></div>' +
        '<div class="lg-item"><span class="lg-dot g3"></span>未开始<i>' + pctStr(rest) + '</i><b>' + rest + '</b></div>' +
      '</div>';

    var hm = heatmapHTML();

    return '<div class="view-anim">' +
      '<div class="tiles">' +
        '<div class="tile t1"><span class="ti">' + ic('bolt', 16) + '</span><b>' + td.n + '<small>题</small></b><span>今日练习</span></div>' +
        '<div class="tile t2"><span class="ti">' + ic('target', 16) + '</span><b>' + acc + '</b><span>今日正确率</span></div>' +
        '<div class="tile t3"><span class="ti">' + ic('flame', 16) + '</span><b>' + streak() + '<small>天</small></b><span>连续打卡</span></div>' +
        '<div class="tile t4"><span class="ti">' + ic('layers', 16) + '</span><b>' + m + '<small>词</small></b><span>累计掌握</span></div>' +
      '</div>' +
      '<div class="sec-title"><h2>近 7 天练习量</h2><span>每日答题数</span></div>' +
      '<div class="card">' + '<div class="chart">' + bars + '</div></div>' +
      '<div class="sec-title"><h2>掌握程度</h2><span>按复习间隔分级</span></div>' +
      '<div class="card">' + '<div class="donut-box">' + donutHTML + '</div></div>' +
      '<div class="sec-title"><h2>学习热力图</h2><span>近 5 周</span></div>' +
      '<div class="card">' + hm + '</div>' +
      '<p class="note">数据仅保存在本机浏览器 localStorage，清缓存前请放心练习</p></div>';
  }
  function pctStr(v) { return Math.round(v / ALL.length * 100) + '%'; }

  function heatmapHTML() {
    var weeks = 5, today = new Date();
    var dow = (today.getDay() + 6) % 7; // 周一为 0
    var start = new Date(today);
    start.setDate(start.getDate() - dow - (weeks - 1) * 7); // 本周所在周为最后一列
    var cols = '', total = 0, activeDays = 0, tk = dayKey(today);
    for (var w = 0; w < weeks; w++) {
      var cells = '';
      for (var d = 0; d < 7; d++) {
        var dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
        var future = dt > today;
        var n = (S.daily[dayKey(dt)] || {}).n || 0;
        if (!future) { total += n; if (n > 0) activeDays++; }
        var lv = n === 0 ? 0 : n < 10 ? 1 : n < 20 ? 2 : n < 30 ? 3 : 4;
        cells += '<span class="hm-cell lv' + lv + (future ? ' fut' : '') + (dayKey(dt) === tk ? ' today' : '') + '" title="' +
          (dt.getMonth() + 1) + '/' + dt.getDate() + '：' + (future ? '未到' : n + ' 题') + '"></span>';
      }
      cols += '<div class="hm-col">' + cells + '</div>';
    }
    var side = ['一', '', '三', '', '五', '', '日'].map(function (t) { return '<span>' + t + '</span>'; }).join('');
    var leg = [0, 1, 2, 3, 4].map(function (l) { return '<i class="hm-cell lv' + l + '" style="cursor:default"></i>'; }).join('');
    return '<div class="hm"><div class="hm-side">' + side + '</div><div class="hm-grid">' + cols + '</div></div>' +
      '<div class="hm-foot"><span class="hm-meta">近 35 天 · 共 ' + total + ' 题 · 打卡 ' + activeDays + ' 天</span>' +
      '<span class="hm-leg">少 ' + leg + ' 多</span></div>';
  }

  /* ---------------- 导航 ---------------- */
  function nav(tab) {
    currentTab = tab;
    closeSheet();
    var map = { home: homeHTML, review: reviewHTML, wrong: wrongHTML, stats: statsHTML };
    view.innerHTML = '<div class="view-anim">' + (map[tab] || homeHTML)() + '</div>';
    document.querySelectorAll('#tabbar .tab').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    window.scrollTo(0, 0);
    updateChrome();
    animateSVG(view);
  }

  /* ---------------- 单元模式弹层 ---------------- */
  function openSheet(ui) {
    var u = UNITS[ui];
    var l = unitLearned(ui);
    sheetEl.innerHTML = '<div class="sheet-grip"></div><h3>' + esc(u.name) + '</h3>' +
      '<div class="s-sub">' + u.words.length + ' 词 · 已学 ' + l + ' · 每组随机抽取</div>' +
      '<div class="sheet-modes">' +
      [['learn', '看词选义', '显示单词，四选一词义', 'linear-gradient(135deg,#5766f5,#7d8bff)', 'eye'],
       ['listen', '听音识词', '播放发音，选择词义', 'linear-gradient(135deg,#8b5cf6,#a78bfa)', 'sound'],
       ['spell', '拼写挑战', '看释义逐字母拼写单词', 'linear-gradient(135deg,#0ea5e9,#38bdf8)', 'pen']].map(function (m) {
        return '<button class="sheet-mode" data-act="unitmode" data-type="' + m[0] + '" data-ui="' + ui + '">' +
          '<span class="mi" style="background:' + m[3] + '">' + ic(m[4], 20) + '</span>' +
          '<span><b>' + m[1] + '</b><i>' + m[2] + '</i></span>' +
          '<span class="arr">' + ic('chev', 18) + '</span></button>';
      }).join('') + '</div>' +
      '<button class="sheet-close" data-act="sheet-close">取消</button>';
    sheetWrap.classList.remove('hidden');
  }
  function closeSheet() { sheetWrap.classList.add('hidden'); }

  /* ================= 训练会话 ================= */
  var SES = null;
  var TYPE_NAME = { learn: '看词选义', listen: '听音识词', spell: '拼写挑战', review: '间隔复习' };

  function smartWords(type) {
    var due = shuffle(dueWords());
    var fresh = shuffle(ALL.filter(function (x) { return !S.states[x.w]; }));
    var list = due.concat(fresh);
    if (!list.length) list = shuffle(ALL);
    var n = type === 'spell' ? 8 : 12;
    return list.slice(0, n);
  }
  function smartStart(type) {
    var title = type === 'wrong' ? '错词冲刺' : '智能练习';
    var words = type === 'wrong' ? S.wrong.map(function (w) { return BY[w]; }).filter(Boolean) : smartWords(type);
    if (type === 'wrong' && !words.length) { toast('错词本是空的，先去练一组吧'); return; }
    startSession(type === 'wrong' ? 'learn' : type, words, title, type === 'spell' ? 8 : 10);
  }
  function reviewStart() {
    var words = dueWords();
    if (!words.length) { toast('当前没有到期的复习词'); return; }
    startSession('learn', words, '间隔复习', Math.min(words.length, 12));
  }

  function startSession(type, words, title, count) {
    if (SES && SES.timer) clearTimeout(SES.timer);
    words = (words || []).filter(Boolean);
    if (!words.length) { toast('暂无可练习的单词'); return; }
    count = count || 10;
    SES = {
      type: type, title: title || TYPE_NAME[type], words: words,
      queue: shuffle(words).slice(0, count), idx: 0, ok: 0, bad: 0,
      combo: 0, maxCombo: 0, wrongList: [], reQ: {}, timer: 0, locked: false
    };
    sessionEl.classList.remove('hidden');
    sessionEl.innerHTML = '';
    document.body.classList.add('noscroll');
    renderQ();
  }
  function closeSession() {
    if (SES && SES.timer) clearTimeout(SES.timer);
    SES = null;
    if (window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} }
    sessionEl.classList.add('hidden');
    sessionEl.innerHTML = '';
    document.body.classList.remove('noscroll');
    nav(currentTab);
  }

  function sTop() {
    var total = SES.queue.length;
    var pct = Math.round(SES.idx / total * 100);
    return '<div class="s-top"><button class="ic-btn" data-act="exit" aria-label="退出练习">' + ic('x', 18) + '</button>' +
      '<div class="s-title">' + esc(SES.title) + '</div>' +
      '<div class="s-count">' + Math.min(SES.idx + 1, total) + '/' + total + '</div></div>' +
      '<div class="s-prog"><i style="width:' + pct + '%"></i></div>' +
      '<div class="combo-slot" id="comboSlot"></div>';
  }
  function optsHTML() {
    return '<div class="opts" id="opts">' + SES.opts.map(function (o, i) {
      return '<button class="opt" data-act="opt" data-i="' + i + '"><span class="key">' + 'ABCD'[i] + '</span><span>' + esc(o.d) + '</span></button>';
    }).join('') + '</div>';
  }
  function makeOptions(cur) {
    var same = shuffle(ALL.filter(function (x) { return x.u === cur.u && x.w !== cur.w; }));
    var others = shuffle(ALL.filter(function (x) { return x.u !== cur.u; }));
    var seen = {}, ds = [];
    same.concat(others).forEach(function (x) {
      if (ds.length >= 3) return;
      if (x.d !== cur.d && !seen[x.d]) { seen[x.d] = 1; ds.push(x.d); }
    });
    var opts = [{ d: cur.d, ok: true }].concat(ds.map(function (d) { return { d: d, ok: false }; }));
    opts = shuffle(opts);
    SES.ansIdx = opts.findIndex(function (o) { return o.ok; });
    SES.opts = opts;
  }
  function exHTML(cur) {
    var re = new RegExp('\\b' + cur.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'ig');
    return esc(cur.e).replace(re, function (m) { return '<b>' + m + '</b>'; });
  }

  function renderQ() {
    if (!SES) return;
    if (SES.idx >= SES.queue.length) return summary();
    var cur = SES.queue[SES.idx];
    SES.cur = cur; SES.locked = false;
    var html;

    if (SES.type === 'spell') {
      SES.typed = ''; SES.hints = 0;
      var slots = cur.w.toLowerCase().split('').map(function (ch, i) {
        return '<span class="slot' + (i === 0 ? ' cur' : '') + '" data-i="' + i + '"></span>';
      }).join('');
      html = sTop() +
        '<div class="s-card"><div class="q-hint">根据释义和发音，拼出这个单词</div>' +
        '<div class="q-def">' + esc(cur.d) + '</div>' +
        '<button class="spk" data-act="speak">' + ic('sound', 15) + ' 播放发音</button>' +
        '<div class="slots" data-act="focus-spell">' + slots + '<input id="spellIn" class="spell-in" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" aria-label="拼写输入"></div>' +
        '<div class="spell-tip">边听边拼记得更牢 · 打错字母会有红字提示</div>' +
        '<div class="spell-btns"><button class="ghost-btn" data-act="hint">' + ic('spark', 14) + ' 提示一字</button>' +
        '<button class="ghost-btn" data-act="skip">跳过这个词 ' + ic('arr', 14) + '</button></div>' +
        '<div id="spellResult"></div></div>';
      sessionEl.innerHTML = html;
      var inp = document.getElementById('spellIn');
      if (inp) setTimeout(function () { try { inp.focus(); } catch (e) {} }, 80);
      setTimeout(function () { speak(cur.w); }, 250);
      return;
    }

    makeOptions(cur);
    if (SES.type === 'listen') {
      html = sTop() +
        '<div class="s-card"><div class="q-hint">听发音，选出对应的词义</div>' +
        '<button class="big-spk" data-act="speak" aria-label="播放发音">' + ic('sound', 44) + '</button>' +
        '<div class="q-hint">点喇叭可以重听</div><div id="reveal"></div></div>' + optsHTML();
    } else {
      html = sTop() +
        '<div class="s-card"><div class="q-hint">选出单词的正确词义</div>' +
        '<div class="q-word">' + esc(cur.w) + '</div>' +
        '<div class="q-phon">' + esc(cur.p) + '</div>' +
        '<button class="spk" data-act="speak">' + ic('sound', 15) + ' 播放发音</button>' +
        '<div id="reveal"></div></div>' + optsHTML();
    }
    sessionEl.innerHTML = html;
    if (SES.type === 'listen') setTimeout(function () { speak(cur.w); }, 300);
  }

  function showCombo() {
    var slot = document.getElementById('comboSlot');
    if (slot && SES && SES.combo >= 2) {
      slot.innerHTML = '<span class="combo-chip">' + ic('bolt', 12) + SES.combo + ' 连击</span>';
    }
  }
  function clearCombo() {
    var slot = document.getElementById('comboSlot');
    if (slot) slot.innerHTML = '';
  }

  function onAnswer(i) {
    if (!SES || SES.locked) return;
    SES.locked = true;
    var cur = SES.cur, ok = (i === SES.ansIdx);
    answer(cur.w, ok);
    if (ok) {
      SES.ok++; SES.combo++;
      if (SES.combo > SES.maxCombo) SES.maxCombo = SES.combo;
      showCombo();
    } else {
      SES.bad++; SES.combo = 0; clearCombo();
      if (SES.wrongList.indexOf(cur.w) < 0) SES.wrongList.push(cur.w);
      if (!SES.reQ[cur.w]) { SES.reQ[cur.w] = 1; SES.queue.push(cur); }
    }
    var box = document.getElementById('opts');
    if (box) {
      box.classList.add('locked');
      box.children[i].classList.add(ok ? 'ok' : 'bad');
      if (!ok) {
        box.children[SES.ansIdx].classList.add('ok', 'breathe');
        for (var k = 0; k < box.children.length; k++) {
          if (k !== i && k !== SES.ansIdx) box.children[k].classList.add('dim');
        }
      } else {
        for (var k2 = 0; k2 < box.children.length; k2++) {
          if (k2 !== i) box.children[k2].classList.add('dim');
        }
      }
    }
    var rv = document.getElementById('reveal');
    if (rv) {
      rv.innerHTML = '<div class="reveal">' +
        '<span class="rv-tag ' + (ok ? 'ok' : 'bad') + '">' + (ok ? ic('check', 12) + ' 回答正确' : ic('x', 12) + ' 正确答案在这里') + '</span>' +
        (SES.type !== 'learn' ? '<div class="rv-word">' + esc(cur.w) + ' <small>' + esc(cur.p) + '</small></div>' : '') +
        '<div>' + exHTML(cur) + '</div></div>';
    }
    speak(cur.w);
    var total = SES.queue.length;
    var prog = sessionEl.querySelector('.s-prog i');
    if (prog) prog.style.width = Math.round((SES.idx + 1) / total * 100) + '%';
    SES.timer = setTimeout(function () { if (SES) { SES.idx++; renderQ(); } }, ok ? 1150 : 2200);
  }

  function renderSlots() {
    if (!SES || SES.type !== 'spell') return;
    var els = sessionEl.querySelectorAll('.slot');
    els.forEach(function (el, i) {
      el.textContent = i < SES.typed.length ? SES.typed[i] : '';
      el.className = 'slot' + (i < SES.typed.length ? (SES.hintSet && SES.hintSet[i] ? ' hint' : ' on') : (i === SES.typed.length ? ' cur' : ''));
    });
    var cnt = sessionEl.querySelector('.s-count');
    if (cnt) cnt.textContent = Math.min(SES.idx + 1, SES.queue.length) + '/' + SES.queue.length;
  }
  function onSpellInput() {
    if (!SES || SES.type !== 'spell' || SES.locked) return;
    var inp = document.getElementById('spellIn');
    if (!inp) return;
    var w = SES.cur.w.toLowerCase();
    var v = inp.value.toLowerCase().replace(/[^a-z]/g, '');
    var out = '', bad = -1, badCh = '';
    for (var i = 0; i < v.length; i++) {
      if (i < w.length && v[i] === w[i]) out += v[i];
      else { bad = i; badCh = v[i]; break; }
    }
    inp.value = out;
    SES.typed = out;
    renderSlots();
    if (bad > -1) { // 错误字母：红闪提示后消失
      var els = sessionEl.querySelectorAll('.slot');
      var el = els[out.length];
      if (el) {
        el.textContent = badCh; el.className = 'slot err';
        (function (elm) { setTimeout(function () { if (elm.isConnected) { elm.textContent = ''; elm.className = 'slot cur'; } }, 450); })(el);
      }
      return;
    }
    if (out.length === w.length) spellDone(true);
  }
  function spellHint() {
    if (!SES || SES.type !== 'spell' || SES.locked) return;
    var w = SES.cur.w.toLowerCase();
    if (SES.typed.length >= w.length) return;
    if (!SES.hintSet) SES.hintSet = {};
    SES.hintSet[SES.typed.length] = 1;
    SES.typed += w[SES.typed.length];
    var inp = document.getElementById('spellIn');
    if (inp) inp.value = SES.typed;
    SES.hints++;
    renderSlots();
    if (SES.typed.length === w.length) spellDone(true);
  }
  function spellDone(userFinished) {
    if (!SES || SES.locked) return;
    SES.locked = true;
    var cur = SES.cur, w = cur.w.toLowerCase(), ok = userFinished;
    answer(cur.w, ok);
    if (ok) {
      SES.ok++; SES.combo++;
      if (SES.combo > SES.maxCombo) SES.maxCombo = SES.combo;
      showCombo();
    } else {
      SES.bad++; SES.combo = 0; clearCombo();
      if (SES.wrongList.indexOf(cur.w) < 0) SES.wrongList.push(cur.w);
      if (!SES.reQ[cur.w]) { SES.reQ[cur.w] = 1; SES.queue.push(cur); }
    }
    var els = sessionEl.querySelectorAll('.slot');
    els.forEach(function (el, i) {
      el.textContent = w[i];
      var good = ok || i < SES.typed.length || (SES.hintSet && SES.hintSet[i]);
      el.className = 'slot ' + (good ? ((SES.hintSet && SES.hintSet[i]) ? 'hint' : 'on') : 'err');
    });
    var box = document.getElementById('spellResult');
    if (box) {
      box.innerHTML = '<div class="spell-result">' +
        '<div class="sr-word">' + esc(cur.w) + '</div><div class="sr-phon">' + esc(cur.p) + '</div>' +
        '<div class="sr-msg ' + (ok ? 'ok' : 'bad') + '">' + (ok ? (SES.hints ? '借助提示完成，再默一遍更牢' : '拼写正确，太棒了！') : '拼错了，跟读一遍加深记忆') + '</div>' +
        '<div class="sr-ex">' + exHTML(cur) + '</div></div>';
    }
    speak(cur.w);
    var total = SES.queue.length;
    var prog = sessionEl.querySelector('.s-prog i');
    if (prog) prog.style.width = Math.round((SES.idx + 1) / total * 100) + '%';
    SES.timer = setTimeout(function () { if (SES) { SES.idx++; renderQ(); } }, ok ? 1500 : 2600);
  }

  function summary() {
    var total = SES.ok + SES.bad;
    var pct = total ? Math.round(SES.ok / total * 100) : 0;
    var chips = SES.wrongList.map(function (w) {
      var x = BY[w];
      return '<span class="chip">' + esc(w) + ' · ' + esc(x ? x.d : '') + '</span>';
    }).join('');
    var msg = pct >= 100 ? '满分通关，这组词已经刻进脑海' :
              pct >= 90 ? '手感火热，就差一点点完美' :
              pct >= 70 ? '不错的表现，错词记得回炉' :
              pct >= 40 ? '有点起伏，错词本里加练一组' : '这组有点难，消灭错词后再战';
    var ringCol = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
    var award = pct >= 80 ? '<div class="sum-award">' + ic('trophy', 40) + '</div>' : '';
    sessionEl.innerHTML =
      '<div class="s-wrap">' + confettiHTML(30) +
      '<div class="s-top"><button class="ic-btn" data-act="exit" aria-label="退出练习">' + ic('x', 18) + '</button>' +
      '<div class="s-title">' + esc(SES.title) + ' · 完成</div><div class="s-count"></div></div>' +
      '<div class="sum"><div class="sum-ring">' + ring(pct, 150, 12, ringCol, 'var(--track)') +
      '<div class="sum-c"><div><b>' + pct + '%</b><span>正确率</span></div></div></div>' +
      '<h3>' + msg + '</h3>' + award +
      '<p>共 <b>' + total + '</b> 题 · 答对 <b>' + SES.ok + '</b> · 答错 <i>' + SES.bad + '</i>' + (SES.maxCombo >= 2 ? ' · 最高 ' + SES.maxCombo + ' 连击' : '') + '</p>' +
      (chips ? '<div class="sum-wrong">' + chips + '</div>' : '') +
      '<div class="sum-btns"><button class="btn block" data-act="again">再来一组</button>' +
      '<button class="btn ghost block" data-act="finish">完成返回</button></div></div></div>';
    animateSVG(sessionEl);
  }

  /* ---------------- 事件委托 ---------------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.dataset.act;
    if (act === 'sheet-close') return closeSheet();
    if (act === 'unit') return openSheet(+t.dataset.ui);
    if (act === 'unitmode') { closeSheet(); var ui = +t.dataset.ui, ty = t.dataset.type; return startSession(ty, unitWords(ui), UNITS[ui].name, ty === 'spell' ? 8 : 10); }
    if (act === 'mode') return smartStart(t.dataset.type);
    if (act === 'review-start') return reviewStart();
    if (act === 'wrong-start') return smartStart('wrong');
    if (act === 'speak') { if (SES && SES.cur) return speak(SES.cur.w); return; }
    if (act === 'speak-word') return speak(t.dataset.w);
    if (act === 'opt') return onAnswer(+t.dataset.i);
    if (act === 'exit') return closeSession();
    if (act === 'finish') return closeSession();
    if (act === 'again') {
      if (!SES) return closeSession();
      var s = SES;
      return startSession(s.type, s.words, s.title, s.type === 'spell' ? 8 : 10);
    }
    if (act === 'hint') return spellHint();
    if (act === 'skip') { if (SES && SES.type === 'spell' && !SES.locked) return spellDone(false); return; }
    if (act === 'focus-spell') { var inp = document.getElementById('spellIn'); if (inp) { try { inp.focus(); } catch (e2) {} } return; }
  });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'spellIn') onSpellInput();
  });
  document.querySelectorAll('#tabbar .tab').forEach(function (b) {
    b.addEventListener('click', function () { nav(b.dataset.tab); });
  });
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', cycleTheme);

  /* ---------------- 启动 ---------------- */
  applyTheme();
  nav('home');

  /* 演示/自动化联调钩子（不参与业务逻辑） */
  window.WT = {
    nav: nav,
    startUnit: function (type, ui) { startSession(type, unitWords(ui), UNITS[ui].name, type === 'spell' ? 8 : 10); },
    smart: smartStart,
    review: reviewStart,
    close: closeSession,
    theme: cycleTheme,
    q: function () { return SES ? { word: SES.cur ? SES.cur.w : null, ans: SES.ansIdx, type: SES.type, typed: SES.typed || '' } : null; }
  };
})();
