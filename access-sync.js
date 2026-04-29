(function(){
  if(window.__arabrusAccessSync)return;
  window.__arabrusAccessSync=true;
  var APP='arabrus-v41-monthly-sub';
  var KEY='arabrus_access_cache_v1_';
  var last=0,busy=false,lastAppliedUntil=0,lastUid='';

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
  function getUntil(d){return ms(d&& (d.premiumUntilMs||d.premiumUntil||d.validUntil||d.accessUntil||d.expiresAt||d.until));}

  function saveCache(id,until){
    try{if(id&&until>Date.now())localStorage.setItem(KEY+id,JSON.stringify({premiumActive:true,premiumUntilMs:until,savedAt:Date.now()}));}catch(_){}
  }

  function loadCache(id){
    try{
      var raw=localStorage.getItem(KEY+id);
      if(!raw)return 0;
      var data=JSON.parse(raw);
      var until=getUntil(data);
      return until>Date.now()?until:0;
    }catch(_){return 0;}
  }

  function apply(until,skipRender){
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
      saveCache(uid(),nextUntil);
      if(changed&&!skipRender){
        try{if(typeof updateTrialIndicator==='function')updateTrialIndicator();}catch(_){}
        try{if(typeof renderApp==='function')renderApp();}catch(_){}
      }
      return true;
    }catch(_){return false;}
  }

  function applyCache(){
    var id=uid();
    if(!id)return false;
    if(id!==lastUid){lastUid=id;last=0;}
    var cachedUntil=loadCache(id);
    if(cachedUntil)return apply(cachedUntil,true);
    return false;
  }

  function patchAccessChecks(){
    try{
      if(typeof hasPaidAccess==='function'&&!hasPaidAccess.__accessSyncCached){
        var oldHasPaid=hasPaidAccess;
        hasPaidAccess=function(){
          try{applyCache();}catch(_){}
          try{if(typeof userAccess!=='undefined'&&userAccess){var until=Number(userAccess.premiumUntilMs||0);if(until>Date.now())return true;}}catch(_){}
          try{return !!oldHasPaid.apply(this,arguments);}catch(_){return false;}
        };
        hasPaidAccess.__accessSyncCached=true;
        try{window.hasPaidAccess=hasPaidAccess;}catch(_){}
      }
      if(typeof canUsePremiumFeatures==='function'&&!canUsePremiumFeatures.__accessSyncCached){
        var oldCanUse=canUsePremiumFeatures;
        canUsePremiumFeatures=function(){
          try{if(typeof hasPaidAccess==='function'&&hasPaidAccess())return true;}catch(_){}
          try{return !!oldCanUse.apply(this,arguments);}catch(_){return false;}
        };
        canUsePremiumFeatures.__accessSyncCached=true;
        try{window.canUsePremiumFeatures=canUsePremiumFeatures;}catch(_){}
      }
    }catch(_){}
  }

  async function read(force){
    patchAccessChecks();
    applyCache();
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
        try{var s=await refs[i].get(); if(s&&s.exists&&apply(getUntil(s.data()),false))break;}catch(_){}
      }
    }finally{busy=false;}
  }

  function start(){
    patchAccessChecks();
    read(true);
    var fastTicks=0;
    var fast=setInterval(function(){fastTicks++;read(false);if(fastTicks>15)clearInterval(fast);},350);
    setInterval(function(){read(false);},3000);
    window.addEventListener('online',function(){read(true);});
    window.addEventListener('focus',function(){read(true);});
    document.addEventListener('visibilitychange',function(){if(!document.hidden)read(true);});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
