import { Injectable, Logger } from '@nestjs/common';
import type { ModuleDefinition } from '@tpg/shared';
import type { AuthUser } from '../../common/auth-user';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Module Registry — โมดูลธุรกิจลงทะเบียนตัวเองที่นี่ (ห้าม core import โค้ดโมดูล)
 * ใช้สร้างเมนู LINE / เมนูเว็บ / การ์ด dashboard แบบ dynamic ตามสิทธิ์
 */
@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);
  private readonly modules = new Map<string, ModuleDefinition>();

  constructor(private readonly prisma: PrismaService) {}

  /** โมดูลเรียกตอน onModuleInit เพื่อลงทะเบียน */
  register(def: ModuleDefinition): void {
    this.modules.set(def.key, def);
    this.logger.log(`registered module: ${def.key} (${def.name})`);
  }

  getAll(): ModuleDefinition[] {
    return [...this.modules.values()];
  }

  get(key: string): ModuleDefinition | undefined {
    return this.modules.get(key);
  }

  /** sync รายการโมดูลลงตาราง modules (idempotent) */
  async syncToDatabase(): Promise<void> {
    for (const def of this.modules.values()) {
      await this.prisma.module.upsert({
        where: { key: def.key },
        update: { name: def.name },
        create: { key: def.key, name: def.name, isEnabled: true },
      });
    }
  }

  private can(user: AuthUser, permission: string): boolean {
    return user.isSystemAdmin || user.permissions.includes(permission);
  }

  /** เมนู LINE ที่ผู้ใช้คนนี้เห็น (กรองตามสิทธิ์) */
  lineMenuForUser(user: AuthUser) {
    return this.getAll().flatMap((m) =>
      m.lineMenu
        .filter((item) => this.can(user, item.requiredPermission))
        .map((item) => ({ moduleKey: m.key, ...item })),
    );
  }

  /** เมนูเว็บที่ผู้ใช้คนนี้เห็น */
  webNavForUser(user: AuthUser) {
    return this.getAll()
      .map((m) => ({
        key: m.key,
        name: m.name,
        items: m.webNav.filter((item) => this.can(user, item.requiredPermission)),
      }))
      .filter((m) => m.items.length > 0);
  }

  /** การ์ด dashboard ที่ผู้ใช้คนนี้เห็น */
  dashboardCardsForUser(user: AuthUser) {
    return this.getAll().flatMap((m) =>
      m.dashboardCards
        .filter((card) => this.can(user, card.requiredPermission))
        .map((card) => ({ moduleKey: m.key, ...card })),
    );
  }
}
