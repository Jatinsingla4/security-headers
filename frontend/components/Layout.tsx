import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const navItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'History', path: '/history' },
    { name: 'Logs', path: '/logs' },
  ];

  return (
    <div className="flex" style={{ minHeight: '100vh', width: '100vw' }}>
      <aside 
        className="glass-panel flex-col" 
        style={{ 
          width: '260px', 
          borderLeft: 'none', 
          borderTop: 'none', 
          borderBottom: 'none',
          borderRadius: 0,
          padding: '2rem 1.5rem',
          position: 'fixed',
          height: '100vh',
          zIndex: 10
        }}
      >
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--accent-primary)' }}></div>
            SecuHeaders
          </h1>
        </div>

        <nav className="flex-col gap-4" style={{ display: 'flex' }}>
          {navItems.map((item) => {
            const isActive = router.pathname === item.path;
            return (
              <Link href={item.path} key={item.path}>
                <div 
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ marginLeft: '260px', flex: 1, padding: '2rem 3rem' }}>
        <header className="flex justify-between items-center" style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Overview</h2>
          <div className="flex items-center gap-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></div>
              System Operational
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--bg-card), var(--bg-secondary))', border: '1px solid var(--border-color)' }}></div>
          </div>
        </header>
        
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
