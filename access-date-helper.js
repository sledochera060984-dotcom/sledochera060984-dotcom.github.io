(function(){
  if(window.__arabrusAccessDateHelper)return;
  window.__arabrusAccessDateHelper=true;
  function parseAccessDate(v){
    if(!v)return 0;
    if(typeof v==='number')return v>100000000000?v:v*1000;
    if(typeof v==='string'){
      var s=v.trim();
      if(/^\d+$/.test(s))return parseAccessDate(Number(s));
      var p=Date.parse(s);
      return Number.isNaN(p)?0:p;
    }
    if(v instanceof Date)return v.getTime();
    if(typeof v.toDate==='function')return parseAccessDate(v.toDate());
    if(typeof v.toMillis==='function')return Number(v.toMillis())||0;
    if(typeof v.seconds==='number')return v.seconds*1000;
    if(typeof v._seconds==='number')return v._seconds*1000;
    return 0;
  }
  window.arabrusParseAccessDate=parseAccessDate;
})();
