import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApi } from '../../core/hooks/useApi';
import { Card, CardBody, EmptyState, ErrorState, PageHeader, Spinner } from '../../core/ui';
import { baht, num } from '../../core/lib/format';

interface NameValue {
  name: string;
  value: number;
}
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
  charts: {
    discountByProduct: NameValue[];
    discountBySales: NameValue[];
    discountTrend: NameValue[];
    disposalByReason: { name: string; quantity: number; saleValue: number }[];
  };
}

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

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

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) {
  return (
    <Card>
      <CardBody>
        <div className="mb-3 font-semibold text-slate-800">{title}</div>
        {empty ? <EmptyState message="ยังไม่มีข้อมูล" /> : <div className="h-64">{children}</div>}
      </CardBody>
    </Card>
  );
}

export function DashboardPage() {
  const { data, loading, error } = useApi<Dashboard>('/returns-discount/dashboard');

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { kpis, charts } = data;

  return (
    <div>
      <PageHeader
        title="ภาพรวมส่วนลดรับเทิร์น"
        subtitle="โมดูล 1"
        actions={
          <Link to="/returns-discount/documents" className="text-sm font-medium text-brand-600 hover:underline">
            ดูใบ GD ทั้งหมด →
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="ส่วนลดรวมเดือนนี้ (บาท)" value={baht(kpis.totalDiscountThisMonth)} tone="text-brand-700" />
        <Kpi label="ใบ GD รอคลังรับ" value={num(kpis.gdPendingReceipt)} tone="text-amber-600" />
        <Kpi label="รออนุมัติพิเศษ" value={num(kpis.pendingApprovals)} tone="text-red-600" />
        <Kpi label="รายการ mismatch" value={num(kpis.mismatchCount)} tone="text-amber-600" />
        <Kpi label="สต็อกคงเหลือรวม (หน่วย)" value={num(kpis.totalStockBalance)} />
        <Kpi label="ตัดจำหน่ายเดือนนี้ (หน่วย)" value={num(kpis.disposalThisMonthQuantity)} />
        <Kpi label="รอบันทึกมูลค่าขาย" value={num(kpis.disposalPendingSaleValue)} tone="text-amber-600" />
        <Kpi label="มูลค่าขายรวมที่บันทึก (บาท)" value={baht(kpis.totalSaleValueRecorded)} tone="text-green-600" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="ส่วนลดตามสินค้า/รุ่น" empty={charts.discountByProduct.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.discountByProduct}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${baht(v)} บาท`} />
              <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ส่วนลดตามพนักงานขาย" empty={charts.discountBySales.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.discountBySales}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${baht(v)} บาท`} />
              <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="แนวโน้มส่วนลด 30 วัน" empty={charts.discountTrend.every((d) => d.value === 0)}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.discountTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${baht(v)} บาท`} />
              <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="การตัดจำหน่ายแยกตามเหตุผล (หน่วย)" empty={charts.disposalByReason.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={charts.disposalByReason}
                dataKey="quantity"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(e: { name: string; quantity: number }) => `${e.name}: ${num(e.quantity)}`}
              >
                {charts.disposalByReason.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${num(v)} หน่วย`} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
