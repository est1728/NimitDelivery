// Vercel Serverless Function — ยิง push notification จริงผ่าน Firebase Cloud Messaging
// ใช้ Firebase Admin SDK กับ Environment Variables ที่ตั้งไว้แล้ว (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
// เรียกใช้จาก rider.html ทุกครั้งที่ไรเดอร์เปลี่ยนสถานะออเดอร์สำเร็จ

import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // ค่าที่เก็บใน Vercel Environment Variables จะมี \n เป็นตัวอักษรตรงๆ (ไม่ใช่ขึ้นบรรทัดจริง)
      // ต้องแปลงกลับเป็นการขึ้นบรรทัดจริงก่อน ไม่งั้น Firebase Admin จะอ่านกุญแจไม่ออก
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'ใช้ได้แค่ POST เท่านั้น' });
    return;
  }

  const { token, title, body, orderId, url } = req.body || {};

  if (!token || !title || !body) {
    res.status(400).json({ error: 'ข้อมูลไม่ครบ ต้องมี token, title, body' });
    return;
  }

  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: { orderId: orderId || '', url: url || '/track.html' },
      webpush: {
        notification: {
          icon: '/icon-192.png', // ถ้ายังไม่มีไฟล์นี้ ไม่เป็นไร แจ้งเตือนจะขึ้นแบบไม่มีไอคอนพิเศษ ไม่ทำให้พัง
        },
        fcmOptions: { link: url || '/track.html' },
      },
    });
    res.status(200).json({ success: true });
  } catch (e) {
    // token ไม่ถูกต้อง/หมดอายุ (เช่น ลูกค้าเคยกดปิดแจ้งเตือน หรือลบแอปไปแล้ว) ไม่ใช่ error ระดับระบบ
    // ส่งกลับสถานะไปให้ rider.html รู้ แต่ไม่ควรทำให้การอัปเดตสถานะออเดอร์ล้มเหลวไปด้วย
    res.status(200).json({ success: false, error: e.message });
  }
}
