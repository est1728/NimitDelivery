// fcm.js — ใส่ในทุกหน้าที่อยากรับ push
// <script src="fcm.js"></script>
// ปกติจะขอสิทธิ์แจ้งเตือนอัตโนมัติทันทีที่โหลดหน้า (พฤติกรรมเดิม สำหรับหน้าที่ต้องการแบบนี้)
// ถ้าอยากให้ผู้ใช้กดเปิดเองก่อน (เช่น สวิตช์ในหน้าตั้งค่า) ให้ตั้ง window._fcmManual = true ก่อน include ไฟล์นี้
// แล้วเรียก window.enableFcmNotifications() เองตอนผู้ใช้กดเปิดสวิตช์

// เสียงแจ้งเตือนกลาง ใช้ได้ทุกหน้าเหมือนกันหมด ไม่ต้องพึ่งฟังก์ชันเสียงเฉพาะของแต่ละหน้า
// (บางหน้ามีระบบเสียงของตัวเอง เช่น rider.html แต่ปุ่มแสดงแจ้งเตือนของหน้านั้นไม่เคยเรียกใช้เสียงเลย
// ทำให้แจ้งเตือนที่มาจาก push ขึ้นแบบเงียบสนิท ไม่มีเสียงเตือนเลย)
// สำคัญมาก: ต้องใช้ AudioContext ตัวเดียวที่สร้างครั้งเดียวแล้วนำกลับมาใช้ซ้ำเสมอ ห้ามสร้างใหม่ทุกครั้งที่เล่นเสียง
// เบราว์เซอร์ส่วนใหญ่จำกัดจำนวน AudioContext ที่เปิดพร้อมกันได้ (มักประมาณ 6 ตัว) ถ้าสร้างใหม่ทุกครั้งที่มีการแจ้งเตือน
// เข้ามา พอเปิดแท็บทิ้งไว้นานๆแล้วมีการแจ้งเตือนเข้ามาหลายรอบ จะชนขีดจำกัดจนสร้างไม่ได้อีกเลย เสียงแจ้งเตือนก็เลย
// เงียบไปดื้อๆทั้งที่ก่อนหน้านี้เคยทำงานปกติ (อาการตรงกับที่เจอ "เปิดเว็บทิ้งไว้นานๆแล้วแจ้งเตือนดับทั้งเว็บ")
let _fcmAudioCtx = null;
function _fcmPlayDing(){
  try{
    if(!_fcmAudioCtx) _fcmAudioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(_fcmAudioCtx.state === 'suspended') _fcmAudioCtx.resume();
    const ctx = _fcmAudioCtx;
    const notes = [523, 659, 784];
    notes.forEach((freq,i)=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      const t = ctx.currentTime + i*0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t+0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t+0.3);
      osc.start(t); osc.stop(t+0.35);
    });
  }catch(e){}
}

async function _enableFcmNotificationsInner() {
  // กันไม่ให้ลงทะเบียนซ้ำถ้าเคยเปิดสำเร็จแล้วในหน้านี้อยู่แล้ว (กดปุ่มซ้ำหลายครั้งไม่ควรทำให้แจ้งเตือนซ้ำ)
  if (window._fcmAlreadyEnabled) return { ok: true };
  // รอ Firebase โหลด (เผื่อถูกเรียกเร็วเกินไปตั้งแต่หน้ายังโหลดไม่เสร็จ)
  await new Promise(r => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', r);
    else r();
  });

  try {
    // Register service worker
    if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-serviceworker' };
    const reg = await navigator.serviceWorker.register('/sw.js');

    // Load Firebase Messaging
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getMessaging, getToken, onMessage, isSupported } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');
    const { getFirestore, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    // สำคัญมาก: ต้องเช็ค isSupported() ก่อนเรียก getMessaging() เสมอ ห้ามข้ามขั้นตอนนี้เด็ดขาด
    // เบราว์เซอร์ในแอป (Messenger/Line/Instagram ฯลฯ) มักไม่รองรับ Push API ที่ FCM ต้องใช้
    // ถ้าเรียก getMessaging() ตรงๆในเบราว์เซอร์แบบนี้ Firebase SDK จะโยน error จาก "floating promise"
    // ภายในตัวเอง ซึ่ง try/catch ปกติจับไม่ได้เลย (เป็นพฤติกรรมที่รู้จักกันดีของ Firebase SDK) ทำให้กลาย
    // เป็น unhandled promise rejection ที่หลุดออกไปแสดงเป็น error ให้ผู้ใช้จริงเห็นตรงๆ (เคยเกิดขึ้นจริง
    // กับลูกค้าที่เปิดผ่าน Messenger — เห็น error สีแดงเต็มจอ ทั้งที่ควรจะแค่ข้ามการแจ้งเตือนไปเงียบๆ)
    const supported = await isSupported().catch(() => false);
    if (!supported) return { ok: false, reason: 'unsupported-browser' };

    const app = getApps()[0] || initializeApp({
      apiKey: "AIzaSyCnBUk0ZKFcwMK0NyYkheux1xPt9bLYhr4",
      authDomain: "nimit-delivery.firebaseapp.com",
      projectId: "nimit-delivery",
      storageBucket: "nimit-delivery.firebasestorage.app",
      messagingSenderId: "233476256130",
      appId: "1:233476256130:web:62ba8f64ad0bf2f92c9f9b"
    });

    const messaging = getMessaging(app);
    const db = getFirestore(app);

    // ดึง VAPID key จากฐานข้อมูลกลาง (ตั้งค่าได้จากหน้าตั้งค่าใน admin.html) แทนการฝังไว้ในโค้ดตรงๆ
    // จะได้ไม่ต้องมาแก้ไฟล์นี้ทุกครั้งที่ต้องเปลี่ยนค่า — เก็บแคชไว้ใน localStorage ด้วยกันเรียก Firestore ซ้ำถี่เกินไป
    let VAPID_KEY = localStorage.getItem('_fcmVapidKeyCache') || '';
    try{
      const vSnap = await getDoc(doc(db, 'settings', 'fcmConfig'));
      if(vSnap.exists() && vSnap.data().vapidKey){
        VAPID_KEY = vSnap.data().vapidKey;
        localStorage.setItem('_fcmVapidKeyCache', VAPID_KEY);
      }
    }catch(e){} // ถ้าดึงไม่ได้ ใช้ค่าที่แคชไว้ก่อนหน้า (ถ้ามี) ต่อไปก่อน
    if(!VAPID_KEY) return { ok: false, reason: 'no-vapid-key' };

    // ขอ permission
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, reason: 'permission-' + perm };

    // รับ token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, reason: 'no-token' };

    // บันทึก token ลง Firestore ตาม role
    const role = window._fcmRole || 'customer'; // หน้าไหนตั้ง window._fcmRole ก่อน include fcm.js
    const uid = window._fcmUid || localStorage.getItem('customerPhone') || 'unknown';
    await setDoc(doc(db, 'fcmTokens', uid + '_' + role), {
      token, role, uid,
      updatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent.slice(0, 100)
    }, { merge: true });

    // รับ push ตอนแอปเปิดอยู่ — เล่นเสียงเตือนทุกครั้งเสมอ ไม่ว่าจะโชว์ผลลัพธ์แบบไหน
    onMessage(messaging, payload => {
      const { title, body } = payload.notification || {};
      _fcmPlayDing();
      if (typeof window.showNotif === 'function') {
        window.showNotif('🔔', title, body, 'new');
      } else if (typeof window.showToast === 'function') {
        window.showToast((title || '') + ' ' + (body || ''), 'in', 4000);
      } else {
        // fallback OS notification — ต้องใช้ serviceWorker.showNotification() แทน new Notification()
        // ตรงๆ เพราะตอนนี้มี service worker ควบคุมหน้าอยู่แล้ว (จำเป็นสำหรับ push) เบราว์เซอร์บางตัว
        // (โดยเฉพาะ Chrome บน Android) จะ error ทันทีถ้าเรียก new Notification() ตรงๆระหว่างมี SW ควบคุมอยู่
        if (Notification.permission === 'granted') {
          // สำคัญ: ใช้ tag ไม่ซ้ำกันทุกครั้งเหมือนที่แก้ไปแล้วใน sw.js — ของเดิมใช้ tag คงที่ ('nimit')
          // ทำให้มือถือบางรุ่นไม่เด้งแจ้งเตือนซ้ำถ้ามีอันเก่าค้างอยู่ในทีเดียวกัน แม้จะตั้ง renotify:true ไว้แล้วก็ตาม
          // จุดนี้เป็นคนละที่กับ sw.js (นี่คือตอนแอปเปิดอยู่ ไม่ใช่ตอนปิดแอป) เลยพลาดแก้ไปรอบก่อนหน้านี้
          const uniqueTag = 'nimit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
          reg.showNotification(title || 'Nimit Delivery', { body, tag: uniqueTag, renotify: true });
        }
      }
    });

    window._fcmAlreadyEnabled = true;
    return { ok: true };
  } catch (e) {
    console.warn('FCM setup failed:', e.message);
    return { ok: false, reason: 'error', message: e.message };
  }
}
window.enableFcmNotifications = async function(){
  const result = await _enableFcmNotificationsInner();
  // สำคัญ: บันทึกผลลัพธ์ล่าสุดไว้เสมอไม่ว่าสำเร็จหรือไม่ก็ตาม ไม่ว่าจะออกจากฟังก์ชันด้วยเหตุผลไหนก็ตาม
  // (ไม่ใช่แค่ตอนสำเร็จ/error เท่านั้น — ครอบคลุมทุกจุด return ข้างในด้วย เช่น ไม่มี VAPID key, เบราว์เซอร์ไม่รองรับ,
  // ผู้ใช้ปฏิเสธสิทธิ์ ฯลฯ) ทำแบบนี้เพื่อให้ตรวจสอบย้อนหลังได้ว่าจริงๆแล้วระบบทำงานอยู่หรือเปล่า โดยไม่ต้องให้ใครกด
  // ทดสอบเองเลย แค่เข้าเว็บใช้งานตามปกติ ระบบจะจดสถานะไว้ให้อัตโนมัติทุกครั้ง
  try{
    localStorage.setItem('_fcmLastResult', JSON.stringify({...result, ts:new Date().toISOString(), role:window._fcmRole||'?'}));
  }catch(e){}
  return result;
};

// พฤติกรรมเดิม: ขอสิทธิ์อัตโนมัติทันที เว้นแต่หน้านั้นตั้ง window._fcmManual = true ไว้ก่อน
if (!window._fcmManual) {
  window.enableFcmNotifications();
} else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
  // สำคัญมาก: หน้าที่ตั้งใจให้กดสวิตช์เปิดเอง (_fcmManual=true) แต่ถ้าผู้ใช้คนนี้เคยกดอนุญาตสำเร็จมาก่อนแล้วจริงๆ
  // ให้รีเฟรช token ให้เงียบๆทุกครั้งที่เข้าเว็บอัตโนมัติเลย ไม่ต้องรอให้กดสวิตช์ใหม่เอง
  // ทำแบบนี้ได้อย่างปลอดภัย 100% เพราะ requestPermission() จะไม่มีทาง popup ถามซ้ำอีกเลยถ้าเบราว์เซอร์
  // เคยได้คำตอบ "อนุญาต" ไปแล้ว (จำคำตอบเดิมไว้ถาวร) — เรียกซ้ำได้เรื่อยๆแบบเงียบสนิท ไม่กวนผู้ใช้แม้แต่นิดเดียว
  // แก้ปัญหา token เก่าหมดอายุ/ไม่ตรงกับการตั้งค่าปัจจุบัน (เช่น เปลี่ยน VAPID key) โดยไม่ต้องให้ผู้ใช้ทำอะไรเองเลย
  window.enableFcmNotifications();
}
