import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LINE_PUSH_PORT } from '../notifications/line-push.port';
import { LinePushAdapter } from './line-push.adapter';
import { LineEventHandlerService } from './line-event-handler.service';
import { LineRichMenuService } from './line-rich-menu.service';
import { LineService } from './line.service';
import { LineWebhookController } from './line-webhook.controller';

/**
 * LineModule — global
 * - Override LINE_PUSH_PORT ด้วย LinePushAdapter (real หรือ mock ขึ้นอยู่กับ env)
 * - Expose LineService และ LineEventHandlerService ให้โมดูลธุรกิจใช้
 */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [LineWebhookController],
  providers: [
    LineService,
    LineRichMenuService,
    LineEventHandlerService,
    LinePushAdapter,
    { provide: LINE_PUSH_PORT, useExisting: LinePushAdapter },
  ],
  exports: [LineService, LineEventHandlerService, LineRichMenuService, LINE_PUSH_PORT],
})
export class LineModule {}
