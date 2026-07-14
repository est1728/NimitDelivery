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
  self.registration.showNotification(title || 'Nimit Delivery', {
    body: body || '',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'nimit-push',
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
