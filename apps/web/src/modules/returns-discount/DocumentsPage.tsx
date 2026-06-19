import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReturnDocumentStatus } from '@tpg/shared';
import { useApi } from '../../core/hooks/useApi';
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '../../core/ui';
import { docStatusLabel, formatDate } from '../../core/lib/format';

interface DocItem {
  id: string;
  approvalStatus: string;
  receiptStatus: string;
}
interface Doc {
  id: string;
  gdNumber: string;
  customerCode: string;
  customerName: string | null;
  status: string;
  createdAt: string;
  createdBy: { name: string };
  items: DocItem[];
}

export function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set('search', search.trim());
    if (status) p.set('status', status);
    const s = p.toString();
    return `/returns-discount/documents${s ? `?${s}` : ''}`;
  }, [search, status]);

  const { data, loading, error } = useApi<Doc[]>(query, [query]);

  return (
    <div>
      <PageHeader title="ใบ GD ทั้งหมด" subtitle="ส่วนลดรับคืนสินค้าเทิร์น" />

      <Card className="mb-4">
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="ค้นหาเลขที่ใบ GD">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="เช่น GD-001" />
            </Field>
            <Field label="สถานะ">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">ทั้งหมด</option>
                <option value={ReturnDocumentStatus.RECORDED}>บันทึกแล้ว</option>
                <option value={ReturnDocumentStatus.PARTIALLY_RECEIVED}>รับบางส่วน</option>
                <option value={ReturnDocumentStatus.FULLY_RECEIVED}>รับครบแล้ว</option>
              </Select>
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <CardBody>
            <ErrorState message={error} />
          </CardBody>
        ) : !data || data.length === 0 ? (
          <EmptyState message="ไม่พบใบ GD" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>เลขที่ใบ GD</Th>
                <Th>ลูกค้า</Th>
                <Th>พนักงานขาย</Th>
                <Th>รายการ</Th>
                <Th>สถานะ</Th>
                <Th>วันที่</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((d) => {
                const st = docStatusLabel[d.status];
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <Td>
                      <Link to={`/returns-discount/documents/${d.id}`} className="font-medium text-brand-600 hover:underline">
                        {d.gdNumber}
                      </Link>
                    </Td>
                    <Td>{d.customerName ?? d.customerCode}</Td>
                    <Td>{d.createdBy?.name}</Td>
                    <Td>{d.items.length} รายการ</Td>
                    <Td>{st && <Badge tone={st.tone}>{st.text}</Badge>}</Td>
                    <Td className="text-slate-500">{formatDate(d.createdAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
