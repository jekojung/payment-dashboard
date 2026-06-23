import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LineBindingInput } from '@tpg/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * ผูกบัญชี LINE เองด้วยรหัสพนักงาน (กรอกครั้งแรก)
 * admin แก้ไข/ลบการผูกได้ (ดู UsersService)
 */
@Injectable()
export class LineBindingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** ผูก lineUserId เข้ากับผู้ใช้ตามรหัสพนักงาน */
  async bind(input: LineBindingInput) {
    const user = await this.prisma.user.findUnique({
      where: { employeeCode: input.employeeCode },
    });
    if (!user || !user.isActive) {
      throw new NotFoundException('ไม่พบรหัสพนักงานนี้ หรือบัญชีถูกปิดใช้งาน');
    }

    // line userId ถูกผูกกับคนอื่นแล้ว
    const existing = await this.prisma.user.findUnique({
      where: { lineUserId: input.lineUserId },
    });
    if (existing && existing.id !== user.id) {
      throw new ConflictException('บัญชี LINE นี้ถูกผูกกับพนักงานคนอื่นแล้ว');
    }

    if (user.lineUserId && user.lineUserId !== input.lineUserId) {
      throw new BadRequestException('พนักงานคนนี้ผูกบัญชี LINE อื่นไว้แล้ว');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lineUserId: input.lineUserId },
    });

    await this.audit.log({
      userId: user.id,
      action: 'line.bind',
      entity: 'user',
      entityId: user.id,
      payload: { lineUserId: input.lineUserId },
    });

    return { id: updated.id, employeeCode: updated.employeeCode, name: updated.name };
  }

  /** หาผู้ใช้จาก lineUserId (ใช้ใน webhook step 4) */
  findUserByLineId(lineUserId: string) {
    return this.prisma.user.findUnique({ where: { lineUserId } });
  }
}
