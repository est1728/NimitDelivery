/* live.js — ให้หน้าลูกค้าอัปเดตเองโดยไม่ต้องรีเฟรช
   NimitLive.watch(fn, {every: มิลลิวินาที (0 = ไม่วนตามเวลา)})
   เรียก fn ใหม่เมื่อ: กลับมาเปิดหน้า/แอป (visibilitychange, focus, pageshow จากแคชย้อนกลับ), เน็ตกลับมา, และทุก every ms ขณะหน้าเปิดอยู่
   (ไม่ทำงานตอนหน้าถูกซ่อน, ไม่ซ้อนกัน, ห่างกันอย่างน้อย 4 วินาที) */
(function(){
  var MIN=4000;
  window.NimitLive={watch:function(fn,opt){
    opt=opt||{}; var every=opt.every==null?25000:opt.every, last=Date.now(), busy=false;
    function run(force){
      if(document.hidden||busy) return;
      var n=Date.now(); if(!force&&n-last<MIN) return;
      last=n; busy=true;
      Promise.resolve().then(function(){return fn(!!force);}).catch(function(){}).then(function(){busy=false;});
    }
    document.addEventListener('visibilitychange',function(){ if(!document.hidden) run(); });
    window.addEventListener('focus',function(){ run(); });
    window.addEventListener('pageshow',function(e){ if(e.persisted) run(true); });
    window.addEventListener('online',function(){ run(true); });
    if(every>0) setInterval(function(){ run(); },every);
    return run;
  }};
})();
