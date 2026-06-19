import { Injectable, Logger } from '@nestjs/common';
import type { WebhookEvent, MessageEvent, FollowEvent, PostbackEvent } from '@line/bot-sdk';
import { LineBindingService } from '../auth/line-binding.service';
import { LineService } from './line.service';
import { LineRichMenuService } from './line-rich-menu.service';
import { PrismaService } from '../../prisma/prisma.service';

type TextMessageEvent = MessageEvent & { message: { type: 'text'; text: string } };
type PostbackHandlerFn = (event: PostbackEvent) => Promise<void>;

@Injectable()
export class LineEventHandlerService {
  private readonly logger = new Logger(LineEventHandlerService.name);
  private readonly postbackHandlers = new Map<string, PostbackHandlerFn>();

  constructor(
    private readonly lineService: LineService,
    private readonly lineBinding: LineBindingService,
    private readonly richMenu: LineRichMenuService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * โมดูลธุรกิจ (steps 5–7) ลงทะเบียน postback handler ตาม action prefix
   * เช่น prefix='returns_discount:create' จะ match data ที่มี 'returns_discount:create'
   */
  registerPostbackHandler(actionPrefix: string, handler: PostbackHandlerFn): void {
    this.postbackHandlers.set(actionPrefix, handler);
    this.logger.log(`Postback handler registered: ${actionPrefix}`);
  }

  async handle(event: WebhookEvent): Promise<void> {
    switch (event.type) {
      case 'follow':
        await this.onFollow(event as FollowEvent);
        break;
      case 'unfollow':
        this.logger.log(`Unfollow: ${(event as { source: { userId?: string } }).source.userId}`);
        break;
      case 'message':
        if ((event as MessageEvent).message.type === 'text') {
          await this.onTextMessage(event as TextMessageEvent);
        }
        break;
      case 'postback':
        await this.onPostback(event as PostbackEvent);
        break;
      default:
        this.logger.debug(`Unhandled LINE event type: ${event.type}`);
    }
  }

  private async onFollow(event: FollowEvent) {
    const lineUserId = event.source.userId;
    if (!lineUserId) return;

    const user = await this.lineBinding.findUserByLineId(lineUserId);

    if (user) {
      await this.lineService.replyText(
        event.replyToken,
        `ยินดีต้อนรับกลับ ${user.name} 🎉\nกดปุ่มเมนูด้านล่างเพื่อเริ่มบันทึกงาน`,
      );
      const primaryRole = await this.getUserPrimaryRole(user.id);
      if (primaryRole) {
        await this.richMenu.assignToUser(lineUserId, primaryRole);
      }
    } else {
      await this.lineService.replyText(
        event.replyToken,
        'ยินดีต้อนรับสู่ TPG Center 👋\n\nกรุณาผูกบัญชีโดยพิมพ์:\n"ผูกบัญชี {รหัสพนักงาน}"\n\nตัวอย่าง: ผูกบัญชี SALE001',
      );
    }
  }

  private async onTextMessage(event: TextMessageEvent) {
    const lineUserId = event.source.userId;
    if (!lineUserId) return;
    const text = event.message.text.trim();

    const bindMatch = text.match(/^ผูกบัญชี\s+(\S+)/i);
    if (bindMatch) {
      await this.handleBindingRequest(event.replyToken, lineUserId, bindMatch[1].toUpperCase());
      return;
    }

    if (/^(ช่วยเหลือ|help|เมนู|menu)$/i.test(text)) {
      await this.lineService.replyText(
        event.replyToken,
        'คำสั่งที่ใช้ได้:\n• ผูกบัญชี {รหัสพนักงาน} — ผูกบัญชี LINE\n• ช่วยเหลือ — แสดงคำแนะนำ',
      );
      return;
    }

    this.logger.debug(`Unhandled text from ${lineUserId}: ${text}`);
  }

  private async handleBindingRequest(
    replyToken: string,
    lineUserId: string,
    employeeCode: string,
  ) {
    try {
      const result = await this.lineBinding.bind({ lineUserId, employeeCode });

      const primaryRole = await this.getUserPrimaryRole(result.id);
      if (primaryRole) {
        await this.richMenu.assignToUser(lineUserId, primaryRole);
      }

      await this.lineService.replyText(
        replyToken,
        `✅ ผูกบัญชีสำเร็จ!\nสวัสดี ${result.name}\nกดปุ่มเมนูด้านล่างเพื่อเริ่มบันทึกงาน`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      await this.lineService.replyText(replyToken, `❌ ผูกบัญชีไม่สำเร็จ: ${message}`);
    }
  }

  private async onPostback(event: PostbackEvent) {
    const data = event.postback.data;
    this.logger.debug(`Postback: ${data} from ${event.source.userId}`);

    for (const [prefix, handler] of this.postbackHandlers.entries()) {
      if (data.includes(prefix)) {
        await handler(event);
        return;
      }
    }

    this.logger.debug(`No postback handler for: ${data}`);
  }

  private async getUserPrimaryRole(userId: string): Promise<string | null> {
    const userRole = await this.prisma.userRole.findFirst({
      where: { userId },
      include: { role: true },
    });
    return userRole?.role.key ?? null;
  }
}
