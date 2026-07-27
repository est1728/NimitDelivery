// fcm.js — ใส่ในทุกหน้าที่อยากรับ push
// <script src="fcm.js"></script>
// ปกติจะขอสิทธิ์แจ้งเตือนอัตโนมัติทันทีที่โหลดหน้า (พฤติกรรมเดิม สำหรับหน้าที่ต้องการแบบนี้)
// ถ้าอยากให้ผู้ใช้กดเปิดเองก่อน (เช่น สวิตช์ในหน้าตั้งค่า) ให้ตั้ง window._fcmManual = true ก่อน include ไฟล์นี้
// แล้วเรียก window.enableFcmNotifications() เองตอนผู้ใช้กดเปิดสวิตช์

// เสียงแจ้งเตือนกลาง ใช้ได้ทุกหน้าเหมือนกันหมด ไม่ต้องพึ่งฟังก์ชันเสียงเฉพาะของแต่ละหน้า
// (บางหน้ามีระบบเสียงของตัวเอง เช่น rider.html แต่ปุ่มแสดงแจ้งเตือนของหน้านั้นไม่เคยเรียกใช้เสียงเลย
// ทำให้แจ้งเตือนที่มาจาก push ขึ้นแบบเงียบสนิท ไม่มีเสียงเตือนเลย)
function _fcmPlayDing(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
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

window.enableFcmNotifications = async function () {
  // รอ Firebase โหลด (เผื่อถูกเรียกเร็วเกินไปตั้งแต่หน้ายังโหลดไม่เสร็จ)
  await new Promise(r => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', r);
    else r();
  });

  const VAPID_KEY = 'YOUR_VAPID_KEY'; // เปลี่ยนหลังตั้ง FCM

  try {
    // Register service worker
    if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-serviceworker' };
    const reg = await navigator.serviceWorker.register('/sw.js');

    // Load Firebase Messaging
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');
    const { getFirestore, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

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
          reg.showNotification(title || 'Nimit Delivery', { body, tag: 'nimit', renotify: true });
        }
      }
    });

    return { ok: true };
  } catch (e) {
    console.warn('FCM setup failed:', e.message);
    return { ok: false, reason: 'error', message: e.message };
  }
};

// พฤติกรรมเดิม: ขอสิทธิ์อัตโนมัติทันที เว้นแต่หน้านั้นตั้ง window._fcmManual = true ไว้ก่อน
if (!window._fcmManual) {
  window.enableFcmNotifications();
}
