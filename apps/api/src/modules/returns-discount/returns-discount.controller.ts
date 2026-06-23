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
  createDisposalSchema,
  createReturnDiscountSchema,
  receiveItemSchema,
  rejectReturnItemSchema,
  setSaleValueSchema,
  type CreateDisposalInput,
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

  /** รายการใบ GD (filter ผ่าน query) */
  @Get('documents')
  @RequirePermissions(P.VIEW)
  documents(
    @Query('status') status?: string,
    @Query('customerCode') customerCode?: string,
    @Query('createdById') createdById?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listDocuments({ status, customerCode, createdById, search });
  }

  /** รายละเอียดใบ GD */
  @Get('documents/:id')
  @RequirePermissions(P.VIEW)
  document(@Param('id') id: string) {
    return this.service.getDocument(id);
  }

  /** KPI + กราฟ หน้า dashboard */
  @Get('dashboard')
  @RequirePermissions(P.VIEW)
  dashboard() {
    return this.service.getDashboard();
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

  // ---------- Flow C: ตัดจำหน่าย ----------

  /** ตัดจำหน่ายสต็อก (validate ≤ คงเหลือ, บันทึกเหตุผล + คู่ค้าปลายทาง) */
  @Post('disposals')
  @RequirePermissions(P.DISPOSAL)
  dispose(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createDisposalSchema)) body: CreateDisposalInput,
  ) {
    return this.service.createDisposal(user, body);
  }

  // ---------- Flow D: ตรวจสอบสต็อก ----------

  /** ยอดคงเหลือต่อ (สินค้า/รุ่น); ?all=true เพื่อรวมที่คงเหลือ 0 */
  @Get('stock')
  @RequirePermissions(P.VIEW)
  stock(@Query('all') all?: string) {
    return this.service.listStockBalances(all !== 'true');
  }

  /** ประวัติการเคลื่อนไหวของสินค้า/รุ่น */
  @Get('stock/ledger')
  @RequirePermissions(P.VIEW)
  ledger(@Query('productId') productId: string, @Query('productModelId') productModelId?: string) {
    return this.service.getLedger(productId, productModelId ?? null);
  }

  /** รายการตัดจำหน่าย (filter เหตุผล/สถานะมูลค่าขาย) */
  @Get('disposals')
  @RequirePermissions(P.VIEW)
  disposals(
    @Query('reasonId') reasonId?: string,
    @Query('saleValueStatus') saleValueStatus?: string,
  ) {
    return this.service.listDisposals({ reasonId, saleValueStatus });
  }

  /** ผู้บริหารบันทึกมูลค่าขายของรายการตัดจำหน่าย */
  @Post('disposals/:id/sale-value')
  @RequirePermissions(P.SET_SALE_VALUE)
  setSaleValue(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setSaleValueSchema)) body: { saleValue: number },
  ) {
    return this.service.setSaleValue(user, id, body.saleValue);
  }
}
