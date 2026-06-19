import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../core/hooks/useApi';
import { Badge, Card, CardBody, ErrorState, PageHeader, Spinner } from '../../core/ui';
import {
  approvalLabel,
  baht,
  discountLabel,
  docStatusLabel,
  formatDateTime,
  num,
  receiptLabel,
} from '../../core/lib/format';

interface Attachment {
  id: string;
  driveLink: string;
}
interface Item {
  id: string;
  product: { name: string };
  productModel: { name: string } | null;
  declaredQuantity: number;
  receivedQuantity: number | null;
  discountPerUnit: string;
  totalDiscount: string;
  standardDiscountSnapshot: string;
  discountStatus: string;
  approvalStatus: string;
  receiptStatus: string;
  qtyMismatch: boolean;
  rejectReason: string | null;
  approvedBy: { name: string } | null;
  receivedBy: { name: string } | null;
  attachments: Attachment[];
}
interface DocDetail {
  id: string;
  gdNumber: string;
  customerCode: string;
  customerName: string | null;
  status: string;
  createdAt: string;
  createdBy: { name: string };
  items: Item[];
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

export function DocumentDetailPage() {
  const { id } = useParams();
  const { data, loading, error } = useApi<DocDetail>(`/returns-discount/documents/${id}`);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const st = docStatusLabel[data.status];

  return (
    <div>
      <PageHeader
        title={`ใบ GD ${data.gdNumber}`}
        subtitle="รายละเอียดใบรับคืนสินค้าเทิร์น"
        actions={
          <Link to="/returns-discount/documents" className="text-sm text-brand-600 hover:underline">
            ← กลับรายการ
          </Link>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Info label="ลูกค้า" value={data.customerName ?? data.customerCode} />
            <Info label="รหัสลูกค้า" value={data.customerCode} />
            <Info label="พนักงานขาย" value={data.createdBy?.name ?? '-'} />
            <Info label="บันทึกเมื่อ" value={formatDateTime(data.createdAt)} />
          </div>
          <div className="mt-3">{st && <Badge tone={st.tone}>{st.text}</Badge>}</div>
        </CardBody>
      </Card>

      <div className="space-y-4">
        {data.items.map((it) => {
          const ds = discountLabel[it.discountStatus];
          const ap = approvalLabel[it.approvalStatus];
          const rc = receiptLabel[it.receiptStatus];
          return (
            <Card key={it.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    {it.product.name}
                    {it.productModel && <span className="text-slate-500"> ({it.productModel.name})</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ds && <Badge tone={ds.tone}>{ds.text}</Badge>}
                    {ap && <Badge tone={ap.tone}>{ap.text}</Badge>}
                    {rc && <Badge tone={rc.tone}>{rc.text}</Badge>}
                    {it.qtyMismatch && <Badge tone="amber">จำนวนไม่ตรง</Badge>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Info label="จำนวนที่แจ้ง" value={`${num(it.declaredQuantity)} หน่วย`} />
                  <Info
                    label="จำนวนที่รับ"
                    value={it.receivedQuantity != null ? `${num(it.receivedQuantity)} หน่วย` : '-'}
                  />
                  <Info label="ส่วนลด/หน่วย" value={`${baht(it.discountPerUnit)} บาท`} />
                  <Info label="มาตรฐาน/หน่วย" value={`${baht(it.standardDiscountSnapshot)} บาท`} />
                  <Info label="ส่วนลดรวม" value={`${baht(it.totalDiscount)} บาท`} />
                  {it.approvedBy && <Info label="อนุมัติ/ปฏิเสธโดย" value={it.approvedBy.name} />}
                  {it.receivedBy && <Info label="รับโดย" value={it.receivedBy.name} />}
                </div>

                {it.rejectReason && (
                  <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    เหตุผลปฏิเสธ: {it.rejectReason}
                  </div>
                )}

                {it.attachments.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-xs text-slate-400">รูปสินค้าที่รับ</div>
                    <div className="flex flex-wrap gap-2">
                      {it.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={a.driveLink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-brand-600 hover:bg-slate-50"
                        >
                          🖼️ เปิดรูป
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
