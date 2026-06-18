import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  const makeService = (user: unknown) => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    const jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    const rbac = {
      resolveAccess: jest
        .fn()
        .mockResolvedValue({ roles: ['executive'], permissions: ['returns_discount:view'], isSystemAdmin: false }),
    };
    return {
      service: new AuthService(prisma as never, jwt as never, rbac as never),
      prisma,
      jwt,
    };
  };

  it('คืน token เมื่อรหัสผ่านถูกต้อง', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    const { service, jwt } = makeService({
      id: 'u1',
      employeeCode: 'E001',
      name: 'ผู้บริหาร',
      department: 'mgmt',
      isActive: true,
      passwordHash,
    });

    const result = await service.login({ employeeCode: 'E001', password: 'secret123' });
    expect(result.accessToken).toBe('signed-token');
    expect(result.user.permissions).toContain('returns_discount:view');
    expect(jwt.signAsync).toHaveBeenCalled();
  });

  it('โยน Unauthorized เมื่อรหัสผ่านผิด', async () => {
    const passwordHash = await bcrypt.hash('correct', 10);
    const { service } = makeService({
      id: 'u1',
      employeeCode: 'E001',
      name: 'x',
      isActive: true,
      passwordHash,
    });
    await expect(service.login({ employeeCode: 'E001', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('โยน Unauthorized เมื่อไม่พบผู้ใช้', async () => {
    const { service } = makeService(null);
    await expect(
      service.login({ employeeCode: 'X', password: 'y' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('โยน Unauthorized เมื่อบัญชีไม่มีรหัสผ่าน (LINE-only)', async () => {
    const { service } = makeService({
      id: 'u2',
      employeeCode: 'E002',
      name: 'staff',
      isActive: true,
      passwordHash: null,
    });
    await expect(
      service.login({ employeeCode: 'E002', password: 'any' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
