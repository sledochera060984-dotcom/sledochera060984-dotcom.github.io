(function () {
  if (window.__arabrusTtsEnhancerInstalled) return;
  window.__arabrusTtsEnhancerInstalled = true;

  var FONT_STEP_KEY = 'arabrus_font_size_step';
  var fontBarEl = null;
  var fontLabelEl = null;
  var fontMinusBtn = null;
  var fontPlusBtn = null;
  var currentFontStep = 0;

  function safeShowMsg(text) {
    try {
      if (typeof window.showMsg === 'function') {
        window.showMsg(text);
        return;
      }
    } catch (_) {}
    try {
      console.log(text);
    } catch (_) {}
  }

  function safeStopPlayback() {
    try {
      if (typeof window.stopTtsPlayback === 'function') {
        window.stopTtsPlayback();
        return;
      }
    } catch (_) {}

    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch (_) {}
  }

  function safeUnlockTts() {
    try {
      if (typeof window.unlockTts === 'function') window.unlockTts();
    } catch (_) {}

    try {
      if ('speechSynthesis' in window) window.speechSynthesis.resume();
    } catch (_) {}
  }

  function canUsePremium() {
    try {
      if (typeof window.canUsePremiumFeatures === 'function') {
        return !!window.canUsePremiumFeatures();
      }
    } catch (_) {}
    return true;
  }

  function askPremium() {
    try {
      if (typeof window.showActivationPrompt === 'function') {
        window.showActivationPrompt();
      }
    } catch (_) {}
  }

  function getVoices() {
    try {
      if (!('speechSynthesis' in window)) return [];
      return window.speechSynthesis.getVoices() || [];
    } catch (_) {
      return [];
    }
  }

  function pickArabicVoice() {
    var voices = getVoices();
    if (!voices.length) return null;

    return (
      voices.find(function (v) { return /^ar(-|$)/i.test(v.lang || '') && /google|arabic|العربية/i.test(v.name || ''); }) ||
      voices.find(function (v) { return /^ar(-|$)/i.test(v.lang || ''); }) ||
      voices.find(function (v) { return /arabic|العربية/i.test(v.name || ''); }) ||
      null
    );
  }

  function speakAttempt(text, options) {
    return new Promise(function (resolve) {
      var started = false;
      var finished = false;
      var utterance;
      var timeoutId;

      function done(result) {
        if (finished) return;
        finished = true;
        try { clearTimeout(timeoutId); } catch (_) {}
        resolve(result);
      }

      try {
        utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options.lang;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        if (options.voice) utterance.voice = options.voice;
      } catch (_) {
        done({ ok: false, reason: 'create' });
        return;
      }

      utterance.onstart = function () {
        started = true;
        done({ ok: true });
      };

      utterance.onerror = function () {
        done({ ok: false, reason: 'error' });
      };

      utterance.onend = function () {
        if (!started) done({ ok: false, reason: 'end-without-start' });
      };

      timeoutId = setTimeout(function () {
        if (!started) {
          try { window.speechSynthesis.cancel(); } catch (_) {}
          done({ ok: false, reason: 'timeout' });
        }
      }, options.timeout || 1800);

      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (_) {
        done({ ok: false, reason: 'speak' });
      }
    });
  }

  async function patchedSpeak(text, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();

    if (!canUsePremium()) {
      askPremium();
      return;
    }

    var cleanText = String(text || '').trim();
    if (!cleanText) {
      safeShowMsg('Нет текста для озвучки');
      return;
    }

    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
      safeShowMsg('Озвучка недоступна на этом устройстве');
      return;
    }

    safeUnlockTts();
    safeStopPlayback();

    var voice = pickArabicVoice();

    var firstTry = await speakAttempt(cleanText, {
      lang: 'ar-SA',
      voice: voice,
      timeout: 1800
    });

    if (firstTry.ok) return;

    try { window.speechSynthesis.getVoices(); } catch (_) {}
    await new Promise(function (resolve) { setTimeout(resolve, 350); });

    voice = pickArabicVoice();

    var secondTry = await speakAttempt(cleanText, {
      lang: 'ar',
      voice: voice,
      timeout: 1800
    });

    if (secondTry.ok) return;

    safeShowMsg('Озвучка недоступна на этом устройстве');
  }

  function clampFontStep(step) {
    var value = Number(step);
    if (!Number.isFinite(value)) value = 0;
    if (value < 0) value = 0;
    if (value > 2) value = 2;
    return Math.round(value);
  }

  function getFontStepLabel(step) {
    if (step === 1) return 'Крупный';
    if (step === 2) return 'Очень крупный';
    return 'Обычный';
  }

  function readFontStep() {
    try {
      return clampFontStep(localStorage.getItem(FONT_STEP_KEY));
    } catch (_) {
      return 0;
    }
  }

  function saveFontStep(step) {
    try {
      localStorage.setItem(FONT_STEP_KEY, String(step));
    } catch (_) {}
  }

  function injectEnhancerStyles() {
    if (document.getElementById('arabrusEnhancerStyle')) return;

    var style = document.createElement('style');
    style.id = 'arabrusEnhancerStyle';
    style.textContent = '' +
      '.font-access-bar{display:none;margin:0 0 10px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 4px 16px rgba(15,23,42,.04)}' +
      '.font-access-bar.show{display:block}' +
      '.font-access-title{font-size:12px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#64748b;margin-bottom:8px}' +
      '.font-access-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}' +
      '.font-access-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
      '.font-access-actions .btn{min-width:56px;padding:10px 12px}' +
      '.font-access-label{min-width:110px;text-align:center;font-size:14px;font-weight:800;color:#334155}' +
      '.font-access-hint{font-size:13px;line-height:1.45;color:#475569;flex:1;min-width:180px}' +
      '.font-access-actions .btn[disabled]{opacity:.45;cursor:default}' +
      'body.dict-searching #fontAccessBar{display:none !important}' +
      '@media (max-width:560px){.font-access-row{flex-direction:column;align-items:stretch}.font-access-actions{justify-content:space-between}.font-access-label{min-width:0;flex:1;text-align:center}}' +
      'body.arabrus-font-step-1 .search,body.arabrus-font-step-1 .field,body.arabrus-font-step-1 textarea{font-size:18px !important}' +
      'body.arabrus-font-step-2 .search,body.arabrus-font-step-2 .field,body.arabrus-font-step-2 textarea{font-size:20px !important}' +
      'body.arabrus-font-step-1 .btn,body.arabrus-font-step-1 .auth-btn,body.arabrus-font-step-1 .tab,body.arabrus-font-step-1 .chip{font-size:15px !important}' +
      'body.arabrus-font-step-2 .btn,body.arabrus-font-step-2 .auth-btn,body.arabrus-font-step-2 .tab,body.arabrus-font-step-2 .chip{font-size:16px !important}' +
      'body.arabrus-font-step-1 .ru,body.arabrus-font-step-1 .full-translation,body.arabrus-font-step-1 .full-translation-fav,body.arabrus-font-step-1 .support-box-text,body.arabrus-font-step-1 .home-guide-item,body.arabrus-font-step-1 .section-note,body.arabrus-font-step-1 .reading-placeholder,body.arabrus-font-step-1 .reading-translation-text{font-size:17px !important;line-height:1.6 !important}' +
      'body.arabrus-font-step-2 .ru,body.arabrus-font-step-2 .full-translation,body.arabrus-font-step-2 .full-translation-fav,body.arabrus-font-step-2 .support-box-text,body.arabrus-font-step-2 .home-guide-item,body.arabrus-font-step-2 .section-note,body.arabrus-font-step-2 .reading-placeholder,body.arabrus-font-step-2 .reading-translation-text{font-size:19px !important;line-height:1.65 !important}' +
      'body.arabrus-font-step-1 .ar{font-size:32px !important;line-height:1.3 !important}' +
      'body.arabrus-font-step-2 .ar{font-size:36px !important;line-height:1.32 !important}' +
      'body.arabrus-font-step-1 .hint,body.arabrus-font-step-1 .home-guide-title,body.arabrus-font-step-1 .support-box-title,body.arabrus-font-step-1 .reading-preview-label,body.arabrus-font-step-1 .reading-preview-hint{font-size:14px !important;line-height:1.45 !important}' +
      'body.arabrus-font-step-2 .hint,body.arabrus-font-step-2 .home-guide-title,body.arabrus-font-step-2 .support-box-title,body.arabrus-font-step-2 .reading-preview-label,body.arabrus-font-step-2 .reading-preview-hint{font-size:15px !important;line-height:1.5 !important}' +
      'body.arabrus-font-step-1 .verb-box,body.arabrus-font-step-1 .reading-tab,body.arabrus-font-step-1 .reading-line{font-size:16px !important}' +
      'body.arabrus-font-step-2 .verb-box,body.arabrus-font-step-2 .reading-tab,body.arabrus-font-step-2 .reading-line{font-size:17px !important}' +
      'body.arabrus-font-step-1 .verb-box span,body.arabrus-font-step-1 .reading-ar,body.arabrus-font-step-1 .reading-preview-line{font-size:28px !important}' +
      'body.arabrus-font-step-2 .verb-box span,body.arabrus-font-step-2 .reading-ar,body.arabrus-font-step-2 .reading-preview-line{font-size:32px !important}' +
      'body.arabrus-font-step-1 .card-front-text{font-size:17px !important;line-height:1.45 !important}' +
      'body.arabrus-font-step-2 .card-front-text{font-size:19px !important;line-height:1.5 !important}' +
      'body.arabrus-font-step-1 .card-front-ar,body.arabrus-font-step-1 .card-back .ar{font-size:34px !important;line-height:1.25 !important}' +
      'body.arabrus-font-step-2 .card-front-ar,body.arabrus-font-step-2 .card-back .ar{font-size:38px !important;line-height:1.28 !important}';
    document.head.appendChild(style);
  }

  function ensureFontControls() {
    injectEnhancerStyles();
    if (fontBarEl) return;

    var dictSection = document.getElementById('dictSection');
    if (!dictSection || !dictSection.parentNode) return;

    fontBarEl = document.createElement('div');
    fontBarEl.id = 'fontAccessBar';
    fontBarEl.className = 'font-access-bar';
    fontBarEl.innerHTML = '' +
      '<div class="font-access-title">Размер текста</div>' +
      '<div class="font-access-row">' +
      '  <div class="font-access-actions">' +
      '    <button type="button" id="fontAccessMinus" class="btn">A−</button>' +
      '    <div id="fontAccessLabel" class="font-access-label">Обычный</div>' +
      '    <button type="button" id="fontAccessPlus" class="btn primary">A+</button>' +
      '  </div>' +
      '  <div class="font-access-hint">Можно увеличить шрифт для удобного чтения.</div>' +
      '</div>';

    dictSection.insertAdjacentElement('afterend', fontBarEl);

    fontLabelEl = document.getElementById('fontAccessLabel');
    fontMinusBtn = document.getElementById('fontAccessMinus');
    fontPlusBtn = document.getElementById('fontAccessPlus');

    if (fontMinusBtn) {
      fontMinusBtn.addEventListener('click', function () {
        setFontStep(currentFontStep - 1, true);
      });
    }

    if (fontPlusBtn) {
      fontPlusBtn.addEventListener('click', function () {
        setFontStep(currentFontStep + 1, true);
      });
    }
  }

  function updateFontUi() {
    if (fontLabelEl) fontLabelEl.textContent = getFontStepLabel(currentFontStep);
    if (fontMinusBtn) fontMinusBtn.disabled = currentFontStep <= 0;
    if (fontPlusBtn) fontPlusBtn.disabled = currentFontStep >= 2;
  }

  function applyFontStep(step) {
    currentFontStep = clampFontStep(step);
    document.body.classList.remove('arabrus-font-step-0', 'arabrus-font-step-1', 'arabrus-font-step-2');
    document.body.classList.add('arabrus-font-step-' + currentFontStep);
    updateFontUi();
  }

  function setFontStep(step, notify) {
    var nextStep = clampFontStep(step);
    if (nextStep === currentFontStep) return;
    applyFontStep(nextStep);
    saveFontStep(nextStep);
    if (notify) safeShowMsg('Размер текста: ' + getFontStepLabel(nextStep));
  }

  function updateFontBarVisibility() {
    ensureFontControls();
    if (!fontBarEl) return;

    var activeTab = '';
    try { activeTab = String(window.activeTab || ''); } catch (_) { activeTab = ''; }
    var query = '';
    try { query = String((document.getElementById('queryInput') || {}).value || '').trim(); } catch (_) { query = ''; }

    var shouldShow = activeTab === 'dict' && !query;
    fontBarEl.classList.toggle('show', shouldShow);
  }

  function installFontAccessibility() {
    ensureFontControls();
    applyFontStep(readFontStep());
    updateFontBarVisibility();

    var originalRenderApp = typeof window.renderApp === 'function' ? window.renderApp : null;
    if (originalRenderApp && !window.__arabrusFontRenderWrapped) {
      window.__arabrusFontRenderWrapped = true;
      window.renderApp = function () {
        var result = originalRenderApp.apply(this, arguments);
        updateFontBarVisibility();
        return result;
      };
    }

    var originalHandleDictionaryInput = typeof window.handleDictionaryInput === 'function' ? window.handleDictionaryInput : null;
    if (originalHandleDictionaryInput && !window.__arabrusFontInputWrapped) {
      window.__arabrusFontInputWrapped = true;
      window.handleDictionaryInput = function () {
        var result = originalHandleDictionaryInput.apply(this, arguments);
        updateFontBarVisibility();
        return result;
      };
    }
  }

  function install() {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = function () {
          try { window.speechSynthesis.getVoices(); } catch (_) {}
        };
      }
    } catch (_) {}

    window.playGoogleTtsFallback = function () {
      safeShowMsg('Озвучка недоступна на этом устройстве');
    };

    window.speak = patchedSpeak;
    installFontAccessibility();
  }

  document.addEventListener('click', safeUnlockTts, { passive: true });
  document.addEventListener('touchstart', safeUnlockTts, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();