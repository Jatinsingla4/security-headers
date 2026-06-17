import React, { useState } from 'react';

export default function Dashboard() {
  const [isScanning, setIsScanning] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const stats = [
    { label: 'Safety Score', value: scanResult ? '98/100' : '—', trend: scanResult ? '+2%' : null, color: 'var(--success)' },
    { label: 'Total Links Scanned', value: scanResult ? scanResult.totalLinks.toString() : '0', trend: null, color: 'var(--accent-primary)' },
    { label: 'Broken Links', value: scanResult ? scanResult.summary.broken.toString() : '0', trend: null, color: 'var(--danger)' },
    { label: 'Active Redirects', value: scanResult ? scanResult.summary.redirected.toString() : '0', trend: null, color: 'var(--warning)' },
  ];

  const handleScan = async () => {
    if (!targetUrl) return;
    setError(null);
    setIsScanning(true);
    
    try {
      const response = await fetch('/api/trpc/startScan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: targetUrl }),
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || 'Scan failed');
      
      setScanResult(data.result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Section */}
      <div className="flex justify-between items-center glass-panel p-6">
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Security Headers Status</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {scanResult ? `Last scanned: Just now` : 'Enter a URL to start scanning'}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <input 
              type="text" 
              placeholder="https://example.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="glass-panel"
              style={{ 
                width: '100%', 
                padding: '0.875rem 1rem', 
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.925rem'
              }}
            />
          </div>
          <button 
            className="btn-primary"
            onClick={handleScan}
            disabled={isScanning || !targetUrl}
            style={{ 
              opacity: (isScanning || !targetUrl) ? 0.7 : 1, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              padding: '0.875rem 1.75rem',
              fontSize: '1rem',
              whiteSpace: 'nowrap'
            }}
          >
            {isScanning ? (
              <>
                <div className="spinner" />
                Scanning...
              </>
            ) : (
              'Trigger Live Scan'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="animate-fade-in" style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.875rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {stats.map((stat, i) => (
          <div key={i} className="glass-panel p-6" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Subtle glow */}
            <div 
              style={{ 
                position: 'absolute', 
                top: '-20px', 
                right: '-20px', 
                width: '100px', 
                height: '100px', 
                background: stat.color, 
                filter: 'blur(50px)', 
                opacity: 0.1,
                borderRadius: '50%'
              }} 
            />
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.75rem' }}>
              {stat.label}
            </p>
            <div className="flex items-center gap-4">
              <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {stat.value}
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: stat.color, backgroundColor: `${stat.color}20`, padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="glass-panel p-6" style={{ minHeight: '300px' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>Recent Scan Highlights</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {scanResult ? (
            scanResult.results.filter((r: any) => r.status !== 'healthy').slice(0, 5).map((result: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: result.status === 'broken' ? 'var(--danger)' : 'var(--warning)' }}></div>
                  <div>
                    <p style={{ fontWeight: 500 }}>{result.status === 'broken' ? 'Broken Link Found' : 'Redirect Detected'}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{result.url}</p>
                  </div>
                </div>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{result.statusCode}</span>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No scan data available. Start a scan to see security events.
            </div>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          width: 16px; 
          height: 16px; 
          border: 2px solid rgba(255,255,255,0.3); 
          border-top-color: white; 
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
      `}} />
    </div>
  );
}
