// Vercel Serverless Function — ยิง push notification จริงผ่าน Firebase Cloud Messaging
// ใช้ Firebase Admin SDK กับ Environment Variables ที่ตั้งไว้แล้ว (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
// เรียกใช้จาก rider.html ทุกครั้งที่ไรเดอร์เปลี่ยนสถานะออเดอร์สำเร็จ (ส่ง token เดี่ยว)
// และจาก checkout.html/order-create.html ตอนมีออเดอร์ใหม่เข้า (ส่ง tokens หลายอันพร้อมกัน — แอดมิน+ไรเดอร์ทุกคน+ร้าน)

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

const db = admin.firestore();

// token ที่ตายแล้วจริงๆ (ผู้ใช้ปิดแจ้งเตือน/ลบข้อมูลเบราว์เซอร์/ยกเลิกสิทธิ์ถาวร) ให้ลบทิ้งจาก Firestore
// อัตโนมัติเลย ไม่ต้องรอให้ใครมาจัดการเอง — กันไม่ให้ยิงไปหา token ตายซ้ำๆทุกครั้งที่มีออเดอร์เข้า
// (ส่วนกรณี token หมดอายุแค่ชั่วคราวเพราะเปลี่ยนการตั้งค่า/VAPID key ฝั่ง fcm.js เองมีระบบรีเฟรชเงียบๆ
// ให้อัตโนมัติอยู่แล้วทุกครั้งที่ลูกค้าเปิดแอปมา ถ้ายังเคยอนุญาตไว้ก่อนหน้า — ไม่ต้องรอให้ตรงนี้ลบทิ้งก่อน)
async function cleanupDeadToken(token){
  try{
    const snap = await db.collection('fcmTokens').where('token','==',token).get();
    const batch = db.batch();
    snap.forEach(doc=>batch.delete(doc.ref));
    if(!snap.empty) await batch.commit();
  }catch(e){} // การลบพลาดไม่ควรทำให้ทั้ง request ล้มเหลว
}
function isDeadTokenError(err){
  const code = err?.code || err?.errorInfo?.code || '';
  return code.includes('registration-token-not-registered') || code.includes('invalid-argument');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'ใช้ได้แค่ POST เท่านั้น' });
    return;
  }

  const { token, tokens, title, body, orderId, url } = req.body || {};
  // สำคัญมาก: บัคจริงที่เจอ — เดิมกรองแค่ค่าว่าง/null ออก (filter(Boolean)) แต่ไม่เคยตัดตัวที่ซ้ำกันออกเลย
  // ถ้าเครื่องเดียวกันมีเอกสาร fcmTokens มากกว่า 1 ชิ้นที่ชี้ไปที่ token เดียวกัน (เช่น จากบัคเก่าที่เคยเจอ
  // เรื่อง token ชนกันตอนไม่มี uid เฉพาะตัว) รายการ tokens ที่ query ออกมาได้ก็จะมี token ตัวเดียวกันซ้ำอยู่
  // หลายรอบ พอส่งแบบ multicast ไปทุกตัวใน list เครื่องนั้นเลยได้รับข้อความเดียวกันซ้ำหลายครั้งในการส่งครั้งเดียว
  const rawTokenList = Array.isArray(tokens) ? tokens.filter(Boolean) : (token ? [token] : []);
  const tokenList = [...new Set(rawTokenList)];

  if (!tokenList.length || !title || !body) {
    res.status(400).json({ error: 'ข้อมูลไม่ครบ ต้องมี token หรือ tokens อย่างน้อย 1 อัน, title, body' });
    return;
  }

  const message = {
    notification: { title, body },
    data: { orderId: orderId || '', url: url || '/track.html' },
    webpush: {
      notification: {
        icon: '/icon-192.png',
      },
      fcmOptions: { link: url || '/track.html' },
    },
  };

  try {
    if (tokenList.length === 1) {
      try {
        await admin.messaging().send({ ...message, token: tokenList[0] });
        res.status(200).json({ success: true, sent: 1 });
      } catch (e) {
        if (isDeadTokenError(e)) await cleanupDeadToken(tokenList[0]);
        res.status(200).json({ success: false, error: e.message, cleaned: isDeadTokenError(e) });
      }
    } else {
      // ส่งพร้อมกันได้สูงสุด 500 token ต่อครั้ง (เกินพอสำหรับจำนวนไรเดอร์/แอดมินของร้านนี้)
      const result = await admin.messaging().sendEachForMulticast({ ...message, tokens: tokenList });
      // เช็คทีละ token ที่ส่งไม่ผ่าน ถ้าเป็น token ตายจริงๆ ลบทิ้งอัตโนมัติเลย
      let cleaned = 0;
      await Promise.all(result.responses.map(async (r, i) => {
        if (!r.success && isDeadTokenError(r.error)) {
          await cleanupDeadToken(tokenList[i]);
          cleaned++;
        }
      }));
      res.status(200).json({ success: true, sent: result.successCount, failed: result.failureCount, cleaned });
    }
  } catch (e) {
    // error ระดับระบบ (เช่น Firebase Admin ตั้งค่าไม่ถูกต้อง) ไม่ใช่ปัญหาที่ token
    res.status(200).json({ success: false, error: e.message });
  }
}
