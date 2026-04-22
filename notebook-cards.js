(function () {
  if (window.__arabrusNotebookCardsInstalled) return;
  window.__arabrusNotebookCardsInstalled = true;

  var NOTE_VIEW_MODE_KEY = 'arabrus_note_view_mode';
  var watchTimer = null;
  var tries = 0;

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

  function getVar(name) {
    try {
      return Function('try { return typeof ' + name + ' !== "undefined" ? ' + name + ' : window["' + name + '"]; } catch (_) { return window["' + name + '"]; }')();
    } catch (_) {
      return window[name];
    }
  }

  function setFn(name, fn) {
    try { Function('fn', name + ' = fn;')(fn); } catch (_) {}
    window[name] = fn;
  }

  function getFn(name) {
    var value = getVar(name);
    return typeof value === 'function' ? value : window[name];
  }

  function h(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function j(value) {
    if (typeof escapeJs === 'function') return escapeJs(value);
    return String(value == null ? '' : value)
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
      '.note-card-press-target{touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;min-height:240px}',
      '.note-card-press-target *{-webkit-user-select:none;user-select:none}',
      '.note-card-press-target .card-inner{height:240px;min-height:240px}',
      '.note-card-press-target .card-face{overflow:hidden;gap:8px}',
      '.note-card-front-main,.note-card-back-main-wrap{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}',
      '.note-card-press-target .card-front-text{margin:0;text-align:center;font-size:15px;font-weight:800;line-height:1.32;color:#334155;white-space:normal;word-break:break-word;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:7}',
      '.note-card-folder{margin-top:0;text-align:center;color:#64748b;font-size:12px;font-weight:700;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;flex:0 0 auto}',
      '.note-card-back-main{margin:0;text-align:center;direction:rtl;color:var(--primary);font-size:28px;font-weight:800;line-height:1.22;white-space:normal;word-break:break-word;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:5}',
      '.note-card-actions{width:100%;margin-top:0;flex:0 0 auto}',
      '.note-card-press-target .card-hint{flex:0 0 auto}',
      'body.compact-notes .note-card-press-target{min-height:220px}',
      'body.compact-notes .note-card-press-target .card-inner{height:220px;min-height:220px}',
      'body.compact-notes .note-card-press-target .card-front-text{font-size:14px;-webkit-line-clamp:6}',
      'body.compact-notes .note-card-back-main{font-size:24px;-webkit-line-clamp:4}',
      '@media (max-width:560px){.note-card-press-target{min-height:220px}.note-card-press-target .card-inner{height:220px;min-height:220px}.note-card-press-target .card-front-text{font-size:14px;-webkit-line-clamp:6}.note-card-back-main{font-size:24px;-webkit-line-clamp:4}}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureButton() {
    var topbar = document.getElementById('noteTopbar');
    var selectBtn = document.getElementById('noteSelectBtn');
    if (!topbar || !selectBtn) return null;

    var btn = document.getElementById('noteViewModeBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'noteViewModeBtn';
      btn.type = 'button';
      btn.className = 'btn';
      btn.onclick = function () { window.toggleNoteViewMode(); };
      topbar.insertBefore(btn, selectBtn);
    }
    return btn;
  }

  function updateButton() {
    var btn = ensureButton();
    if (!btn) return;
    btn.textContent = window.noteViewMode === 'cards' ? '📄 Режим списка' : '🎴 Режим карточек';

    var activeTab = getVar('activeTab');
    var user = getVar('user');
    var locked = false;
    try {
      locked = typeof isPremiumLocked === 'function' ? !!isPremiumLocked() : false;
    } catch (_) {}

    btn.style.display = activeTab === 'notes' && !!user && !locked ? '' : 'none';
  }

  function getItems() {
    var notes = getVar('notes');
    var activeCollection = getVar('activeCollection') || 'Все';
    var query = String((document.getElementById('noteSearchInput') || {}).value || '').trim().toLowerCase();
    var items = Array.isArray(notes) ? notes.slice() : [];

    if (activeCollection !== 'Все') {
      items = items.filter(function (n) {
        return String((n && n.collection) || '') === activeCollection;
      });
    }

    if (query) {
      items = items.filter(function (n) {
        return String((n && n.ru) || '').toLowerCase().includes(query)
          || String((n && n.ar) || '').toLowerCase().includes(query)
          || String((n && n.collection) || '').toLowerCase().includes(query);
      });
    }

    items.sort(function (a, b) {
      return Number((b && b.ts) || 0) - Number((a && a.ts) || 0);
    });

    return items;
  }

  window.noteViewMode = readMode();

  window.toggleNoteViewMode = function () {
    window.noteViewMode = window.noteViewMode === 'cards' ? 'list' : 'cards';
    saveMode(window.noteViewMode);
    var renderApp = getFn('renderApp');
    if (typeof renderApp === 'function') renderApp();
  };

  window.handleNoteCardPress = function (action, id, el, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    if (event && event.target && event.target.closest('button, input, select, textarea, label, a')) return false;

    if (action === 'select') {
      var toggleNoteSelected = getFn('toggleNoteSelected');
      if (typeof toggleNoteSelected === 'function') toggleNoteSelected(id);
      return false;
    }

    if (action === 'flip' && el) {
      el.classList.toggle('flipped');
      return false;
    }

    return false;
  };

  function renderCards(items) {
    var activeCollection = getVar('activeCollection') || 'Все';
    var noteSelectionMode = !!getVar('noteSelectionMode');
    var selectedNoteIds = getVar('selectedNoteIds');
    var isSpecificFolder = activeCollection !== 'Все';

    return '<div class="cards-grid">' + items.map(function (n) {
      var rawId = (n && n.id) || '';
      var id = j(rawId);
      var rawAr = (n && n.ar) || '';
      var rawRu = (n && n.ru) || '';
      var ar = h(rawAr);
      var ru = h(rawRu);
      var collection = String((n && n.collection) || '');
      var checked = !!(selectedNoteIds && selectedNoteIds.has && selectedNoteIds.has(rawId));
      var folderHint = collection && !isSpecificFolder ? '<div class="note-card-folder">📁 ' + h(collection) + '</div>' : '';
      var folderButton = (isSpecificFolder || collection)
        ? `<button type="button" class="btn warn" onclick="event.stopPropagation(); removeNoteFromFolder('${id}')">📂</button>`
        : `<button type="button" class="btn" onclick="event.stopPropagation(); openFolderModal('note', '${id}', 'Укажите папку для записи')">📁</button>`;

      return `
        <div class="card-item note-card-press-target" onclick="return handleNoteCardPress('${noteSelectionMode ? 'select' : 'flip'}', '${id}', this, event)">
          ${noteSelectionMode ? `<input class="card-checkbox" type="checkbox" ${checked ? 'checked' : ''} onchange="event.stopPropagation(); toggleNoteSelected('${id}')">` : ''}
          <div class="card-inner">
            <div class="card-face">
              <div class="note-card-front-main">
                <div class="card-front-text">${ru}</div>
              </div>
              ${folderHint}
              <div class="card-hint">коснись, чтобы перевернуть</div>
            </div>
            <div class="card-face card-back">
              <div class="note-card-back-main-wrap">
                <div class="note-card-back-main">${ar}</div>
              </div>
              ${folderHint}
              <div class="actions note-card-actions">
                <button type="button" class="btn" onclick="event.stopPropagation(); speak('${j(rawAr)}', event)">🔊</button>
                <button type="button" class="btn" onclick="event.stopPropagation(); openNoteEditModal('${id}')">✏️</button>
                ${folderButton}
                <button type="button" class="btn danger" onclick="event.stopPropagation(); removeNote('${id}')">🗑</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  }

  function formatDate(ms) {
    try {
      if (!ms) return '';
      var d = new Date(ms);
      if (Number.isNaN(d.getTime())) return '';
      var day = String(d.getDate()).padStart(2, '0');
      var month = String(d.getMonth() + 1).padStart(2, '0');
      var year = d.getFullYear();
      return day + '.' + month + '.' + year;
    } catch (_) {
      return '';
    }
  }

  function getTrialDaysLeft(trial) {
    try {
      if (!trial || typeof trial !== 'object') return null;

      var directKeys = ['daysLeft', 'remainingDays', 'daysRemaining', 'leftDays', 'remainDays', 'days'];
      for (var i = 0; i < directKeys.length; i += 1) {
        var directValue = Number(trial[directKeys[i]]);
        if (Number.isFinite(directValue) && directValue >= 0) {
          return Math.max(0, Math.ceil(directValue));
        }
      }

      var endKeys = ['endAt', 'endMs', 'endsAt', 'endsAtMs', 'expiresAt', 'expiresAtMs', 'trialEnd', 'trialEndMs', 'until', 'untilMs'];
      for (var jIndex = 0; jIndex < endKeys.length; jIndex += 1) {
        var endValue = Number(trial[endKeys[jIndex]]);
        if (Number.isFinite(endValue) && endValue > 0) {
          return Math.max(0, Math.ceil((endValue - Date.now()) / 86400000));
        }
      }
    } catch (_) {}
    return null;
  }

  function applyAccessCopy() {
    var mainEl = document.getElementById('compactAuthAccessMain');
    var subEl = document.getElementById('compactAuthAccessSub');
    var btnEl = document.getElementById('compactAuthAccessBtn');
    if (!mainEl || !subEl) return;

    if (btnEl) btnEl.textContent = '💎 Premium';

    var user = getVar('user');
    var hasPaid = false;
    var getTrialInfoFn = getFn('getTrialInfo');
    var hasPaidAccessFn = getFn('hasPaidAccess');
    var userAccess = getVar('userAccess') || {};

    try {
      hasPaid = typeof hasPaidAccessFn === 'function' ? !!hasPaidAccessFn() : false;
    } catch (_) {
      hasPaid = false;
    }

    if (!user) {
      mainEl.textContent = 'Премиум — 100 ₽ в месяц';
      subEl.textContent = 'Войдите в Google, затем нажмите на алмаз 💎, чтобы подключить доступ.';
      return;
    }

    if (hasPaid) {
      var until = formatDate(Number(userAccess.premiumUntilMs || 0));
      mainEl.textContent = 'Премиум активен';
      subEl.textContent = until
        ? '100 ₽ в месяц · доступ до ' + until
        : '100 ₽ в месяц · полный доступ включён';
      return;
    }

    try {
      if (typeof getTrialInfoFn === 'function') {
        var trial = getTrialInfoFn();
        if (trial && trial.active) {
          var daysLeft = getTrialDaysLeft(trial);
          mainEl.textContent = 'Пробный период активен';
          subEl.textContent = daysLeft !== null
            ? 'Осталось дней: ' + daysLeft + ' · Premium — 100 ₽ в месяц'
            : 'Премиум — 100 ₽ в месяц. Для подключения позже нажмите на алмаз 💎.';
          return;
        }
      }
    } catch (_) {}

    mainEl.textContent = 'Премиум — 100 ₽ в месяц';
    subEl.textContent = 'Чтобы подключить доступ, нажмите на алмаз 💎.';
  }

  function wrapRuntime() {
    var changed = false;
    var renderNotes = getFn('renderNotes');
    var renderApp = getFn('renderApp');

    if (!window.__arabrusNotebookCardsRenderWrapped && typeof renderNotes === 'function') {
      setFn('renderNotes', function () {
        var user = getVar('user');
        if (!user) return '<div class="empty">Войдите через Google, чтобы использовать блокнот</div>';
        try {
          if (typeof isPremiumLocked === 'function' && isPremiumLocked()) return renderLockedFeature('Блокнот');
        } catch (_) {}

        var items = getItems();
        if (!items.length) return '<div class="empty">В блокноте пока пусто</div>';
        if (window.noteViewMode !== 'cards') return renderNotes.apply(this, arguments);
        return renderCards(items);
      });
      window.__arabrusNotebookCardsRenderWrapped = true;
      changed = true;
    }

    if (!window.__arabrusNotebookCardsAppWrapped && typeof renderApp === 'function') {
      setFn('renderApp', function () {
        var result = renderApp.apply(this, arguments);
        updateButton();
        applyAccessCopy();
        return result;
      });
      window.__arabrusNotebookCardsAppWrapped = true;
      changed = true;
    }

    updateButton();
    applyAccessCopy();

    if (window.__arabrusNotebookCardsRenderWrapped && window.__arabrusNotebookCardsAppWrapped && watchTimer) {
      clearInterval(watchTimer);
      watchTimer = null;
      var fn = getFn('renderApp');
      if (typeof fn === 'function') {
        try { fn(); } catch (_) {}
      }
    }

    return changed;
  }

  function startWatcher() {
    injectStyles();
    ensureButton();
    updateButton();
    wrapRuntime();

    if (!window.__arabrusAccessCopyTimer) {
      window.__arabrusAccessCopyTimer = setInterval(applyAccessCopy, 1200);
    }

    if (window.__arabrusNotebookCardsRenderWrapped && window.__arabrusNotebookCardsAppWrapped) return;
    if (watchTimer) return;

    watchTimer = setInterval(function () {
      tries += 1;
      wrapRuntime();
      if (tries > 200 && watchTimer) {
        clearInterval(watchTimer);
        watchTimer = null;
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWatcher, { once: true });
  } else {
    startWatcher();
  }

  window.addEventListener('load', startWatcher);
})();