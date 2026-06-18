import { Inject, Injectable } from '@nestjs/common';
import { NotificationChannel } from '@tpg/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LINE_PUSH_PORT, type LinePushPort } from './line-push.port';

export interface NotifyInput {
  userId: string;
  channel: NotificationChannel;
  title: string;
  body?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LINE_PUSH_PORT) private readonly linePush: LinePushPort,
  ) {}

  /** สร้าง notification (web เก็บ DB, line push ผ่าน port) */
  async notify(input: NotifyInput) {
    const created = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        channel: input.channel,
        title: input.title,
        body: input.body ?? null,
      },
    });

    if (input.channel === NotificationChannel.LINE) {
      const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
      if (user?.lineUserId) {
        const text = input.body ? `${input.title}\n${input.body}` : input.title;
        await this.linePush.pushText(user.lineUserId, text);
      }
    }
    return created;
  }

  listForUser(userId: string, onlyUnread = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(onlyUnread ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, params: { ids?: string[]; all?: boolean }) {
    const where = params.all
      ? { userId, isRead: false }
      : { userId, id: { in: params.ids ?? [] } };
    const result = await this.prisma.notification.updateMany({ where, data: { isRead: true } });
    return { updated: result.count };
  }
}
