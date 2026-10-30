/* ===== Nimit Theme (ธีมเทศกาล) — ใช้ร่วมกันทุกหน้า =====
   - ตั้งค่าเลือกธีมที่ developer.html → เก็บที่ Firestore: settings/theme { active, start, end }
   - แต่ละธีมนิยามที่นี่: ชุดสี (ตัวแปร CSS), ชุดภาพมาสคอต, ภาพตกแต่งส่วนหัว
   - หน้าที่ใช้: <script src="theme.js"></script> ในส่วน <head> (ใส่ data-noapply ถ้าแค่ต้องการรายการธีม)
   - ภาพมาสคอตใช้ชื่อไฟล์เดียวกับชุดปกติ (mascot/NAME.webp) วางที่ theme/<id>/mascot/NAME.webp
     ถ้าไม่มีไฟล์ จะถอยกลับไปใช้ชุดปกติเอง                                                    */
(function(){
  var PRESETS={
    'default':{name:'ปกติ',vars:{},themeColor:'#0B2C63',swatch:['#071B3D','#0E3B8C','#2E6FE0']},
    'halloween':{name:'ฮาโลวีน',themeColor:'#1A0B2E',swatch:['#1A0B2E','#5A2A9A','#FF7A18'],
      mascotDir:'theme/halloween/mascot/',sprites:['web','pumpkin','bat','ghost'],spriteDir:'theme/halloween/deco/',deco:{header:'theme/halloween/header.webp'},
      vars:{'--blue-900':'#1A0B2E','--blue-800':'#2A1048','--blue-700':'#4B1F7C','--blue-600':'#6A2FB0','--blue-500':'#8A4FD6',
            '--blue-100':'#EFE5FB','--blue-50':'#F8F3FE','--bg':'#F8F4FC',
            '--t1':'#EDE2FB','--t2':'#F6F0FE','--t3':'#E2D2F6','--t4':'#EEE3FA','--t5':'#E6DAF5','--t6':'#D3BFEF',
            '--amber-500':'#FF7A18','--amber-600':'#E0620A','--amber-100':'#FFE9D6'}}
  };
  var KEY='appThemeCfg', root=document.documentElement, applied='default', applyVars=[], spriteNames=[];
  var script=document.currentScript; var noApply=script&&script.hasAttribute('data-noapply');
  function today(){var d=new Date();return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
  function pick(cfg){
    if(!cfg||!cfg.active||!PRESETS[cfg.active]||cfg.active==='default') return 'default';
    var t=today(); if(cfg.start&&t<cfg.start) return 'default'; if(cfg.end&&t>cfg.end) return 'default';
    return cfg.active;
  }
  function paintDeco(p){
    var els=document.querySelectorAll('[data-theme-deco]');
    for(var i=0;i<els.length;i++){(function(el){
      var url=p.deco&&p.deco[el.getAttribute('data-theme-deco')];
      if(!url){ el.style.backgroundImage=''; el.style.display='none'; return; }
      var im=new Image(); im.onload=function(){ el.style.backgroundImage='url("'+url+'")'; el.style.display='block'; };
      im.onerror=function(){ el.style.backgroundImage=''; el.style.display='none'; }; im.src=url;
    })(els[i]);}
  }
  function refreshImgs(){
    var els=document.querySelectorAll('img[data-m]');
    for(var i=0;i<els.length;i++){ var n=els[i].getAttribute('data-m'); var u=NT.mascot(n); if(els[i].getAttribute('src')!==u) els[i].src=u; }
  }
  function apply(id){
    var p=PRESETS[id]||PRESETS['default'];
    for(var i=0;i<applyVars.length;i++) root.style.removeProperty(applyVars[i]);
    applyVars=[]; for(var k in p.vars){ root.style.setProperty(k,p.vars[k]); applyVars.push(k); }
    root.setAttribute('data-theme',id); applied=id;
    /* สไปรต์ตกแต่ง: โหลดได้จึงตั้งตัวแปร --sp-NAME และเพิ่มชื่อใน data-sp (ไม่มีไฟล์ = ไม่แสดง ไม่พัง) */
    spriteNames.forEach(function(n){ root.style.removeProperty('--sp-'+n); }); spriteNames=[]; root.removeAttribute('data-sp');
    (p.sprites||[]).forEach(function(n){ var u=p.spriteDir+n+'.webp', im=new Image();
      im.onload=function(){ if(applied!==id) return; root.style.setProperty('--sp-'+n,'url("'+u+'")'); spriteNames.push(n); root.setAttribute('data-sp',spriteNames.join(' ')); };
      im.src=u; });
    var m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content',p.themeColor||'#0B2C63');
    function after(){ paintDeco(p); refreshImgs(); try{ window.dispatchEvent(new CustomEvent('themechange',{detail:{id:id}})); }catch(e){} }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',after); else after();
  }
  var NT=window.NimitTheme={
    presets:PRESETS, active:function(){return applied;}, apply:apply, pick:pick,
    list:function(){return Object.keys(PRESETS).map(function(k){return {id:k,name:PRESETS[k].name,swatch:PRESETS[k].swatch};});},
    mascot:function(name){var p=PRESETS[applied]; return (p&&p.mascotDir?p.mascotDir:'mascot/')+name+'.webp';},
    fallback:function(el){ el.onerror=null; el.src='mascot/'+el.getAttribute('data-m')+'.webp'; },
    sync:function(){
      if(noApply) return Promise.resolve();
      var url='https://firestore.googleapis.com/v1/projects/nimit-delivery/databases/(default)/documents/settings/theme?key=AIzaSyCnBUk0ZKFcwMK0NyYkheux1xPt9bLYhr4';
      return fetch(url).then(function(r){ if(r.status===404) return {fields:{}}; if(!r.ok) throw 0; return r.json(); }).then(function(j){
        var f=(j&&j.fields)||{}, cfg={active:(f.active&&f.active.stringValue)||'default',start:(f.start&&f.start.stringValue)||'',end:(f.end&&f.end.stringValue)||''};
        try{localStorage.setItem(KEY,JSON.stringify(cfg));}catch(e){}
        var id=pick(cfg); if(id!==applied) apply(id);
      }).catch(function(){});
    }
  };
  window.mc=function(n){return NT.mascot(n);}; window.mcErr=NT.fallback;
  if(!noApply){
    var cfg=null; try{cfg=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
    var id=pick(cfg); if(id!=='default') apply(id);
    NT.sync();
  }
})();
