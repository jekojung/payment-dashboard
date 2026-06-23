import { Link } from 'react-router-dom';
import { Permissions } from '@tpg/shared';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { Badge, Card, CardBody, PageHeader, Spinner } from '../ui';
import { baht, num } from '../lib/format';

const P = Permissions.RETURNS_DISCOUNT;

interface Dashboard {
  kpis: {
    totalDiscountThisMonth: number;
    gdPendingReceipt: number;
    pendingApprovals: number;
    mismatchCount: number;
    totalStockBalance: number;
    disposalPendingSaleValue: number;
    totalSaleValueRecorded: number;
    disposalThisMonthQuantity: number;
  };
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardBody>
        <div className="text-sm text-slate-500">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${tone ?? 'text-slate-900'}`}>{value}</div>
      </CardBody>
    </Card>
  );
}

export function OverviewPage() {
  const { user, can } = useAuth();
  const canView = can(P.VIEW);
  const { data, loading } = useApi<Dashboard>(canView ? '/returns-discount/dashboard' : null);

  return (
    <div>
      <PageHeader title={`สวัสดี ${user?.name ?? ''}`} subtitle="ภาพรวมระบบ" />

      {!canView && (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">
              ยินดีต้อนรับสู่ TPG Center — เมนูด้านซ้ายจะแสดงตามสิทธิ์ของบัญชีคุณ
            </p>
          </CardBody>
        </Card>
      )}

      {canView && loading && <Spinner />}

      {canView && data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="ส่วนลดรวมเดือนนี้ (บาท)" value={baht(data.kpis.totalDiscountThisMonth)} tone="text-brand-700" />
            <Kpi label="ใบ GD รอคลังรับ" value={num(data.kpis.gdPendingReceipt)} tone="text-amber-600" />
            <Kpi label="รออนุมัติพิเศษ" value={num(data.kpis.pendingApprovals)} tone="text-red-600" />
            <Kpi label="รายการ mismatch" value={num(data.kpis.mismatchCount)} tone="text-amber-600" />
            <Kpi label="สต็อกคงเหลือรวม (หน่วย)" value={num(data.kpis.totalStockBalance)} tone="text-slate-900" />
            <Kpi label="ตัดจำหน่ายเดือนนี้ (หน่วย)" value={num(data.kpis.disposalThisMonthQuantity)} />
            <Kpi label="รอบันทึกมูลค่าขาย" value={num(data.kpis.disposalPendingSaleValue)} tone="text-amber-600" />
            <Kpi label="มูลค่าขายรวมที่บันทึก (บาท)" value={baht(data.kpis.totalSaleValueRecorded)} tone="text-green-600" />
          </div>

          <div className="mt-6">
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">โมดูล 1 — ส่วนลดรับคืนสินค้าเทิร์น</div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      ติดตามใบ GD, สต็อกรับเทิร์น และการตัดจำหน่าย
                    </p>
                  </div>
                  <Badge tone="indigo">เปิดใช้งาน</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/returns-discount" className="text-sm font-medium text-brand-600 hover:underline">
                    ดู Dashboard →
                  </Link>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
