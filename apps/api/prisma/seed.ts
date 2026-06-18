/**
 * Prisma seed — เติมข้อมูลตั้งต้น
 * (โครงสำหรับขั้นที่ 10: users ทุก role, customers, suppliers, buyers,
 *  products + models, discount_standards, disposal_reasons 3 รายการ,
 *  ใบ GD ตัวอย่างหลายสถานะ, stock movement receipt/disposal ตัวอย่าง)
 *
 * ขั้นนี้ (1-2) เป็นเพียง schema — seed เต็มจะทำในขั้นที่ 10
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // TODO (ขั้นที่ 10): seed ข้อมูลตั้งต้นทั้งหมด
  console.log('[seed] schema-only phase — full seed will be added in build step 10');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
