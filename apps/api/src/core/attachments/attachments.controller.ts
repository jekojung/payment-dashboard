import { Controller, Get, Query } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';

/**
 * อ่านรายการไฟล์แนบของ owner (เช่น รูปที่รับสินค้า) — endpoint อัปโหลดอยู่ในขั้นที่ 6
 */
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  list(@Query('ownerType') ownerType: string, @Query('ownerId') ownerId: string) {
    return this.attachments.listForOwner(ownerType, ownerId);
  }
}
