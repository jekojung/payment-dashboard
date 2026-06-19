import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, DiscountStatus, Permissions, ReceiptStatus } from '@tpg/shared';
import { ReturnsDiscountService } from './returns-discount.service';

const P = Permissions.RETURNS_DISCOUNT;

/** สร้าง service พร้อม mock dependencies */
function makeService() {
  const prisma = {
    product: { findUnique: jest.fn() },
    productModel: { findUnique: jest.fn() },
    discountStandard: { findFirst: jest.fn() },
    returnDocument: { findUnique: jest.fn(), create: jest.fn() },
    returnItem: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    customer: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const rbac = {
    findUsersWithPermission: jest.fn().mockResolvedValue([]),
    resolveAccess: jest.fn(),
  };
  const line = { pushFlex: jest.fn().mockResolvedValue(undefined) };

  const service = new ReturnsDiscountService(
    prisma as never,
    audit as never,
    notifications as never,
    rbac as never,
    line as never,
  );
  return { service, prisma, audit, notifications, rbac, line };
}

const salesActor = {
  id: 'u-sales',
  name: 'อนันต์ พนักงานขาย',
  permissions: [P.CREATE],
  isSystemAdmin: false,
};
const leadActor = {
  id: 'u-lead',
  name: 'สมหญิง หัวหน้าขาย',
  permissions: [P.APPROVE_SPECIAL],
  isSystemAdmin: false,
};

describe('ReturnsDiscountService.classifyDiscount', () => {
  const { service } = makeService();

  it('ส่วนลด ≤ มาตรฐาน → within_standard', () => {
    expect(service.classifyDiscount(10, 10).status).toBe(DiscountStatus.WITHIN_STANDARD);
    expect(service.classifyDiscount(5, 10).status).toBe(DiscountStatus.WITHIN_STANDARD);
  });

  it('ส่วนลด > มาตรฐาน → over_standard', () => {
    expect(service.classifyDiscount(15, 10).status).toBe(DiscountStatus.OVER_STANDARD);
  });

  it('ไม่มีมาตรฐาน (null) → snapshot 0, ส่วนลด>0 ถือว่าเกิน', () => {
    const r = service.classifyDiscount(5, null);
    expect(r.standardSnapshot).toBe(0);
    expect(r.status).toBe(DiscountStatus.OVER_STANDARD);
  });

  it('ไม่มีมาตรฐาน และส่วนลด 0 → within', () => {
    expect(service.classifyDiscount(0, null).status).toBe(DiscountStatus.WITHIN_STANDARD);
  });
});

describe('ReturnsDiscountService.createDiscountReport', () => {
  it('อยู่ในเกณฑ์ → not_required + แจ้งคลัง', async () => {
    const { service, prisma, rbac, notifications } = makeService();
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'แบตเตอรี่', hasModels: false });
    prisma.discountStandard.findFirst.mockResolvedValue({ standardDiscount: 10 });
    prisma.returnDocument.findUnique.mockResolvedValue(null);
    prisma.returnDocument.create.mockResolvedValue({
      id: 'doc1',
      gdNumber: 'GD-001',
      customerName: 'ลูกค้า A',
      customerCode: 'C001',
    });
    prisma.returnItem.create.mockImplementation((args: { data: Record<string, unknown> }) => ({ id: 'item1', ...args.data }));

    const res = await service.createDiscountReport(salesActor, {
      customerCode: 'C001',
      customerName: 'ลูกค้า A',
      gdNumber: 'GD-001',
      productId: 'p1',
      declaredQuantity: 4,
      discountPerUnit: 8,
    });

    expect(res.discountStatus).toBe(DiscountStatus.WITHIN_STANDARD);
    const created = prisma.returnItem.create.mock.calls[0][0].data;
    expect(created.approvalStatus).toBe(ApprovalStatus.NOT_REQUIRED);
    expect(created.receiptStatus).toBe(ReceiptStatus.PENDING_RECEIPT);
    expect(created.totalDiscount).toBe(32); // 8 × 4
    expect(created.standardDiscountSnapshot).toBe(10);
    // แจ้งคลัง (RECEIVE)
    expect(rbac.findUsersWithPermission).toHaveBeenCalledWith(P.RECEIVE);
    expect(notifications.notify).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('อนุมัติ') }),
    );
  });

  it('เกินมาตรฐาน → pending + แจ้งผู้อนุมัติ (push Flex)', async () => {
    const { service, prisma, rbac, line } = makeService();
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'แบตเตอรี่', hasModels: false });
    prisma.discountStandard.findFirst.mockResolvedValue({ standardDiscount: 10 });
    prisma.returnDocument.findUnique.mockResolvedValue(null);
    prisma.returnDocument.create.mockResolvedValue({
      id: 'doc1',
      gdNumber: 'GD-002',
      customerName: 'ลูกค้า B',
      customerCode: 'C002',
    });
    prisma.returnItem.create.mockImplementation((args: { data: Record<string, unknown> }) => ({ id: 'item2', ...args.data }));
    rbac.findUsersWithPermission.mockResolvedValue([
      { id: 'u-lead', name: 'หัวหน้า', lineUserId: 'Ulead' },
    ]);

    const res = await service.createDiscountReport(salesActor, {
      customerCode: 'C002',
      gdNumber: 'GD-002',
      productId: 'p1',
      declaredQuantity: 2,
      discountPerUnit: 25,
    });

    expect(res.discountStatus).toBe(DiscountStatus.OVER_STANDARD);
    const created = prisma.returnItem.create.mock.calls[0][0].data;
    expect(created.approvalStatus).toBe(ApprovalStatus.PENDING);
    expect(rbac.findUsersWithPermission).toHaveBeenCalledWith(P.APPROVE_SPECIAL);
    expect(line.pushFlex).toHaveBeenCalledWith('Ulead', expect.any(String), expect.any(Object));
  });

  it('สินค้ามีรุ่นแต่ไม่ระบุรุ่น → BadRequest', async () => {
    const { service, prisma } = makeService();
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'แบตเตอรี่', hasModels: true });

    await expect(
      service.createDiscountReport(salesActor, {
        customerCode: 'C001',
        gdNumber: 'GD-003',
        productId: 'p1',
        declaredQuantity: 1,
        discountPerUnit: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ใบ GD เดิมมีอยู่แล้ว → เพิ่ม item โดยไม่สร้างใบใหม่', async () => {
    const { service, prisma } = makeService();
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'แบตเตอรี่', hasModels: false });
    prisma.discountStandard.findFirst.mockResolvedValue({ standardDiscount: 10 });
    prisma.returnDocument.findUnique.mockResolvedValue({
      id: 'docX',
      gdNumber: 'GD-001',
      customerName: 'ลูกค้า A',
      customerCode: 'C001',
    });
    prisma.returnItem.create.mockImplementation((args: { data: Record<string, unknown> }) => ({ id: 'item9', ...args.data }));

    await service.createDiscountReport(salesActor, {
      customerCode: 'C001',
      gdNumber: 'GD-001',
      productId: 'p1',
      declaredQuantity: 1,
      discountPerUnit: 5,
    });

    expect(prisma.returnDocument.create).not.toHaveBeenCalled();
    expect(prisma.returnItem.create.mock.calls[0][0].data.returnDocumentId).toBe('docX');
  });
});

describe('ReturnsDiscountService approve/reject', () => {
  const pendingItem = {
    id: 'item2',
    approvalStatus: ApprovalStatus.PENDING,
    returnDocument: { gdNumber: 'GD-002', createdById: 'u-sales' },
    product: { name: 'แบตเตอรี่' },
    productModel: null,
  };

  it('อนุมัติ: pending → approved + แจ้งฝ่ายขาย/คลัง', async () => {
    const { service, prisma, rbac, notifications } = makeService();
    prisma.returnItem.findUnique.mockResolvedValue(pendingItem);
    prisma.returnItem.update.mockImplementation((args: { data: Record<string, unknown> }) => ({ id: 'item2', ...args.data }));
    prisma.user.findUnique.mockResolvedValue({ id: 'u-sales', lineUserId: null });

    const res = await service.approveItem(leadActor, 'item2');

    expect(res.approvalStatus).toBe(ApprovalStatus.APPROVED);
    expect(res.approvedById).toBe('u-lead');
    expect(rbac.findUsersWithPermission).toHaveBeenCalledWith(P.RECEIVE); // แจ้งคลัง
    expect(notifications.notify).toHaveBeenCalled();
  });

  it('ปฏิเสธ: pending → rejected + เก็บเหตุผล', async () => {
    const { service, prisma } = makeService();
    prisma.returnItem.findUnique.mockResolvedValue(pendingItem);
    prisma.returnItem.update.mockImplementation((args: { data: Record<string, unknown> }) => ({ id: 'item2', ...args.data }));
    prisma.user.findUnique.mockResolvedValue({ id: 'u-sales', lineUserId: null });

    const res = await service.rejectItem(leadActor, 'item2', 'ส่วนลดสูงเกินไป');

    expect(res.approvalStatus).toBe(ApprovalStatus.REJECTED);
    expect(res.rejectReason).toBe('ส่วนลดสูงเกินไป');
  });

  it('อนุมัติรายการที่ไม่ pending → BadRequest', async () => {
    const { service, prisma } = makeService();
    prisma.returnItem.findUnique.mockResolvedValue({
      ...pendingItem,
      approvalStatus: ApprovalStatus.APPROVED,
    });
    await expect(service.approveItem(leadActor, 'item2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ผู้ไม่มีสิทธิ์ approve_special → Forbidden', async () => {
    const { service } = makeService();
    await expect(service.approveItem(salesActor, 'item2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
