/**
 * Shared enums — ต้องตรงกับ enum ใน Prisma schema (apps/api/prisma/schema.prisma)
 * ใช้ร่วมกันทั้ง API และ Web
 */

/** ช่องทางที่ผู้ใช้/บทบาทเข้าถึงได้ */
export enum Channel {
  LINE = 'line',
  WEB = 'web',
}

/** สถานะใบ GD (return_documents.status) — derived */
export enum ReturnDocumentStatus {
  RECORDED = 'recorded',
  PARTIALLY_RECEIVED = 'partially_received',
  FULLY_RECEIVED = 'fully_received',
}

/** ผลการเทียบส่วนลดกับมาตรฐาน */
export enum DiscountStatus {
  WITHIN_STANDARD = 'within_standard',
  OVER_STANDARD = 'over_standard',
}

/** สถานะการอนุมัติพิเศษของ return_item */
export enum ApprovalStatus {
  NOT_REQUIRED = 'not_required',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/** สถานะการรับสินค้าของ return_item */
export enum ReceiptStatus {
  PENDING_RECEIPT = 'pending_receipt',
  RECEIVED = 'received',
}

/** ประเภทการเคลื่อนไหวสต็อก */
export enum StockMovementType {
  RECEIPT = 'receipt',
  DISPOSAL = 'disposal',
}

/** ชนิดคู่ค้าปลายทางของการตัดจำหน่าย */
export enum CounterpartyType {
  SUPPLIER = 'supplier',
  BUYER = 'buyer',
}

/** ชนิดคู่ค้าที่เหตุผลตัดจำหน่ายต้องการ */
export enum CounterpartyKind {
  SUPPLIER = 'supplier',
  BUYER = 'buyer',
  NONE = 'none',
}

/** สถานะการบันทึกมูลค่าขาย (ผู้บริหารบันทึกภายหลัง) */
export enum SaleValueStatus {
  PENDING = 'pending',
  RECORDED = 'recorded',
}

/** ช่องทางการแจ้งเตือน */
export enum NotificationChannel {
  LINE = 'line',
  WEB = 'web',
}

/** role keys (RBAC แบบ module-level) */
export enum RoleKey {
  SYSTEM_ADMIN = 'system_admin',
  EXECUTIVE = 'executive',
  SALES_LEAD = 'sales_lead',
  WAREHOUSE_LEAD = 'warehouse_lead',
  SALES_STAFF = 'sales_staff',
  WAREHOUSE_STAFF = 'warehouse_staff',
  TRANSPORT_LEAD = 'transport_lead',
  TRANSPORT_STAFF = 'transport_staff',
}

/** module keys */
export enum ModuleKey {
  RETURNS_DISCOUNT = 'returns_discount',
}

/**
 * permissions รูปแบบ `module:action`
 * core = สิทธิ์ระดับแพลตฟอร์ม (admin จัดการ users/master data/modules/audit)
 * โมดูล 1 (returns_discount)
 */
export const Permissions = {
  CORE: {
    MANAGE_USERS: 'core:manage_users',
    MANAGE_MASTERDATA: 'core:manage_masterdata',
    MANAGE_DISCOUNT_STANDARDS: 'core:manage_discount_standards',
    MANAGE_MODULES: 'core:manage_modules',
    VIEW_AUDIT: 'core:view_audit',
  },
  RETURNS_DISCOUNT: {
    VIEW: 'returns_discount:view',
    CREATE: 'returns_discount:create',
    APPROVE_SPECIAL: 'returns_discount:approve_special',
    RECEIVE: 'returns_discount:receive',
    DISPOSAL: 'returns_discount:disposal',
    SET_SALE_VALUE: 'returns_discount:set_sale_value',
  },
} as const;

/** รวม permission keys ทั้งหมดเป็น flat list (ใช้ seed permissions table) */
export const ALL_PERMISSION_KEYS: string[] = [
  ...Object.values(Permissions.CORE),
  ...Object.values(Permissions.RETURNS_DISCOUNT),
];

/**
 * แมป role → permissions (ค่าเริ่มต้น)
 * system_admin เป็น super-admin (ผ่านทุก permission) จึงไม่ต้องลิสต์ทั้งหมด
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  [RoleKey.SYSTEM_ADMIN]: ALL_PERMISSION_KEYS,
  [RoleKey.EXECUTIVE]: [
    Permissions.CORE.MANAGE_DISCOUNT_STANDARDS,
    Permissions.RETURNS_DISCOUNT.VIEW,
    Permissions.RETURNS_DISCOUNT.SET_SALE_VALUE,
  ],
  [RoleKey.SALES_LEAD]: [
    Permissions.RETURNS_DISCOUNT.VIEW,
    Permissions.RETURNS_DISCOUNT.CREATE,
    Permissions.RETURNS_DISCOUNT.APPROVE_SPECIAL,
  ],
  [RoleKey.WAREHOUSE_LEAD]: [
    Permissions.RETURNS_DISCOUNT.VIEW,
    Permissions.RETURNS_DISCOUNT.RECEIVE,
    Permissions.RETURNS_DISCOUNT.DISPOSAL,
  ],
  [RoleKey.SALES_STAFF]: [Permissions.RETURNS_DISCOUNT.CREATE],
  [RoleKey.WAREHOUSE_STAFF]: [
    Permissions.RETURNS_DISCOUNT.VIEW,
    Permissions.RETURNS_DISCOUNT.RECEIVE,
    Permissions.RETURNS_DISCOUNT.DISPOSAL,
  ],
  [RoleKey.TRANSPORT_LEAD]: [],
  [RoleKey.TRANSPORT_STAFF]: [],
};

/** ช่องทางของแต่ละ role (web / line) — ใช้ตอน seed roles */
export const ROLE_CHANNELS: Record<string, Channel[]> = {
  [RoleKey.SYSTEM_ADMIN]: [Channel.WEB],
  [RoleKey.EXECUTIVE]: [Channel.WEB],
  [RoleKey.SALES_LEAD]: [Channel.WEB, Channel.LINE],
  [RoleKey.WAREHOUSE_LEAD]: [Channel.WEB, Channel.LINE],
  [RoleKey.SALES_STAFF]: [Channel.LINE],
  [RoleKey.WAREHOUSE_STAFF]: [Channel.LINE],
  [RoleKey.TRANSPORT_LEAD]: [Channel.LINE],
  [RoleKey.TRANSPORT_STAFF]: [Channel.LINE],
};
