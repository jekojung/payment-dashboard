import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RoleKey } from '@tpg/shared';
import { LineService } from './line.service';

/**
 * Rich menu group ตามกลุ่มสิทธิ์
 * แต่ละ group ใช้ rich menu template คนละแบบ
 */
export type RichMenuGroup = 'sales' | 'warehouse' | 'default';

const MENU_TEMPLATES: Record<RichMenuGroup, object> = {
  sales: {
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'TPG Sales Menu',
    chatBarText: 'เมนู',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: {
          type: 'postback',
          label: 'แจ้งส่วนลด',
          data: 'action=returns_discount:create',
          displayText: 'แจ้งส่วนลด',
        },
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: {
          type: 'postback',
          label: 'อนุมัติพิเศษ',
          data: 'action=returns_discount:approve_special',
          displayText: 'อนุมัติพิเศษ',
        },
      },
    ],
  },
  warehouse: {
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'TPG Warehouse Menu',
    chatBarText: 'เมนู',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 834, height: 843 },
        action: {
          type: 'postback',
          label: 'รับสินค้าคืน',
          data: 'action=returns_discount:receive',
          displayText: 'รับสินค้าคืน',
        },
      },
      {
        bounds: { x: 834, y: 0, width: 833, height: 843 },
        action: {
          type: 'postback',
          label: 'ตัดจำหน่าย',
          data: 'action=returns_discount:disposal',
          displayText: 'ตัดจำหน่าย',
        },
      },
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: {
          type: 'postback',
          label: 'ตรวจสต็อก',
          data: 'action=returns_discount:stock_check',
          displayText: 'ตรวจสต็อก',
        },
      },
    ],
  },
  default: {
    size: { width: 2500, height: 843 },
    selected: false,
    name: 'TPG Default Menu',
    chatBarText: 'เมนู',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 2500, height: 843 },
        action: { type: 'message', label: 'ช่วยเหลือ', text: 'ช่วยเหลือ' },
      },
    ],
  },
};

/** แมป role key → rich menu group */
export function roleToMenuGroup(roleKey: string): RichMenuGroup {
  if ([RoleKey.SALES_STAFF, RoleKey.SALES_LEAD].includes(roleKey as RoleKey)) return 'sales';
  if ([RoleKey.WAREHOUSE_STAFF, RoleKey.WAREHOUSE_LEAD].includes(roleKey as RoleKey))
    return 'warehouse';
  return 'default';
}

@Injectable()
export class LineRichMenuService implements OnModuleInit {
  private readonly logger = new Logger(LineRichMenuService.name);
  private readonly menuIds = new Map<RichMenuGroup, string>();

  constructor(private readonly lineService: LineService) {}

  async onModuleInit() {
    if (this.lineService.isEnabled) {
      await this.ensureMenusCreated();
    }
  }

  /**
   * สร้าง rich menu สำหรับทุก group (idempotent — เรียกได้ทุก startup)
   * หมายเหตุ: rich menu ต้องการรูปภาพขนาด 2500×843 px
   *           ใส่ภาพผ่าน uploadRichMenuImage() ก่อน setDefaultRichMenu() จึงจะแสดงผล
   */
  private async ensureMenusCreated() {
    const client = this.lineService.getClient();
    if (!client) return;

    for (const [group, template] of Object.entries(MENU_TEMPLATES) as [RichMenuGroup, object][]) {
      try {
        const res = await client.createRichMenu(template as Parameters<typeof client.createRichMenu>[0]);
        this.menuIds.set(group, res.richMenuId);
        this.logger.log(`Rich menu created: group=${group} id=${res.richMenuId}`);
        this.logger.log(
          `  → Upload image: POST https://api-data.line.me/v2/bot/richmenu/${res.richMenuId}/content`,
        );
      } catch (err) {
        this.logger.warn(`Failed to create rich menu for group=${group}: ${String(err)}`);
      }
    }
  }

  /** กำหนด rich menu ให้ผู้ใช้ตาม role */
  async assignToUser(lineUserId: string, roleKey: string): Promise<void> {
    const group = roleToMenuGroup(roleKey);
    const menuId = this.menuIds.get(group);
    const client = this.lineService.getClient();

    if (!client || !menuId) {
      this.logger.debug(`[mock] assign rich menu group=${group} → ${lineUserId}`);
      return;
    }
    await client.linkRichMenuIdToUser(lineUserId, menuId);
    this.logger.log(`Assigned rich menu group=${group} → ${lineUserId}`);
  }

  /** ยกเลิก rich menu ของผู้ใช้ (เช่น ตอน unbind) */
  async unlinkFromUser(lineUserId: string): Promise<void> {
    const client = this.lineService.getClient();
    if (!client) {
      this.logger.debug(`[mock] unlink rich menu → ${lineUserId}`);
      return;
    }
    await client.unlinkRichMenuIdFromUser(lineUserId).catch(() => {
      // ไม่ error ถ้าผู้ใช้ยังไม่มี menu
    });
  }
}
