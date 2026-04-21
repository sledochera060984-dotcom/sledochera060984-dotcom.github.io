(function () {
  if (window.__arabrusTtsEnhancerInstalled) return;
  window.__arabrusTtsEnhancerInstalled = true;

  var FONT_STEP_KEY = 'arabrus_font_size_step';
  var LOCAL_USER_KEY = 'arabrus_cached_user_v1';
  var LOCAL_STATE_KEY = 'arabrus_cached_state_v1';
  var LOCAL_QUEUE_KEY = 'arabrus_pending_ops_v1';
  var fontBarEl = null;
  var fontLabelEl = null;
  var fontMinusBtn = null;
  var fontPlusBtn = null;
  var currentFontStep = 0;
  var localStateSaveTimer = null;
  var flushTimer = null;
  var flushInProgress = false;
  var manualSignOutInProgress = false;

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
      if (typeof window.canUsePremiumFeatures === 'function') return !!window.canUsePremiumFeatures();
    } catch (_) {}
    return true;
  }

  function askPremium() {
    try {
      if (typeof window.showActivationPrompt === 'function') window.showActivationPrompt();
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
      utterance.onstart = function () { started = true; done({ ok: true }); };
      utterance.onerror = function () { done({ ok: false, reason: 'error' }); };
      utterance.onend = function () { if (!started) done({ ok: false, reason: 'end-without-start' }); };
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
    if (!canUsePremium()) { askPremium(); return; }
    var cleanText = String(text || '').trim();
    if (!cleanText) { safeShowMsg('Нет текста для озвучки'); return; }
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
      safeShowMsg('Озвучка недоступна на этом устройстве');
      return;
    }
    safeUnlockTts();
    safeStopPlayback();
    var voice = pickArabicVoice();
    var firstTry = await speakAttempt(cleanText, { lang: 'ar-SA', voice: voice, timeout: 1800 });
    if (firstTry.ok) return;
    try { window.speechSynthesis.getVoices(); } catch (_) {}
    await new Promise(function (resolve) { setTimeout(resolve, 350); });
    voice = pickArabicVoice();
    var secondTry = await speakAttempt(cleanText, { lang: 'ar', voice: voice, timeout: 1800 });
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
  function getFontStepLabel(step) { return step === 1 ? 'Крупный' : step === 2 ? 'Очень крупный' : 'Обычный'; }
  function readFontStep() {
    try { return clampFontStep(localStorage.getItem(FONT_STEP_KEY)); } catch (_) { return 0; }
  }
  function saveFontStep(step) {
    try { localStorage.setItem(FONT_STEP_KEY, String(step)); } catch (_) {}
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
    if (fontMinusBtn) fontMinusBtn.addEventListener('click', function () { setFontStep(currentFontStep - 1, true); });
    if (fontPlusBtn) fontPlusBtn.addEventListener('click', function () { setFontStep(currentFontStep + 1, true); });
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
  function isDictionaryHomeVisible() {
    var dictTab = document.getElementById('tabDict');
    var dictSection = document.getElementById('dictSection');
    var queryInput = document.getElementById('queryInput');
    var query = String((queryInput || {}).value || '').trim();
    var dictTabActive = !!(dictTab && dictTab.classList.contains('active'));
    var dictSectionVisible = !!(dictSection && dictSection.style.display !== 'none');
    return dictTabActive && dictSectionVisible && !query;
  }
  function updateFontBarVisibility() {
    ensureFontControls();
    if (!fontBarEl) return;
    fontBarEl.classList.toggle('show', isDictionaryHomeVisible());
  }

  function readJson(key, fallbackValue) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallbackValue;
      return JSON.parse(raw);
    } catch (_) { return fallbackValue; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function removeStorageKey(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }
  function normalizeCachedUser(userLike) {
    if (!userLike || !userLike.uid) return null;
    return {
      uid: String(userLike.uid || ''),
      email: userLike.email || '',
      displayName: userLike.displayName || '',
      metadata: { creationTime: userLike.metadata && userLike.metadata.creationTime ? userLike.metadata.creationTime : '' }
    };
  }
  function cacheCurrentUser() {
    try { if (user && user.uid) writeJson(LOCAL_USER_KEY, normalizeCachedUser(user)); } catch (_) {}
  }
  function getPendingOps() {
    var ops = readJson(LOCAL_QUEUE_KEY, []);
    return Array.isArray(ops) ? ops : [];
  }
  function setPendingOps(ops) {
    writeJson(LOCAL_QUEUE_KEY, Array.isArray(ops) ? ops : []);
    syncPendingFlags();
  }
  function hasPendingFavoriteOps() {
    return getPendingOps().some(function (op) { return op && op.kind === 'favorite'; });
  }
  function syncPendingFlags() {
    try { favSnapshotPending = hasPendingFavoriteOps(); } catch (_) {}
    try { if (typeof updateSyncIndicator === 'function') updateSyncIndicator(); } catch (_) {}
  }
  function saveLocalStateNow() {
    try {
      if (!user || !user.uid) return;
      cacheCurrentUser();
      writeJson(LOCAL_STATE_KEY, {
        favorites: Array.isArray(favorites) ? favorites : [],
        notes: Array.isArray(notes) ? notes : [],
        access: userAccess || { premiumActive: false, premiumUntilMs: 0 },
        savedAt: Date.now()
      });
    } catch (_) {}
  }
  function scheduleLocalStateSave() {
    clearTimeout(localStateSaveTimer);
    localStateSaveTimer = setTimeout(saveLocalStateNow, 180);
  }
  function clearLocalSessionCache() {
    removeStorageKey(LOCAL_USER_KEY);
    removeStorageKey(LOCAL_STATE_KEY);
    removeStorageKey(LOCAL_QUEUE_KEY);
  }
  function syncAuthUiForCurrentUser() {
    try {
      var btn = document.getElementById('authBtn');
      var userLine = document.getElementById('userLine');
      if (user) {
        if (btn) btn.innerText = 'Выйти (' + String((user.displayName || 'Пользователь').split(' ')[0] || 'Пользователь') + ')';
        if (userLine) userLine.innerText = user.email || user.uid;
      } else {
        if (btn) btn.innerText = '🌐 Войти через Google';
        if (userLine) userLine.innerText = typeof firebaseReady !== 'undefined' && firebaseReady ? 'Не выполнен вход' : 'Офлайн-режим';
      }
    } catch (_) {}
  }
  function restoreCachedSession() {
    if (manualSignOutInProgress) return false;
    try { if (user && user.uid) return false; } catch (_) {}
    var cachedUser = normalizeCachedUser(readJson(LOCAL_USER_KEY, null));
    if (!cachedUser) return false;
    var state = readJson(LOCAL_STATE_KEY, {});
    try { if (typeof stopListeners === 'function') stopListeners(); } catch (_) {}
    user = cachedUser;
    favorites = Array.isArray(state.favorites) ? state.favorites : [];
    notes = Array.isArray(state.notes) ? state.notes : [];
    userAccess = state && state.access ? state.access : { premiumActive: false, premiumUntilMs: 0 };
    syncAuthUiForCurrentUser();
    syncPendingFlags();
    try { updateSyncIndicator(); } catch (_) {}
    try { updateTrialIndicator(); } catch (_) {}
    try { updateCompactLoginUi(); } catch (_) {}
    try { renderApp(); } catch (_) {}
    return true;
  }
  function canWriteCloud() {
    try {
      return !!(user && user.uid && navigator.onLine && typeof firebaseReady !== 'undefined' && firebaseReady && typeof db !== 'undefined' && db && !db.__offlineStub && typeof firebase !== 'undefined' && firebase && firebase.firestore && firebase.firestore.FieldValue);
    } catch (_) { return false; }
  }
  function addPendingFavoriteSet(id, payload) {
    var ops = getPendingOps().filter(function (op) { return !(op && op.kind === 'favorite' && op.id === id); });
    ops.push({ kind: 'favorite', type: 'set', id: id, payload: payload, ts: Date.now() });
    setPendingOps(ops);
  }
  function addPendingFavoriteDelete(id) {
    var ops = getPendingOps().filter(function (op) { return !(op && op.kind === 'favorite' && op.id === id); });
    ops.push({ kind: 'favorite', type: 'delete', id: id, ts: Date.now() });
    setPendingOps(ops);
  }
  function replaceFavoriteLocally(id, payload) {
    var next = Array.isArray(favorites) ? favorites.slice() : [];
    var index = next.findIndex(function (item) { return item && item.id === id; });
    var merged = Object.assign({ id: id }, index >= 0 ? (next[index] || {}) : {}, payload || {});
    if (index >= 0) next[index] = merged; else next.unshift(merged);
    favorites = next;
    scheduleLocalStateSave();
    syncPendingFlags();
    try { renderApp(); } catch (_) {}
  }
  function deleteFavoriteLocally(id) {
    favorites = (Array.isArray(favorites) ? favorites : []).filter(function (item) { return !item || item.id !== id; });
    scheduleLocalStateSave();
    syncPendingFlags();
    try { renderApp(); } catch (_) {}
  }
  function makeCloudTimestamp() {
    try { if (typeof firebase !== 'undefined' && firebase && firebase.firestore && firebase.firestore.FieldValue) return firebase.firestore.FieldValue.serverTimestamp(); } catch (_) {}
    return Date.now();
  }
  async function saveFavoriteToCloud(id, payload) {
    await db.collection('users').doc(user.uid).collection('favorites').doc(id).set(Object.assign({}, payload, { updatedAt: makeCloudTimestamp() }), { merge: true });
  }
  async function deleteFavoriteFromCloud(id) {
    await db.collection('users').doc(user.uid).collection('favorites').doc(id).delete();
  }
  function schedulePendingFlush(delayMs) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(function () { flushPendingOps(); }, typeof delayMs === 'number' ? delayMs : 650);
  }
  async function flushPendingOps() {
    if (flushInProgress || !canWriteCloud()) { syncPendingFlags(); return false; }
    var ops = getPendingOps();
    if (!ops.length) { syncPendingFlags(); scheduleLocalStateSave(); return true; }
    flushInProgress = true;
    try {
      while (ops.length) {
        var op = ops[0];
        if (op && op.kind === 'favorite') {
          if (op.type === 'set') await saveFavoriteToCloud(op.id, op.payload || {});
          else if (op.type === 'delete') await deleteFavoriteFromCloud(op.id);
        }
        ops.shift();
        setPendingOps(ops);
      }
      scheduleLocalStateSave();
      syncPendingFlags();
      return true;
    } catch (error) {
      console.error('Pending sync error:', error);
      syncPendingFlags();
      return false;
    } finally {
      flushInProgress = false;
    }
  }
  async function upsertFavoriteWithFallback(id, payload, successText, closeModalFn) {
    if (canWriteCloud()) {
      try {
        await saveFavoriteToCloud(id, payload);
        if (typeof closeModalFn === 'function') closeModalFn();
        scheduleLocalStateSave();
        safeShowMsg(successText);
        return;
      } catch (error) {
        console.error('Cloud favorite save error:', error);
      }
    }
    replaceFavoriteLocally(id, payload);
    addPendingFavoriteSet(id, payload);
    if (typeof closeModalFn === 'function') closeModalFn();
    safeShowMsg(successText + ' · синхронизируется при сети');
  }
  async function deleteFavoriteWithFallback(id, successText) {
    if (canWriteCloud()) {
      try {
        await deleteFavoriteFromCloud(id);
        scheduleLocalStateSave();
        safeShowMsg(successText);
        return;
      } catch (error) {
        console.error('Cloud favorite delete error:', error);
      }
    }
    deleteFavoriteLocally(id);
    addPendingFavoriteDelete(id);
    safeShowMsg(successText + ' · синхронизируется при сети');
  }

  function installOfflineSessionAndSync() {
    var originalApplyAuthState = typeof applyAuthState === 'function' ? applyAuthState : null;
    if (originalApplyAuthState && !window.__arabrusApplyAuthStateWrapped) {
      window.__arabrusApplyAuthStateWrapped = true;
      applyAuthState = function (u) {
        if (u && u.uid) {
          manualSignOutInProgress = false;
          var resultWithUser = originalApplyAuthState.apply(this, arguments);
          cacheCurrentUser();
          scheduleLocalStateSave();
          schedulePendingFlush(900);
          return resultWithUser;
        }
        if (!manualSignOutInProgress) {
          var restored = restoreCachedSession();
          if (restored) {
            schedulePendingFlush(1200);
            return;
          }
        }
        var resultWithoutUser = originalApplyAuthState.apply(this, arguments);
        if (manualSignOutInProgress) {
          clearLocalSessionCache();
          manualSignOutInProgress = false;
          syncPendingFlags();
        }
        return resultWithoutUser;
      };
    }

    var originalToggleAuth = typeof toggleAuth === 'function' ? toggleAuth : null;
    if (originalToggleAuth && !window.__arabrusToggleAuthWrapped) {
      window.__arabrusToggleAuthWrapped = true;
      toggleAuth = async function () {
        if (user && user.uid) {
          manualSignOutInProgress = true;
          try { if (typeof auth !== 'undefined' && auth && typeof auth.signOut === 'function') await auth.signOut(); } catch (error) { console.error('Sign out error:', error); }
          try { if (typeof stopListeners === 'function') stopListeners(); } catch (_) {}
          user = null;
          favorites = [];
          notes = [];
          userAccess = { premiumActive: false, premiumUntilMs: 0 };
          clearLocalSessionCache();
          syncAuthUiForCurrentUser();
          syncPendingFlags();
          try { updateSyncIndicator(); } catch (_) {}
          try { updateTrialIndicator(); } catch (_) {}
          try { updateCompactLoginUi(); } catch (_) {}
          try { renderApp(); } catch (_) {}
          manualSignOutInProgress = false;
          return;
        }
        return originalToggleAuth.apply(this, arguments);
      };
    }

    var originalConfirmFavModal = typeof confirmFavModal === 'function' ? confirmFavModal : null;
    if (originalConfirmFavModal && !window.__arabrusConfirmFavModalWrapped) {
      window.__arabrusConfirmFavModalWrapped = true;
      confirmFavModal = async function () {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (!canUsePremium()) { askPremium(); return; }
        if (!favModalWord) return;
        var w = favModalWord;
        var id = makeFavId(w.ar, w.ru);
        var customRu = String(((document.getElementById('favModalRu') || {}).value) || '').trim() || w.short_ru || String(w.ru || '').split(';')[0];
        var existing = typeof getFavoriteByWord === 'function' ? getFavoriteByWord(w) : null;
        var payload = {
          ar: w.ar,
          ruSource: w.ru,
          customRu: customRu,
          collection: existing && existing.collection ? existing.collection : '',
          markColor: existing && existing.markColor ? existing.markColor : '',
          ts: existing && existing.ts ? existing.ts : Date.now()
        };
        await upsertFavoriteWithFallback(id, payload, existing ? 'Перевод обновлён' : 'Добавлено в избранное', typeof closeFavModal === 'function' ? closeFavModal : null);
      };
    }

    var originalToggleFavoriteDirect = typeof toggleFavoriteDirect === 'function' ? toggleFavoriteDirect : null;
    if (originalToggleFavoriteDirect && !window.__arabrusToggleFavoriteDirectWrapped) {
      window.__arabrusToggleFavoriteDirectWrapped = true;
      toggleFavoriteDirect = async function (idx) {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (!canUsePremium()) { askPremium(); return; }
        var w = currentRenderedWords && currentRenderedWords[idx];
        if (!w) return;
        var existing = typeof getFavoriteByWord === 'function' ? getFavoriteByWord(w) : null;
        if (existing) {
          await deleteFavoriteWithFallback(existing.id, 'Удалено из избранного');
          return;
        }
        if (typeof openFavModal === 'function') openFavModal(idx);
      };
    }

    var originalConfirmMarkColor = typeof confirmMarkColor === 'function' ? confirmMarkColor : null;
    if (originalConfirmMarkColor && !window.__arabrusConfirmMarkColorWrapped) {
      window.__arabrusConfirmMarkColorWrapped = true;
      confirmMarkColor = async function (color) {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (!canUsePremium()) { askPremium(); return; }
        if (!currentColorFavoriteId) { if (typeof closeMarkColorModal === 'function') closeMarkColorModal(); return; }
        var current = (Array.isArray(favorites) ? favorites : []).find(function (item) { return item && item.id === currentColorFavoriteId; });
        if (!current) { if (typeof closeMarkColorModal === 'function') closeMarkColorModal(); return; }
        var payload = Object.assign({}, current, { markColor: color || '' });
        delete payload.id;
        await upsertFavoriteWithFallback(currentColorFavoriteId, payload, color === 'blue' ? 'Помечено синим' : color === 'red' ? 'Помечено красным' : 'Цвет убран', typeof closeMarkColorModal === 'function' ? closeMarkColorModal : null);
      };
    }

    var originalRemoveFavorite = typeof removeFavorite === 'function' ? removeFavorite : null;
    if (originalRemoveFavorite && !window.__arabrusRemoveFavoriteWrapped) {
      window.__arabrusRemoveFavoriteWrapped = true;
      removeFavorite = async function (id) {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (!canUsePremium()) { askPremium(); return; }
        await deleteFavoriteWithFallback(id, 'Удалено из избранного');
      };
    }

    var originalRemoveFavoriteFromFolder = typeof removeFavoriteFromFolder === 'function' ? removeFavoriteFromFolder : null;
    if (originalRemoveFavoriteFromFolder && !window.__arabrusRemoveFavoriteFromFolderWrapped) {
      window.__arabrusRemoveFavoriteFromFolderWrapped = true;
      removeFavoriteFromFolder = async function (id) {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (!canUsePremium()) { askPremium(); return; }
        var current = (Array.isArray(favorites) ? favorites : []).find(function (item) { return item && item.id === id; });
        if (!current) return;
        var payload = Object.assign({}, current, { collection: '' });
        delete payload.id;
        await upsertFavoriteWithFallback(id, payload, 'Убрано из папки', null);
      };
    }

    var originalApplyBulkFolder = typeof applyBulkFolder === 'function' ? applyBulkFolder : null;
    if (originalApplyBulkFolder && !window.__arabrusApplyBulkFolderWrapped) {
      window.__arabrusApplyBulkFolderWrapped = true;
      applyBulkFolder = async function () {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (!canUsePremium()) { askPremium(); return; }
        var ids = Array.from(selectedFavoriteIds || []);
        if (!ids.length) { safeShowMsg('Сначала выберите слова'); return; }
        var existing = String(((document.getElementById('bulkFolderSelect') || {}).value) || '').trim();
        var typed = String(((document.getElementById('bulkFolderInput') || {}).value) || '').trim();
        var folder = typed || existing;
        if (!folder) { safeShowMsg('Выберите или введите папку'); return; }
        if (canWriteCloud()) return originalApplyBulkFolder.apply(this, arguments);
        ids.forEach(function (id) {
          var current = (Array.isArray(favorites) ? favorites : []).find(function (item) { return item && item.id === id; });
          if (!current) return;
          var payload = Object.assign({}, current, { collection: folder });
          delete payload.id;
          replaceFavoriteLocally(id, payload);
          addPendingFavoriteSet(id, payload);
        });
        if (document.getElementById('bulkFolderInput')) document.getElementById('bulkFolderInput').value = '';
        if (document.getElementById('bulkFolderSelect')) document.getElementById('bulkFolderSelect').value = '';
        safeShowMsg('Папка сохранена · синхронизируется при сети');
        try { if (typeof toggleFavoriteSelectionMode === 'function') toggleFavoriteSelectionMode(false); } catch (_) {}
      };
    }

    var originalRemoveSelectedFavoritesFromFolder = typeof removeSelectedFavoritesFromFolder === 'function' ? removeSelectedFavoritesFromFolder : null;
    if (originalRemoveSelectedFavoritesFromFolder && !window.__arabrusRemoveSelectedFavoritesWrapped) {
      window.__arabrusRemoveSelectedFavoritesWrapped = true;
      removeSelectedFavoritesFromFolder = async function () {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (!canUsePremium()) { askPremium(); return; }
        var ids = Array.from(selectedFavoriteIds || []);
        if (!ids.length) { safeShowMsg('Сначала выберите слова'); return; }
        if (canWriteCloud()) return originalRemoveSelectedFavoritesFromFolder.apply(this, arguments);
        ids.forEach(function (id) {
          var current = (Array.isArray(favorites) ? favorites : []).find(function (item) { return item && item.id === id; });
          if (!current) return;
          var payload = Object.assign({}, current, { collection: '' });
          delete payload.id;
          replaceFavoriteLocally(id, payload);
          addPendingFavoriteSet(id, payload);
        });
        safeShowMsg('Убрано из папки · синхронизируется при сети');
        try { if (typeof toggleFavoriteSelectionMode === 'function') toggleFavoriteSelectionMode(false); } catch (_) {}
      };
    }

    var originalDeleteSelectedFavorites = typeof deleteSelectedFavorites === 'function' ? deleteSelectedFavorites : null;
    if (originalDeleteSelectedFavorites && !window.__arabrusDeleteSelectedFavoritesWrapped) {
      window.__arabrusDeleteSelectedFavoritesWrapped = true;
      deleteSelectedFavorites = async function () {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (!canUsePremium()) { askPremium(); return; }
        var ids = Array.from(selectedFavoriteIds || []);
        if (!ids.length) { safeShowMsg('Сначала выберите слова'); return; }
        if (canWriteCloud()) return originalDeleteSelectedFavorites.apply(this, arguments);
        ids.forEach(function (id) { deleteFavoriteLocally(id); addPendingFavoriteDelete(id); });
        safeShowMsg('Удалено · синхронизируется при сети');
        try { if (typeof toggleFavoriteSelectionMode === 'function') toggleFavoriteSelectionMode(false); } catch (_) {}
      };
    }

    var originalConfirmFolderModal = typeof confirmFolderModal === 'function' ? confirmFolderModal : null;
    if (originalConfirmFolderModal && !window.__arabrusConfirmFolderModalWrapped) {
      window.__arabrusConfirmFolderModalWrapped = true;
      confirmFolderModal = async function () {
        if (folderModalMode !== 'fav') return originalConfirmFolderModal.apply(this, arguments);
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (!canUsePremium()) { askPremium(); return; }
        var selected = String(((document.getElementById('singleFolderSelect') || {}).value) || '').trim();
        var typed = String(((document.getElementById('folderInput') || {}).value) || '').trim();
        var value = typed || selected;
        if (!folderModalTargetId) { if (typeof closeFolderModal === 'function') closeFolderModal(); return; }
        if (canWriteCloud()) return originalConfirmFolderModal.apply(this, arguments);
        var current = (Array.isArray(favorites) ? favorites : []).find(function (item) { return item && item.id === folderModalTargetId; });
        if (!current) { if (typeof closeFolderModal === 'function') closeFolderModal(); return; }
        var payload = Object.assign({}, current, { collection: value });
        delete payload.id;
        replaceFavoriteLocally(folderModalTargetId, payload);
        addPendingFavoriteSet(folderModalTargetId, payload);
        if (typeof closeFolderModal === 'function') closeFolderModal();
        safeShowMsg('Папка сохранена · синхронизируется при сети');
      };
    }

    window.addEventListener('online', function () {
      try { if (typeof loadFirebaseSdk === 'function') loadFirebaseSdk(); } catch (_) {}
      schedulePendingFlush(1200);
      scheduleLocalStateSave();
    });
    window.addEventListener('offline', function () {
      syncPendingFlags();
      scheduleLocalStateSave();
      restoreCachedSession();
    });
    window.addEventListener('beforeunload', saveLocalStateNow);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') saveLocalStateNow();
      else updateFontBarVisibility();
    });
    setInterval(function () {
      if (user && user.uid) saveLocalStateNow();
      if (navigator.onLine) schedulePendingFlush(200);
    }, 3000);
    setTimeout(function () {
      restoreCachedSession();
      syncPendingFlags();
      updateFontBarVisibility();
      schedulePendingFlush(1200);
    }, 120);
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
        scheduleLocalStateSave();
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
    window.addEventListener('pageshow', updateFontBarVisibility);
    window.addEventListener('load', updateFontBarVisibility);
    document.addEventListener('visibilitychange', updateFontBarVisibility);
    setTimeout(updateFontBarVisibility, 200);
    setTimeout(updateFontBarVisibility, 1000);
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
    window.playGoogleTtsFallback = function () { safeShowMsg('Озвучка недоступна на этом устройстве'); };
    window.speak = patchedSpeak;
    installFontAccessibility();
    installOfflineSessionAndSync();
  }

  document.addEventListener('click', safeUnlockTts, { passive: true });
  document.addEventListener('touchstart', safeUnlockTts, { passive: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();