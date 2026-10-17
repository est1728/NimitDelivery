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
    // เอกสารที่ token ตัวนี้อยู่ได้ 2 แบบ: ฟิลด์ token เดี่ยว (เว็บ/แอปเก่า) และ array tokens (แอปร้านหลายเครื่อง)
    const [s1, s2] = await Promise.all([
      db.collection('fcmTokens').where('token','==',token).get(),
      db.collection('fcmTokens').where('tokens','array-contains',token).get(),
    ]);
    const docs = new Map();
    s1.forEach(d=>docs.set(d.ref.path, d));
    s2.forEach(d=>docs.set(d.ref.path, d));
    if(!docs.size) return;
    const batch = db.batch();
    docs.forEach(d=>{
      const data = d.data() || {};
      const rest = (Array.isArray(data.tokens) ? data.tokens : []).filter(t=>t && t!==token);
      if(rest.length){
        // ยังมีเครื่องอื่นของร้านเหลืออยู่: เอาเฉพาะตัวที่ตายออก ไม่ลบทั้งเอกสาร
        const upd = { tokens: rest };
        if(data.token===token) upd.token = rest[rest.length-1];
        batch.update(d.ref, upd);
      } else {
        batch.delete(d.ref);
      }
    });
    await batch.commit();
  }catch(e){} // การลบพลาดไม่ควรทำให้ทั้ง request ล้มเหลว
}
function isDeadTokenError(err){
  const code = err?.code || err?.errorInfo?.code || '';
  return code.includes('registration-token-not-registered') || code.includes('invalid-argument');
}

// หาโทเคนของ "แอปร้านค้าบน Android" (fcmTokens role:'shop' + platform:'android') จากรายการที่ส่งมา
// แล้วขยายเป็นทุกเครื่องของร้านนั้น (tokens array) เพื่อให้ร้านที่มีหลายเครื่องดังทุกเครื่อง
async function findAndroidShopTokens(tokenList){
  const found = new Set();
  const requested = new Set(tokenList);
  for(let i=0;i<tokenList.length;i+=30){
    const chunk = tokenList.slice(i,i+30);
    const [a, b] = await Promise.all([
      db.collection('fcmTokens').where('token','in',chunk).get(),
      db.collection('fcmTokens').where('tokens','array-contains-any',chunk).get(),
    ]);
    const seen = new Set();
    for(const snap of [a,b]) snap.forEach(d=>{
      if(seen.has(d.ref.path)) return; seen.add(d.ref.path);
      const x = d.data() || {};
      if(x.role!=='shop' || x.platform!=='android') return;
      if(x.token) found.add(x.token);
      if(Array.isArray(x.tokens)) x.tokens.forEach(t=>{ if(t) found.add(t); });
    });
  }
  return found;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'ใช้ได้แค่ POST เท่านั้น' });
    return;
  }

  const { token, tokens, title, body, orderId, url, type, test } = req.body || {};
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

  // ออเดอร์ใหม่: ระบุ type:'new_order' ชัดเจน หรือผู้เรียกเก่าที่ไม่ส่ง type แต่หัวข้อเป็น "มีออเดอร์ใหม่..." (checkout/order-create/แอปลูกค้าเดิม)
  // ไม่ใช้ orderId เป็นตัวตัดสิน เพราะข้อความอัปเดตสถานะของไรเดอร์ก็ส่ง orderId มาด้วย
  const isNewOrder = type === 'new_order' || (!type && String(title).startsWith('มีออเดอร์ใหม่'));
  const isTest = test === '1' || test === 1 || test === true;

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
    // แยกโทเคนแอปร้านค้า Android ออก ส่งแบบ data-only (ไม่มีบล็อก notification) เพื่อให้แอปรับเองแล้วดังเสียงวน
    // ส่วนโทเคนอื่นทั้งหมด (แอดมิน ไรเดอร์ ลูกค้า เว็บร้านค้า) ส่งแบบเดิมทุกอย่าง
    let shopTokens = [];
    let otherTokens = tokenList;
    if (isNewOrder) {
      try {
        const shopSet = await findAndroidShopTokens(tokenList);
        if (shopSet.size) {
          shopTokens = [...shopSet];
          otherTokens = tokenList.filter(t=>!shopSet.has(t));
        }
      } catch (e) {
        // หา role ไม่ได้ (เช่น query พลาด) → ถอยกลับส่งแบบเดิมทั้งหมด ดีกว่าไม่ส่งเลย
        shopTokens = []; otherTokens = tokenList;
      }
    }

    const groups = [];
    if (shopTokens.length) {
      const data = {
        type: 'new_order',
        orderId: String(orderId || ''),
        title: String(title),
        body: String(body),
        url: String(url || '/'),
      };
      if (isTest) data.test = '1';
      groups.push({ tokens: shopTokens, msg: { data, android: { priority: 'high', ttl: 60 * 1000 } } });
    }
    if (otherTokens.length) groups.push({ tokens: otherTokens, msg: message });

    let sent = 0, failed = 0, cleaned = 0, firstError = '';
    for (const g of groups) {
      // ส่งพร้อมกันได้สูงสุด 500 token ต่อครั้ง
      for (let i=0;i<g.tokens.length;i+=500) {
        const chunk = g.tokens.slice(i,i+500);
        const result = await admin.messaging().sendEachForMulticast({ ...g.msg, tokens: chunk });
        sent += result.successCount; failed += result.failureCount;
        // เช็คทีละ token ที่ส่งไม่ผ่าน ถ้าเป็น token ตายจริงๆ ลบทิ้ง/เอาออกจาก tokens อัตโนมัติ
        await Promise.all(result.responses.map(async (r, idx) => {
          if (!r.success) {
            if (!firstError) firstError = (r.error && r.error.message) || 'send failed';
            if (isDeadTokenError(r.error)) { await cleanupDeadToken(chunk[idx]); cleaned++; }
          }
        }));
      }
    }
    // success: ส่งผ่านอย่างน้อย 1 ตัว หรือไม่มีตัวไหนล้มเหลว (ตรงกับพฤติกรรมเดิมของแต่ละโหมด)
    const ok = sent > 0 || failed === 0;
    const out = { success: ok, sent, failed, cleaned, shopData: shopTokens.length };
    if (!ok) out.error = firstError;
    res.status(200).json(out);
  } catch (e) {
    // error ระดับระบบ (เช่น Firebase Admin ตั้งค่าไม่ถูกต้อง) ไม่ใช่ปัญหาที่ token
    res.status(200).json({ success: false, error: e.message });
  }
}
