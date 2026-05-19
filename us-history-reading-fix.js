(function(){
  window.j = window.j || function(value){
    try {
      if (typeof window.escapeJs === 'function') return window.escapeJs(value);
    } catch (_) {}
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  };
})();
