import { useState } from 'react';
import { api, apiError } from '../core/api/client';
import { useApi } from '../core/hooks/useApi';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '../core/ui';
import { formatDate, num } from '../core/lib/format';

interface Std {
  id: string;
  standardDiscount: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  product: { name: string };
  productModel: { name: string } | null;
}

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

interface StdForm {
  productId: string;
  productModelId: string;
  standardDiscount: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
}

function StdModal({
  row,
  products,
  onClose,
  onSaved,
}: {
  row: (Std & StdForm) | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [productId, setProductId] = useState(row?.productId ?? '');
  const [productModelId, setProductModelId] = useState(row?.productModelId ?? '');
  const [standardDiscount, setStandardDiscount] = useState(row?.standardDiscount ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(row?.effectiveFrom ?? '');
  const [effectiveTo, setEffectiveTo] = useState(row?.effectiveTo ?? '');
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        productId,
        productModelId: productModelId || null,
        standardDiscount: Number(standardDiscount),
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        isActive,
      };
      if (row) await api.patch(`/masterdata/discount-standards/${row.id}`, payload);
      else await api.post('/masterdata/discount-standards', payload);
      onSaved();
      onClose();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={row ? 'แก้ไขมาตรฐานส่วนลด' : 'เพิ่มมาตรฐานส่วนลด'}>
      <div className="space-y-4">
        {err && <ErrorState message={err} />}
        <Field label="สินค้า">
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setProductModelId('');
            }}
          >
            <option value="">เลือกสินค้า</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {selectedProduct?.hasModels && (
          <Field label="รุ่น" hint="ไม่บังคับ">
            <Select value={productModelId} onChange={(e) => setProductModelId(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {selectedProduct.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="มาตรฐาน/หน่วย">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={standardDiscount}
            onChange={(e) => setStandardDiscount(e.target.value)}
          />
        </Field>
        <Field label="มีผลตั้งแต่">
          <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
        <Field label="ถึง" hint="เว้นว่าง = ไม่มีกำหนด">
          <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          ใช้งาน
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={busy || !productId || !standardDiscount || !effectiveFrom}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function DiscountStandardsPage() {
  const { data, loading, error, reload } = useApi<Std[]>('/masterdata/discount-standards');
  const products = useApi<Product[]>('/masterdata/products');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Std | null>(null);

  const toForm = (s: Std): Std & StdForm => ({
    ...s,
    productId: '',
    productModelId: '',
    effectiveFrom: s.effectiveFrom.slice(0, 10),
    effectiveTo: s.effectiveTo ? s.effectiveTo.slice(0, 10) : '',
  });

  return (
    <div>
      <PageHeader
        title="มาตรฐานส่วนลด"
        subtitle="กำหนดส่วนลดมาตรฐานต่อหน่วยของสินค้า"
        actions={<Button onClick={() => setCreating(true)}>เพิ่มมาตรฐาน</Button>}
      />

      <Card>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="ไม่มีมาตรฐานส่วนลด" />
        ) : (
          <Table>
            <thead>
              <tr className="border-b border-slate-100">
                <Th>สินค้า</Th>
                <Th className="text-right">มาตรฐาน/หน่วย</Th>
                <Th>มีผลตั้งแต่</Th>
                <Th>ถึง</Th>
                <Th>สถานะ</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">
                    {s.product.name}
                    {s.productModel ? ` (${s.productModel.name})` : ''}
                  </Td>
                  <Td className="text-right">{num(s.standardDiscount)}</Td>
                  <Td className="text-slate-500">{formatDate(s.effectiveFrom)}</Td>
                  <Td className="text-slate-500">{s.effectiveTo ? formatDate(s.effectiveTo) : 'ไม่มีกำหนด'}</Td>
                  <Td>
                    {s.isActive ? <Badge tone="green">ใช้งาน</Badge> : <Badge tone="slate">ปิด</Badge>}
                  </Td>
                  <Td className="text-right">
                    <Button variant="ghost" onClick={() => setEditing(s)}>
                      แก้ไข
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {creating && (
        <StdModal row={null} products={products.data ?? []} onClose={() => setCreating(false)} onSaved={reload} />
      )}
      {editing && (
        <StdModal
          row={toForm(editing)}
          products={products.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
