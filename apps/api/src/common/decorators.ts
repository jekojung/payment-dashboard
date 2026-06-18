import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthUser } from './auth-user';

/** marker ให้ endpoint ข้ามการตรวจ JWT (เช่น login, line webhook) */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** permissions ที่ต้องมีจึงจะเรียก endpoint ได้ */
export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...perms: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, perms);

/** ดึง AuthUser จาก request */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return data ? user?.[data] : user;
  },
);
