import { Permissions } from '@tpg/shared';
import type { AuthUser } from '../../common/auth-user';
import { RegistryService } from './registry.service';
import { returnsDiscountDefinition } from '../../modules/returns-discount/returns-discount.definition';

const baseUser = (perms: string[], isSystemAdmin = false): AuthUser => ({
  id: 'u1',
  employeeCode: 'E001',
  name: 'test',
  roles: [],
  permissions: perms,
  isSystemAdmin,
});

describe('RegistryService — dynamic menu by permission', () => {
  let registry: RegistryService;

  beforeEach(() => {
    registry = new RegistryService(null as never);
    registry.register(returnsDiscountDefinition);
  });

  it('sales_staff (create) เห็นเฉพาะเมนูแจ้งส่วนลด', () => {
    const menu = registry.lineMenuForUser(baseUser([Permissions.RETURNS_DISCOUNT.CREATE]));
    expect(menu.map((m) => m.action)).toEqual(['returns.create']);
  });

  it('warehouse_staff (view+receive+disposal) เห็น 3 เมนูคลัง', () => {
    const menu = registry.lineMenuForUser(
      baseUser([
        Permissions.RETURNS_DISCOUNT.VIEW,
        Permissions.RETURNS_DISCOUNT.RECEIVE,
        Permissions.RETURNS_DISCOUNT.DISPOSAL,
      ]),
    );
    expect(menu.map((m) => m.action).sort()).toEqual(
      ['returns.disposal', 'returns.receive', 'returns.stock'].sort(),
    );
  });

  it('system_admin เห็นทุกเมนู', () => {
    const menu = registry.lineMenuForUser(baseUser([], true));
    expect(menu).toHaveLength(returnsDiscountDefinition.lineMenu.length);
  });

  it('ผู้ใช้ไม่มีสิทธิ์ไม่เห็น web nav', () => {
    expect(registry.webNavForUser(baseUser([]))).toHaveLength(0);
  });
});
