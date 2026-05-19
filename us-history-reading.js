(function(){
  if (window.__arabrusUsHistoryReadingInstalled) return;
  window.__arabrusUsHistoryReadingInstalled = true;

  const TITLE = 'تاريخ الولايات المتحدة';
  const WIKI_PAGE = 'https://ar.wikipedia.org/wiki/' + encodeURIComponent(TITLE).replace(/%20/g, '_');
  const WIKI_API = 'https://ar.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(TITLE);
  const FALLBACK_TEXT = 'تاريخ الولايات المتحدة هو تاريخ دولة الولايات المتحدة الأمريكية، وهي جمهورية اتحادية تقع في أمريكا الشمالية. بدأت الهجرة البشرية إلى أراضي الولايات المتحدة منذ آلاف السنين. تطورت مجتمعات السكان الأصليين في مناطق مختلفة قبل وصول الأوروبيين. في عام 1492 وصل كريستوفر كولومبس إلى جزر البحر الكاريبي، وبعد ذلك بدأ الاستعمار الأوروبي للأمريكيتين. تأسست المستعمرات البريطانية على الساحل الشرقي، ثم أعلنت ثلاث عشرة مستعمرة استقلالها عن بريطانيا عام 1776. خاضت الولايات المتحدة حرب الاستقلال، ثم وضعت دستوراً اتحادياً. توسعت الدولة غرباً خلال القرن التاسع عشر، وحدثت الحرب الأهلية بسبب الخلاف حول العبودية والسلطة الاتحادية. بعد الحرب أصبحت الولايات المتحدة قوة صناعية كبيرة. وفي القرن العشرين شاركت في الحربين العالميتين، ثم أصبحت قوة عظمى ذات تأثير سياسي واقتصادي وثقافي واسع.';

  let loadedText = '';
  let wordStore = {};
  let wordSeq = 0;
  let indexReadyKey = '';
  let formIndex = new Map();
  let rootIndex = new Map();

  function html(v) {
    try { if (typeof escapeHtml === 'function') return escapeHtml(v); } catch (_) {}
    return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function js(v) {
    try { if (typeof escapeJs === 'function') return escapeJs(v); } catch (_) {}
    return String(v == null ? '' : v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n').replace(/\r/g,'\\r');
  }

  function addStyles() {
    if (document.getElementById('usHistoryReadingStyle')) return;
    const style = document.createElement('style');
    style.id = 'usHistoryReadingStyle';
    style.textContent = `
      .us-history-home{padding:0;overflow:hidden}.us-history-open-btn{display:block;width:100%;padding:14px;border:0;background:#fff;text-align:left;cursor:pointer;color:inherit}.us-history-open-btn:active{background:#f8fafc}.us-history-home-title{font-size:18px;font-weight:900;color:#0f172a}.us-history-home-ar{font-size:24px;font-weight:900;color:var(--primary);direction:rtl;text-align:right;margin:8px 0;line-height:1.35}.us-history-home-text{font-size:14px;line-height:1.5;color:#475569}
      .us-history-screen{display:none;position:fixed;inset:0;z-index:10050;background:#fff;color:#1e293b;flex-direction:column}.us-history-screen.open{display:flex}body.us-history-screen-open{overflow:hidden}.us-history-screen-head{border-bottom:1px solid #e2e8f0;background:#fff;padding:12px 14px;box-shadow:0 4px 18px rgba(15,23,42,.05)}.us-history-screen-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.us-history-close{width:44px;height:40px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;font-size:22px;font-weight:900}.us-history-screen-title{font-size:17px;font-weight:900;color:#0f172a}.us-history-source{margin-top:6px;font-size:12px;line-height:1.35;color:#64748b}.us-history-source a{color:#2563eb;text-decoration:none;font-weight:800}.us-history-match-info{margin-top:6px;font-size:12px;font-weight:800;color:#166534}.us-history-screen-body{flex:1;overflow:auto;background:#f8fafc;padding:16px 14px 120px;-webkit-overflow-scrolling:touch}.us-history-article{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;direction:rtl;text-align:right;box-shadow:0 4px 18px rgba(15,23,42,.04)}.us-history-article p{font-size:22px;line-height:2.05;color:#172033;margin:0 0 14px}.us-history-word{display:inline;border:0;background:transparent;color:var(--primary);padding:0 1px;margin:0;font:inherit;font-weight:900;text-decoration:underline;text-underline-offset:4px;cursor:pointer}.us-history-word.active{background:#dcfce7;border-radius:6px}.us-history-load{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;text-align:center;color:#64748b;font-size:15px;line-height:1.45}
      .us-history-translation-panel{display:none;position:fixed;left:12px;right:12px;bottom:12px;z-index:10070;max-width:760px;margin:0 auto;background:#fff;border:1px solid #bbf7d0;border-radius:18px;box-shadow:0 18px 46px rgba(15,23,42,.22);padding:14px;direction:ltr;text-align:left}.us-history-translation-panel.open{display:block}.us-history-translation-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.us-history-translation-word{font-size:28px;font-weight:900;color:var(--primary);direction:rtl;text-align:right;line-height:1.25}.us-history-translation-close{border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;width:36px;height:34px;font-size:18px;font-weight:900}.us-history-translation-short{font-size:16px;font-weight:900;color:#0f172a;line-height:1.45;margin-top:8px}.us-history-translation-full{font-size:13px;line-height:1.45;color:#475569;margin-top:8px;max-height:96px;overflow:auto;white-space:pre-wrap}.us-history-translation-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.us-history-translation-actions .btn{flex:1;min-width:120px;padding:9px 10px;font-size:13px}.us-history-tip{font-size:12px;color:#64748b;margin-top:8px;line-height:1.35}
      body.arabrus-font-step-1 .us-history-article p{font-size:24px;line-height:2.1}body.arabrus-font-step-2 .us-history-article p{font-size:27px;line-height:2.15}
    `;
    document.head.appendChild(style);
  }

  function homeCard() {
    addStyles();
    return `<div class="home-guide us-history-home"><button type="button" class="us-history-open-btn" onclick="openUsHistoryReading()"><div class="home-guide-title">Статья для чтения</div><div class="us-history-home-title">История США ↗</div><div class="us-history-home-ar">تاريخ الولايات المتحدة</div><div class="us-history-home-text">Откроется статья на весь экран. Нажмите на зелёное слово — снизу появится перевод и кнопка перехода к карточке словаря.</div></button></div>`;
  }

  function patchHomeGuide() {
    try {
      renderDictionaryHomeGuide = function(){ return homeCard(); };
      window.renderDictionaryHomeGuide = renderDictionaryHomeGuide;
      if (typeof renderApp === 'function') renderApp();
    } catch (_) {}
  }

  function normalizeArabic(value) {
    return String(value || '').toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/ـ/g, '')
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ى/g, 'ي')
      .replace(/[^ء-ي]/g, '')
      .trim();
  }

  function variants(raw) {
    const base = normalizeArabic(raw);
    const result = new Set();
    const queue = [base];
    const prefixes = ['وال','فال','بال','كال','ولل','فلل','لل','ال','و','ف','ب','ك','ل','س'];
    const suffixes = ['كما','هما','كم','كن','هم','هن','ها','نا','ني','وا','ون','ين','ان','ات','ة','ه','ي','ت'];
    let guard = 0;
    while (queue.length && guard < 90) {
      guard++;
      const w = queue.shift();
      if (!w || w.length < 2 || result.has(w)) continue;
      result.add(w);
      for (const p of prefixes) if (w.startsWith(p) && w.length - p.length >= 3) queue.push(w.slice(p.length));
      for (const s of suffixes) if (w.endsWith(s) && w.length - s.length >= 3) {
        const stem = w.slice(0, -s.length);
        queue.push(stem);
        if (s === 'ات') queue.push(stem + 'ة');
        if (s === 'ة' || s === 'ه' || s === 'ت') queue.push(stem + 'ة', stem + 'ه');
      }
      if (/^[يتأن]/.test(w) && w.length > 3) queue.push(w.slice(1));
    }
    try { if (typeof getArabicStems === 'function') getArabicStems(base).forEach(x => result.add(normalizeArabic(x))); } catch (_) {}
    return Array.from(result).filter(x => x && x.length > 1).sort((a,b) => b.length - a.length);
  }

  function splitForms(value) {
    return String(value || '').split(/[\s\n\r\t،؛,.;:()\[\]{}"'«»!?؟/\\|ـ-]+/g).map(x => x.trim()).filter(Boolean);
  }

  function put(map, key, word, score) {
    key = normalizeArabic(key);
    if (!key || key.length < 2 || !word) return;
    const current = map.get(key);
    const len = String(word.ar || '').length;
    if (!current || score > current.score || (score === current.score && len < current.len)) map.set(key, { word, score, len });
  }

  function addForms(map, value, word, score) {
    splitForms(value).forEach(part => variants(part).forEach(v => put(map, v, word, score)));
  }

  function buildIndex() {
    let words = [];
    try { if (Array.isArray(dictBase)) words = dictBase; } catch (_) {}
    const key = words.length + ':' + ((words[0] || {}).ar || '') + ':' + ((words[words.length - 1] || {}).ar || '');
    if (key === indexReadyKey) return;
    indexReadyKey = key;
    formIndex = new Map();
    rootIndex = new Map();
    words.forEach(w => {
      addForms(formIndex, w && w.ar, w, 100);
      addForms(formIndex, w && w.plural, w, 92);
      addForms(rootIndex, w && w.root, w, 45);
    });
  }

  function findWord(token) {
    buildIndex();
    const list = variants(token);
    for (const v of list) { const hit = formIndex.get(v); if (hit) return hit.word; }
    for (const v of list) { const hit = rootIndex.get(v); if (hit) return hit.word; }
    return null;
  }

  function screen() {
    addStyles();
    let el = document.getElementById('usHistoryReadingScreen');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'usHistoryReadingScreen';
    el.className = 'us-history-screen';
    el.innerHTML = `<div class="us-history-screen-head"><div class="us-history-screen-top"><button type="button" class="us-history-close" onclick="closeUsHistoryReading()">×</button><div class="us-history-screen-title">История США · تاريخ الولايات المتحدة</div></div><div class="us-history-source">Источник: <a href="${WIKI_PAGE}" target="_blank" rel="noopener">Arabic Wikipedia</a>. Нажмите зелёное слово — появится перевод. Затем можно открыть карточку словаря и добавить в избранное.</div><div id="usHistoryMatchInfo" class="us-history-match-info"></div></div><div id="usHistoryBody" class="us-history-screen-body"><div class="us-history-load">Загрузка статьи...</div></div><div id="usHistoryTranslationPanel" class="us-history-translation-panel"></div>`;
    el.addEventListener('click', event => {
      const panel = event.target && event.target.closest ? event.target.closest('#usHistoryTranslationPanel') : null;
      const btn = event.target && event.target.closest ? event.target.closest('[data-us-history-word]') : null;
      if (btn) {
        event.preventDefault();
        showTranslation(btn.getAttribute('data-us-history-word'));
      } else if (!panel) {
        hideTranslation();
      }
    });
    document.body.appendChild(el);
    return el;
  }

  function trimArticle(value) {
    let text = String(value || '').replace(/\r/g, '').trim();
    const cut = text.search(/\n\s*(انظر أيضًا|المراجع|مراجع|وصلات خارجية|مصادر|هوامش)\s*\n/);
    if (cut > 0) text = text.slice(0, cut).trim();
    return text;
  }

  function shortRu(word) {
    if (!word) return '';
    try { if (word.short_ru) return String(word.short_ru); } catch (_) {}
    const full = String((word.ru || '')).split(/[;\n]/)[0].trim();
    return full || '';
  }

  function fullRu(word) {
    return String((word && word.ru) || '').trim();
  }

  function renderToken(token, stat) {
    const word = findWord(token);
    stat.total += 1;
    if (!word) return html(token);
    stat.matched += 1;
    const id = 'ush_' + (++wordSeq);
    wordStore[id] = { word, original: token };
    const title = shortRu(word) || fullRu(word) || word.ar || token;
    return `<button type="button" class="us-history-word" data-us-history-word="${id}" title="${html(title)}">${html(token)}</button>`;
  }

  function renderArticle(text) {
    hideTranslation();
    wordStore = {};
    wordSeq = 0;
    const stat = { total: 0, matched: 0 };
    const paragraphs = trimArticle(text).split(/\n{2,}/g).map(p => p.trim()).filter(Boolean);
    const body = paragraphs.map(p => '<p>' + p.split(/([\u0600-\u06FF]+)/g).map(part => /^[\u0600-\u06FF]+$/.test(part) ? renderToken(part, stat) : html(part)).join('') + '</p>').join('');
    const info = document.getElementById('usHistoryMatchInfo');
    if (info) info.textContent = stat.total ? ('Найдено в словаре: ' + stat.matched + ' из ' + stat.total + ' словоформ') : '';
    return `<div class="us-history-article">${body}</div>`;
  }

  async function loadArticle() {
    const body = document.getElementById('usHistoryBody');
    if (!body) return;
    body.innerHTML = '<div class="us-history-load">Загрузка статьи из Википедии...</div>';
    try {
      buildIndex();
      let text = '';
      const response = await fetch(WIKI_API, { cache: 'force-cache' });
      if (response.ok) {
        const data = await response.json();
        text = data && data.extract ? data.extract : '';
      }
      loadedText = trimArticle(text || FALLBACK_TEXT);
      body.innerHTML = renderArticle(loadedText);
    } catch (error) {
      console.error(error);
      loadedText = FALLBACK_TEXT;
      body.innerHTML = renderArticle(loadedText);
    }
  }

  function hideTranslation() {
    document.querySelectorAll('.us-history-word.active').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById('usHistoryTranslationPanel');
    if (panel) {
      panel.classList.remove('open');
      panel.innerHTML = '';
    }
  }

  function showTranslation(id) {
    const item = wordStore[id];
    if (!item || !item.word) return;
    const word = item.word;
    document.querySelectorAll('.us-history-word.active').forEach(el => el.classList.remove('active'));
    const btn = document.querySelector(`[data-us-history-word="${id}"]`);
    if (btn) btn.classList.add('active');
    const panel = document.getElementById('usHistoryTranslationPanel');
    if (!panel) return;
    const shortText = shortRu(word) || 'Перевод есть в карточке словаря';
    const fullText = fullRu(word);
    const rootText = word.root ? `<div class="us-history-tip">Корень: <b>${html(word.root)}</b></div>` : '';
    const pluralText = word.plural ? `<div class="us-history-tip">Мн. число: <b>${html(word.plural)}</b></div>` : '';
    panel.innerHTML = `<div class="us-history-translation-top"><div><div class="us-history-translation-word">${html(item.original)} → ${html(word.ar || '')}</div><div class="us-history-translation-short">${html(shortText)}</div></div><button type="button" class="us-history-translation-close" onclick="hideUsHistoryTranslation()">×</button></div>${fullText ? `<div class="us-history-translation-full">${html(fullText)}</div>` : ''}${rootText}${pluralText}<div class="us-history-translation-actions"><button type="button" class="btn primary" onclick="openUsHistoryMatchedWord('${js(id)}')">Открыть карточку</button><button type="button" class="btn" onclick="speak('${js(word.ar || item.original)}', event)">🔊 Слушать</button></div><div class="us-history-tip">В карточке словаря можно добавить слово в избранное.</div>`;
    panel.classList.add('open');
  }

  function openScreen() {
    const el = screen();
    el.classList.add('open');
    document.body.classList.add('us-history-screen-open');
    if (loadedText) document.getElementById('usHistoryBody').innerHTML = renderArticle(loadedText);
    else loadArticle();
  }

  function closeScreen() {
    hideTranslation();
    const el = document.getElementById('usHistoryReadingScreen');
    if (el) el.classList.remove('open');
    document.body.classList.remove('us-history-screen-open');
  }

  function openMatchedWord(id) {
    const item = wordStore[id];
    const word = item && item.word ? item.word : item;
    if (!word) return;
    closeScreen();
    try { if (typeof switchTab === 'function') switchTab('dict'); } catch (_) {}
    setTimeout(() => {
      const input = document.getElementById('queryInput');
      if (input) input.value = word.ar || '';
      try { if (typeof handleDictionaryInput === 'function') handleDictionaryInput(); else if (typeof renderApp === 'function') renderApp(); } catch (_) {}
      setTimeout(() => {
        const first = document.querySelector('#list .item.collapsible');
        if (first) {
          first.classList.add('expanded');
          try { first.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { first.scrollIntoView(); }
        }
      }, 180);
    }, 30);
  }

  window.openUsHistoryReading = openScreen;
  window.closeUsHistoryReading = closeScreen;
  window.hideUsHistoryTranslation = hideTranslation;
  window.openUsHistoryMatchedWord = openMatchedWord;

  function install() {
    addStyles();
    patchHomeGuide();
    setTimeout(patchHomeGuide, 350);
    setTimeout(patchHomeGuide, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
