import { Global, Module } from '@nestjs/common';
import { LINE_PUSH_PORT, NoopLinePush } from './line-push.port';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * NotificationsModule — global
 * LINE_PUSH_PORT ใช้ NoopLinePush ก่อน ขั้นที่ 4 จะ override ด้วย implementation จริง
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, { provide: LINE_PUSH_PORT, useClass: NoopLinePush }],
  exports: [NotificationsService, LINE_PUSH_PORT],
})
export class NotificationsModule {}
