(function () {
  if (window.__arabrusTrialAccessLabelInstalled) return;
  window.__arabrusTrialAccessLabelInstalled = true;

  function refreshTrialAccessLabel() {
    try {
      var mainEl = document.getElementById('compactAuthAccessMain');
      var subEl = document.getElementById('compactAuthAccessSub');
      var btnEl = document.getElementById('compactAuthAccessBtn');
      if (!mainEl || !subEl) return;

      if (btnEl) btnEl.textContent = '💎 Premium';

      if (typeof user === 'undefined' || !user) return;
      if (typeof hasPaidAccess === 'function' && hasPaidAccess()) return;
      if (typeof getTrialInfo !== 'function') return;

      var trial = getTrialInfo();
      if (!trial || !trial.active) return;

      var daysLeft = Number(trial.daysLeft);
      mainEl.textContent = 'Пробный период активен';
      subEl.textContent = Number.isFinite(daysLeft)
        ? 'Осталось дней: ' + daysLeft + ' · Premium — 100 ₽ в месяц'
        : 'Premium — 100 ₽ в месяц. Для доступа нажмите на алмаз 💎';
    } catch (_) {}
  }

  function start() {
    refreshTrialAccessLabel();
    window.setInterval(refreshTrialAccessLabel, 800);
    window.addEventListener('load', refreshTrialAccessLabel);
    window.addEventListener('online', refreshTrialAccessLabel);
    window.addEventListener('offline', refreshTrialAccessLabel);
    document.addEventListener('visibilitychange', refreshTrialAccessLabel);
    document.addEventListener('click', function () {
      window.setTimeout(refreshTrialAccessLabel, 30);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();