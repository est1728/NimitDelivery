/* ==========================================================================
   Nimit Delivery — Motion & Micro-interaction Utility
   Shared across customer / merchant / rider / admin sites.
   Include with: <script src="motion.js"></script>
   No markup changes required — ripple/press effects auto-bind to common
   interactive selectors. Everything else is called explicitly via Motion.*
   ========================================================================== */
(function(){
  const DUR = 220; // default animation duration (150-300ms range)

  /* ---------- inject shared CSS once ---------- */
  const css = `
  .m-page{opacity:0;animation:mFadeInPage .28s ease forwards;}
  @keyframes mFadeInPage{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .m-page-out{animation:mFadeOutPage .16s ease forwards;}
  @keyframes mFadeOutPage{to{opacity:0;transform:translateY(-4px)}}

  button,[onclick],.sc,.pop-card,.cart,.addr-chip,.dot,.m-press{
    transition:transform .12s cubic-bezier(.4,0,.2,1),opacity .12s;
    -webkit-tap-highlight-color:transparent;
  }
  button:active,[onclick]:active,.sc:active,.pop-card:active,.cart:active,.addr-chip:active,.m-press:active{
    transform:scale(.96);
  }

  .m-ripple-wrap{position:relative;overflow:hidden;}
  .m-ripple{position:absolute;border-radius:50%;background:rgba(255,255,255,.55);
    transform:scale(0);animation:mRipple .5s ease-out;pointer-events:none;}
  .m-ripple.dark{background:rgba(12,74,166,.18);}
  @keyframes mRipple{to{transform:scale(2.6);opacity:0;}}

  .m-fade-in{opacity:0;animation:mFadeUp .32s ease forwards;}
  @keyframes mFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

  .m-skel{background:linear-gradient(90deg,#e9edf3 25%,#f4f6f9 37%,#e9edf3 63%);
    background-size:400% 100%;animation:mShimmer 1.4s ease infinite;border-radius:20px;}
  @keyframes mShimmer{0%{background-position:100% 0}100%{background-position:0 0}}

  .m-toast-host{position:fixed;left:0;right:0;bottom:24px;display:flex;flex-direction:column;
    align-items:center;gap:8px;z-index:9999;pointer-events:none;padding:0 16px;}
  .m-toast{pointer-events:auto;max-width:92vw;background:#1e293b;color:#fff;font-size:13.5px;
    font-weight:600;padding:11px 18px;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.22);
    display:flex;align-items:center;gap:8px;animation:mToastIn .22s cubic-bezier(.34,1.56,.64,1) forwards;}
  .m-toast.out{animation:mToastOut .18s ease forwards;}
  .m-toast.success{background:#16a34a;} .m-toast.error{background:#dc2626;} .m-toast.info{background:#0c4aa6;}
  @keyframes mToastIn{from{opacity:0;transform:translateY(16px) scale(.94)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes mToastOut{to{opacity:0;transform:translateY(10px) scale(.96)}}

  .m-modal-mask{position:fixed;inset:0;background:rgba(0,0,0,0);z-index:998;
    transition:background .2s ease;display:flex;align-items:flex-end;justify-content:center;}
  .m-modal-mask.on{background:rgba(15,23,42,.5);}
  .m-modal-box{transform:scale(.92) translateY(12px);opacity:0;transition:transform .22s cubic-bezier(.34,1.56,.64,1),opacity .18s;}
  .m-modal-mask.on .m-modal-box{transform:scale(1) translateY(0);opacity:1;}

  .m-spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;
    border-radius:50%;display:inline-block;animation:mSpin .6s linear infinite;}
  .m-spin.dark{border:2px solid rgba(12,74,166,.25);border-top-color:var(--p,#0c4aa6);}
  @keyframes mSpin{to{transform:rotate(360deg)}}
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- page enter transition ---------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    document.body.classList.add('m-page');
  });
  // Fix: when the browser restores this page from bfcache (back/forward button),
  // DOMContentLoaded does NOT fire again, so a pending fade-out class would leave
  // the page stuck invisible. Always reset visibility on pageshow.
  window.addEventListener('pageshow', ()=>{
    document.body.classList.remove('m-page-out');
    document.body.classList.add('m-page');
  });

  /* ---------- ripple (auto-delegated, no markup needed) ---------- */
  const RIPPLE_SELECTOR = 'button,[onclick],.sc,.pop-card,.cart,.addr-chip,.m-press';
  document.addEventListener('pointerdown', e=>{
    const el = e.target.closest(RIPPLE_SELECTOR);
    if(!el || el.classList.contains('closed')) return;
    const cs = getComputedStyle(el);
    if(cs.position === 'static') el.style.position = 'relative';
    el.classList.add('m-ripple-wrap');
    const r = document.createElement('span');
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const dark = ['BUTTON'].includes(el.tagName) === false && !el.classList.contains('cart');
    r.className = 'm-ripple' + (dark ? ' dark' : '');
    r.style.width = r.style.height = size + 'px';
    r.style.left = (e.clientX - rect.left - size/2) + 'px';
    r.style.top = (e.clientY - rect.top - size/2) + 'px';
    el.appendChild(r);
    setTimeout(()=>r.remove(), 520);
  }, {passive:true});

  /* ---------- haptic feedback (respects on/off pref) ---------- */
  function hapticEnabled(){ return localStorage.getItem('hapticOff') !== '1'; }
  function haptic(pattern){
    if(!hapticEnabled() || !navigator.vibrate) return;
    try{ navigator.vibrate(pattern||10); }catch(e){}
  }

  /* ---------- toast ---------- */
  let toastHost = null;
  function toast(msg, type='info', duration=2400){
    if(!toastHost){
      toastHost = document.createElement('div');
      toastHost.className = 'm-toast-host';
      document.body.appendChild(toastHost);
    }
    const el = document.createElement('div');
    el.className = 'm-toast ' + type;
    el.textContent = msg;
    toastHost.appendChild(el);
    setTimeout(()=>{
      el.classList.add('out');
      setTimeout(()=>el.remove(), 200);
    }, duration);
    return el;
  }

  /* ---------- skeleton loading ---------- */
  function skeletonCards(count, height){
    height = height || 178;
    let out = '';
    for(let i=0;i<(count||3);i++){
      out += `<div class="m-skel" style="height:${height}px;margin-bottom:12px"></div>`;
    }
    return out;
  }
  function skeletonRow(count, w, h){
    let out = '<div style="display:flex;gap:12px;overflow:hidden">';
    for(let i=0;i<(count||3);i++){
      out += `<div class="m-skel" style="min-width:${w||160}px;height:${h||160}px;flex-shrink:0"></div>`;
    }
    return out + '</div>';
  }

  /* ---------- fade-in stagger for a freshly-rendered list ---------- */
  function staggerIn(container, selector, stepMs){
    if(!container) return;
    const items = selector ? container.querySelectorAll(selector) : container.children;
    const step = stepMs || 45;
    Array.from(items).forEach((it,i)=>{
      it.classList.add('m-fade-in');
      it.style.animationDelay = Math.min(i*step, 400) + 'ms';
    });
  }

  /* ---------- navigate with fade-out transition ---------- */
  function navigate(url, delay){
    haptic(8);
    document.body.classList.add('m-page-out');
    setTimeout(()=>{ location.href = url; }, delay || 150);
  }

  /* ---------- button loading state helper ---------- */
  function setBtnLoading(btn, loading, loadingText){
    if(!btn) return;
    if(loading){
      if(!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.style.opacity = '.75';
      btn.innerHTML = `<span class="m-spin"></span>${loadingText?(' '+loadingText):''}`;
    } else {
      btn.disabled = false;
      btn.style.opacity = '';
      if(btn.dataset.origHtml){ btn.innerHTML = btn.dataset.origHtml; delete btn.dataset.origHtml; }
    }
  }

  /* ---------- modal open/close (fade + scale) ---------- */
  function openModal(mask){
    if(typeof mask === 'string') mask = document.getElementById(mask) || document.querySelector(mask);
    if(!mask) return;
    mask.style.display = 'flex';
    requestAnimationFrame(()=> mask.classList.add('on'));
  }
  function closeModal(mask){
    if(typeof mask === 'string') mask = document.getElementById(mask) || document.querySelector(mask);
    if(!mask) return;
    mask.classList.remove('on');
    setTimeout(()=>{ mask.style.display = 'none'; }, 200);
  }

  window.Motion = {
    toast, haptic, skeletonCards, skeletonRow, staggerIn, navigate,
    setBtnLoading, openModal, closeModal
  };
})();
