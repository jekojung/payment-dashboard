import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import type { AuthUser } from '../../common/auth-user';
import { RegistryService } from './registry.service';

/**
 * เปิดเผยเมนู/การ์ดที่ "ผู้ใช้ปัจจุบัน" เห็น — เว็บใช้ render sidebar/cards แบบ dynamic
 */
@Controller('modules')
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}

  @Get('me/navigation')
  navigation(@CurrentUser() user: AuthUser) {
    return {
      webNav: this.registry.webNavForUser(user),
      dashboardCards: this.registry.dashboardCardsForUser(user),
      lineMenu: this.registry.lineMenuForUser(user),
    };
  }
}
