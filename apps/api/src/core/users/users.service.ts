import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateUserInput, UpdateUserInput } from '@tpg/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

const userSelect = {
  id: true,
  employeeCode: true,
  name: true,
  department: true,
  lineUserId: true,
  isActive: true,
  createdAt: true,
  userRoles: { select: { role: { select: { key: true, name: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({
      select: userSelect,
      orderBy: { employeeCode: 'asc' },
    });
    return users.map(this.flatten);
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้');
    return this.flatten(user);
  }

  async create(input: CreateUserInput) {
    const exists = await this.prisma.user.findUnique({
      where: { employeeCode: input.employeeCode },
    });
    if (exists) throw new ConflictException('รหัสพนักงานนี้มีอยู่แล้ว');

    const roleIds = await this.resolveRoleIds(input.roleKeys);
    const passwordHash = input.password ? await AuthService.hashPassword(input.password) : null;

    const user = await this.prisma.user.create({
      data: {
        employeeCode: input.employeeCode,
        name: input.name,
        department: input.department ?? null,
        passwordHash,
        userRoles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
      select: userSelect,
    });
    return this.flatten(user);
  }

  async update(id: string, input: UpdateUserInput) {
    await this.get(id);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.department !== undefined) data.department = input.department;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.lineUserId !== undefined) data.lineUserId = input.lineUserId;
    if (input.password) data.passwordHash = await AuthService.hashPassword(input.password);

    if (input.roleKeys) {
      const roleIds = await this.resolveRoleIds(input.roleKeys);
      data.userRoles = {
        deleteMany: {},
        create: roleIds.map((roleId) => ({ roleId })),
      };
    }

    const user = await this.prisma.user.update({ where: { id }, data, select: userSelect });
    return this.flatten(user);
  }

  /** admin ลบการผูกบัญชี LINE */
  async unbindLine(id: string) {
    await this.get(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { lineUserId: null },
      select: userSelect,
    });
    return this.flatten(user);
  }

  private async resolveRoleIds(roleKeys: string[]): Promise<string[]> {
    if (roleKeys.length === 0) return [];
    const roles = await this.prisma.role.findMany({ where: { key: { in: roleKeys } } });
    if (roles.length !== roleKeys.length) {
      const found = new Set(roles.map((r) => r.key));
      const missing = roleKeys.filter((k) => !found.has(k));
      throw new NotFoundException(`ไม่พบบทบาท: ${missing.join(', ')}`);
    }
    return roles.map((r) => r.id);
  }

  private flatten = (u: {
    id: string;
    employeeCode: string;
    name: string;
    department: string | null;
    lineUserId: string | null;
    isActive: boolean;
    createdAt: Date;
    userRoles: { role: { key: string; name: string } }[];
  }) => ({
    id: u.id,
    employeeCode: u.employeeCode,
    name: u.name,
    department: u.department,
    lineUserId: u.lineUserId,
    isActive: u.isActive,
    createdAt: u.createdAt,
    roles: u.userRoles.map((ur) => ur.role),
  });
}
