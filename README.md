# TPG Center — ระบบติดตามงานคลังสินค้าและขนส่ง

Core Platform (เฟส 0) + โมดูล 1 (ส่วนลดจากการรับคืนสินค้าเทิร์น + การจัดการสต็อกสินค้ารับเทิร์น)

บริษัท TPG Center จำหน่ายสินค้าซ่อมบำรุงโรงงาน และเป็นตัวแทนแบรนด์ SKF
พนักงานบันทึกงานผ่าน **LINE OA** ผู้บริหาร/หัวหน้าแผนกติดตามผ่าน **Web Dashboard**

---

## Tech Stack

- **Monorepo:** pnpm workspaces → `apps/api`, `apps/web`, `packages/shared`
- **Backend (`apps/api`):** Node.js + TypeScript + NestJS
- **ORM/DB:** PostgreSQL + Prisma (migration + seed)
- **Frontend (`apps/web`):** React + Vite + TypeScript + Tailwind + shadcn/ui + Recharts
- **LINE:** `@line/bot-sdk` (Messaging API) + LIFF
- **Auth:** JWT (web) + ผูกบัญชี LINE userId กับ user
- **Storage รูป:** Google Drive (Service Account)
- ภาษา UI/ข้อความ LINE = ไทย, โค้ด/ตาราง = อังกฤษ, เขตเวลา `Asia/Bangkok`

---

## โครงสร้างโปรเจกต์

```
apps/
  api/                 # NestJS + Prisma
    prisma/
      schema.prisma    # core + โมดูล 1 (stock + disposal)
      seed.ts
    src/
      core/            # auth, rbac, users, modules(registry), audit,
                       # attachments(Google Drive), notifications, masterdata, line
      modules/
        returns-discount/   # โมดูล 1 ทั้งก้อน
  web/                 # React + Vite + Tailwind
    src/
      core/            # layout, auth, nav, dashboard shell
      modules/
        returns-discount/
packages/
  shared/              # types, enums, zod schemas ใช้ร่วม api+web
```

**กติกาเพิ่มโมดูลใหม่:** เพิ่มโฟลเดอร์ใน `modules/<name>` ทั้ง api และ web แล้วลงทะเบียนผ่าน
Module Registry เท่านั้น — ห้ามแก้ core

---

## ความต้องการระบบ (Prerequisites)

- Node.js ≥ 20
- pnpm ≥ 9
- PostgreSQL ≥ 14 (local หรือ remote)

---

## เริ่มต้นใช้งาน

```bash
# 1) ติดตั้ง dependencies (จาก root)
pnpm install

# 2) ตั้งค่า environment
cp .env.example .env
#   แก้ DATABASE_URL, JWT_SECRET, LINE_*, LIFF_ID, GOOGLE_* ให้ครบ

# 3) สร้าง Prisma client + migrate ฐานข้อมูล
pnpm prisma:generate
pnpm prisma:migrate        # prisma migrate dev

# 4) seed ข้อมูลตั้งต้น  (เต็มในขั้นที่ 10)
pnpm prisma:seed

# 5) รัน dev ทั้ง api + web
pnpm dev
#   api : http://localhost:3000
#   web : http://localhost:5173
```

> รีเซ็ตฐานข้อมูล (ลบ + migrate + seed ใหม่): `pnpm db:reset`

---

## Environment Variables

ดูรายละเอียดทั้งหมดใน [`.env.example`](./.env.example) — กลุ่มหลัก:

| กลุ่ม | ตัวแปร |
|---|---|
| Database | `DATABASE_URL` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| LINE | `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` |
| LIFF | `LIFF_ID`, `VITE_LIFF_ID` |
| Google Drive | `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`, `GDRIVE_FOLDER_ID` |
| Web | `VITE_API_BASE_URL` |

### ตั้งค่า LINE Webhook (จะ implement ในขั้นที่ 4)

1. สร้าง Messaging API channel ใน [LINE Developers Console](https://developers.line.biz/)
2. นำ `Channel access token` และ `Channel secret` ใส่ `.env`
3. ตั้ง Webhook URL = `{API_BASE_URL}/line/webhook` แล้วเปิด **Use webhook**

### ตั้งค่า LIFF (จะ implement ในขั้นที่ 4-7)

1. สร้าง LIFF app ใน channel เดียวกัน → Endpoint URL ชี้ไปยัง `{WEB_ORIGIN}` (หน้า LIFF)
2. นำ `LIFF ID` ใส่ `.env` (`LIFF_ID` และ `VITE_LIFF_ID`)

### ตั้งค่า Google Drive (Service Account) (จะ implement ในขั้นที่ 3/6)

1. สร้าง Google Cloud project → เปิด **Google Drive API**
2. สร้าง **Service Account** → ออก key เป็น JSON
3. วาง JSON ไว้ที่ `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` หรือใส่ทั้งก้อนใน `GOOGLE_SERVICE_ACCOUNT_JSON`
4. สร้างโฟลเดอร์บน Google Drive → **แชร์โฟลเดอร์ให้อีเมลของ Service Account** (สิทธิ์ Editor)
5. นำ Folder ID (จาก URL ของโฟลเดอร์) ใส่ `GDRIVE_FOLDER_ID`

---

## คำสั่งที่ใช้บ่อย

| คำสั่ง (จาก root) | หน้าที่ |
|---|---|
| `pnpm dev` | รัน api + web พร้อมกัน |
| `pnpm build` | build ทุก workspace |
| `pnpm test` | รันเทสต์ทุก workspace |
| `pnpm lint` | lint ทุก workspace |
| `pnpm format` | จัดรูปแบบโค้ดด้วย Prettier |
| `pnpm prisma:migrate` | สร้าง/ใช้ migration (dev) |
| `pnpm prisma:seed` | seed ข้อมูล |
| `pnpm db:reset` | รีเซ็ตฐานข้อมูล + seed |

---

## ลำดับการสร้าง (Build Order) & สถานะ

| ขั้น | งาน | สถานะ |
|---|---|---|
| 1 | Monorepo + tooling + `.env.example` + README | ✅ เสร็จ |
| 2 | Prisma schema (core + โมดูล 1 รวม stock + disposal) + migration | ✅ schema เสร็จ — *รอยืนยันก่อน migrate* |
| 3 | Core: auth, RBAC, users, registry, audit, attachments, notifications, masterdata | ⏳ |
| 4 | LINE core: webhook + line-binding + dynamic rich menu | ⏳ |
| 5 | โมดูล 1 — Flow A (แจ้งส่วนลด + อนุมัติพิเศษ) | ⏳ |
| 6 | โมดูล 1 — Flow B (รับเข้า + Google Drive + stock movement) | ⏳ |
| 7 | โมดูล 1 — Flow C (ตัดจำหน่าย) + Flow D (ตรวจสต็อก) | ⏳ |
| 8 | Web: dashboard shell + login + nav | ⏳ |
| 9 | Web: หน้าโมดูล 1 + หน้า admin | ⏳ |
| 10 | Seed data ครบ + ตรวจ end-to-end | ⏳ |
