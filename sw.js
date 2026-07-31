// Service Worker — Nimit Delivery
// วางไว้ที่ root ของ repo

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCnBUk0ZKFcwMK0NyYkheux1xPt9bLYhr4",
  authDomain: "nimit-delivery.firebaseapp.com",
  projectId: "nimit-delivery",
  storageBucket: "nimit-delivery.firebasestorage.app",
  messagingSenderId: "233476256130",
  appId: "1:233476256130:web:62ba8f64ad0bf2f92c9f9b"
});

const messaging = firebase.messaging();

// รับ push เมื่อแอปปิดอยู่
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  // สำคัญ: เดิมใช้ tag เดียวกันทุกแจ้งเตือน ('nimit-push') — Android บางรุ่น/บางยี่ห้อมีปัญหารู้จักกันว่า
  // ถ้าแจ้งเตือนก่อนหน้ายังค้างอยู่ในทีเดียวกัน แจ้งเตือนใหม่ที่ tag ซ้ำกันอาจไม่เด้งเตือนซ้ำให้เห็นจริง
  // แม้จะตั้ง renotify:true ไว้แล้วก็ตาม (ระบบมองว่าเป็นแจ้งเตือนเดิมที่แค่อัปเดต ไม่ใช่เรื่องใหม่ทั้งหมด)
  // แก้ด้วยการใช้ tag ที่ไม่ซ้ำกันเลยในทุกข้อความ รับประกันว่าแต่ละอันจะถูกมองเป็นแจ้งเตือนใหม่แยกกันเสมอ
  const uniqueTag = 'nimit-push-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  self.registration.showNotification(title || 'Nimit Delivery', {
    body: body || '',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: uniqueTag,
    renotify: true,
    data: payload.data || {}
  });
});

// กดแจ้งเตือน → เปิดแอป
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.openWindow(url));
});
