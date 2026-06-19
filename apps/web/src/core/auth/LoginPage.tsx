import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, ErrorState, Field, Input } from '../ui';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(employeeCode.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">TPG Center</h1>
          <p className="mt-1 text-sm text-slate-500">ระบบติดตามงานคลังสินค้าและขนส่ง</p>
        </div>
        <Card>
          <CardBody>
            <form onSubmit={submit} className="space-y-4">
              {error && <ErrorState message={error} />}
              <Field label="รหัสพนักงาน">
                <Input
                  autoFocus
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="เช่น ADMIN001"
                />
              </Field>
              <Field label="รหัสผ่าน">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </Button>
            </form>
          </CardBody>
        </Card>
        <p className="mt-4 text-center text-xs text-slate-400">
          บัญชีทดสอบ: ADMIN001 / EXEC001 / SLEAD001 — รหัสผ่าน password123
        </p>
      </div>
    </div>
  );
}
