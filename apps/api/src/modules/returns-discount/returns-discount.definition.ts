import { ModuleKey, Permissions, type ModuleDefinition } from '@tpg/shared';

const P = Permissions.RETURNS_DISCOUNT;

/** นิยามโมดูล 1 สำหรับ Module Registry (เมนู LINE/เว็บ/การ์ด dashboard) */
export const returnsDiscountDefinition: ModuleDefinition = {
  key: ModuleKey.RETURNS_DISCOUNT,
  name: 'ส่วนลดรับคืนสินค้าเทิร์น + สต็อก',
  apiBasePath: '/returns-discount',
  permissions: Object.values(P),
  lineMenu: [
    { label: 'แจ้งส่วนลดรับเทิร์นสินค้า', requiredPermission: P.CREATE, action: 'returns.create' },
    { label: 'บันทึกรับสินค้าเทิร์น', requiredPermission: P.RECEIVE, action: 'returns.receive' },
    { label: 'ตรวจสอบสต็อกรับเทิร์น', requiredPermission: P.VIEW, action: 'returns.stock' },
    { label: 'ตัดจำหน่ายสินค้ารับเทิร์น', requiredPermission: P.DISPOSAL, action: 'returns.disposal' },
  ],
  webNav: [
    { label: 'ภาพรวมส่วนลดรับเทิร์น', path: '/returns-discount', requiredPermission: P.VIEW },
    { label: 'สต็อกรับเทิร์น', path: '/returns-discount/stock', requiredPermission: P.VIEW },
    { label: 'การตัดจำหน่าย', path: '/returns-discount/disposal', requiredPermission: P.VIEW },
  ],
  dashboardCards: [
    { key: 'returns_discount_summary', title: 'ส่วนลดรับเทิร์น', requiredPermission: P.VIEW },
  ],
};
