import { useApi } from '../core/hooks/useApi';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
} from '../core/ui';
import { formatDateTime, num } from '../core/lib/format';

interface AuditItem {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  moduleKey: string | null;
  createdAt: string;
  user: { name: string; employeeCode: string } | null;
}

interface AuditResponse {
  items: AuditItem[];
  total: number;
}

export function AuditPage() {
  const { data, loading, error } = useApi<AuditResponse>('/audit');

  return (
    <div>
      <PageHeader
        title="บันทึกการใช้งาน"
        subtitle={data ? `ทั้งหมด ${num(data.total)} รายการ` : undefined}
      />

      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState message="ไม่มีบันทึกการใช้งาน" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>เวลา</Th>
                <Th>ผู้ใช้</Th>
                <Th>โมดูล</Th>
                <Th>การกระทำ</Th>
                <Th>Entity</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <Td className="text-slate-500">{formatDateTime(a.createdAt)}</Td>
                  <Td>{a.user?.name ?? 'ระบบ'}</Td>
                  <Td>{a.moduleKey ?? 'core'}</Td>
                  <Td>
                    <Badge tone="slate">{a.action}</Badge>
                  </Td>
                  <Td>{a.entity ?? '-'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
