// nav-enhance.js — เอฟเฟกต์เปลี่ยนหน้าลื่นๆ + โหลดหน้าถัดไปล่วงหน้าตอนวางนิ้ว/เมาส์
// แยกไฟล์จาก motion.js เดิมโดยตั้งใจ กันชนกับของเก่าที่ยังไม่เห็นเนื้อหา
// ไฟล์นี้ไม่แก้ UI/เนื้อหาเดิมเลย เป็นแค่ enhancement เสริม เบราว์เซอร์ที่ไม่รองรับจะไม่มีผลอะไร ไม่พัง

(function(){
  "use strict";

  // ===== 1) PREFETCH ON HOVER/TOUCH =====
  // เว็บนี้เปลี่ยนหน้าด้วย onclick="location.href='xxx.html'" เป็นหลัก ไม่ใช่ <a href> ธรรมดา
  // เลยต้องดักทั้ง <a href> และ element ที่มี onclick แบบนี้ด้วย
  var prefetched = {};
  function prefetch(url){
    if(!url || prefetched[url]) return;
    if(!/\.html?($|\?|#)/.test(url)) return; // เฉพาะไฟล์ .html ในเว็บเราเอง กัน prefetch ลิงก์นอก/ไฟล์แปลกๆ
    if(/^https?:\/\//i.test(url) && url.indexOf(location.origin)!==0) return; // กันลิงก์ข้ามโดเมน
    prefetched[url] = true;
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }
  function extractUrl(el){
    if(!el) return null;
    if(el.tagName === 'A' && el.getAttribute('href')) return el.getAttribute('href');
    var oc = el.getAttribute('onclick');
    if(oc){
      var m = oc.match(/(?:location\.href|window\.location\.href|location\.assign)\s*=?\(?\s*['"]([^'"]+\.html[^'"]*)['"]/);
      if(m) return m[1];
    }
    return null;
  }
  function onHoverLike(e){
    var el = e.target && e.target.closest && e.target.closest('a[href], [onclick]');
    if(el) prefetch(extractUrl(el));
  }
  document.addEventListener('mouseenter', onHoverLike, true); // capture เพราะ mouseenter ไม่ bubble
  document.addEventListener('touchstart', onHoverLike, {capture:true, passive:true});
  document.addEventListener('focus', onHoverLike, true); // เผื่อกด tab ด้วยคีย์บอร์ด

  // ===== 2) VIEW TRANSITIONS (CROSS-DOCUMENT) =====
  // Chrome/Edge รุ่นใหม่รองรับเอฟเฟกต์เปลี่ยนหน้าแบบ native สำหรับเว็บหลายหน้าธรรมดาแบบนี้โดยตรง
  // ไม่รองรับก็แค่เปลี่ยนหน้าปกติเหมือนเดิมทุกอย่าง ไม่มีอะไรพัง ไม่ต้องพึ่ง React/framework ใดๆเลย
  if(!document.querySelector('meta[name="view-transition"]')){
    var meta = document.createElement('meta');
    meta.name = 'view-transition';
    meta.content = 'same-origin';
    document.head.appendChild(meta);
  }
  if(!document.getElementById('nav-enhance-vt-style')){
    var style = document.createElement('style');
    style.id = 'nav-enhance-vt-style';
    style.textContent =
      '@media (prefers-reduced-motion: no-preference){' +
      '::view-transition-old(root){animation:220ms ease both nav-fade-out;}' +
      '::view-transition-new(root){animation:220ms ease both nav-fade-in;}' +
      '@keyframes nav-fade-out{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(-6px);}}' +
      '@keyframes nav-fade-in{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}' +
      '}' +
      '@media (prefers-reduced-motion: reduce){' + // เคารพผู้ใช้ที่ปิด animation ไว้ในเครื่อง
      '::view-transition-old(root),::view-transition-new(root){animation:none;}' +
      '}';
    document.head.appendChild(style);
  }
})();
