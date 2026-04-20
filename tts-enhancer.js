(function () {
  if (window.__arabrusTtsEnhancerInstalled) return;
  window.__arabrusTtsEnhancerInstalled = true;

  var lastText = '';
  var watchdogTimer = null;
  var bannerEl = null;
  var modalWrapEl = null;
  var modalTextEl = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function safeShowMsg(text) {
    try {
      if (typeof window.showMsg === 'function') window.showMsg(text);
    } catch (_) {}
  }

  function safeStopPlayback() {
    try {
      if (typeof window.stopTtsPlayback === 'function') {
        window.stopTtsPlayback();
        return;
      }
    } catch (_) {}
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }

  function safeUnlockTts() {
    try {
      if (typeof window.unlockTts === 'function') window.unlockTts();
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
      if (typeof window.showActivationPrompt === 'function') window.showActivationPrompt();
    } catch (_) {}
  }

  function getArabicVoice() {
    try {
      var voices = window.speechSynthesis.getVoices() || [];
      if (!voices.length) return null;
      return (
        voices.find(function (v) { return /^ar(-|$)/i.test(v.lang || '') && /google|arabic|العربية/i.test(v.name || ''); }) ||
        voices.find(function (v) { return /^ar(-|$)/i.test(v.lang || ''); }) ||
        voices.find(function (v) { return /arabic|العربية/i.test(v.name || ''); }) ||
        null
      );
    } catch (_) {
      return null;
    }
  }

  function injectStyles() {
    if (byId('ttsEnhancerStyle')) return;
    var style = document.createElement('style');
    style.id = 'ttsEnhancerStyle';
    style.textContent = '' +
      '.tts-help-banner{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:min(92vw,460px);background:#0f172a;color:#fff;border-radius:18px;padding:14px;box-shadow:0 16px 40px rgba(15,23,42,.28);z-index:10000;display:none}' +
      '.tts-help-banner.show{display:block}' +
      '.tts-help-title{font-size:15px;font-weight:800;margin-bottom:6px}' +
      '.tts-help-text{font-size:13px;line-height:1.45;color:#cbd5e1}' +
      '.tts-help-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}' +
      '.tts-help-btn{flex:1;min-width:120px;border:none;border-radius:12px;padding:10px 12px;font-size:13px;font-weight:800;cursor:pointer}' +
      '.tts-help-btn.primary{background:#27ae60;color:#fff}' +
      '.tts-help-btn.secondary{background:#fff;color:#0f172a}' +
      '.tts-help-btn.ghost{background:rgba(255,255,255,.14);color:#fff}' +
      '.tts-help-modal-wrap{position:fixed;inset:0;background:rgba(15,23,42,.56);display:none;align-items:center;justify-content:center;padding:18px;z-index:10001}' +
      '.tts-help-modal-wrap.show{display:flex}' +
      '.tts-help-modal{background:#fff;color:#0f172a;border-radius:22px;width:min(92vw,480px);padding:20px;box-shadow:0 20px 44px rgba(15,23,42,.22)}' +
      '.tts-help-modal h3{margin:0 0 10px;font-size:20px}' +
      '.tts-help-modal p{margin:0 0 8px;line-height:1.5;color:#334155;font-size:14px}' +
      '.tts-help-modal ol{margin:10px 0 0 18px;padding:0;color:#334155;font-size:14px;line-height:1.5}' +
      '.tts-help-modal li{margin:0 0 8px}' +
      '.tts-help-modal-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}' +
      '.tts-help-modal-actions .tts-help-btn{border:1px solid #e2e8f0}';
    document.head.appendChild(style);
  }

  function ensureUi() {
    injectStyles();
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.className = 'tts-help-banner';
      bannerEl.id = 'ttsHelpBanner';
      bannerEl.innerHTML = '' +
        '<div class="tts-help-title" id="ttsHelpBannerTitle">Озвучка не запустилась</div>' +
        '<div class="tts-help-text" id="ttsHelpBannerText">Нажми «Повторить». Если снова не сработает — открой подсказку.</div>' +
        '<div class="tts-help-actions">' +
        '  <button class="tts-help-btn primary" id="ttsHelpRetryBtn">Повторить</button>' +
        '  <button class="tts-help-btn secondary" id="ttsHelpGuideBtn">Что делать</button>' +
        '  <button class="tts-help-btn ghost" id="ttsHelpCloseBtn">Закрыть</button>' +
        '</div>';
      document.body.appendChild(bannerEl);
      byId('ttsHelpRetryBtn').addEventListener('click', function () {
        if (lastText) window.speak(lastText);
      });
      byId('ttsHelpGuideBtn').addEventListener('click', function () {
        openGuide();
      });
      byId('ttsHelpCloseBtn').addEventListener('click', function () {
        hideBanner();
      });
    }

    if (!modalWrapEl) {
      modalWrapEl = document.createElement('div');
      modalWrapEl.className = 'tts-help-modal-wrap';
      modalWrapEl.id = 'ttsHelpModalWrap';
      modalWrapEl.innerHTML = '' +
        '<div class="tts-help-modal">' +
        '  <h3>Если озвучка не запускается</h3>' +
        '  <p id="ttsHelpModalText">Проверь настройки системного синтеза речи на устройстве.</p>' +
        '  <ol>' +
        '    <li>Открой <b>Настройки Android → Синтез речи</b>.</li>' +
        '    <li>Выбери <b>Распознавание и синтез речи от Google</b>.</li>' +
        '    <li>Открой пункт <b>Язык</b> и выбери <b>арабский</b>.</li>' +
        '    <li>Если кнопка «Воспроизвести» неактивна, обнови <b>Speech Services by Google</b> и скачай арабский голос.</li>' +
        '    <li>Вернись в приложение и нажми <b>Повторить</b>.</li>' +
        '  </ol>' +
        '  <div class="tts-help-modal-actions">' +
        '    <button class="tts-help-btn primary" id="ttsHelpModalRetryBtn">Повторить слово</button>' +
        '    <button class="tts-help-btn secondary" id="ttsHelpSettingsBtn">Открыть настройки</button>' +
        '    <button class="tts-help-btn secondary" id="ttsHelpTestBtn">Проверить صوت</button>' +
        '    <button class="tts-help-btn ghost" id="ttsHelpModalCloseBtn">Закрыть</button>' +
        '  </div>' +
        '</div>';
      document.body.appendChild(modalWrapEl);
      modalTextEl = byId('ttsHelpModalText');
      byId('ttsHelpModalRetryBtn').addEventListener('click', function () {
        closeGuide();
        if (lastText) window.speak(lastText);
      });
      byId('ttsHelpSettingsBtn').addEventListener('click', function () {
        tryOpenTtsSettings();
      });
      byId('ttsHelpTestBtn').addEventListener('click', function () {
        closeGuide();
        window.speak('صوت');
      });
      byId('ttsHelpModalCloseBtn').addEventListener('click', function () {
        closeGuide();
      });
      modalWrapEl.addEventListener('click', function (event) {
        if (event.target === modalWrapEl) closeGuide();
      });
    }
  }

  function showBanner(title, text) {
    ensureUi();
    var titleEl = byId('ttsHelpBannerTitle');
    var textEl = byId('ttsHelpBannerText');
    if (titleEl) titleEl.textContent = title || 'Озвучка не запустилась';
    if (textEl) textEl.textContent = text || 'Нажми «Повторить». Если снова не сработает — открой подсказку.';
    bannerEl.classList.add('show');
  }

  function hideBanner() {
    if (bannerEl) bannerEl.classList.remove('show');
  }

  function openGuide(customText) {
    ensureUi();
    if (modalTextEl && customText) modalTextEl.textContent = customText;
    modalWrapEl.classList.add('show');
  }

  function closeGuide() {
    if (modalWrapEl) modalWrapEl.classList.remove('show');
  }

  function tryOpenTtsSettings() {
    var hidden = false;
    var cleanup = function () {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    var onVisibilityChange = function () {
      if (document.visibilityState === 'hidden') hidden = true;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    try {
      window.location.href = 'intent://settings#Intent;action=android.settings.TTS_SETTINGS;end';
    } catch (_) {}

    setTimeout(function () {
      cleanup();
      if (!hidden) {
        safeShowMsg('Открой: Настройки Android → Синтез речи → Язык → арабский');
      }
    }, 1200);
  }

  function handleFailure(reason) {
    clearTimeout(watchdogTimer);
    if (reason === 'no-voice') {
      safeShowMsg('Арабский голос не найден');
      showBanner('Арабский голос не найден', 'Открой подсказку и проверь системный TTS и язык арабский.');
      openGuide('На устройстве не найден арабский голос. Обычно помогает выбор языка арабский в системном синтезе речи и обновление Speech Services by Google.');
      return;
    }
    safeShowMsg('Озвучка не запустилась');
    showBanner('Озвучка не запустилась', 'Нажми «Повторить». Если не поможет — открой подсказку.');
  }

  function startSpeech(text, voice) {
    clearTimeout(watchdogTimer);
    var started = false;
    var finished = false;
    var utterance;

    try {
      utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice && voice.lang ? voice.lang : 'ar-SA';
      if (voice) utterance.voice = voice;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
    } catch (_) {
      handleFailure('create');
      return;
    }

    utterance.onstart = function () {
      started = true;
      hideBanner();
      clearTimeout(watchdogTimer);
    };

    utterance.onend = function () {
      finished = true;
      clearTimeout(watchdogTimer);
      hideBanner();
    };

    utterance.onerror = function () {
      finished = true;
      handleFailure('error');
    };

    watchdogTimer = setTimeout(function () {
      if (!started && !finished) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
        handleFailure('timeout');
      }
    }, 1800);

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (_) {
      handleFailure('speak');
    }
  }

  function patchedSpeak(text, event) {
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

    lastText = cleanText;
    hideBanner();
    closeGuide();
    safeUnlockTts();
    safeStopPlayback();

    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
      handleFailure('api');
      return;
    }

    var voice = getArabicVoice();
    if (voice) {
      startSpeech(cleanText, voice);
      return;
    }

    try { window.speechSynthesis.getVoices(); } catch (_) {}
    setTimeout(function () {
      var delayedVoice = getArabicVoice();
      if (!delayedVoice) {
        handleFailure('no-voice');
        return;
      }
      startSpeech(cleanText, delayedVoice);
    }, 350);
  }

  function install() {
    ensureUi();

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = function () {
          if (getArabicVoice()) hideBanner();
        };
      }
    } catch (_) {}

    window.playGoogleTtsFallback = function () {
      handleFailure('fallback');
    };

    window.speak = patchedSpeak;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();