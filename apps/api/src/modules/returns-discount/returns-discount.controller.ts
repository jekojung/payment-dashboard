import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  Permissions,
  createReturnDiscountSchema,
  receiveItemSchema,
  rejectReturnItemSchema,
  type CreateReturnDiscountInput,
  type RejectReturnItemInput,
} from '@tpg/shared';
import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthUser } from '../../common/auth-user';
import { ReturnsDiscountService } from './returns-discount.service';

/** ไฟล์ที่อัปโหลดผ่าน multer (memory storage) */
interface UploadedPhoto {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

const P = Permissions.RETURNS_DISCOUNT;

/**
 * REST สำหรับโมดูล 1 — Flow A (แจ้งส่วนลด + อนุมัติพิเศษ)
 * ใช้ทั้งจากฟอร์ม LIFF (ฝ่ายขาย) และหน้าเว็บ (หัวหน้า/ผู้บริหาร)
 */
@Controller('returns-discount')
export class ReturnsDiscountController {
  constructor(private readonly service: ReturnsDiscountService) {}

  /** ฝ่ายขายแจ้งส่วนลด (LIFF) */
  @Post('items')
  @RequirePermissions(P.CREATE)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createReturnDiscountSchema)) body: CreateReturnDiscountInput,
  ) {
    return this.service.createDiscountReport(user, body);
  }

  /** preview ผลเทียบส่วนลด vs มาตรฐาน (live ในฟอร์ม LIFF) */
  @Get('standards/compare')
  @RequirePermissions(P.CREATE)
  compare(
    @Query('productId') productId: string,
    @Query('discountPerUnit') discountPerUnit: string,
    @Query('productModelId') productModelId?: string,
  ) {
    return this.service.compare(productId, productModelId ?? null, Number(discountPerUnit));
  }

  /** รายการรออนุมัติพิเศษ */
  @Get('items/pending-approvals')
  @RequirePermissions(P.APPROVE_SPECIAL)
  pendingApprovals() {
    return this.service.listPendingApprovals();
  }

  /** อนุมัติส่วนลดพิเศษ */
  @Post('items/:id/approve')
  @RequirePermissions(P.APPROVE_SPECIAL)
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.approveItem(user, id);
  }

  /** ปฏิเสธส่วนลดพิเศษ (ต้องมีเหตุผล) */
  @Post('items/:id/reject')
  @RequirePermissions(P.APPROVE_SPECIAL)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectReturnItemSchema)) body: RejectReturnItemInput,
  ) {
    return this.service.rejectItem(user, id, body.reason);
  }

  /** รายการใบ GD (เบื้องต้น) */
  @Get('documents')
  @RequirePermissions(P.VIEW)
  documents() {
    return this.service.listDocuments();
  }

  // ---------- Flow B: คลังรับสินค้าเทิร์น ----------

  /** ใบ GD ที่มีรายการพร้อมรับ (สำหรับฟอร์ม LIFF คลัง) */
  @Get('receivable')
  @RequirePermissions(P.RECEIVE)
  receivable() {
    return this.service.listReceivable();
  }

  /** บันทึกรับสินค้า + แนบรูป (multipart: field "photo" + receivedQuantity) */
  @Post('items/:id/receive')
  @RequirePermissions(P.RECEIVE)
  @UseInterceptors(FileInterceptor('photo'))
  receive(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(receiveItemSchema)) body: { receivedQuantity: number },
    @UploadedFile() photo?: UploadedPhoto,
  ) {
    return this.service.receiveItem(user, id, body.receivedQuantity, photo);
  }
}
