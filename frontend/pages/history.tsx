import React from 'react';

export default function History() {
  const reports = [
    { id: '1', date: '2026-04-07 10:10', url: 'https://securityheaders.com', status: 'completed', links: 32, broken: 1 },
    { id: '2', date: '2026-04-06 14:22', url: 'https://example.com', status: 'completed', links: 12, broken: 0 },
    { id: '3', date: '2026-04-06 09:15', url: 'https://testsite.org', status: 'failed', links: 0, broken: 0 },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="flex justify-between items-center glass-panel p-6">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Scan History</h1>
          <p style={{ color: 'var(--text-secondary)' }}>View past crawl reports from R2 Storage</p>
        </div>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Date</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Target URL</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Total Links</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Broken</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <td style={{ padding: '1rem 1.5rem' }}>{report.date}</td>
                <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>{report.url}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '12px', 
                    fontSize: '0.75rem', 
                    fontWeight: 600,
                    backgroundColor: report.status === 'completed' ? 'var(--success)20' : 'var(--danger)20',
                    color: report.status === 'completed' ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {report.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '1rem 1.5rem' }}>{report.links}</td>
                <td style={{ padding: '1rem 1.5rem', color: report.broken > 0 ? 'var(--danger)' : 'inherit' }}>{report.broken}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>View JSON</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
