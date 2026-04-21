(function () {
  if (window.__arabrusNotebookCardsInstalled) return;
  window.__arabrusNotebookCardsInstalled = true;

  var NOTE_VIEW_MODE_KEY = 'arabrus_note_view_mode';

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

  function h(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
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
      '.note-card-front-ru{margin:auto 0 12px;text-align:center;font-size:16px;font-weight:800;line-height:1.4;color:#334155;white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}',
      '.note-card-front-ar{margin:auto;text-align:center;direction:rtl;color:var(--primary);font-size:28px;font-weight:800;line-height:1.25;white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
      '.note-card-folder{margin-top:8px;text-align:center;color:#64748b;font-size:12px;font-weight:700;line-height:1.35}',
      '.note-card-back-ru{font-size:15px;line-height:1.5;color:#334155;white-space:pre-wrap;word-break:break-word;margin-bottom:10px;text-align:left}',
      '.note-card-back-ar{font-size:26px;line-height:1.3;color:var(--primary);direction:rtl;text-align:center;font-weight:800;white-space:pre-wrap;word-break:break-word;margin-bottom:10px}',
      '.note-card-actions{width:100%;margin-top:auto}',
      'body.compact-notes .note-card-front-ru{font-size:15px;-webkit-line-clamp:3}',
      'body.compact-notes .note-card-front-ar{font-size:24px}',
      'body.compact-notes .note-card-back-ru{font-size:14px}',
      'body.compact-notes .note-card-back-ar{font-size:22px}',
      '@media (max-width:560px){.note-card-front-ru{font-size:15px}.note-card-front-ar{font-size:24px}.note-card-back-ar{font-size:22px}}'
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
    var show = activeTab === 'notes' && !!user && !(typeof isPremiumLocked === 'function' && isPremiumLocked());
    btn.style.display = show ? '' : 'none';
  }

  function getItems() {
    var items = Array.isArray(notes) ? notes.slice() : [];
    var noteQuery = String(((document.getElementById('noteSearchInput') || {}).value) || '').trim().toLowerCase();
    var isSpecificFolder = activeCollection !== 'Все';

    if (isSpecificFolder) items = items.filter(function (n) { return String(n.collection || '') === activeCollection; });
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
    if (typeof renderApp === 'function') renderApp();
  };

  window.handleNoteCardPress = function (action, id, el, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    if (event && event.target && event.target.closest('button, input, select, textarea, label, a')) return false;
    if (action === 'select') {
      toggleNoteSelected(id);
      return false;
    }
    if (action === 'flip' && el) {
      el.classList.toggle('flipped');
      return false;
    }
    return false;
  };

  function renderCards(items) {
    var isSpecificFolder = activeCollection !== 'Все';
    return '<div class="cards-grid">' + items.map(function (n) {
      var actionMode = noteSelectionMode ? 'select' : 'flip';
      var checked = !!(selectedNoteIds && selectedNoteIds.has(n.id));
      var folderButton = (isSpecificFolder || n.collection)
        ? '<button type="button" class="btn warn" onclick="event.stopPropagation(); removeNoteFromFolder(\'' + j(n.id) + '\')">📂</button>'
        : '<button type="button" class="btn" onclick="event.stopPropagation(); openFolderModal(\'note\', \'" + j(n.id) + "\', \'Укажите папку для записи\')">📁</button>';

      return '' +
        '<div class="card-item" onclick="return handleNoteCardPress(\'' + j(actionMode) + '\', \'" + j(n.id) + "\', this, event)">' +
          (noteSelectionMode ? '<input class="card-checkbox" type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="event.stopPropagation(); toggleNoteSelected(\'' + j(n.id) + '\')">' : '') +
          '<div class="card-inner">' +
            '<div class="card-face">' +
              '<div class="note-card-front-ru">' + h(n.ru || '') + '</div>' +
              '<div class="note-card-front-ar">' + h(n.ar || '') + '</div>' +
              ((n.collection && !isSpecificFolder) ? '<div class="note-card-folder">📁 ' + h(n.collection) + '</div>' : '') +
              '<div class="card-hint">коснись, чтобы перевернуть</div>' +
            '</div>' +
            '<div class="card-face card-back">' +
              '<div class="note-card-back-ru">' + h(n.ru || '') + '</div>' +
              '<div class="note-card-back-ar">' + h(n.ar || '') + '</div>' +
              ((n.collection && !isSpecificFolder) ? '<div class="note-card-folder">📁 ' + h(n.collection) + '</div>' : '') +
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

  var originalRenderNotes = typeof renderNotes === 'function' ? renderNotes : null;
  if (originalRenderNotes) {
    renderNotes = function () {
      if (!user) return '<div class="empty">Войдите через Google, чтобы использовать блокнот</div>';
      if (typeof isPremiumLocked === 'function' && isPremiumLocked()) return renderLockedFeature('Блокнот');
      var items = getItems();
      if (!items.length) return '<div class="empty">В блокноте пока пусто</div>';
      if (window.noteViewMode !== 'cards') return originalRenderNotes.apply(this, arguments);
      return renderCards(items);
    };
  }

  var originalRenderApp = typeof renderApp === 'function' ? renderApp : null;
  if (originalRenderApp) {
    renderApp = function () {
      var result = originalRenderApp.apply(this, arguments);
      updateButton();
      return result;
    };
  }

  function install() {
    injectStyles();
    ensureButton();
    updateButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();