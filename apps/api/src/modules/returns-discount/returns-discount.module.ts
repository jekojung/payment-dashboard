import { Module, OnModuleInit } from '@nestjs/common';
import { RegistryService } from '../../core/modules/registry.service';
import { returnsDiscountDefinition } from './returns-discount.definition';
import { ReturnsDiscountController } from './returns-discount.controller';
import { ReturnsDiscountService } from './returns-discount.service';
import { ReturnsDiscountLineHandler } from './returns-discount.line';

/**
 * โมดูล 1 — ลงทะเบียนตัวเองผ่าน Registry (ห้าม core import โค้ดโมดูลนี้)
 * Flow A (แจ้งส่วนลด + อนุมัติพิเศษ) — ขั้นที่ 5
 * core services (Prisma/Rbac/Audit/Notifications/Line) inject ได้จาก global scope
 */
@Module({
  controllers: [ReturnsDiscountController],
  providers: [ReturnsDiscountService, ReturnsDiscountLineHandler],
})
export class ReturnsDiscountModule implements OnModuleInit {
  constructor(private readonly registry: RegistryService) {}

  onModuleInit(): void {
    this.registry.register(returnsDiscountDefinition);
  }
}
