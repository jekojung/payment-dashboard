import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../common/decorators';
import type { AuthUser } from '../../common/auth-user';

/**
 * PermissionsGuard — ตรวจ @RequirePermissions(...) เทียบกับ permission ของผู้ใช้
 * system_admin ผ่านทุก permission (isSystemAdmin)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('ไม่ได้รับอนุญาต');

    if (user.isSystemAdmin) return true;

    const ok = required.every((p) => user.permissions.includes(p));
    if (!ok) {
      throw new ForbiddenException('สิทธิ์ไม่เพียงพอสำหรับการดำเนินการนี้');
    }
    return true;
  }
}
