import type { ReactNode } from 'react';

interface StudentAccessShellProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  maxWidthClassName?: string;
  contentWidthClassName?: string;
}

export function StudentAccessShell({
  icon,
  title,
  subtitle,
  children,
  maxWidthClassName = 'max-w-xl',
  contentWidthClassName = 'max-w-xl',
}: StudentAccessShellProps) {
  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(circle at top, #2b2257 0%, #17152b 42%, #0a0b14 100%)',
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.03), transparent 35%, transparent 65%, rgba(255,255,255,0.02))',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
      </div>

      <div className={`relative w-full ${maxWidthClassName}`}>
        <div
          className="bg-white px-8 py-10 md:px-12 md:py-12"
          style={{
            borderRadius: '34px',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 35px 120px rgba(2,6,23,0.55)',
          }}
        >
          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center text-indigo-600"
              style={{
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #eef2ff, #ede9fe)',
                boxShadow: '0 10px 30px rgba(99,102,241,0.18)',
              }}
            >
              {icon}
            </div>
            <h1
              className="mx-auto text-3xl md:text-4xl font-bold tracking-tight text-slate-800 leading-tight"
              style={{ maxWidth: '760px' }}
            >
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-3 text-base text-slate-500">
                {subtitle}
              </div>
            ) : null}
          </div>

          <div className={`mx-auto w-full ${contentWidthClassName}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
