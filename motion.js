// ============================================
// Nimit Delivery — Motion & Micro-interactions
// ใส่ <script src="motion.js"></script> ทุกหน้า
// ============================================

(function(){
// ===== RIPPLE EFFECT =====
function addRipple(el){
  el.style.position='relative';
  el.style.overflow='hidden';
  el.addEventListener('pointerdown',function(e){
    var r=document.createElement('span');
    var rect=el.getBoundingClientRect();
    var size=Math.max(rect.width,rect.height)*2;
    r.style.cssText='position:absolute;border-radius:50%;pointer-events:none;transform:scale(0);animation:_ripple .5s linear;width:'+size+'px;height:'+size+'px;left:'+(e.clientX-rect.left-size/2)+'px;top:'+(e.clientY-rect.top-size/2)+'px;background:rgba(255,255,255,0.35);';
    el.appendChild(r);
    setTimeout(()=>r.remove(),500);
  });
}
// inject ripple CSS
var s=document.createElement('style');
s.textContent='@keyframes _ripple{to{transform:scale(1);opacity:0}}'+
  '._press{transition:transform .1s,box-shadow .1s !important;}'+
  '._press:active{transform:scale(0.96) !important;}'+
  '.btn,.save-btn,.next-btn,.next-fab,.submit-btn,.bnxt,.bprev,.basgn,.action-btn,.cart-btn,.back,.tb-back,.reorder-btn,.done-btn{position:relative;overflow:hidden;}';
document.head.appendChild(s);

// apply ripple to all buttons
function applyRipples(){
  document.querySelectorAll('button,a.btn,[role="button"]').forEach(function(el){
    if(!el.dataset.ripple){el.dataset.ripple='1';addRipple(el);el.classList.add('_press');}
  });
}

// ===== TOAST =====
var toastEl=null;
window.showToast=function(msg,type,duration){
  if(!toastEl){
    toastEl=document.createElement('div');
    toastEl.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);padding:10px 20px;border-radius:20px;font-size:14px;font-weight:700;color:#fff;z-index:9999;opacity:0;transition:all .3s;pointer-events:none;max-width:80vw;text-align:center;white-space:nowrap;';
    document.body.appendChild(toastEl);
  }
  var colors={ok:'#16a34a',er:'#dc2626',in:'#0c4aa6',warn:'#f59e0b'};
  toastEl.style.background=colors[type||'in']||colors.in;
  toastEl.textContent=msg;
  toastEl.style.opacity='1';
  toastEl.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(toastEl._t);
  toastEl._t=setTimeout(function(){
    toastEl.style.opacity='0';
    toastEl.style.transform='translateX(-50%) translateY(20px)';
  },duration||2500);
};

// patch existing toast() if exists
if(typeof toast==='undefined'){window.toast=window.showToast;}

// ===== SKELETON LOADER =====
var skCss=document.createElement('style');
skCss.textContent='.sk{background:linear-gradient(90deg,#f0f2f5 25%,#e8ebf0 50%,#f0f2f5 75%);background-size:200% 100%;animation:_sk 1.4s infinite;border-radius:8px;}&@keyframes _sk{0%{background-position:200% 0}100%{background-position:-200% 0}}'.replace('}&','} ');
document.head.appendChild(skCss);
window.skeleton=function(w,h,r){
  var el=document.createElement('div');
  el.className='sk';
  el.style.cssText='width:'+(w||'100%')+';height:'+(h||'16px')+';border-radius:'+(r||'8px')+';margin:4px 0;';
  return el;
};

// ===== HAPTIC FEEDBACK =====
window.haptic=function(type){
  if(!navigator.vibrate) return;
  if(type==='light') navigator.vibrate(10);
  else if(type==='medium') navigator.vibrate(30);
  else if(type==='heavy') navigator.vibrate([40,20,40]);
  else if(type==='success') navigator.vibrate([20,30,20]);
  else navigator.vibrate(15);
};

// ===== SMOOTH PAGE TRANSITION =====
var fadeCss=document.createElement('style');
fadeCss.textContent='body{animation:_fadeIn .25s ease}@keyframes _fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}';
document.head.appendChild(fadeCss);

// ===== CARD ENTRANCE ANIMATION =====
var entrCss=document.createElement('style');
entrCss.textContent='.sc,.order-card,.addr-card,.pop-card,.rev-card{animation:_slideUp .3s ease both}@keyframes _slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}';
document.head.appendChild(entrCss);
// stagger cards
function staggerCards(){
  document.querySelectorAll('.sc,.order-card,.addr-card,.pop-card,.rev-card').forEach(function(el,i){
    el.style.animationDelay=(i*60)+'ms';
  });
}

// ===== INIT =====
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){applyRipples();staggerCards();});
} else { applyRipples(); staggerCards(); }

// re-apply when new content added
var obs=new MutationObserver(function(){applyRipples();staggerCards();});
obs.observe(document.body,{childList:true,subtree:true});
})();
