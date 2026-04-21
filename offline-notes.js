(function () {
  if (window.__arabrusOfflineNotesInstalled) return;
  window.__arabrusOfflineNotesInstalled = true;

  var LOCAL_USER_KEY = 'arabrus_cached_user_v1';
  var LOCAL_STATE_KEY = 'arabrus_cached_state_v1';
  var NOTE_QUEUE_KEY = 'arabrus_pending_note_ops_v1';
  var saveTimer = null;
  var flushTimer = null;
  var flushInProgress = false;

  function safeShowMsg(text) {
    try {
      if (typeof window.showMsg === 'function') {
        window.showMsg(text);
        return;
      }
    } catch (_) {}
    try { console.log(text); } catch (_) {}
  }

  function readJson(key, fallbackValue) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallbackValue;
      return JSON.parse(raw);
    } catch (_) {
      return fallbackValue;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function normalizeCachedUser(userLike) {
    if (!userLike || !userLike.uid) return null;
    return {
      uid: String(userLike.uid || ''),
      email: userLike.email || '',
      displayName: userLike.displayName || '',
      metadata: {
        creationTime: userLike.metadata && userLike.metadata.creationTime ? userLike.metadata.creationTime : ''
      }
    };
  }

  function cacheCurrentUser() {
    try {
      if (user && user.uid) writeJson(LOCAL_USER_KEY, normalizeCachedUser(user));
    } catch (_) {}
  }

  function scheduleLocalStateSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
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
    }, 180);
  }

  function getNoteQueue() {
    var ops = readJson(NOTE_QUEUE_KEY, []);
    return Array.isArray(ops) ? ops : [];
  }

  function setNoteQueue(ops) {
    writeJson(NOTE_QUEUE_KEY, Array.isArray(ops) ? ops : []);
    syncPendingUi();
  }

  function hasPendingNoteOps() {
    return getNoteQueue().length > 0;
  }

  function syncPendingUi() {
    try { noteSnapshotPending = hasPendingNoteOps(); } catch (_) {}
    try { if (typeof updateSyncIndicator === 'function') updateSyncIndicator(); } catch (_) {}
  }

  function canWriteCloud() {
    try {
      return !!(
        user && user.uid && navigator.onLine && typeof firebaseReady !== 'undefined' && firebaseReady &&
        typeof db !== 'undefined' && db && !db.__offlineStub &&
        typeof firebase !== 'undefined' && firebase && firebase.firestore && firebase.firestore.FieldValue
      );
    } catch (_) {
      return false;
    }
  }

  function makeCloudTimestamp() {
    try {
      if (typeof firebase !== 'undefined' && firebase && firebase.firestore && firebase.firestore.FieldValue) {
        return firebase.firestore.FieldValue.serverTimestamp();
      }
    } catch (_) {}
    return Date.now();
  }

  function makeGeneratedNoteId() {
    return 'note_local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function addPendingNoteSet(id, payload) {
    var ops = getNoteQueue().filter(function (op) {
      return !(op && op.id === id);
    });
    ops.push({ kind: 'note', type: 'set', id: id, payload: payload, ts: Date.now() });
    setNoteQueue(ops);
  }

  function addPendingNoteDelete(id) {
    var ops = getNoteQueue().filter(function (op) {
      return !(op && op.id === id);
    });
    ops.push({ kind: 'note', type: 'delete', id: id, ts: Date.now() });
    setNoteQueue(ops);
  }

  function replaceNoteLocally(id, payload) {
    var next = Array.isArray(notes) ? notes.slice() : [];
    var index = next.findIndex(function (item) { return item && item.id === id; });
    var merged = Object.assign({ id: id }, index >= 0 ? (next[index] || {}) : {}, payload || {});
    if (index >= 0) next[index] = merged;
    else next.unshift(merged);
    notes = next;
    scheduleLocalStateSave();
    syncPendingUi();
    try { renderApp(); } catch (_) {}
  }

  function deleteNoteLocally(id) {
    notes = (Array.isArray(notes) ? notes : []).filter(function (item) {
      return !item || item.id !== id;
    });
    scheduleLocalStateSave();
    syncPendingUi();
    try { renderApp(); } catch (_) {}
  }

  async function saveNoteToCloud(id, payload) {
    await db.collection('users').doc(user.uid).collection('notes').doc(id).set(
      Object.assign({}, payload, { updatedAt: makeCloudTimestamp() }),
      { merge: true }
    );
  }

  async function deleteNoteFromCloud(id) {
    await db.collection('users').doc(user.uid).collection('notes').doc(id).delete();
  }

  function scheduleNoteFlush(delayMs) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(function () {
      flushPendingNoteOps();
    }, typeof delayMs === 'number' ? delayMs : 650);
  }

  async function flushPendingNoteOps() {
    if (flushInProgress || !canWriteCloud()) {
      syncPendingUi();
      return false;
    }

    var ops = getNoteQueue();
    if (!ops.length) {
      syncPendingUi();
      scheduleLocalStateSave();
      return true;
    }

    flushInProgress = true;
    try {
      while (ops.length) {
        var op = ops[0];
        if (op && op.kind === 'note') {
          if (op.type === 'set') await saveNoteToCloud(op.id, op.payload || {});
          else if (op.type === 'delete') await deleteNoteFromCloud(op.id);
        }
        ops.shift();
        setNoteQueue(ops);
      }
      scheduleLocalStateSave();
      syncPendingUi();
      return true;
    } catch (error) {
      console.error('Pending note sync error:', error);
      syncPendingUi();
      return false;
    } finally {
      flushInProgress = false;
    }
  }

  async function upsertNoteWithFallback(id, payload, successText, afterSuccess) {
    if (canWriteCloud()) {
      try {
        await saveNoteToCloud(id, payload);
        if (typeof afterSuccess === 'function') afterSuccess();
        scheduleLocalStateSave();
        safeShowMsg(successText);
        return id;
      } catch (error) {
        console.error('Cloud note save error:', error);
      }
    }

    replaceNoteLocally(id, payload);
    addPendingNoteSet(id, payload);
    if (typeof afterSuccess === 'function') afterSuccess();
    safeShowMsg(successText + ' · синхронизируется при сети');
    return id;
  }

  async function deleteNoteWithFallback(id, successText, afterSuccess) {
    if (canWriteCloud()) {
      try {
        await deleteNoteFromCloud(id);
        if (typeof afterSuccess === 'function') afterSuccess();
        scheduleLocalStateSave();
        safeShowMsg(successText);
        return true;
      } catch (error) {
        console.error('Cloud note delete error:', error);
      }
    }

    deleteNoteLocally(id);
    addPendingNoteDelete(id);
    if (typeof afterSuccess === 'function') afterSuccess();
    safeShowMsg(successText + ' · синхронизируется при сети');
    return true;
  }

  function installSyncIndicatorPatch() {
    var originalUpdateSyncIndicator = typeof updateSyncIndicator === 'function' ? updateSyncIndicator : null;
    if (!originalUpdateSyncIndicator || window.__arabrusOfflineNotesSyncWrapped) return;
    window.__arabrusOfflineNotesSyncWrapped = true;
    updateSyncIndicator = function () {
      var previous = typeof noteSnapshotPending !== 'undefined' ? noteSnapshotPending : false;
      try { noteSnapshotPending = previous || hasPendingNoteOps(); } catch (_) {}
      var result = originalUpdateSyncIndicator.apply(this, arguments);
      try { noteSnapshotPending = previous; } catch (_) {}
      return result;
    };
  }

  function installNoteOverrides() {
    installSyncIndicatorPatch();

    var originalSaveNote = typeof saveNote === 'function' ? saveNote : null;
    if (originalSaveNote && !window.__arabrusOfflineSaveNoteWrapped) {
      window.__arabrusOfflineSaveNoteWrapped = true;
      saveNote = async function () {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (typeof canUsePremiumFeatures === 'function' && !canUsePremiumFeatures()) { askPremium(); return; }
        var ar = String(((document.getElementById('manualAr') || {}).value) || '').trim();
        var ru = String(((document.getElementById('manualRu') || {}).value) || '').trim();
        if (!ar || !ru) { safeShowMsg('Заполните оба поля'); return; }
        var id = makeGeneratedNoteId();
        var payload = { ar: ar, ru: ru, collection: '', ts: Date.now() };
        await upsertNoteWithFallback(id, payload, 'Фраза добавлена', function () {
          if (document.getElementById('manualAr')) document.getElementById('manualAr').value = '';
          if (document.getElementById('manualRu')) document.getElementById('manualRu').value = '';
        });
      };
    }

    var originalSaveReadingPair = typeof saveReadingPair === 'function' ? saveReadingPair : null;
    if (originalSaveReadingPair && !window.__arabrusOfflineSaveReadingWrapped) {
      window.__arabrusOfflineSaveReadingWrapped = true;
      saveReadingPair = async function (ar, ru, collection) {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (typeof canUsePremiumFeatures === 'function' && !canUsePremiumFeatures()) { askPremium(); return; }
        var safeAr = String(ar || '').trim();
        var safeRu = String(ru || '').trim();
        if (!safeAr || !safeRu) { safeShowMsg('Нет фразы для сохранения'); return; }
        var id = makeGeneratedNoteId();
        var payload = {
          ar: safeAr,
          ru: safeRu,
          collection: collection || 'Чтение',
          ts: Date.now()
        };
        await upsertNoteWithFallback(id, payload, 'Фраза добавлена в блокнот');
      };
    }

    var originalConfirmNoteEditModal = typeof confirmNoteEditModal === 'function' ? confirmNoteEditModal : null;
    if (originalConfirmNoteEditModal && !window.__arabrusOfflineEditNoteWrapped) {
      window.__arabrusOfflineEditNoteWrapped = true;
      confirmNoteEditModal = async function () {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (typeof canUsePremiumFeatures === 'function' && !canUsePremiumFeatures()) { askPremium(); return; }
        if (!currentEditingNoteId) return;
        var ar = String(((document.getElementById('noteEditModalArInput') || {}).value) || '').trim();
        var ru = String(((document.getElementById('noteEditModalRu') || {}).value) || '').trim();
        if (!ar || !ru) { safeShowMsg('Заполните арабский и русский текст'); return; }
        var existing = (Array.isArray(notes) ? notes : []).find(function (n) { return n && n.id === currentEditingNoteId; }) || {};
        var payload = {
          ar: ar,
          ru: ru,
          collection: existing.collection || '',
          ts: existing.ts || Date.now()
        };
        await upsertNoteWithFallback(currentEditingNoteId, payload, 'Запись обновлена', function () {
          if (typeof closeNoteEditModal === 'function') closeNoteEditModal();
        });
      };
    }

    var originalRemoveNote = typeof removeNote === 'function' ? removeNote : null;
    if (originalRemoveNote && !window.__arabrusOfflineRemoveNoteWrapped) {
      window.__arabrusOfflineRemoveNoteWrapped = true;
      removeNote = async function (id) {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (typeof canUsePremiumFeatures === 'function' && !canUsePremiumFeatures()) { askPremium(); return; }
        await deleteNoteWithFallback(id, 'Запись удалена');
      };
    }

    var originalRemoveNoteFromFolder = typeof removeNoteFromFolder === 'function' ? removeNoteFromFolder : null;
    if (originalRemoveNoteFromFolder && !window.__arabrusOfflineRemoveNoteFolderWrapped) {
      window.__arabrusOfflineRemoveNoteFolderWrapped = true;
      removeNoteFromFolder = async function (id) {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (typeof canUsePremiumFeatures === 'function' && !canUsePremiumFeatures()) { askPremium(); return; }
        var existing = (Array.isArray(notes) ? notes : []).find(function (n) { return n && n.id === id; });
        if (!existing) return;
        var payload = Object.assign({}, existing, { collection: '' });
        delete payload.id;
        await upsertNoteWithFallback(id, payload, 'Убрано из папки');
      };
    }

    var originalApplyBulkNoteFolder = typeof applyBulkNoteFolder === 'function' ? applyBulkNoteFolder : null;
    if (originalApplyBulkNoteFolder && !window.__arabrusOfflineBulkNoteFolderWrapped) {
      window.__arabrusOfflineBulkNoteFolderWrapped = true;
      applyBulkNoteFolder = async function () {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (typeof canUsePremiumFeatures === 'function' && !canUsePremiumFeatures()) { askPremium(); return; }
        var ids = Array.from(selectedNoteIds || []);
        if (!ids.length) { safeShowMsg('Сначала выберите записи'); return; }
        var existingFolder = String(((document.getElementById('bulkNoteFolderSelect') || {}).value) || '').trim();
        var typedFolder = String(((document.getElementById('bulkNoteFolderInput') || {}).value) || '').trim();
        var folder = typedFolder || existingFolder;
        if (!folder) { safeShowMsg('Выберите или введите папку'); return; }

        if (canWriteCloud()) return originalApplyBulkNoteFolder.apply(this, arguments);

        ids.forEach(function (id) {
          var note = (Array.isArray(notes) ? notes : []).find(function (item) { return item && item.id === id; });
          if (!note) return;
          var payload = Object.assign({}, note, { collection: folder });
          delete payload.id;
          replaceNoteLocally(id, payload);
          addPendingNoteSet(id, payload);
        });
        if (document.getElementById('bulkNoteFolderInput')) document.getElementById('bulkNoteFolderInput').value = '';
        if (document.getElementById('bulkNoteFolderSelect')) document.getElementById('bulkNoteFolderSelect').value = '';
        safeShowMsg('Папка сохранена · синхронизируется при сети');
        try { if (typeof toggleNoteSelectionMode === 'function') toggleNoteSelectionMode(false); } catch (_) {}
      };
    }

    var originalDeleteSelectedNotes = typeof deleteSelectedNotes === 'function' ? deleteSelectedNotes : null;
    if (originalDeleteSelectedNotes && !window.__arabrusOfflineDeleteNotesWrapped) {
      window.__arabrusOfflineDeleteNotesWrapped = true;
      deleteSelectedNotes = async function () {
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (typeof canUsePremiumFeatures === 'function' && !canUsePremiumFeatures()) { askPremium(); return; }
        var ids = Array.from(selectedNoteIds || []);
        if (!ids.length) { safeShowMsg('Сначала выберите записи'); return; }

        if (canWriteCloud()) return originalDeleteSelectedNotes.apply(this, arguments);

        ids.forEach(function (id) {
          deleteNoteLocally(id);
          addPendingNoteDelete(id);
        });
        safeShowMsg('Удалено · синхронизируется при сети');
        try { if (typeof toggleNoteSelectionMode === 'function') toggleNoteSelectionMode(false); } catch (_) {}
      };
    }

    var originalConfirmFolderModal = typeof confirmFolderModal === 'function' ? confirmFolderModal : null;
    if (originalConfirmFolderModal && !window.__arabrusOfflineFolderModalWrapped) {
      window.__arabrusOfflineFolderModalWrapped = true;
      confirmFolderModal = async function () {
        if (folderModalMode !== 'note') return originalConfirmFolderModal.apply(this, arguments);
        if (!user) { if (typeof openAuthModal === 'function') openAuthModal(); return; }
        if (typeof canUsePremiumFeatures === 'function' && !canUsePremiumFeatures()) { askPremium(); return; }
        var selected = String(((document.getElementById('singleFolderSelect') || {}).value) || '').trim();
        var typed = String(((document.getElementById('folderInput') || {}).value) || '').trim();
        var value = typed || selected;
        if (!folderModalTargetId) {
          if (typeof closeFolderModal === 'function') closeFolderModal();
          return;
        }

        if (canWriteCloud()) {
          var noteRef = db.collection('users').doc(user.uid).collection('notes').doc(folderModalTargetId);
          try {
            await noteRef.update({ collection: value, updatedAt: makeCloudTimestamp() });
            if (typeof closeFolderModal === 'function') closeFolderModal();
            safeShowMsg('Папка сохранена');
            return;
          } catch (error) {
            console.error('Note folder save error:', error);
          }
        }

        var current = (Array.isArray(notes) ? notes : []).find(function (item) { return item && item.id === folderModalTargetId; });
        if (!current) {
          if (typeof closeFolderModal === 'function') closeFolderModal();
          return;
        }
        var payload = Object.assign({}, current, { collection: value });
        delete payload.id;
        replaceNoteLocally(folderModalTargetId, payload);
        addPendingNoteSet(folderModalTargetId, payload);
        if (typeof closeFolderModal === 'function') closeFolderModal();
        safeShowMsg('Папка сохранена · синхронизируется при сети');
      };
    }
  }

  function install() {
    installNoteOverrides();
    syncPendingUi();
    setTimeout(function () {
      syncPendingUi();
      scheduleLocalStateSave();
      scheduleNoteFlush(1200);
    }, 200);

    window.addEventListener('online', function () {
      try { if (typeof loadFirebaseSdk === 'function') loadFirebaseSdk(); } catch (_) {}
      scheduleNoteFlush(1200);
      scheduleLocalStateSave();
    });

    window.addEventListener('offline', function () {
      syncPendingUi();
      scheduleLocalStateSave();
    });

    window.addEventListener('beforeunload', function () {
      scheduleLocalStateSave();
    });

    setInterval(function () {
      if (user && user.uid) scheduleLocalStateSave();
      if (navigator.onLine) scheduleNoteFlush(250);
    }, 3200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();