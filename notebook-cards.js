(function () {
  if (window.__arabrusNotebookCardsInstalled) return;
  window.__arabrusNotebookCardsInstalled = true;

  var NOTE_VIEW_MODE_KEY = 'arabrus_note_view_mode';
  var wrapTimer = null;
  var wrapAttempts = 0;

  function readMode() {
    try {
      return localStorage.getItem(NOTE_VIEW_MODE_KEY) === 'cards' ? 'cards' : 'list';
    } catch (_) {
      return 'list';
    }
  }

  function saveMode(mode) {
    try { localStorage.setItem(NOTE_VIEW_MODE_KEY, mode); } catch (_) {}
  }

  function getUserValue() {
    try { return typeof user !== 'undefined' ? user : window.user; } catch (_) { return window.user; }
  }

  function getNotesValue() {
    try { return typeof notes !== 'undefined' ? notes : window.notes; } catch (_) { return window.notes; }
  }

  function getActiveTabValue() {
    try { return typeof activeTab !== 'undefined' ? activeTab : window.activeTab; } catch (_) { return window.activeTab; }
  }

  function getActiveCollectionValue() {
    try { return typeof activeCollection !== 'undefined' ? activeCollection : window.activeCollection; } catch (_) { return window.activeCollection; }
  }

  function getNoteSelectionModeValue() {
    try { return typeof noteSelectionMode !== 'undefined' ? noteSelectionMode : window.noteSelectionMode; } catch (_) { return window.noteSelectionMode; }
  }

  function getSelectedNoteIdsValue() {
    try { return typeof selectedNoteIds !== 'undefined' ? selectedNoteIds : window.selectedNoteIds; } catch (_) { return window.selectedNoteIds; }
  }

  function getRenderNotesFn() {
    try { return typeof renderNotes === 'function' ? renderNotes : window.renderNotes; } catch (_) { return window.renderNotes; }
  }

  function setRenderNotesFn(fn) {
    try { renderNotes = fn; } catch (_) {}
    window.renderNotes = fn;
  }

  function getRenderAppFn() {
    try { return typeof renderApp === 'function' ? renderApp : window.renderApp; } catch (_) { return window.renderApp; }
  }

  function setRenderAppFn(fn) {
    try { renderApp = fn; } catch (_) {}
    window.renderApp = fn;
  }

  function callRenderApp() {
    var fn = getRenderAppFn();
    if (typeof fn === 'function') fn();
  }

  function callToggleNoteSelected(id) {
    try {
      if (typeof toggleNoteSelected === 'function') return toggleNoteSelected(id);
    } catch (_) {}
    if (typeof window.toggleNoteSelected === 'function') return window.toggleNoteSelected(id);
  }

  function h(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function j(value) {
    if (typeof escapeJs === 'function') return escapeJs(value);
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }

  function injectStyles() {
    if (document.getElementById('arabrusNotebookCardsStyle')) return;
    var style = document.createElement('style');
    style.id = 'arabrusNotebookCardsStyle';
    style.textContent = [
      '.note-card-folder{margin-top:8px;text-align:center;color:#64748b;font-size:12px;font-weight:700;line-height:1.35}',
      '.note-card-back-main{margin:auto 0 8px;text-align:center;direction:rtl;color:var(--primary);font-size:30px;font-weight:800;line-height:1.2;white-space:pre-wrap;word-break:break-word}',
      '.note-card-actions{width:100%;margin-top:14px}',
      'body.compact-notes .note-card-back-main{font-size:24px}',
      '@media (max-width:560px){.note-card-back-main{font-size:24px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureButton() {
    var topbar = document.getElementById('noteTopbar');
    if (!topbar) return null;
    var btn = document.getElementById('noteViewModeBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'noteViewModeBtn';
      btn.type = 'button';
      btn.className = 'btn';
      btn.onclick = function () { window.toggleNoteViewMode(); };
      topbar.insertBefore(btn, document.getElementById('noteSelectBtn'));
    }
    return btn;
  }

  function updateButton() {
    var btn = ensureButton();
    if (!btn) return;
    btn.textContent = window.noteViewMode === 'cards' ? '📄 Режим списка' : '🎴 Режим карточек';
    var currentTab = getActiveTabValue();
    var currentUser = getUserValue();
    var show = currentTab === 'notes' && !!currentUser && !(typeof isPremiumLocked === 'function' && isPremiumLocked());
    btn.style.display = show ? '' : 'none';
  }

  function getItems() {
    var sourceNotes = getNotesValue();
    var items = Array.isArray(sourceNotes) ? sourceNotes.slice() : [];
    var noteQuery = String(((document.getElementById('noteSearchInput') || {}).value) || '').trim().toLowerCase();
    var currentCollection = getActiveCollectionValue() || 'Все';
    var isSpecificFolder = currentCollection !== 'Все';

    if (isSpecificFolder) items = items.filter(function (n) { return String(n.collection || '') === currentCollection; });
    if (noteQuery) {
      items = items.filter(function (n) {
        return String(n.ru || '').toLowerCase().includes(noteQuery)
          || String(n.ar || '').toLowerCase().includes(noteQuery)
          || String(n.collection || '').toLowerCase().includes(noteQuery);
      });
    }

    items.sort(function (a, b) { return Number(b.ts || 0) - Number(a.ts || 0); });
    return items;
  }

  window.noteViewMode = readMode();

  window.toggleNoteViewMode = function () {
    window.noteViewMode = window.noteViewMode === 'cards' ? 'list' : 'cards';
    saveMode(window.noteViewMode);
    callRenderApp();
  };

  window.handleNoteCardPress = function (action, id, el, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    if (event && event.target && event.target.closest('button, input, select, textarea, label, a')) return false;
    if (action === 'select') {
      callToggleNoteSelected(id);
      return false;
    }
    if (action === 'flip' && el) {
      el.classList.toggle('flipped');
      return false;
    }
    return false;
  };

  function renderCards(items) {
    var currentCollection = getActiveCollectionValue() || 'Все';
    var isSpecificFolder = currentCollection !== 'Все';
    var noteSelectionModeValue = !!getNoteSelectionModeValue();
    var selectedIds = getSelectedNoteIdsValue();

    return '<div class="cards-grid">' + items.map(function (n) {
      var actionMode = noteSelectionModeValue ? 'select' : 'flip';
      var checked = !!(selectedIds && selectedIds.has && selectedIds.has(n.id));
      var folderHint = (n.collection && !isSpecificFolder)
        ? '<div class="note-card-folder">📁 ' + h(n.collection) + '</div>'
        : '';
      var folderButton = (isSpecificFolder || n.collection)
        ? '<button type="button" class="btn warn" onclick="event.stopPropagation(); removeNoteFromFolder(\'' + j(n.id) + '\')">📂</button>'
        : '<button type="button" class="btn" onclick="event.stopPropagation(); openFolderModal(\'note\', \'" + j(n.id) + "\', \'Укажите папку для записи\')">📁</button>';

      return '' +
        '<div class="card-item" onclick="return handleNoteCardPress(\'' + j(actionMode) + '\', \'" + j(n.id) + "\', this, event)">' +
          (noteSelectionModeValue ? '<input class="card-checkbox" type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="event.stopPropagation(); toggleNoteSelected(\'' + j(n.id) + '\')">' : '') +
          '<div class="card-inner">' +
            '<div class="card-face">' +
              '<div class="card-front-text">' + h(n.ru || '') + '</div>' +
              folderHint +
              '<div class="card-hint">коснись, чтобы перевернуть</div>' +
            '</div>' +
            '<div class="card-face card-back">' +
              '<div class="note-card-back-main">' + h(n.ar || '') + '</div>' +
              folderHint +
              '<div class="actions note-card-actions">' +
                '<button type="button" class="btn" onclick="event.stopPropagation(); speak(\'' + j(n.ar || '') + '\', event)">🔊</button>' +
                '<button type="button" class="btn" onclick="event.stopPropagation(); openNoteEditModal(\'' + j(n.id) + '\')">✏️</button>' +
                folderButton +
                '<button type="button" class="btn danger" onclick="event.stopPropagation(); removeNote(\'' + j(n.id) + '\')">🗑</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function wrapRuntime() {
    var changed = false;

    if (!window.__arabrusNotebookCardsRenderWrapped) {
      var originalRenderNotes = getRenderNotesFn();
      if (typeof originalRenderNotes === 'function') {
        setRenderNotesFn(function () {
          var currentUser = getUserValue();
          if (!currentUser) return '<div class="empty">Войдите через Google, чтобы использовать блокнот</div>';
          if (typeof isPremiumLocked === 'function' && isPremiumLocked()) return renderLockedFeature('Блокнот');
          var items = getItems();
          if (!items.length) return '<div class="empty">В блокноте пока пусто</div>';
          if (window.noteViewMode !== 'cards') return originalRenderNotes.apply(this, arguments);
          return renderCards(items);
        });
        window.__arabrusNotebookCardsRenderWrapped = true;
        changed = true;
      }
    }

    if (!window.__arabrusNotebookCardsAppWrapped) {
      var originalRenderApp = getRenderAppFn();
      if (typeof originalRenderApp === 'function') {
        setRenderAppFn(function () {
          var result = originalRenderApp.apply(this, arguments);
          updateButton();
          return result;
        });
        window.__arabrusNotebookCardsAppWrapped = true;
        changed = true;
      }
    }

    updateButton();

    if (window.__arabrusNotebookCardsRenderWrapped && window.__arabrusNotebookCardsAppWrapped && wrapTimer) {
      clearInterval(wrapTimer);
      wrapTimer = null;
      callRenderApp();
    }

    return changed;
  }

  function startWrapWatcher() {
    injectStyles();
    ensureButton();
    updateButton();
    wrapRuntime();

    if (window.__arabrusNotebookCardsRenderWrapped && window.__arabrusNotebookCardsAppWrapped) return;
    if (wrapTimer) return;

    wrapTimer = setInterval(function () {
      wrapAttempts += 1;
      wrapRuntime();
      if (wrapAttempts > 200 && wrapTimer) {
        clearInterval(wrapTimer);
        wrapTimer = null;
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWrapWatcher, { once: true });
  } else {
    startWrapWatcher();
  }

  window.addEventListener('load', wrapRuntime);
})();