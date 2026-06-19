import { Injectable } from '@nestjs/common';
import { RoleKey } from '@tpg/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface ResolvedUserAccess {
  roles: string[];
  permissions: string[];
  isSystemAdmin: boolean;
}

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  /** รวม roles + permissions ของผู้ใช้ (system_admin = super admin) */
  async resolveAccess(userId: string): Promise<ResolvedUserAccess> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });

    const roles = userRoles.map((ur) => ur.role.key);
    const isSystemAdmin = roles.includes(RoleKey.SYSTEM_ADMIN);

    const permissionSet = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.key);
      }
    }

    return { roles, permissions: [...permissionSet], isSystemAdmin };
  }

  /** ตรวจว่า access มีสิทธิ์ที่ต้องการครบหรือไม่ (system_admin ผ่านเสมอ) */
  hasPermissions(access: ResolvedUserAccess, required: string[]): boolean {
    if (access.isSystemAdmin) return true;
    if (required.length === 0) return true;
    return required.every((p) => access.permissions.includes(p));
  }

  /**
   * หาผู้ใช้ที่ active และมีสิทธิ์ที่กำหนด (รวม system_admin ที่ผ่านทุกสิทธิ์)
   * ใช้ส่ง notification/Flex ให้กลุ่มผู้มีสิทธิ์ เช่น ผู้อนุมัติพิเศษ / คลัง
   */
  findUsersWithPermission(permission: string) {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: {
              OR: [
                { key: RoleKey.SYSTEM_ADMIN },
                { rolePermissions: { some: { permission: { key: permission } } } },
              ],
            },
          },
        },
      },
      select: { id: true, name: true, lineUserId: true },
    });
  }
}
