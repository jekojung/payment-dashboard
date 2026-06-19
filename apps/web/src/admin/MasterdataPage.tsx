import { Fragment, useState } from 'react';
import { api, apiError } from '../core/api/client';
import { useApi } from '../core/hooks/useApi';
import {
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Table,
  Td,
  Th,
} from '../core/ui';

type TabKey = 'customers' | 'suppliers' | 'buyers' | 'products';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'customers', label: 'ลูกค้า' },
  { key: 'suppliers', label: 'ผู้ขายเดิม' },
  { key: 'buyers', label: 'ผู้รับซื้อ' },
  { key: 'products', label: 'สินค้า' },
];

// ---------- Customers / Suppliers (code + name) ----------
interface CodedItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

function CodedEntityModal({
  endpoint,
  row,
  onClose,
  onSaved,
}: {
  endpoint: string;
  row: CodedItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(row?.code ?? '');
  const [name, setName] = useState(row?.name ?? '');
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (row) await api.patch(`${endpoint}/${row.id}`, { code, name, isActive });
      else await api.post(endpoint, { code, name, isActive });
      onSaved();
      onClose();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={row ? 'แก้ไข' : 'เพิ่มรายการ'}>
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <Field label="รหัส">
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="ชื่อ">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          ใช้งาน
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={busy || !code || !name}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CodedEntityTab({ endpoint, addLabel }: { endpoint: string; addLabel: string }) {
  const { data, loading, error, reload } = useApi<CodedItem[]>(endpoint);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CodedItem | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}>{addLabel}</Button>
      </div>
      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="ไม่มีรายการ" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>รหัส</Th>
                <Th>ชื่อ</Th>
                <Th>สถานะ</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{c.code}</Td>
                  <Td>{c.name}</Td>
                  <Td>
                    {c.isActive ? <Badge tone="green">ใช้งาน</Badge> : <Badge tone="slate">ปิด</Badge>}
                  </Td>
                  <Td className="text-right">
                    <Button variant="ghost" onClick={() => setEditing(c)}>
                      แก้ไข
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {creating && <CodedEntityModal endpoint={endpoint} row={null} onClose={() => setCreating(false)} onSaved={reload} />}
      {editing && (
        <CodedEntityModal endpoint={endpoint} row={editing} onClose={() => setEditing(null)} onSaved={reload} />
      )}
    </div>
  );
}

// ---------- Buyers (name only) ----------
interface BuyerItem {
  id: string;
  name: string;
  isActive: boolean;
}

function BuyerModal({ row, onClose, onSaved }: { row: BuyerItem | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(row?.name ?? '');
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (row) await api.patch(`/masterdata/buyers/${row.id}`, { name, isActive });
      else await api.post('/masterdata/buyers', { name, isActive });
      onSaved();
      onClose();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={row ? 'แก้ไขผู้รับซื้อ' : 'เพิ่มผู้รับซื้อ'}>
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <Field label="ชื่อ">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          ใช้งาน
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={busy || !name}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BuyersTab() {
  const { data, loading, error, reload } = useApi<BuyerItem[]>('/masterdata/buyers');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BuyerItem | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}>เพิ่มผู้รับซื้อ</Button>
      </div>
      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="ไม่มีรายการ" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>ชื่อ</Th>
                <Th>สถานะ</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{b.name}</Td>
                  <Td>
                    {b.isActive ? <Badge tone="green">ใช้งาน</Badge> : <Badge tone="slate">ปิด</Badge>}
                  </Td>
                  <Td className="text-right">
                    <Button variant="ghost" onClick={() => setEditing(b)}>
                      แก้ไข
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {creating && <BuyerModal row={null} onClose={() => setCreating(false)} onSaved={reload} />}
      {editing && <BuyerModal row={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

// ---------- Products + models ----------
interface ProductModel {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}
interface Product {
  id: string;
  code: string;
  name: string;
  hasModels: boolean;
  isActive: boolean;
  models: ProductModel[];
}

function ProductModal({ row, onClose, onSaved }: { row: Product | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(row?.code ?? '');
  const [name, setName] = useState(row?.name ?? '');
  const [hasModels, setHasModels] = useState(row?.hasModels ?? false);
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (row) await api.patch(`/masterdata/products/${row.id}`, { code, name, hasModels, isActive });
      else await api.post('/masterdata/products', { code, name, hasModels, isActive });
      onSaved();
      onClose();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={row ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}>
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <Field label="รหัส">
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="ชื่อ">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={hasModels} onChange={(e) => setHasModels(e.target.checked)} />
          มีรุ่น
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          ใช้งาน
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={busy || !code || !name}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ModelModal({ productId, onClose, onSaved }: { productId: string; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.post('/masterdata/products/models', { productId, code, name, isActive: true });
      onSaved();
      onClose();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="เพิ่มรุ่น">
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <Field label="รหัส">
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="ชื่อ">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={busy || !code || !name}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ProductsTab() {
  const { data, loading, error, reload } = useApi<Product[]>('/masterdata/products');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [addingModelFor, setAddingModelFor] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}>เพิ่มสินค้า</Button>
      </div>
      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="ไม่มีสินค้า" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>รหัส</Th>
                <Th>ชื่อ</Th>
                <Th>สถานะ</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((p) => (
                <Fragment key={p.id}>
                  <tr className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-800">{p.code}</Td>
                    <Td>{p.name}</Td>
                    <Td>
                      {p.isActive ? <Badge tone="green">ใช้งาน</Badge> : <Badge tone="slate">ปิด</Badge>}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.hasModels && (
                          <Button variant="ghost" onClick={() => setAddingModelFor(p.id)}>
                            เพิ่มรุ่น
                          </Button>
                        )}
                        <Button variant="ghost" onClick={() => setEditing(p)}>
                          แก้ไข
                        </Button>
                      </div>
                    </Td>
                  </tr>
                  {p.models.map((m) => (
                    <tr key={m.id} className="bg-slate-50/50">
                      <Td className="pl-8 text-slate-500">↳ {m.code}</Td>
                      <Td className="text-slate-600">{m.name}</Td>
                      <Td>
                        {m.isActive ? <Badge tone="green">ใช้งาน</Badge> : <Badge tone="slate">ปิด</Badge>}
                      </Td>
                      <Td></Td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {creating && <ProductModal row={null} onClose={() => setCreating(false)} onSaved={reload} />}
      {editing && <ProductModal row={editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {addingModelFor && (
        <ModelModal productId={addingModelFor} onClose={() => setAddingModelFor(null)} onSaved={reload} />
      )}
    </div>
  );
}

export function MasterdataPage() {
  const [tab, setTab] = useState<TabKey>('customers');

  return (
    <div>
      <PageHeader title="ข้อมูลหลัก" subtitle="จัดการข้อมูลพื้นฐานของระบบ" />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              'rounded-lg px-3.5 py-2 text-sm font-medium transition',
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'customers' && <CodedEntityTab endpoint="/masterdata/customers" addLabel="เพิ่มลูกค้า" />}
      {tab === 'suppliers' && <CodedEntityTab endpoint="/masterdata/suppliers" addLabel="เพิ่มผู้ขายเดิม" />}
      {tab === 'buyers' && <BuyersTab />}
      {tab === 'products' && <ProductsTab />}
    </div>
  );
}
