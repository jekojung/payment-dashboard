/**
 * Module Registry types — สัญญา (contract) สำหรับลงทะเบียนโมดูลธุรกิจ
 * การเพิ่มโมดูลใหม่ทำผ่าน registry นี้เท่านั้น ห้ามแก้ core
 */
import type { ModuleKey } from './enums';

/** เมนูที่จะแสดงใน LINE Rich Menu (dynamic ตามสิทธิ์) */
export interface ModuleLineMenuItem {
  /** label ภาษาไทยที่แสดงบนปุ่ม */
  label: string;
  /** permission ที่ต้องมีจึงจะเห็นเมนูนี้ */
  requiredPermission: string;
  /** action key ที่ใช้ route ฟอร์ม LIFF / postback */
  action: string;
}

/** เมนู/หน้าใน Web Dashboard (dynamic ตามสิทธิ์) */
export interface ModuleWebNavItem {
  label: string;
  path: string;
  requiredPermission: string;
}

/** การ์ดสรุปบนหน้า "ภาพรวม" */
export interface ModuleDashboardCard {
  key: string;
  title: string;
  requiredPermission: string;
}

export interface ModuleDefinition {
  key: ModuleKey;
  /** ชื่อแสดงผลภาษาไทย */
  name: string;
  /** permissions ทั้งหมดที่โมดูลนี้ประกาศใช้ */
  permissions: string[];
  /** prefix ของเส้นทาง API เช่น "/returns-discount" */
  apiBasePath: string;
  lineMenu: ModuleLineMenuItem[];
  webNav: ModuleWebNavItem[];
  dashboardCards: ModuleDashboardCard[];
}
