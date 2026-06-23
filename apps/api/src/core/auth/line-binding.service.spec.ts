import { ConflictException, NotFoundException } from '@nestjs/common';
import { LineBindingService } from './line-binding.service';

describe('LineBindingService.bind', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  it('ผูก lineUserId สำเร็จเมื่อพบรหัสพนักงานและยังไม่ถูกใช้', async () => {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          // ครั้งแรก: หาโดย employeeCode
          .mockResolvedValueOnce({ id: 'u1', employeeCode: 'E001', name: 'น.ส.', isActive: true, lineUserId: null })
          // ครั้งสอง: หาโดย lineUserId (ยังไม่มีใครใช้)
          .mockResolvedValueOnce(null),
        update: jest.fn().mockResolvedValue({ id: 'u1', employeeCode: 'E001', name: 'น.ส.' }),
      },
    };
    const service = new LineBindingService(prisma as never, audit as never);
    const result = await service.bind({ employeeCode: 'E001', lineUserId: 'U999' });
    expect(result.id).toBe('u1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { lineUserId: 'U999' },
    });
    expect(audit.log).toHaveBeenCalled();
  });

  it('โยน NotFound เมื่อไม่พบรหัสพนักงาน', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new LineBindingService(prisma as never, audit as never);
    await expect(
      service.bind({ employeeCode: 'X', lineUserId: 'U1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('โยน Conflict เมื่อบัญชี LINE ถูกผูกกับคนอื่น', async () => {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'u1', employeeCode: 'E001', name: 'a', isActive: true, lineUserId: null })
          .mockResolvedValueOnce({ id: 'u2', employeeCode: 'E002', name: 'b', isActive: true, lineUserId: 'U999' }),
      },
    };
    const service = new LineBindingService(prisma as never, audit as never);
    await expect(
      service.bind({ employeeCode: 'E001', lineUserId: 'U999' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
