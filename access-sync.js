(function(){
  if(window.__arabrusAccessSync)return;
  window.__arabrusAccessSync=true;
  var APP='arabrus-v41-monthly-sub';
  var last=0,busy=false,lastAppliedUntil=0;
  function ms(v){
    try{
      if(!v)return 0;
      if(typeof window.arabrusParseAccessDate==='function')return window.arabrusParseAccessDate(v);
      if(typeof v==='number')return v>100000000000?v:v*1000;
      if(v&&typeof v.toDate==='function')return v.toDate().getTime();
      if(v&&typeof v.seconds==='number')return v.seconds*1000;
      var p=Date.parse(String(v));
      return Number.isNaN(p)?0:p;
    }catch(_){return 0;}
  }
  function uid(){try{return user&&user.uid?String(user.uid):'';}catch(_){return '';}}
  function getUntil(d){return ms(d.premiumUntilMs||d.premiumUntil||d.validUntil||d.accessUntil||d.expiresAt||d.until);}
  function apply(until){
    if(!until||until<=Date.now())return false;
    try{
      if(typeof userAccess==='undefined'||!userAccess)userAccess={};
      var wasActive=!!userAccess.premiumActive;
      var oldUntil=Number(userAccess.premiumUntilMs||0);
      var nextUntil=Math.max(oldUntil,until);
      var changed=(!wasActive)||(oldUntil!==nextUntil)||(lastAppliedUntil!==nextUntil);
      userAccess.premiumUntilMs=nextUntil;
      userAccess.premiumActive=true;
      window.userAccess=userAccess;
      lastAppliedUntil=nextUntil;
      if(changed){
        try{if(typeof updateTrialIndicator==='function')updateTrialIndicator();}catch(_){}
        try{if(typeof renderApp==='function')renderApp();}catch(_){}
      }
      return true;
    }catch(_){return false;}
  }
  async function read(force){
    var id=uid(); if(!id)return;
    if(busy)return;
    if(!force&&Date.now()-last<2500)return;
    last=Date.now();
    try{if(typeof db==='undefined'||!db||db.__offlineStub)return;}catch(_){return;}
    busy=true;
    try{
      var refs=[
        db.collection('artifacts').doc(APP).collection('users').doc(id).collection('data').doc('access'),
        db.collection('users').doc(id).collection('data').doc('access'),
        db.collection('users').doc(id).collection('data').doc('paymentInfo'),
        db.collection('userAccess').doc(id)
      ];
      for(var i=0;i<refs.length;i++){
        try{var s=await refs[i].get(); if(s&&s.exists&&apply(getUntil(s.data())))break;}catch(_){}
      }
    }finally{busy=false;}
  }
  function start(){read(true);setInterval(function(){read(false);},3000);window.addEventListener('online',function(){read(true);});document.addEventListener('visibilitychange',function(){if(!document.hidden)read(true);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
