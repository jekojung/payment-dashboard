/**
 * Zod schemas ใช้ร่วม api + web (validate ทุกชั้น)
 */
import { z } from 'zod';
import { CounterpartyKind } from './enums';

// ---------- Auth ----------
export const loginSchema = z.object({
  employeeCode: z.string().min(1, 'กรุณาระบุรหัสพนักงาน'),
  password: z.string().min(1, 'กรุณาระบุรหัสผ่าน'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const lineBindingSchema = z.object({
  employeeCode: z.string().min(1, 'กรุณาระบุรหัสพนักงาน'),
  lineUserId: z.string().min(1),
});
export type LineBindingInput = z.infer<typeof lineBindingSchema>;

// ---------- Users (admin) ----------
export const createUserSchema = z.object({
  employeeCode: z.string().min(1),
  name: z.string().min(1),
  password: z.string().min(6).optional(),
  department: z.string().optional(),
  roleKeys: z.array(z.string()).default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  department: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  roleKeys: z.array(z.string()).optional(),
  lineUserId: z.string().nullable().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ---------- Master data ----------
export const customerSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean().optional(),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const supplierSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean().optional(),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const buyerSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().optional(),
});
export type BuyerInput = z.infer<typeof buyerSchema>;

export const productSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  hasModels: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const productModelSchema = z.object({
  productId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean().optional(),
});
export type ProductModelInput = z.infer<typeof productModelSchema>;

export const discountStandardSchema = z.object({
  productId: z.string().min(1),
  productModelId: z.string().nullable().optional(),
  standardDiscount: z.number().nonnegative(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type DiscountStandardInput = z.infer<typeof discountStandardSchema>;

export const disposalReasonSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  counterpartyKind: z.nativeEnum(CounterpartyKind),
  isActive: z.boolean().optional(),
});
export type DisposalReasonInput = z.infer<typeof disposalReasonSchema>;

// ---------- Notifications ----------
export const markReadSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});
export type MarkReadInput = z.infer<typeof markReadSchema>;

// ---------- โมดูล 1: Flow A (แจ้งส่วนลดรับเทิร์น) ----------
/** ฟอร์ม LIFF ฝ่ายขายแจ้งส่วนลด (1 รายการ/ครั้ง; 1 ใบ GD มีได้หลายรายการ) */
export const createReturnDiscountSchema = z.object({
  customerCode: z.string().min(1, 'กรุณาระบุรหัสลูกค้า'),
  customerName: z.string().optional(),
  gdNumber: z.string().min(1, 'กรุณาระบุเลขที่ใบ GD'),
  productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
  productModelId: z.string().nullable().optional(),
  declaredQuantity: z.number().int().positive('จำนวนต้องมากกว่า 0'),
  discountPerUnit: z.number().nonnegative('ส่วนลดต้องไม่ติดลบ'),
});
export type CreateReturnDiscountInput = z.infer<typeof createReturnDiscountSchema>;

/** ปฏิเสธการอนุมัติพิเศษ (ต้องมีเหตุผล) */
export const rejectReturnItemSchema = z.object({
  reason: z.string().min(1, 'กรุณาระบุเหตุผลการปฏิเสธ'),
});
export type RejectReturnItemInput = z.infer<typeof rejectReturnItemSchema>;
