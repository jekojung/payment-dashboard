/**
 * Prisma seed
 * ขั้นที่ 3: core RBAC — roles, permissions, role_permissions, demo users ต่อ role
 * ขั้นที่ 10: จะเพิ่ม master data, discount_standards, disposal_reasons,
 *            ใบ GD ตัวอย่าง, stock movement ตัวอย่าง
 */
import { PrismaClient } from '@prisma/client';
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

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedDemoUsers();
  console.log('[seed] core RBAC seed done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
