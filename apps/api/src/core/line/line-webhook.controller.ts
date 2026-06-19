import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import type { WebhookRequestBody } from '@line/bot-sdk';
import { Public } from '../../common/decorators';
import { LineService } from './line.service';
import { LineEventHandlerService } from './line-event-handler.service';

@Public()
@Controller('line')
export class LineWebhookController {
  constructor(
    private readonly lineService: LineService,
    private readonly eventHandler: LineEventHandlerService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<{ rawBody?: Buffer }>,
    @Headers('x-line-signature') signature: string,
  ): Promise<{ ok: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('raw body unavailable');

    if (!this.lineService.verifySignature(rawBody, signature ?? '')) {
      throw new BadRequestException('invalid LINE signature');
    }

    const body = JSON.parse(rawBody.toString()) as WebhookRequestBody;

    // ประมวล events ทีละตัว — ไม่ throw เพื่อตอบกลับ 200 ให้ LINE เสมอ
    for (const event of body.events) {
      await this.eventHandler.handle(event).catch((err: unknown) => {
        console.error('[LINE webhook] event error:', err);
      });
    }

    return { ok: true };
  }
}
