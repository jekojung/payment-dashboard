import { Module, OnModuleInit } from '@nestjs/common';
import { RegistryService } from '../../core/modules/registry.service';
import { returnsDiscountDefinition } from './returns-discount.definition';

/**
 * โมดูล 1 — ลงทะเบียนตัวเองผ่าน Registry (ห้าม core import โค้ดโมดูลนี้)
 * Flow A/B/C/D + controllers จะถูกเพิ่มในขั้นที่ 5-7
 */
@Module({})
export class ReturnsDiscountModule implements OnModuleInit {
  constructor(private readonly registry: RegistryService) {}

  onModuleInit(): void {
    this.registry.register(returnsDiscountDefinition);
  }
}
