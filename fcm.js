// fcm.js — ใส่ในทุกหน้าที่อยากรับ push
// <script src="fcm.js"></script>

(async function () {
  // รอ Firebase โหลด
  await new Promise(r => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', r);
    else r();
  });

  const VAPID_KEY = 'YOUR_VAPID_KEY'; // เปลี่ยนหลังตั้ง FCM

  try {
    // Register service worker
    if (!('serviceWorker' in navigator)) return;
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
    if (perm !== 'granted') return;

    // รับ token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return;

    // บันทึก token ลง Firestore ตาม role
    const role = window._fcmRole || 'customer'; // หน้าไหนตั้ง window._fcmRole ก่อน include fcm.js
    const uid = window._fcmUid || localStorage.getItem('customerPhone') || 'unknown';
    await setDoc(doc(db, 'fcmTokens', uid + '_' + role), {
      token, role, uid,
      updatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent.slice(0, 100)
    }, { merge: true });

    // รับ push ตอนแอปเปิดอยู่
    onMessage(messaging, payload => {
      const { title, body } = payload.notification || {};
      if (typeof window.showNotif === 'function') {
        window.showNotif('🔔', title, body, 'new');
      } else if (typeof window.showToast === 'function') {
        window.showToast((title || '') + ' ' + (body || ''), 'in', 4000);
      } else {
        // fallback OS notification
        if (Notification.permission === 'granted') {
          new Notification(title || 'Nimit Delivery', { body, tag: 'nimit', renotify: true });
        }
      }
    });

  } catch (e) {
    console.warn('FCM setup failed:', e.message);
  }
})();
