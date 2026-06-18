import { Body, Controller, Get, Post } from '@nestjs/common';
import { lineBindingSchema, loginSchema, type LineBindingInput, type LoginInput } from '@tpg/shared';
import { CurrentUser, Public } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthUser } from '../../common/auth-user';
import { AuthService } from './auth.service';
import { LineBindingService } from './line-binding.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly lineBinding: LineBindingService,
  ) {}

  @Public()
  @Post('login')
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  /** ผูกบัญชี LINE ด้วยรหัสพนักงาน (เรียกจาก LIFF/webhook — ภายในจะตรวจ signature ใน step 4) */
  @Public()
  @Post('line/bind')
  bindLine(@Body(new ZodValidationPipe(lineBindingSchema)) body: LineBindingInput) {
    return this.lineBinding.bind(body);
  }

  /** ข้อมูลผู้ใช้ปัจจุบัน (ตรวจ token + คืน roles/permissions) */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
