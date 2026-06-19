import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as lineSdk from '@line/bot-sdk';
import type { messagingApi } from '@line/bot-sdk';

export type LineWebhookEvent = lineSdk.WebhookEvent;
type SendMessageParams = Parameters<messagingApi.MessagingApiClient['pushMessage']>[0];

@Injectable()
export class LineService implements OnModuleInit {
  private readonly logger = new Logger(LineService.name);
  private client: lineSdk.messagingApi.MessagingApiClient | null = null;
  private readonly channelSecret: string;
  readonly isEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    const accessToken = config.get<string>('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
    const secret = config.get<string>('LINE_CHANNEL_SECRET') ?? '';
    this.channelSecret = secret;
    this.isEnabled = !!(accessToken && secret);

    if (this.isEnabled) {
      this.client = new lineSdk.messagingApi.MessagingApiClient({
        channelAccessToken: accessToken,
      });
    }
  }

  onModuleInit() {
    if (this.isEnabled) {
      this.logger.log('LINE Messaging API client initialized (credentials detected)');
    } else {
      this.logger.warn(
        'LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET not set — running in mock mode',
      );
    }
  }

  /** ตรวจ HMAC-SHA256 signature จาก LINE (ข้ามเมื่อ dev-mode) */
  verifySignature(rawBody: Buffer, signature: string): boolean {
    if (!this.isEnabled) return true;
    return lineSdk.validateSignature(rawBody.toString(), this.channelSecret, signature);
  }

  async pushText(lineUserId: string, text: string): Promise<void> {
    if (!this.client) {
      this.logger.debug(`[mock] push text → ${lineUserId}: ${text}`);
      return;
    }
    await this.client.pushMessage({ to: lineUserId, messages: [{ type: 'text', text }] });
  }

  async pushFlex(lineUserId: string, altText: string, contents: object): Promise<void> {
    if (!this.client) {
      this.logger.debug(`[mock] push flex → ${lineUserId}: ${altText}`);
      return;
    }
    await this.client.pushMessage({
      to: lineUserId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ type: 'flex', altText, contents: contents as any }],
    } as SendMessageParams);
  }

  async replyText(replyToken: string, text: string): Promise<void> {
    if (!this.client) {
      this.logger.debug(`[mock] reply → ${replyToken}: ${text}`);
      return;
    }
    await this.client.replyMessage({ replyToken, messages: [{ type: 'text', text }] });
  }

  async replyFlex(replyToken: string, altText: string, contents: object): Promise<void> {
    if (!this.client) {
      this.logger.debug(`[mock] reply flex → ${replyToken}: ${altText}`);
      return;
    }
    await this.client.replyMessage({
      replyToken,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ type: 'flex', altText, contents: contents as any }],
    } as Parameters<messagingApi.MessagingApiClient['replyMessage']>[0]);
  }

  /** ใช้โดย LineRichMenuService */
  getClient(): lineSdk.messagingApi.MessagingApiClient | null {
    return this.client;
  }
}
