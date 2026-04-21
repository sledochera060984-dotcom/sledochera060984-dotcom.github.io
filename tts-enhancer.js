(function () {
  if (window.__arabrusTtsEnhancerInstalled) return;
  window.__arabrusTtsEnhancerInstalled = true;

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
  }

  document.addEventListener('click', safeUnlockTts, { passive: true });
  document.addEventListener('touchstart', safeUnlockTts, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();