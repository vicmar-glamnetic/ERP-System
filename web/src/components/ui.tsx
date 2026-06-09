import React from 'react';

// ─── Badge ────────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:      { bg: '#E8F5E9', color: '#2E7D32' },
  pending:     { bg: '#FFF3E0', color: '#E65100' },
  in_progress: { bg: '#E3F2FD', color: '#1565C0' },
  picking:     { bg: '#E3F2FD', color: '#1565C0' },
  checking:    { bg: '#EDE7F6', color: '#4527A0' },
  checked:     { bg: '#E8F5E9', color: '#2E7D32' },
  packed:      { bg: '#E8F5E9', color: '#2E7D32' },
  invoiced:    { bg: '#E0F2F1', color: '#00695C' },
  dispatched:  { bg: '#F3E5F5', color: '#6A1B9A' },
  completed:   { bg: '#E8F5E9', color: '#2E7D32' },
  receiving:   { bg: '#E3F2FD', color: '#1565C0' },
  received:    { bg: '#E8F5E9', color: '#2E7D32' },
  cancelled:   { bg: '#FFEBEE', color: '#C62828' },
  failed:      { bg: '#FFEBEE', color: '#C62828' },
  passed:      { bg: '#E8F5E9', color: '#2E7D32' },
  available:   { bg: '#E8F5E9', color: '#2E7D32' },
  in_use:      { bg: '#E3F2FD', color: '#1565C0' },
  maintenance: { bg: '#FFF3E0', color: '#E65100' },
  unpaid:      { bg: '#FFF3E0', color: '#E65100' },
  partial:     { bg: '#E3F2FD', color: '#1565C0' },
  paid:        { bg: '#E8F5E9', color: '#2E7D32' },
  issued:      { bg: '#E0F2F1', color: '#00695C' },
  staging:     { bg: '#FFF8E1', color: '#F57F17' },
  rack:        { bg: '#E8F5E9', color: '#2E7D32' },
  inactive:    { bg: '#F5F5F5', color: '#9E9E9E' },
};

export function Badge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: '#F5F5F5', color: '#666' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 700, background: s.bg, color: s.color,
      textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  loading?: boolean;
}
export function Btn({ variant = 'primary', size = 'md', loading, children, style, ...props }: BtnProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6,
    fontWeight: 600, border: 'none', cursor: props.disabled || loading ? 'not-allowed' : 'pointer',
    opacity: props.disabled || loading ? 0.55 : 1, transition: 'opacity .15s',
    padding: size === 'sm' ? '4px 10px' : '8px 16px',
    fontSize: size === 'sm' ? 12 : 13,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--primary)',   color: '#fff' },
    secondary: { background: 'var(--border)',    color: 'var(--text)' },
    danger:    { background: 'var(--danger)',     color: '#fff' },
    ghost:     { background: 'transparent',       color: 'var(--text-muted)', border: '1px solid var(--border)' },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)', ...style,
    }}>
      {children}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, color, icon, danger }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode; danger?: boolean;
}) {
  const resolvedColor = color ?? (danger ? 'var(--danger)' : 'var(--primary)');
  return (
    <Card style={{ padding: 20, minWidth: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        {icon && <span style={{ color: resolvedColor, opacity: 0.7 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: resolvedColor, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </Card>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table({ cols, rows, onRow }: {
  cols: { key: string; label: string; render?: (row: any) => React.ReactNode; width?: number }[];
  rows: any[];
  onRow?: (row: any) => void;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border)' }}>
            {cols.map((c) => (
              <th key={c.key} style={{
                padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase',
                letterSpacing: 0.4, whiteSpace: 'nowrap', width: c.width,
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>No records found</td></tr>
          ) : rows.map((row, i) => (
            <tr key={row.id ?? i}
              onClick={() => onRow?.(row)}
              style={{
                borderBottom: '1px solid var(--border)',
                cursor: onRow ? 'pointer' : undefined,
                background: 'var(--surface)',
              }}
              onMouseEnter={(e) => { if (onRow) (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
              onMouseLeave={(e) => { if (onRow) (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
            >
              {cols.map((c) => (
                <td key={c.key} style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 520 }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, width, maxWidth: '95vw',
        maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow-md)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────
export function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</label>
      {children}
      {error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{error}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
  borderRadius: 6, fontSize: 13, color: 'var(--text)', background: 'var(--surface)',
  outline: 'none',
};
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} style={{ ...inputStyle, ...props.style }} {...props} />
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ children, ...props }, ref) => (
    <select ref={ref} style={{ ...inputStyle, ...props.style }} {...props}>{children}</select>
  )
);
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => <textarea ref={ref} style={{ ...inputStyle, minHeight: 80, resize: 'vertical', ...props.style }} {...props} />
);
Textarea.displayName = 'Textarea';

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, color = 'var(--primary)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin .7s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity=".25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────
export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{title}</h1>
        {sub && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

// ─── Alert ────────────────────────────────────────────────────────────────────
export function Alert({ type = 'error', message }: { type?: 'error' | 'success' | 'info'; message: string }) {
  const colors = {
    error:   { bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: '#FFCDD2' },
    success: { bg: 'var(--success-bg)', color: 'var(--success)', border: '#C8E6C9' },
    info:    { bg: 'var(--info-bg)',    color: 'var(--info)',    border: '#BBDEFB' },
  };
  const c = colors[type];
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 6, background: c.bg,
      color: c.color, fontSize: 13, border: `1px solid ${c.border}`,
      marginBottom: 12,
    }}>{message}</div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description }: { icon?: string; title: string; description?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
      {icon && <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>}
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {description && <div style={{ fontSize: 13 }}>{description}</div>}
    </div>
  );
}
