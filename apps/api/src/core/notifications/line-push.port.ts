import { Logger } from '@nestjs/common';

/**
 * พอร์ตสำหรับ push ข้อความไป LINE — ขั้นที่ 4 (LINE core) จะ implement จริง
 * แยก interface ไว้เพื่อไม่ให้ core notifications ผูกกับ LINE SDK โดยตรง
 */
export const LINE_PUSH_PORT = Symbol('LINE_PUSH_PORT');

export interface LinePushPort {
  /** push ข้อความ text ไปยัง lineUserId (ขั้นที่ 4 รองรับ Flex ด้วย) */
  pushText(lineUserId: string, text: string): Promise<void>;
}

/** default no-op (ก่อนต่อ LINE SDK ในขั้นที่ 4) — log ไว้เพื่อ debug */
export class NoopLinePush implements LinePushPort {
  private readonly logger = new Logger('NoopLinePush');
  async pushText(lineUserId: string, text: string): Promise<void> {
    this.logger.debug(`[noop] push to ${lineUserId}: ${text}`);
  }
}
