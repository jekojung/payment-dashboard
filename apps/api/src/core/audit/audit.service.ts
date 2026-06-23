import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  userId?: string | null;
  moduleKey?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  payload?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** บันทึก audit log ของทุกการกระทำสำคัญ */
  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        moduleKey: entry.moduleKey ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        payload: entry.payload ?? Prisma.JsonNull,
      },
    });
  }

  async list(params: {
    moduleKey?: string;
    entity?: string;
    entityId?: string;
    userId?: string;
    take?: number;
    skip?: number;
  }) {
    const { moduleKey, entity, entityId, userId, take = 50, skip = 0 } = params;
    const where: Prisma.AuditLogWhereInput = {
      ...(moduleKey ? { moduleKey } : {}),
      ...(entity ? { entity } : {}),
      ...(entityId ? { entityId } : {}),
      ...(userId ? { userId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(take, 200),
        skip,
        include: { user: { select: { id: true, name: true, employeeCode: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
