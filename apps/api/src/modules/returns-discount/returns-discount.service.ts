import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ApprovalStatus,
  CounterpartyKind,
  CounterpartyType,
  DiscountStatus,
  NotificationChannel,
  Permissions,
  ReceiptStatus,
  ReturnDocumentStatus,
  SaleValueStatus,
  StockMovementType,
  type CreateDisposalInput,
  type CreateReturnDiscountInput,
} from '@tpg/shared';
import type { AuthUser } from '../../common/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AttachmentsService } from '../../core/attachments/attachments.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { RbacService } from '../../core/rbac/rbac.service';
import { LineService } from '../../core/line/line.service';
import {
  buildApprovalRequestFlex,
  buildApprovalResultFlex,
  buildDisposalSuccessFlex,
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
    private readonly attachments: AttachmentsService,
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

  /** รายการใบ GD (filter: สถานะ, ลูกค้า, พนักงานขาย, ค้นเลข GD) */
  listDocuments(filter?: {
    status?: string;
    customerCode?: string;
    createdById?: string;
    search?: string;
  }) {
    return this.prisma.returnDocument.findMany({
      where: {
        ...(filter?.status ? { status: filter.status as ReturnDocumentStatus } : {}),
        ...(filter?.customerCode ? { customerCode: filter.customerCode } : {}),
        ...(filter?.createdById ? { createdById: filter.createdById } : {}),
        ...(filter?.search
          ? { gdNumber: { contains: filter.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        createdBy: { select: { name: true, employeeCode: true } },
        items: { include: { product: true, productModel: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Flow B — คลังตรวจรับสินค้าเทิร์น
  // ---------------------------------------------------------------------------

  /** ยอดคงเหลือสต็อกรับเทิร์น = SUM(quantity_change) ต่อ (สินค้า/รุ่น) */
  async getBalance(productId: string, productModelId: string | null): Promise<number> {
    const agg = await this.prisma.returnStockMovement.aggregate({
      where: { productId, productModelId: productModelId ?? null },
      _sum: { quantityChange: true },
    });
    return agg._sum.quantityChange ?? 0;
  }

  /** ใบ GD ที่มีรายการพร้อมรับ (pending_receipt + อนุมัติแล้ว/ไม่ต้องอนุมัติ) */
  listReceivable() {
    const readyFilter = {
      receiptStatus: ReceiptStatus.PENDING_RECEIPT,
      approvalStatus: { in: [ApprovalStatus.NOT_REQUIRED, ApprovalStatus.APPROVED] },
    };
    return this.prisma.returnDocument.findMany({
      where: { items: { some: readyFilter } },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { name: true, employeeCode: true } },
        items: {
          where: readyFilter,
          include: { product: true, productModel: true },
        },
      },
    });
  }

  /**
   * คลังบันทึกรับสินค้า: ตรวจรูป → อัปโหลด → update item + สร้าง stock movement receipt
   * ถ้า received ≠ declared → ตั้งธง qty_mismatch
   */
  async receiveItem(
    actor: Actor,
    itemId: string,
    receivedQuantity: number,
    photo?: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    if (!actor.isSystemAdmin && !actor.permissions.includes(P.RECEIVE)) {
      throw new ForbiddenException('ไม่มีสิทธิ์รับสินค้าเทิร์น');
    }

    const item = await this.prisma.returnItem.findUnique({
      where: { id: itemId },
      include: { returnDocument: true, product: true, productModel: true },
    });
    if (!item) throw new NotFoundException('ไม่พบรายการ');
    if (item.receiptStatus === ReceiptStatus.RECEIVED) {
      throw new BadRequestException('รายการนี้รับเข้าแล้ว');
    }
    if (
      item.approvalStatus !== ApprovalStatus.NOT_REQUIRED &&
      item.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      throw new BadRequestException('รายการนี้ยังไม่พร้อมรับ (รออนุมัติหรือถูกปฏิเสธ)');
    }
    if (!photo) throw new BadRequestException('กรุณาแนบรูปสินค้าที่รับ');

    const qtyMismatch = receivedQuantity !== item.declaredQuantity;

    // อัปโหลดรูปขึ้น storage (Google Drive / local) + ผูก attachment
    const attachment = await this.attachments.createForOwner({
      ownerType: 'return_item',
      ownerId: item.id,
      file: { buffer: photo.buffer, filename: photo.originalname, mime: photo.mimetype },
      uploadedById: actor.id,
    });

    const { updated, movement, docStatus } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.returnItem.update({
        where: { id: item.id },
        data: {
          receivedQuantity,
          receiptStatus: ReceiptStatus.RECEIVED,
          receivedById: actor.id,
          receivedAt: new Date(),
          qtyMismatch,
        },
      });
      const movement = await tx.returnStockMovement.create({
        data: {
          productId: item.productId,
          productModelId: item.productModelId,
          quantityChange: receivedQuantity,
          movementType: StockMovementType.RECEIPT,
          referenceType: 'return_item',
          referenceId: item.id,
          createdById: actor.id,
        },
      });
      const docStatus = await this.recomputeDocumentStatus(tx, item.returnDocumentId);
      return { updated, movement, docStatus };
    });

    await this.audit.log({
      userId: actor.id,
      moduleKey: MODULE_KEY,
      action: 'stock.receipt',
      entity: 'return_item',
      entityId: item.id,
      payload: {
        gdNumber: item.returnDocument.gdNumber,
        declaredQuantity: item.declaredQuantity,
        receivedQuantity,
        qtyMismatch,
        movementId: movement.id,
      },
    });

    await this.notifyReceipt(item, receivedQuantity, qtyMismatch);

    const balance = await this.getBalance(item.productId, item.productModelId);
    return {
      item: updated,
      movement,
      qtyMismatch,
      documentStatus: docStatus,
      balance,
      attachment: { id: attachment.id, driveLink: attachment.driveLink },
    };
  }

  /** คำนวณสถานะใบ GD ใหม่จากรายการ (item ที่ rejected ไม่นับ) */
  private async recomputeDocumentStatus(
    tx: Prisma.TransactionClient,
    documentId: string,
  ): Promise<ReturnDocumentStatus> {
    const items = await tx.returnItem.findMany({ where: { returnDocumentId: documentId } });
    const relevant = items.filter((i) => i.approvalStatus !== ApprovalStatus.REJECTED);
    const receivedCount = relevant.filter(
      (i) => i.receiptStatus === ReceiptStatus.RECEIVED,
    ).length;

    let status: ReturnDocumentStatus;
    if (relevant.length === 0 || receivedCount === 0) {
      status = ReturnDocumentStatus.RECORDED;
    } else if (receivedCount === relevant.length) {
      status = ReturnDocumentStatus.FULLY_RECEIVED;
    } else {
      status = ReturnDocumentStatus.PARTIALLY_RECEIVED;
    }

    await tx.returnDocument.update({ where: { id: documentId }, data: { status } });
    return status;
  }

  /** แจ้งฝ่ายขายผู้สร้างใบว่ารับสินค้าแล้ว (+ เตือน mismatch) */
  private async notifyReceipt(
    item: {
      returnDocument: { gdNumber: string; createdById: string };
      product: { name: string };
      declaredQuantity: number;
    },
    receivedQuantity: number,
    qtyMismatch: boolean,
  ) {
    const title = qtyMismatch ? '⚠️ รับสินค้าแล้ว (จำนวนไม่ตรง)' : '📥 รับสินค้าเทิร์นแล้ว';
    const body = qtyMismatch
      ? `ใบ GD ${item.returnDocument.gdNumber} — ${item.product.name}\nแจ้ง ${item.declaredQuantity} / รับจริง ${receivedQuantity}`
      : `ใบ GD ${item.returnDocument.gdNumber} — ${item.product.name}\nรับจริง ${receivedQuantity}`;

    await this.notifications.notify({
      userId: item.returnDocument.createdById,
      channel: NotificationChannel.WEB,
      title,
      body,
    });
  }

  // ---------------------------------------------------------------------------
  // Flow C — ตัดจำหน่ายสินค้ารับเทิร์น
  // ---------------------------------------------------------------------------

  async createDisposal(actor: Actor, input: CreateDisposalInput) {
    if (!actor.isSystemAdmin && !actor.permissions.includes(P.DISPOSAL)) {
      throw new ForbiddenException('ไม่มีสิทธิ์ตัดจำหน่ายสินค้า');
    }

    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new NotFoundException('ไม่พบสินค้าที่เลือก');

    const modelId = input.productModelId ?? null;
    let model = null;
    if (modelId) {
      model = await this.prisma.productModel.findUnique({ where: { id: modelId } });
      if (!model || model.productId !== product.id) {
        throw new BadRequestException('รุ่นสินค้าไม่ถูกต้อง');
      }
    } else if (product.hasModels) {
      throw new BadRequestException('สินค้านี้ต้องระบุรุ่น');
    }

    const reason = await this.prisma.disposalReason.findUnique({
      where: { id: input.disposalReasonId },
    });
    if (!reason || !reason.isActive) {
      throw new BadRequestException('เหตุผลตัดจำหน่ายไม่ถูกต้อง');
    }

    // validate จำนวนที่ตัด ≤ คงเหลือ
    const balanceBefore = await this.getBalance(product.id, modelId);
    if (input.quantity > balanceBefore) {
      throw new BadRequestException(
        `จำนวนที่ตัด (${input.quantity}) เกินคงเหลือ (${balanceBefore})`,
      );
    }

    const cp = await this.resolveCounterparty(reason.counterpartyKind, input);

    const movement = await this.prisma.returnStockMovement.create({
      data: {
        productId: product.id,
        productModelId: modelId,
        quantityChange: -input.quantity,
        movementType: StockMovementType.DISPOSAL,
        disposalReasonId: reason.id,
        counterpartyType: cp.counterpartyType,
        counterpartyId: cp.counterpartyId,
        counterpartyName: cp.counterpartyName,
        saleValueStatus: SaleValueStatus.PENDING, // ผู้บริหารบันทึกมูลค่าขายภายหลัง
        createdById: actor.id,
      },
    });

    await this.audit.log({
      userId: actor.id,
      moduleKey: MODULE_KEY,
      action: 'stock.disposal',
      entity: 'return_stock_movement',
      entityId: movement.id,
      payload: {
        productId: product.id,
        productModelId: modelId,
        quantity: input.quantity,
        reason: reason.name,
        counterpartyType: cp.counterpartyType,
        counterpartyName: cp.counterpartyName,
      },
    });

    await this.notifyDisposalPendingSaleValue(reason.name, product.name, input.quantity);

    const balanceAfter = balanceBefore - input.quantity;
    return {
      movement,
      balanceBefore,
      balanceAfter,
      flex: buildDisposalSuccessFlex({
        productName: product.name,
        modelName: model?.name ?? null,
        quantity: input.quantity,
        reasonName: reason.name,
        counterpartyName: cp.counterpartyName,
        balanceAfter,
      }),
    };
  }

  /** กำหนดคู่ค้าปลายทางตามชนิดของเหตุผล (supplier/buyer/none) */
  private async resolveCounterparty(kind: string, input: CreateDisposalInput) {
    if (kind === CounterpartyKind.NONE) {
      return { counterpartyType: null, counterpartyId: null, counterpartyName: null };
    }
    const type =
      kind === CounterpartyKind.SUPPLIER ? CounterpartyType.SUPPLIER : CounterpartyType.BUYER;

    let id = input.counterpartyId ?? null;
    let name = input.counterpartyName?.trim() || null;

    if (id) {
      if (type === CounterpartyType.SUPPLIER) {
        const s = await this.prisma.supplier.findUnique({ where: { id } });
        if (!s) throw new BadRequestException('ไม่พบผู้ขายเดิมที่เลือก');
        name = s.name;
      } else {
        const b = await this.prisma.buyer.findUnique({ where: { id } });
        if (!b) throw new BadRequestException('ไม่พบผู้รับซื้อที่เลือก');
        name = b.name;
      }
    }
    if (!id && !name) {
      throw new BadRequestException('กรุณาระบุคู่ค้าปลายทาง');
    }
    return { counterpartyType: type, counterpartyId: id, counterpartyName: name };
  }

  private async notifyDisposalPendingSaleValue(
    reasonName: string,
    productName: string,
    quantity: number,
  ) {
    const execs = await this.rbac.findUsersWithPermission(P.SET_SALE_VALUE);
    await Promise.all(
      execs.map((u) =>
        this.notifications.notify({
          userId: u.id,
          channel: NotificationChannel.WEB,
          title: '💰 รายการตัดจำหน่ายรอบันทึกมูลค่าขาย',
          body: `${productName} จำนวน ${quantity} (${reasonName})`,
        }),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Flow D — ตรวจสอบสต็อกสินค้ารับเทิร์น
  // ---------------------------------------------------------------------------

  /** ยอดคงเหลือต่อ (สินค้า/รุ่น) จากผลรวม movements */
  async listStockBalances(onlyInStock = true) {
    const groups = await this.prisma.returnStockMovement.groupBy({
      by: ['productId', 'productModelId'],
      _sum: { quantityChange: true },
    });

    const rows = await Promise.all(
      groups.map(async (g) => {
        const balance = g._sum.quantityChange ?? 0;
        const product = await this.prisma.product.findUnique({ where: { id: g.productId } });
        const model = g.productModelId
          ? await this.prisma.productModel.findUnique({ where: { id: g.productModelId } })
          : null;
        return {
          productId: g.productId,
          productName: product?.name ?? g.productId,
          productModelId: g.productModelId,
          modelName: model?.name ?? null,
          balance,
        };
      }),
    );

    return rows
      .filter((r) => (onlyInStock ? r.balance > 0 : true))
      .sort((a, b) => a.productName.localeCompare(b.productName, 'th'));
  }

  /** ประวัติการเคลื่อนไหว (ledger) ของ (สินค้า/รุ่น) */
  getLedger(productId: string, productModelId: string | null) {
    return this.prisma.returnStockMovement.findMany({
      where: { productId, productModelId: productModelId ?? null },
      orderBy: { createdAt: 'desc' },
      include: {
        disposalReason: true,
        createdBy: { select: { name: true, employeeCode: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Dashboard (เว็บ) — KPI / กราฟ / รายการตัดจำหน่าย / มูลค่าขาย
  // ---------------------------------------------------------------------------

  /** รายการตัดจำหน่าย (filter เหตุผล/สถานะมูลค่าขาย) */
  listDisposals(filter?: { reasonId?: string; saleValueStatus?: string }) {
    return this.prisma.returnStockMovement.findMany({
      where: {
        movementType: StockMovementType.DISPOSAL,
        ...(filter?.reasonId ? { disposalReasonId: filter.reasonId } : {}),
        ...(filter?.saleValueStatus
          ? { saleValueStatus: filter.saleValueStatus as SaleValueStatus }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        productModel: true,
        disposalReason: true,
        createdBy: { select: { name: true } },
        saleValueBy: { select: { name: true } },
      },
    });
  }

  /** ผู้บริหารบันทึกมูลค่าขาย (pending → recorded) */
  async setSaleValue(actor: Actor, movementId: string, saleValue: number) {
    if (!actor.isSystemAdmin && !actor.permissions.includes(P.SET_SALE_VALUE)) {
      throw new ForbiddenException('ไม่มีสิทธิ์บันทึกมูลค่าขาย');
    }
    const mv = await this.prisma.returnStockMovement.findUnique({ where: { id: movementId } });
    if (!mv || mv.movementType !== StockMovementType.DISPOSAL) {
      throw new NotFoundException('ไม่พบรายการตัดจำหน่าย');
    }
    const updated = await this.prisma.returnStockMovement.update({
      where: { id: movementId },
      data: {
        saleValue,
        saleValueStatus: SaleValueStatus.RECORDED,
        saleValueById: actor.id,
        saleValueAt: new Date(),
      },
    });
    await this.audit.log({
      userId: actor.id,
      moduleKey: MODULE_KEY,
      action: 'stock.disposal.set_sale_value',
      entity: 'return_stock_movement',
      entityId: movementId,
      payload: { saleValue },
    });
    return updated;
  }

  /** รายละเอียดใบ GD (items + เทียบมาตรฐาน + รูปแนบ) */
  async getDocument(id: string) {
    const doc = await this.prisma.returnDocument.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, employeeCode: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: true,
            productModel: true,
            approvedBy: { select: { name: true } },
            receivedBy: { select: { name: true } },
          },
        },
      },
    });
    if (!doc) throw new NotFoundException('ไม่พบใบ GD');

    // แนบรูปของแต่ละ item
    const itemIds = doc.items.map((i) => i.id);
    const attachments = itemIds.length
      ? await this.prisma.attachment.findMany({
          where: { ownerType: 'return_item', ownerId: { in: itemIds } },
        })
      : [];
    const byItem = new Map<string, typeof attachments>();
    for (const a of attachments) {
      const list = byItem.get(a.ownerId) ?? [];
      list.push(a);
      byItem.set(a.ownerId, list);
    }
    return {
      ...doc,
      items: doc.items.map((i) => ({ ...i, attachments: byItem.get(i.id) ?? [] })),
    };
  }

  /** KPI + กราฟ สำหรับหน้า dashboard โมดูล 1 */
  async getDashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [items, movements, disposalReasons] = await Promise.all([
      this.prisma.returnItem.findMany({
        include: {
          product: true,
          productModel: true,
          returnDocument: { include: { createdBy: { select: { name: true } } } },
        },
      }),
      this.prisma.returnStockMovement.findMany({ include: { disposalReason: true } }),
      this.prisma.disposalReason.findMany(),
    ]);

    const notRejected = items.filter((i) => i.approvalStatus !== ApprovalStatus.REJECTED);
    const num = (d: Prisma.Decimal | number) => Number(d);

    // ----- KPI -----
    const totalDiscountThisMonth = notRejected
      .filter((i) => i.createdAt >= monthStart)
      .reduce((s, i) => s + num(i.totalDiscount), 0);

    const gdPendingReceiptDocs = new Set(
      notRejected
        .filter(
          (i) =>
            i.receiptStatus === ReceiptStatus.PENDING_RECEIPT &&
            (i.approvalStatus === ApprovalStatus.NOT_REQUIRED ||
              i.approvalStatus === ApprovalStatus.APPROVED),
        )
        .map((i) => i.returnDocumentId),
    );

    const pendingApprovals = items.filter(
      (i) => i.approvalStatus === ApprovalStatus.PENDING,
    ).length;
    const mismatchCount = items.filter((i) => i.qtyMismatch).length;

    const disposals = movements.filter((m) => m.movementType === StockMovementType.DISPOSAL);
    const totalStockBalance = movements.reduce((s, m) => s + m.quantityChange, 0);
    const disposalPendingSaleValue = disposals.filter(
      (m) => m.saleValueStatus === SaleValueStatus.PENDING,
    ).length;
    const totalSaleValueRecorded = disposals
      .filter((m) => m.saleValueStatus === SaleValueStatus.RECORDED)
      .reduce((s, m) => s + num(m.saleValue ?? 0), 0);

    // ----- กราฟ -----
    const sumBy = <T>(arr: T[], key: (t: T) => string, val: (t: T) => number) => {
      const map = new Map<string, number>();
      for (const t of arr) map.set(key(t), (map.get(key(t)) ?? 0) + val(t));
      return [...map.entries()].map(([name, value]) => ({ name, value }));
    };

    const discountByProduct = sumBy(
      notRejected,
      (i) => (i.productModel ? `${i.product.name} (${i.productModel.name})` : i.product.name),
      (i) => num(i.totalDiscount),
    );
    const discountBySales = sumBy(
      notRejected,
      (i) => i.returnDocument.createdBy.name,
      (i) => num(i.totalDiscount),
    );

    // แนวโน้มส่วนลด 30 วันล่าสุด
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const trendMap = new Map<string, number>();
    for (let k = 29; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k);
      trendMap.set(dayKey(d), 0);
    }
    for (const i of notRejected) {
      const key = dayKey(i.createdAt);
      if (trendMap.has(key)) trendMap.set(key, trendMap.get(key)! + num(i.totalDiscount));
    }
    const discountTrend = [...trendMap.entries()].map(([name, value]) => ({ name, value }));

    // ตัดจำหน่ายแยกเหตุผล (จำนวน + มูลค่าขายที่บันทึกแล้ว)
    const reasonName = new Map(disposalReasons.map((r) => [r.id, r.name]));
    const disposalByReasonMap = new Map<string, { quantity: number; saleValue: number }>();
    for (const m of disposals) {
      const name = m.disposalReasonId
        ? reasonName.get(m.disposalReasonId) ?? 'อื่นๆ'
        : 'อื่นๆ';
      const cur = disposalByReasonMap.get(name) ?? { quantity: 0, saleValue: 0 };
      cur.quantity += Math.abs(m.quantityChange);
      cur.saleValue += num(m.saleValue ?? 0);
      disposalByReasonMap.set(name, cur);
    }
    const disposalByReason = [...disposalByReasonMap.entries()].map(([name, v]) => ({
      name,
      quantity: v.quantity,
      saleValue: v.saleValue,
    }));

    return {
      kpis: {
        totalDiscountThisMonth,
        gdPendingReceipt: gdPendingReceiptDocs.size,
        pendingApprovals,
        mismatchCount,
        totalStockBalance,
        disposalPendingSaleValue,
        totalSaleValueRecorded,
        disposalThisMonthQuantity: disposals
          .filter((m) => m.createdAt >= monthStart)
          .reduce((s, m) => s + Math.abs(m.quantityChange), 0),
      },
      charts: { discountByProduct, discountBySales, discountTrend, disposalByReason },
    };
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
