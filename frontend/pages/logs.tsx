import React from 'react';

export default function Logs() {
  const logs = [
    { id: 1, type: 'broken_link', path: '/api/missing', method: 'GET', ip: '192.168.1.1', date: '2026-04-07 10:11:00' },
    { id: 2, type: 'unauthorized', path: '/api/admin', method: 'POST', ip: '10.0.0.5', date: '2026-04-07 09:45:12' },
    { id: 3, type: 'rate_limited', path: '/api/upload', method: 'PUT', ip: '172.16.0.4', date: '2026-04-06 23:14:05' },
    { id: 4, type: 'broken_link', path: '/favicon.ico', method: 'GET', ip: '192.168.1.1', date: '2026-04-06 21:03:00' },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="flex justify-between items-center glass-panel p-6">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Security Logs</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Real-time database logs from D1</p>
        </div>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Timestamp</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Type</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Path</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Method</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              let typeColor = 'var(--text-primary)';
              if (log.type === 'unauthorized') typeColor = 'var(--danger)';
              if (log.type === 'rate_limited') typeColor = 'var(--warning)';
              if (log.type === 'broken_link') typeColor = 'var(--accent-primary)';

              return (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem' }}>{log.date}</td>
                  <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: typeColor }}>{log.type.replace('_', ' ').toUpperCase()}</td>
                  <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace' }}>{log.path}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                      {log.method}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>{log.ip}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
