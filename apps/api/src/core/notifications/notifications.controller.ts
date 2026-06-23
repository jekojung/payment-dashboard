import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { markReadSchema, type MarkReadInput } from '@tpg/shared';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { AuthUser } from '../../common/auth-user';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.notifications.listForUser(user.id, unread === 'true');
  }

  @Patch('read')
  markRead(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(markReadSchema)) body: MarkReadInput,
  ) {
    return this.notifications.markRead(user.id, body);
  }
}
