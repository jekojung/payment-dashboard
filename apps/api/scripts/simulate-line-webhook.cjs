/**
 * จำลอง event ที่ LINE platform จะ POST มายัง /line/webhook
 * ใช้ทดสอบ logic ของ webhook (signature verify, binding, event routing)
 * โดยไม่ต้องต่อ LINE จริง
 *
 * วิธีใช้:
 *   node scripts/simulate-line-webhook.cjs [employeeCode]
 *
 * ต้องรัน API ไว้ก่อน (เช่น `pnpm --filter @tpg/api dev`)
 * อ่านค่า LINE_CHANNEL_SECRET / API_PORT จาก env (ถ้าไม่ตั้ง = dev-mode, ข้าม verify)
 */
const crypto = require('crypto');

const SECRET = process.env.LINE_CHANNEL_SECRET || '';
const PORT = process.env.API_PORT || 3000;
const URL = `http://localhost:${PORT}/line/webhook`;
const EMPLOYEE_CODE = process.argv[2] || 'SALE001';

// userId LINE สมมุติ (ปกติ LINE จะส่ง userId จริงมา)
const FAKE_LINE_USER = 'U' + crypto.randomBytes(16).toString('hex');
const REPLY_TOKEN = crypto.randomBytes(16).toString('hex');

/** สร้าง body + signature header แบบเดียวกับที่ LINE ทำ */
function sign(body) {
  const json = JSON.stringify(body);
  const signature = SECRET
    ? crypto.createHmac('sha256', SECRET).update(json).digest('base64')
    : 'dev-mode-no-secret';
  return { json, signature };
}

async function send(label, body) {
  const { json, signature } = sign(body);
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-line-signature': signature },
    body: json,
  });
  console.log(`  ${label.padEnd(34)} → HTTP ${res.status}`);
  return res.status;
}

const baseSource = { type: 'user', userId: FAKE_LINE_USER };

const events = {
  // 1) ผู้ใช้กดเพิ่มเพื่อน (ยังไม่ผูกบัญชี → ได้ข้อความชวนผูก)
  follow: {
    destination: 'Uxxxxxxxx',
    events: [
      {
        type: 'follow',
        mode: 'active',
        timestamp: Date.now(),
        source: baseSource,
        replyToken: REPLY_TOKEN,
        webhookEventId: '01HZ' + crypto.randomBytes(8).toString('hex'),
        deliveryContext: { isRedelivery: false },
      },
    ],
  },
  // 2) ผู้ใช้พิมพ์ "ผูกบัญชี <code>" → ผูกลง DB + ตอบกลับ
  bind: {
    destination: 'Uxxxxxxxx',
    events: [
      {
        type: 'message',
        mode: 'active',
        timestamp: Date.now(),
        source: baseSource,
        replyToken: REPLY_TOKEN,
        webhookEventId: '01HZ' + crypto.randomBytes(8).toString('hex'),
        deliveryContext: { isRedelivery: false },
        message: { id: '1', type: 'text', text: `ผูกบัญชี ${EMPLOYEE_CODE}` },
      },
    ],
  },
  // 3) ผู้ใช้กดปุ่ม rich menu → postback (จะถูก route ไปยัง handler ของโมดูล step 5-7)
  postback: {
    destination: 'Uxxxxxxxx',
    events: [
      {
        type: 'postback',
        mode: 'active',
        timestamp: Date.now(),
        source: baseSource,
        replyToken: REPLY_TOKEN,
        webhookEventId: '01HZ' + crypto.randomBytes(8).toString('hex'),
        deliveryContext: { isRedelivery: false },
        postback: { data: 'action=returns_discount:create' },
      },
    ],
  },
};

async function main() {
  console.log(`\nLINE webhook simulation → ${URL}`);
  console.log(`  mode          : ${SECRET ? 'signed (verify ON)' : 'dev-mode (verify skipped)'}`);
  console.log(`  fake lineUser : ${FAKE_LINE_USER}`);
  console.log(`  employeeCode  : ${EMPLOYEE_CODE}\n`);

  await send('1. follow (ยังไม่ผูก)', events.follow);
  await send('2. message "ผูกบัญชี ' + EMPLOYEE_CODE + '"', events.bind);
  await send('3. postback returns_discount:create', events.postback);

  // ทดสอบ negative: signature ผิด (เฉพาะเมื่อมี secret)
  if (SECRET) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': 'wrong-signature' },
      body: JSON.stringify(events.follow),
    });
    console.log(`  ${'4. signature ผิด (ต้องถูกปฏิเสธ)'.padEnd(34)} → HTTP ${res.status} ${res.status === 400 ? '✓' : '✗ คาดหวัง 400'}`);
  }

  console.log(`\nเสร็จ — ตรวจ DB ว่า ${EMPLOYEE_CODE} ผูกกับ ${FAKE_LINE_USER} แล้วหรือยัง`);
}

main().catch((e) => {
  console.error('error:', e.message);
  process.exit(1);
});
