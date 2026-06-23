import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginInput } from '@tpg/shared';
import * as bcrypt from 'bcryptjs';
import type { JwtPayload } from '../../common/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rbac: RbacService,
  ) {}

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { employeeCode: input.employeeCode },
    });

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง');
    }

    const payload: JwtPayload = {
      sub: user.id,
      employeeCode: user.employeeCode,
      name: user.name,
    };
    const access = await this.rbac.resolveAccess(user.id);

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        name: user.name,
        department: user.department,
        roles: access.roles,
        permissions: access.permissions,
        isSystemAdmin: access.isSystemAdmin,
      },
    };
  }

  static hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
