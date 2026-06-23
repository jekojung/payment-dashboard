/**
 * Prisma seed
 * ขั้นที่ 3: core RBAC — roles, permissions, role_permissions, demo users ต่อ role
 * ขั้นที่ 10: จะเพิ่ม master data, discount_standards, disposal_reasons,
 *            ใบ GD ตัวอย่าง, stock movement ตัวอย่าง
 */
import {
  ApprovalStatus,
  CounterpartyType,
  DiscountStatus,
  PrismaClient,
  ReceiptStatus,
  ReturnDocumentStatus,
  SaleValueStatus,
  StockMovementType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  ALL_PERMISSION_KEYS,
  Channel,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_CHANNELS,
  RoleKey,
} from '@tpg/shared';

const prisma = new PrismaClient();

const ROLE_NAMES: Record<string, string> = {
  [RoleKey.SYSTEM_ADMIN]: 'ผู้ดูแลระบบ',
  [RoleKey.EXECUTIVE]: 'ผู้บริหาร',
  [RoleKey.SALES_LEAD]: 'หัวหน้าฝ่ายขาย',
  [RoleKey.WAREHOUSE_LEAD]: 'หัวหน้าคลัง',
  [RoleKey.SALES_STAFF]: 'พนักงานขาย',
  [RoleKey.WAREHOUSE_STAFF]: 'พนักงานคลัง',
  [RoleKey.TRANSPORT_LEAD]: 'หัวหน้าขนส่ง',
  [RoleKey.TRANSPORT_STAFF]: 'พนักงานขนส่ง',
};

// demo users ต่อ role (รหัสผ่านเดียวกันสำหรับทดสอบ)
const DEMO_PASSWORD = 'password123';
const DEMO_USERS: { employeeCode: string; name: string; roleKey: string; department: string }[] = [
  { employeeCode: 'ADMIN001', name: 'แอดมิน ระบบ', roleKey: RoleKey.SYSTEM_ADMIN, department: 'IT' },
  { employeeCode: 'EXEC001', name: 'สมชาย ผู้บริหาร', roleKey: RoleKey.EXECUTIVE, department: 'Management' },
  { employeeCode: 'SLEAD001', name: 'สมหญิง หัวหน้าขาย', roleKey: RoleKey.SALES_LEAD, department: 'Sales' },
  { employeeCode: 'WLEAD001', name: 'สมศักดิ์ หัวหน้าคลัง', roleKey: RoleKey.WAREHOUSE_LEAD, department: 'Warehouse' },
  { employeeCode: 'SALE001', name: 'อนันต์ พนักงานขาย', roleKey: RoleKey.SALES_STAFF, department: 'Sales' },
  { employeeCode: 'WH001', name: 'บุญมี พนักงานคลัง', roleKey: RoleKey.WAREHOUSE_STAFF, department: 'Warehouse' },
];

async function seedPermissions() {
  for (const key of ALL_PERMISSION_KEYS) {
    const [moduleKey, action] = key.split(':');
    await prisma.permission.upsert({
      where: { key },
      update: { moduleKey, action },
      create: { key, moduleKey, action },
    });
  }
  console.log(`[seed] permissions: ${ALL_PERMISSION_KEYS.length}`);
}

async function seedRoles() {
  for (const roleKey of Object.values(RoleKey)) {
    const channels = ROLE_CHANNELS[roleKey] ?? [];
    const channel = channels.includes(Channel.WEB)
      ? Channel.WEB
      : channels.includes(Channel.LINE)
        ? Channel.LINE
        : null;

    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: ROLE_NAMES[roleKey], channel },
      create: { key: roleKey, name: ROLE_NAMES[roleKey], channel },
    });

    // ตั้งค่า role_permissions ตาม default mapping
    const permKeys = DEFAULT_ROLE_PERMISSIONS[roleKey] ?? [];
    const perms = await prisma.permission.findMany({ where: { key: { in: permKeys } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (perms.length > 0) {
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`[seed] roles: ${Object.values(RoleKey).length}`);
}

async function seedDemoUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of DEMO_USERS) {
    const role = await prisma.role.findUnique({ where: { key: u.roleKey } });
    if (!role) continue;
    const user = await prisma.user.upsert({
      where: { employeeCode: u.employeeCode },
      update: { name: u.name, department: u.department, passwordHash },
      create: { employeeCode: u.employeeCode, name: u.name, department: u.department, passwordHash },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
  console.log(`[seed] demo users: ${DEMO_USERS.length} (password: ${DEMO_PASSWORD})`);
}

/**
 * ขั้นที่ 10 — master data + ใบ GD ตัวอย่างหลายสถานะ + stock movements
 * idempotent: ลบข้อมูล transactional เดิมก่อน แล้ว upsert master data
 */
async function seedModule1() {
  // ลบข้อมูล transactional เดิม (idempotent)
  await prisma.returnStockMovement.deleteMany();
  await prisma.attachment.deleteMany({ where: { ownerType: 'return_item' } });
  await prisma.returnDocument.deleteMany(); // cascade ลบ return_items

  // ----- master data -----
  const customers = [
    { code: 'C001', name: 'บจก. ลูกค้าทดสอบหนึ่ง' },
    { code: 'C002', name: 'บจก. โรงงานสองพันเอ็ด' },
    { code: 'C003', name: 'หจก. สามมิตรการช่าง' },
  ];
  for (const c of customers) {
    await prisma.customer.upsert({ where: { code: c.code }, update: { name: c.name }, create: c });
  }

  const supplier = await prisma.supplier.upsert({
    where: { code: 'SKF' },
    update: { name: 'SKF (Thailand)' },
    create: { code: 'SKF', name: 'SKF (Thailand)' },
  });

  await prisma.buyer.deleteMany();
  const buyerNew = await prisma.buyer.create({ data: { name: 'กรุงเทพรีไซเคิล (ผู้รับซื้อรายใหม่)' } });
  const buyerScrap = await prisma.buyer.create({ data: { name: 'ร้านลุงโต (รับซื้อซาก)' } });

  // สินค้า: แบตเตอรี่ (มีรุ่น), ถังทินเนอร์ (ไม่มีรุ่น)
  const battery = await prisma.product.upsert({
    where: { code: 'BATT' },
    update: { name: 'แบตเตอรี่', hasModels: true },
    create: { code: 'BATT', name: 'แบตเตอรี่', hasModels: true },
  });
  const thinner = await prisma.product.upsert({
    where: { code: 'THIN' },
    update: { name: 'ถังทินเนอร์', hasModels: false },
    create: { code: 'THIN', name: 'ถังทินเนอร์', hasModels: false },
  });

  const batt12 = await prisma.productModel.upsert({
    where: { productId_code: { productId: battery.id, code: 'BATT-12V' } },
    update: { name: '12V 100Ah' },
    create: { productId: battery.id, code: 'BATT-12V', name: '12V 100Ah' },
  });
  const batt24 = await prisma.productModel.upsert({
    where: { productId_code: { productId: battery.id, code: 'BATT-24V' } },
    update: { name: '24V 200Ah' },
    create: { productId: battery.id, code: 'BATT-24V', name: '24V 200Ah' },
  });

  // มาตรฐานส่วนลด (บาท/หน่วย)
  await prisma.discountStandard.deleteMany();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  await prisma.discountStandard.createMany({
    data: [
      { productId: battery.id, productModelId: batt12.id, standardDiscount: 15, effectiveFrom: lastMonth, isActive: true },
      { productId: battery.id, productModelId: batt24.id, standardDiscount: 25, effectiveFrom: lastMonth, isActive: true },
      { productId: thinner.id, productModelId: null, standardDiscount: 20, effectiveFrom: lastMonth, isActive: true },
    ],
  });

  // เหตุผลตัดจำหน่าย 3 รายการ
  const reasons = [
    { code: 'SELL_BACK', name: 'ขายคืนผู้ขายเดิม', counterpartyKind: 'supplier' as const },
    { code: 'SELL_NEW', name: 'ขายให้ผู้รับซื้อรายใหม่', counterpartyKind: 'buyer' as const },
    { code: 'SELL_SCRAP', name: 'ขายซาก', counterpartyKind: 'buyer' as const },
  ];
  const reasonByCode: Record<string, string> = {};
  for (const r of reasons) {
    const reason = await prisma.disposalReason.upsert({
      where: { code: r.code },
      update: { name: r.name, counterpartyKind: r.counterpartyKind },
      create: r,
    });
    reasonByCode[r.code] = reason.id;
  }

  // ----- users สำหรับอ้างอิง -----
  const sale = await prisma.user.findUniqueOrThrow({ where: { employeeCode: 'SALE001' } });
  const lead = await prisma.user.findUniqueOrThrow({ where: { employeeCode: 'SLEAD001' } });
  const wh = await prisma.user.findUniqueOrThrow({ where: { employeeCode: 'WH001' } });
  const exec = await prisma.user.findUniqueOrThrow({ where: { employeeCode: 'EXEC001' } });

  // helper: สร้าง receipt movement สำหรับ item ที่รับแล้ว
  const receiptMovement = (itemId: string, productId: string, productModelId: string | null, qty: number) =>
    prisma.returnStockMovement.create({
      data: {
        productId,
        productModelId,
        quantityChange: qty,
        movementType: StockMovementType.receipt,
        referenceType: 'return_item',
        referenceId: itemId,
        createdById: wh.id,
      },
    });

  // ===== GD-2025-0001: รับครบทั้งใบ (fully_received) =====
  const gd1 = await prisma.returnDocument.create({
    data: {
      gdNumber: 'GD-2025-0001',
      customerCode: 'C001',
      customerName: 'บจก. ลูกค้าทดสอบหนึ่ง',
      createdById: sale.id,
      status: ReturnDocumentStatus.fully_received,
    },
  });
  const g1a = await prisma.returnItem.create({
    data: {
      returnDocumentId: gd1.id, productId: battery.id, productModelId: batt12.id,
      declaredQuantity: 10, discountPerUnit: 12, totalDiscount: 120, standardDiscountSnapshot: 15,
      discountStatus: DiscountStatus.within_standard, approvalStatus: ApprovalStatus.not_required,
      receivedQuantity: 10, receiptStatus: ReceiptStatus.received, receivedById: wh.id, receivedAt: new Date(),
    },
  });
  await receiptMovement(g1a.id, battery.id, batt12.id, 10);
  const g1b = await prisma.returnItem.create({
    data: {
      returnDocumentId: gd1.id, productId: thinner.id, productModelId: null,
      declaredQuantity: 5, discountPerUnit: 18, totalDiscount: 90, standardDiscountSnapshot: 20,
      discountStatus: DiscountStatus.within_standard, approvalStatus: ApprovalStatus.not_required,
      receivedQuantity: 5, receiptStatus: ReceiptStatus.received, receivedById: wh.id, receivedAt: new Date(),
    },
  });
  await receiptMovement(g1b.id, thinner.id, null, 5);

  // ===== GD-2025-0002: อนุมัติพิเศษ + รับแล้ว(mismatch) + อีกรายการรอรับ (partially_received) =====
  const gd2 = await prisma.returnDocument.create({
    data: {
      gdNumber: 'GD-2025-0002', customerCode: 'C002', customerName: 'บจก. โรงงานสองพันเอ็ด',
      createdById: sale.id, status: ReturnDocumentStatus.partially_received,
    },
  });
  const g2a = await prisma.returnItem.create({
    data: {
      returnDocumentId: gd2.id, productId: battery.id, productModelId: batt24.id,
      declaredQuantity: 8, discountPerUnit: 30, totalDiscount: 240, standardDiscountSnapshot: 25,
      discountStatus: DiscountStatus.over_standard, approvalStatus: ApprovalStatus.approved,
      approvedById: lead.id, approvedAt: new Date(),
      receivedQuantity: 7, receiptStatus: ReceiptStatus.received, receivedById: wh.id, receivedAt: new Date(),
      qtyMismatch: true,
    },
  });
  await receiptMovement(g2a.id, battery.id, batt24.id, 7);
  await prisma.returnItem.create({
    data: {
      returnDocumentId: gd2.id, productId: thinner.id, productModelId: null,
      declaredQuantity: 4, discountPerUnit: 15, totalDiscount: 60, standardDiscountSnapshot: 20,
      discountStatus: DiscountStatus.within_standard, approvalStatus: ApprovalStatus.not_required,
      receiptStatus: ReceiptStatus.pending_receipt,
    },
  });

  // ===== GD-2025-0003: ปฏิเสธพิเศษ + อีกรายการรอรับ (recorded) =====
  const gd3 = await prisma.returnDocument.create({
    data: {
      gdNumber: 'GD-2025-0003', customerCode: 'C003', customerName: 'หจก. สามมิตรการช่าง',
      createdById: sale.id, status: ReturnDocumentStatus.recorded,
    },
  });
  await prisma.returnItem.create({
    data: {
      returnDocumentId: gd3.id, productId: battery.id, productModelId: batt12.id,
      declaredQuantity: 6, discountPerUnit: 22, totalDiscount: 132, standardDiscountSnapshot: 15,
      discountStatus: DiscountStatus.over_standard, approvalStatus: ApprovalStatus.rejected,
      approvedById: lead.id, approvedAt: new Date(), rejectReason: 'ส่วนลดสูงเกินไป ไม่อนุมัติ',
      receiptStatus: ReceiptStatus.pending_receipt,
    },
  });
  await prisma.returnItem.create({
    data: {
      returnDocumentId: gd3.id, productId: thinner.id, productModelId: null,
      declaredQuantity: 3, discountPerUnit: 19, totalDiscount: 57, standardDiscountSnapshot: 20,
      discountStatus: DiscountStatus.within_standard, approvalStatus: ApprovalStatus.not_required,
      receiptStatus: ReceiptStatus.pending_receipt,
    },
  });

  // ===== GD-2025-0004: รอคลังรับ + รออนุมัติพิเศษ (recorded) =====
  const gd4 = await prisma.returnDocument.create({
    data: {
      gdNumber: 'GD-2025-0004', customerCode: 'C001', customerName: 'บจก. ลูกค้าทดสอบหนึ่ง',
      createdById: sale.id, status: ReturnDocumentStatus.recorded,
    },
  });
  await prisma.returnItem.create({
    data: {
      returnDocumentId: gd4.id, productId: battery.id, productModelId: batt24.id,
      declaredQuantity: 12, discountPerUnit: 22, totalDiscount: 264, standardDiscountSnapshot: 25,
      discountStatus: DiscountStatus.within_standard, approvalStatus: ApprovalStatus.not_required,
      receiptStatus: ReceiptStatus.pending_receipt,
    },
  });
  await prisma.returnItem.create({
    data: {
      returnDocumentId: gd4.id, productId: battery.id, productModelId: batt12.id,
      declaredQuantity: 5, discountPerUnit: 18, totalDiscount: 90, standardDiscountSnapshot: 15,
      discountStatus: DiscountStatus.over_standard, approvalStatus: ApprovalStatus.pending,
      receiptStatus: ReceiptStatus.pending_receipt,
    },
  });

  // ===== ตัดจำหน่ายตัวอย่าง 2 รายการ =====
  // batt12 คงเหลือ 10 → ตัด 3 (ขายคืนผู้ขายเดิม, ผู้บริหารบันทึกมูลค่าแล้ว)
  await prisma.returnStockMovement.create({
    data: {
      productId: battery.id, productModelId: batt12.id, quantityChange: -3,
      movementType: StockMovementType.disposal, disposalReasonId: reasonByCode.SELL_BACK,
      counterpartyType: CounterpartyType.supplier, counterpartyId: supplier.id, counterpartyName: supplier.name,
      saleValue: 4500, saleValueStatus: SaleValueStatus.recorded, saleValueById: exec.id, saleValueAt: new Date(),
      createdById: wh.id,
    },
  });
  // thinner คงเหลือ 5 → ตัด 2 (ขายซาก, รอผู้บริหารบันทึกมูลค่า)
  await prisma.returnStockMovement.create({
    data: {
      productId: thinner.id, productModelId: null, quantityChange: -2,
      movementType: StockMovementType.disposal, disposalReasonId: reasonByCode.SELL_SCRAP,
      counterpartyType: CounterpartyType.buyer, counterpartyId: buyerScrap.id, counterpartyName: buyerScrap.name,
      saleValueStatus: SaleValueStatus.pending,
      createdById: wh.id,
    },
  });

  void buyerNew; // มีไว้ให้แอดมินเลือกใน UI (ผู้รับซื้อรายใหม่)
  console.log('[seed] module 1: 4 GDs, stock movements (receipt + disposal), master data');
}

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedDemoUsers();
  await seedModule1();
  console.log('[seed] all seed done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
