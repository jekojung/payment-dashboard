import { Logger } from '@nestjs/common';

export const LINE_PUSH_PORT = Symbol('LINE_PUSH_PORT');

export interface LinePushPort {
  pushText(lineUserId: string, text: string): Promise<void>;
  pushFlex(lineUserId: string, altText: string, contents: object): Promise<void>;
  replyText(replyToken: string, text: string): Promise<void>;
}

/** no-op default — ใช้ก่อนที่ LineModule จะ override ด้วย LinePushAdapter */
export class NoopLinePush implements LinePushPort {
  private readonly logger = new Logger('NoopLinePush');
  async pushText(lineUserId: string, text: string): Promise<void> {
    this.logger.debug(`[noop] push to ${lineUserId}: ${text}`);
  }
  async pushFlex(lineUserId: string, altText: string, _contents: object): Promise<void> {
    this.logger.debug(`[noop] push flex to ${lineUserId}: ${altText}`);
  }
  async replyText(replyToken: string, text: string): Promise<void> {
    this.logger.debug(`[noop] reply ${replyToken}: ${text}`);
  }
}
