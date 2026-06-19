import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  DiscountStatus,
  NotificationChannel,
  Permissions,
  ReceiptStatus,
  type CreateReturnDiscountInput,
} from '@tpg/shared';
import type { AuthUser } from '../../common/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { LineService } from '../../core/line/line.service';
import {
  buildApprovalRequestFlex,
  buildApprovalResultFlex,
  buildPendingApprovalFlex,
  buildWithinStandardFlex,
} from './returns-discount.flex';

const P = Permissions.RETURNS_DISCOUNT;
const MODULE_KEY = 'returns_discount';

/** ตัวกระทำ (จาก JWT หรือจาก LINE userId) */
type Actor = Pick<AuthUser, 'id' | 'name' | 'permissions' | 'isSystemAdmin'>;

@Injectable()
export class ReturnsDiscountService {
  private readonly logger = new Logger(ReturnsDiscountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly rbac: RbacService,
    private readonly line: LineService,
  ) {}

  // ---------------------------------------------------------------------------
  // Flow A — ฝ่ายขายแจ้งส่วนลด
  // ---------------------------------------------------------------------------

  /** หามาตรฐานส่วนลดที่ active ของ (สินค้า + รุ่น) ณ ปัจจุบัน */
  async getActiveStandard(productId: string, productModelId: string | null): Promise<number | null> {
    const now = new Date();
    const std = await this.prisma.discountStandard.findFirst({
      where: {
        productId,
        productModelId: productModelId ?? null,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return std ? Number(std.standardDiscount) : null;
  }

  /** เทียบส่วนลดที่ให้ vs มาตรฐาน → in/over + snapshot ที่ใช้บันทึก */
  classifyDiscount(discountPerUnit: number, standard: number | null) {
    const standardSnapshot = standard ?? 0;
    const status =
      discountPerUnit <= standardSnapshot
        ? DiscountStatus.WITHIN_STANDARD
        : DiscountStatus.OVER_STANDARD;
    return { standardSnapshot, status };
  }

  /** preview ผลเทียบ (ใช้ใน LIFF ก่อนยืนยัน) */
  async compare(productId: string, productModelId: string | null, discountPerUnit: number) {
    const standard = await this.getActiveStandard(productId, productModelId);
    const { standardSnapshot, status } = this.classifyDiscount(discountPerUnit, standard);
    return {
      standardDiscount: standardSnapshot,
      hasStandard: standard !== null,
      discountStatus: status,
      requiresApproval: status === DiscountStatus.OVER_STANDARD,
      excessPerUnit: Math.max(0, discountPerUnit - standardSnapshot),
    };
  }

  /** ฝ่ายขายแจ้งส่วนลด 1 รายการ (เพิ่มเข้าใบ GD; สร้างใบใหม่ถ้ายังไม่มี) */
  async createDiscountReport(actor: Actor, input: CreateReturnDiscountInput) {
    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundException('ไม่พบสินค้าที่เลือก');

    const modelId = input.productModelId ?? null;
    if (modelId) {
      const model = await this.prisma.productModel.findUnique({ where: { id: modelId } });
      if (!model || model.productId !== product.id) {
        throw new BadRequestException('รุ่นสินค้าไม่ถูกต้อง');
      }
    } else if (product.hasModels) {
      throw new BadRequestException('สินค้านี้ต้องระบุรุ่น');
    }

    const standard = await this.getActiveStandard(product.id, modelId);
    const { standardSnapshot, status } = this.classifyDiscount(input.discountPerUnit, standard);
    const totalDiscount = input.discountPerUnit * input.declaredQuantity;
    const isWithin = status === DiscountStatus.WITHIN_STANDARD;

    // ใบ GD: ใช้ใบเดิมถ้ามีเลขซ้ำ (1 ใบ GD หลายรายการ)
    let doc = await this.prisma.returnDocument.findUnique({
      where: { gdNumber: input.gdNumber },
    });
    if (!doc) {
      const customerName = await this.resolveCustomerName(input.customerCode, input.customerName);
      doc = await this.prisma.returnDocument.create({
        data: {
          gdNumber: input.gdNumber,
          customerCode: input.customerCode,
          customerName,
          createdById: actor.id,
        },
      });
    }

    const model = modelId
      ? await this.prisma.productModel.findUnique({ where: { id: modelId } })
      : null;

    const item = await this.prisma.returnItem.create({
      data: {
        returnDocumentId: doc.id,
        productId: product.id,
        productModelId: modelId,
        declaredQuantity: input.declaredQuantity,
        discountPerUnit: input.discountPerUnit,
        totalDiscount,
        standardDiscountSnapshot: standardSnapshot,
        discountStatus: status,
        approvalStatus: isWithin ? ApprovalStatus.NOT_REQUIRED : ApprovalStatus.PENDING,
        receiptStatus: ReceiptStatus.PENDING_RECEIPT,
      },
    });

    await this.audit.log({
      userId: actor.id,
      moduleKey: MODULE_KEY,
      action: isWithin ? 'discount.report.within' : 'discount.report.over',
      entity: 'return_item',
      entityId: item.id,
      payload: {
        gdNumber: doc.gdNumber,
        discountPerUnit: input.discountPerUnit,
        standardSnapshot,
        totalDiscount,
      },
    });

    const summary = {
      gdNumber: doc.gdNumber,
      customerName: doc.customerName ?? doc.customerCode,
      productName: product.name,
      modelName: model?.name ?? null,
      quantity: item.declaredQuantity,
      discountPerUnit: input.discountPerUnit,
      totalDiscount,
      standardDiscount: standardSnapshot,
    };

    if (isWithin) {
      await this.notifyWarehousePending(doc.gdNumber, summary.productName);
      return { item, document: doc, discountStatus: status, flex: buildWithinStandardFlex(summary) };
    }

    await this.notifyApprovers({ ...summary, itemId: item.id, salesName: actor.name });
    return {
      item,
      document: doc,
      discountStatus: status,
      flex: buildPendingApprovalFlex(summary),
    };
  }

  // ---------------------------------------------------------------------------
  // อนุมัติ / ปฏิเสธ (หัวหน้า — approve_special)
  // ---------------------------------------------------------------------------

  async approveItem(actor: Actor, itemId: string) {
    const item = await this.loadPendingItem(actor, itemId);

    const updated = await this.prisma.returnItem.update({
      where: { id: item.id },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: actor.id,
        approvedAt: new Date(),
      },
    });

    await this.audit.log({
      userId: actor.id,
      moduleKey: MODULE_KEY,
      action: 'discount.approve',
      entity: 'return_item',
      entityId: item.id,
      payload: { gdNumber: item.returnDocument.gdNumber },
    });

    // แจ้งฝ่ายขายว่าอนุมัติแล้ว + แจ้งคลังว่าพร้อมรับ
    await this.notifySalesResult(item, actor.name, true);
    await this.notifyWarehousePending(item.returnDocument.gdNumber, item.product.name);

    return updated;
  }

  async rejectItem(actor: Actor, itemId: string, reason: string) {
    const item = await this.loadPendingItem(actor, itemId);

    const updated = await this.prisma.returnItem.update({
      where: { id: item.id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvedById: actor.id,
        approvedAt: new Date(),
        rejectReason: reason,
      },
    });

    await this.audit.log({
      userId: actor.id,
      moduleKey: MODULE_KEY,
      action: 'discount.reject',
      entity: 'return_item',
      entityId: item.id,
      payload: { gdNumber: item.returnDocument.gdNumber, reason },
    });

    await this.notifySalesResult(item, actor.name, false, reason);
    return updated;
  }

  /** รายการที่รออนุมัติพิเศษ (สำหรับหัวหน้า/เว็บ) */
  listPendingApprovals() {
    return this.prisma.returnItem.findMany({
      where: { approvalStatus: ApprovalStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: { returnDocument: true, product: true, productModel: true },
    });
  }

  /** รายการใบ GD (เบื้องต้น — หน้าเว็บเต็มในขั้นที่ 9) */
  listDocuments() {
    return this.prisma.returnDocument.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        createdBy: { select: { name: true, employeeCode: true } },
        items: { include: { product: true, productModel: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  /** สร้าง Actor จาก LINE userId (สำหรับ postback อนุมัติ/ปฏิเสธ) */
  async actorFromLineUserId(lineUserId: string): Promise<Actor | null> {
    const user = await this.prisma.user.findUnique({ where: { lineUserId } });
    if (!user || !user.isActive) return null;
    const access = await this.rbac.resolveAccess(user.id);
    return {
      id: user.id,
      name: user.name,
      permissions: access.permissions,
      isSystemAdmin: access.isSystemAdmin,
    };
  }

  private async loadPendingItem(actor: Actor, itemId: string) {
    if (!actor.isSystemAdmin && !actor.permissions.includes(P.APPROVE_SPECIAL)) {
      throw new ForbiddenException('ไม่มีสิทธิ์อนุมัติส่วนลดพิเศษ');
    }
    const item = await this.prisma.returnItem.findUnique({
      where: { id: itemId },
      include: { returnDocument: true, product: true, productModel: true },
    });
    if (!item) throw new NotFoundException('ไม่พบรายการ');
    if (item.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException('รายการนี้ไม่ได้อยู่ในสถานะรออนุมัติ');
    }
    return item;
  }

  private async resolveCustomerName(code: string, provided?: string): Promise<string | null> {
    if (provided && provided.trim()) return provided.trim();
    const customer = await this.prisma.customer.findUnique({ where: { code } });
    return customer?.name ?? null;
  }

  /** แจ้งคลัง (ผู้มีสิทธิ์ receive) ว่ามีใบ GD รอรับ */
  private async notifyWarehousePending(gdNumber: string, productName: string) {
    const users = await this.rbac.findUsersWithPermission(P.RECEIVE);
    await Promise.all(
      users.map((u) =>
        this.notifications.notify({
          userId: u.id,
          channel: NotificationChannel.LINE,
          title: '📦 มีสินค้าเทิร์นรอรับเข้า',
          body: `ใบ GD ${gdNumber} — ${productName}`,
        }),
      ),
    );
  }

  /** แจ้งหัวหน้า (ผู้มีสิทธิ์ approve_special) ด้วย Flex card อนุมัติ/ปฏิเสธ */
  private async notifyApprovers(
    s: Parameters<typeof buildApprovalRequestFlex>[0],
  ) {
    const approvers = await this.rbac.findUsersWithPermission(P.APPROVE_SPECIAL);
    const flex = buildApprovalRequestFlex(s);
    await Promise.all(
      approvers.map(async (u) => {
        // เก็บ web notification ไว้เป็นหลักฐาน
        await this.notifications.notify({
          userId: u.id,
          channel: NotificationChannel.WEB,
          title: '🔔 ขออนุมัติส่วนลดพิเศษ',
          body: `ใบ GD ${s.gdNumber} — ${s.productName} (แจ้งโดย ${s.salesName})`,
        });
        if (u.lineUserId) {
          await this.line
            .pushFlex(u.lineUserId, 'ขออนุมัติส่วนลดพิเศษ', flex)
            .catch((e) => this.logger.warn(`push approver failed: ${String(e)}`));
        }
      }),
    );
  }

  /** แจ้งผลกลับฝ่ายขายผู้สร้างใบ */
  private async notifySalesResult(
    item: { returnDocument: { gdNumber: string; createdById: string }; product: { name: string } },
    approverName: string,
    approved: boolean,
    reason?: string,
  ) {
    const salesId = item.returnDocument.createdById;
    const title = approved ? '✅ อนุมัติส่วนลดพิเศษแล้ว' : '🚫 ไม่อนุมัติส่วนลดพิเศษ';
    const body = approved
      ? `ใบ GD ${item.returnDocument.gdNumber} — ${item.product.name}`
      : `ใบ GD ${item.returnDocument.gdNumber} — ${item.product.name}\nเหตุผล: ${reason ?? '-'}`;

    await this.notifications.notify({
      userId: salesId,
      channel: NotificationChannel.WEB,
      title,
      body,
    });

    const sales = await this.prisma.user.findUnique({ where: { id: salesId } });
    if (sales?.lineUserId) {
      const flex = buildApprovalResultFlex({
        approved,
        gdNumber: item.returnDocument.gdNumber,
        productName: item.product.name,
        approverName,
        reason,
      });
      await this.line
        .pushFlex(sales.lineUserId, title, flex)
        .catch((e) => this.logger.warn(`push sales result failed: ${String(e)}`));
    }
  }
}
