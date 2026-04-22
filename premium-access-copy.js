(function () {
  if (window.__arabrusPremiumAccessCopyInstalled) return;
  window.__arabrusPremiumAccessCopyInstalled = true;

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

  function isLoggedIn() {
    try { return typeof user !== 'undefined' && !!user; } catch (_) { return !!window.user; }
  }

  function hasPaid() {
    try { return typeof hasPaidAccess === 'function' ? !!hasPaidAccess() : false; } catch (_) { return false; }
  }

  function getTrial() {
    try { return typeof getTrialInfo === 'function' ? getTrialInfo() : null; } catch (_) { return null; }
  }

  function getPremiumUntil() {
    try {
      return typeof userAccess !== 'undefined' && userAccess ? Number(userAccess.premiumUntilMs || 0) : 0;
    } catch (_) {
      return 0;
    }
  }

  function applyAccessCopy() {
    var mainEl = document.getElementById('compactAuthAccessMain');
    var subEl = document.getElementById('compactAuthAccessSub');
    var btnEl = document.getElementById('compactAuthAccessBtn');
    if (!mainEl || !subEl) return;

    if (btnEl) {
      btnEl.textContent = '💎 Premium';
      btnEl.title = 'Нажмите на алмаз для доступа';
    }

    if (!isLoggedIn()) {
      mainEl.textContent = 'Премиум — 100 ₽ в месяц';
      subEl.textContent = 'Войдите в Google. Потом нажмите на алмаз 💎, чтобы подключить доступ.';
      return;
    }

    if (hasPaid()) {
      var until = formatDate(getPremiumUntil());
      mainEl.textContent = 'Премиум активен';
      subEl.textContent = until
        ? '100 ₽ в месяц · доступ активен до ' + until
        : '100 ₽ в месяц · полный доступ включён';
      return;
    }

    var trial = getTrial();
    if (trial && trial.active) {
      mainEl.textContent = 'Пробный период активен';
      subEl.textContent = 'Премиум — 100 ₽ в месяц. Чтобы подключить позже, нажмите на алмаз 💎.';
      return;
    }

    mainEl.textContent = 'Премиум — 100 ₽ в месяц';
    subEl.textContent = 'Чтобы подключить доступ, нажмите на алмаз 💎.';
  }

  function start() {
    applyAccessCopy();
    setInterval(applyAccessCopy, 700);
    var target = document.getElementById('compactAuthModalWrap');
    if (target && 'MutationObserver' in window) {
      var observer = new MutationObserver(applyAccessCopy);
      observer.observe(target, { childList: true, subtree: true, attributes: true, characterData: true });
    }
    window.addEventListener('online', applyAccessCopy);
    window.addEventListener('offline', applyAccessCopy);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();