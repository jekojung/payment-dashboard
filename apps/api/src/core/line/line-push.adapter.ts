import { Injectable } from '@nestjs/common';
import type { LinePushPort } from '../notifications/line-push.port';
import { LineService } from './line.service';

/** LinePushPort ที่ใช้ LineService จริง — ใช้แทน NoopLinePush เมื่อ LineModule โหลด */
@Injectable()
export class LinePushAdapter implements LinePushPort {
  constructor(private readonly lineService: LineService) {}

  pushText(lineUserId: string, text: string) {
    return this.lineService.pushText(lineUserId, text);
  }

  pushFlex(lineUserId: string, altText: string, contents: object) {
    return this.lineService.pushFlex(lineUserId, altText, contents);
  }

  replyText(replyToken: string, text: string) {
    return this.lineService.replyText(replyToken, text);
  }
}
