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
 * โมดูล 1 (returns_discount)
 */
export const Permissions = {
  RETURNS_DISCOUNT: {
    VIEW: 'returns_discount:view',
    CREATE: 'returns_discount:create',
    APPROVE_SPECIAL: 'returns_discount:approve_special',
    RECEIVE: 'returns_discount:receive',
    DISPOSAL: 'returns_discount:disposal',
    SET_SALE_VALUE: 'returns_discount:set_sale_value',
  },
} as const;
