import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { PostbackEvent } from '@line/bot-sdk';
import { LineService } from '../../core/line/line.service';
import { LineEventHandlerService } from '../../core/line/line-event-handler.service';
import { ReturnsDiscountService } from './returns-discount.service';

/** parse postback data รูปแบบ "action=...&itemId=..." */
function parsePostback(data: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(data));
}

/**
 * เชื่อม Flow A เข้ากับ LINE — ลงทะเบียน handler ผ่าน registry ของ core
 * (core ไม่รู้จักโมดูลนี้; โมดูลผูกตัวเองเข้า event pipeline)
 */
@Injectable()
export class ReturnsDiscountLineHandler implements OnModuleInit {
  private readonly logger = new Logger(ReturnsDiscountLineHandler.name);
  /** ผู้ที่กด "ปฏิเสธ" แล้วระบบรอเหตุผลถัดไป: lineUserId -> itemId */
  private readonly pendingRejects = new Map<string, string>();

  constructor(
    private readonly events: LineEventHandlerService,
    private readonly line: LineService,
    private readonly service: ReturnsDiscountService,
  ) {}

  onModuleInit(): void {
    // เมนู rich menu "แจ้งส่วนลด" → ตอบลิงก์ LIFF (ฟอร์มจริงในขั้นเว็บ/LIFF)
    this.events.registerPostbackHandler('returns_discount:create', async (event) => {
      await this.replyCreateForm(event);
    });

    this.events.registerPostbackHandler('rd_approve', async (event) => {
      await this.handleApprove(event);
    });

    this.events.registerPostbackHandler('rd_reject', async (event) => {
      await this.handleReject(event);
    });

    // รับ free-text เป็น "เหตุผลการปฏิเสธ" ต่อจากปุ่มปฏิเสธ
    this.events.registerTextHandler(async (event) => {
      const lineUserId = event.source.userId;
      if (!lineUserId || !this.pendingRejects.has(lineUserId)) return false;

      const itemId = this.pendingRejects.get(lineUserId)!;
      this.pendingRejects.delete(lineUserId);
      const actor = await this.service.actorFromLineUserId(lineUserId);
      if (!actor) {
        await this.line.replyText(event.replyToken, 'ไม่พบบัญชีของคุณในระบบ');
        return true;
      }
      try {
        await this.service.rejectItem(actor, itemId, event.message.text.trim());
        await this.line.replyText(event.replyToken, '🚫 บันทึกการปฏิเสธและแจ้งฝ่ายขายแล้ว');
      } catch (e: unknown) {
        await this.line.replyText(event.replyToken, `ไม่สำเร็จ: ${this.msg(e)}`);
      }
      return true;
    });
  }

  private async replyCreateForm(event: PostbackEvent) {
    const liffId = process.env.LIFF_ID;
    const url = liffId ? `https://liff.line.me/${liffId}` : '(ยังไม่ได้ตั้งค่า LIFF_ID)';
    await this.line.replyText(
      event.replyToken,
      `แจ้งส่วนลดรับเทิร์นสินค้า\nกรอกแบบฟอร์มที่นี่:\n${url}`,
    );
  }

  private async handleApprove(event: PostbackEvent) {
    const lineUserId = event.source.userId;
    const { itemId } = parsePostback(event.postback.data);
    if (!lineUserId || !itemId) return;

    const actor = await this.service.actorFromLineUserId(lineUserId);
    if (!actor) {
      await this.line.replyText(event.replyToken, 'ไม่พบบัญชีของคุณในระบบ');
      return;
    }
    try {
      await this.service.approveItem(actor, itemId);
      await this.line.replyText(event.replyToken, '✅ อนุมัติแล้ว และแจ้งฝ่ายขาย/คลังเรียบร้อย');
    } catch (e: unknown) {
      await this.line.replyText(event.replyToken, `ไม่สำเร็จ: ${this.msg(e)}`);
    }
  }

  private async handleReject(event: PostbackEvent) {
    const lineUserId = event.source.userId;
    const { itemId } = parsePostback(event.postback.data);
    if (!lineUserId || !itemId) return;

    const actor = await this.service.actorFromLineUserId(lineUserId);
    if (!actor) {
      await this.line.replyText(event.replyToken, 'ไม่พบบัญชีของคุณในระบบ');
      return;
    }
    // เริ่มสถานะรอเหตุผล แล้วให้หัวหน้าพิมพ์เหตุผลถัดไป
    this.pendingRejects.set(lineUserId, itemId);
    await this.line.replyText(event.replyToken, 'กรุณาพิมพ์เหตุผลการปฏิเสธ');
  }

  private msg(e: unknown): string {
    if (e && typeof e === 'object' && 'message' in e) {
      const m = (e as { message?: unknown }).message;
      if (typeof m === 'string') return m;
    }
    return 'เกิดข้อผิดพลาด';
  }
}
