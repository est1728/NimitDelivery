// Vercel Serverless Function
// POST /api/notify
// body: { tokens: [...], title, body, data }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { tokens, title, body, data } = req.body;
  if (!tokens?.length) return res.status(400).json({ error: 'no tokens' });

  const SERVER_KEY = process.env.FCM_SERVER_KEY;
  if (!SERVER_KEY) return res.status(500).json({ error: 'FCM_SERVER_KEY not set' });

  try {
    const results = await Promise.all(
      tokens.map(token =>
        fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'key=' + SERVER_KEY
          },
          body: JSON.stringify({
            to: token,
            notification: { title, body, icon: '/icon.png', badge: '/icon.png', click_action: '/' },
            data: data || {},
            webpush: { headers: { Urgency: 'high' } }
          })
        }).then(r => r.json())
      )
    );
    res.status(200).json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
