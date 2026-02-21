import { useState } from 'react';
import { useSharedReports, type SharedReport } from '../hooks/useSharedReports';
import './ReportsList.css';

export function ReportsList() {
  const { reports, loading, error } = useSharedReports();
  const [selectedReport, setSelectedReport] = useState<SharedReport | null>(null);

  console.log('🎯 ReportsList rendered:', { loading, reportCount: reports.length, error });

  if (loading) {
    return (
      <div className="reports-container">
        <p>⏳ Loading shared reports...</p>
        <p style={{ fontSize: '0.85em', color: '#888' }}>
          (Check console for detailed logs)
        </p>
      </div>
    );
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h3>GTT Shared Reports</h3>
        {reports.length > 0 && <span className="reports-count">{reports.length}</span>}
      </div>

      {error && (
        <div className="reports-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="reports-empty">
          <p>❌ No reports available yet.</p>
          {!error && (
            <p style={{ fontSize: '0.85em', color: '#888' }}>
              Check browser console (F12) for detailed diagnostic logs.
            </p>
          )}
        </div>
      ) : (
        <div className="reports-grid">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`report-card ${selectedReport?.id === report.id ? 'selected' : ''}`}
              onClick={() => setSelectedReport(report)}
            >
              <div className="report-card-header">
                <h4>{report.name}</h4>
                <span className="report-type">{report.type}</span>
              </div>

              {report.description && (
                <p className="report-description">{report.description}</p>
              )}

              <div className="report-meta">
                <small>
                  Records: {report.data?.length || 0}
                </small>
                {report.createdAt && (
                  <small>
                    Created: {new Date(
                      report.createdAt.toMillis?.() || report.createdAt
                    ).toLocaleDateString()}
                  </small>
                )}
              </div>

              {report.tags && report.tags.length > 0 && (
                <div className="report-tags">
                  {report.tags.map((tag) => (
                    <span key={tag} className="report-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedReport && (
        <div className="report-details">
          <div className="report-details-header">
            <h4>{selectedReport.name}</h4>
            <button
              onClick={() => setSelectedReport(null)}
              className="close-button"
            >
              ✕
            </button>
          </div>

          <div className="report-details-content">
            {selectedReport.description && (
              <div className="detail-section">
                <label>Description</label>
                <p>{selectedReport.description}</p>
              </div>
            )}

            <div className="detail-section">
              <label>Report Type</label>
              <p>{selectedReport.type}</p>
            </div>

            <div className="detail-section">
              <label>Total Records</label>
              <p>{selectedReport.data?.length || 0}</p>
            </div>

            {selectedReport.createdAt && (
              <div className="detail-section">
                <label>Created</label>
                <p>
                  {new Date(
                    selectedReport.createdAt.toMillis?.() || selectedReport.createdAt
                  ).toLocaleString()}
                </p>
              </div>
            )}

            {selectedReport.tags && selectedReport.tags.length > 0 && (
              <div className="detail-section">
                <label>Tags</label>
                <div className="detail-tags">
                  {selectedReport.tags.map((tag) => (
                    <span key={tag} className="detail-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                const json = JSON.stringify(selectedReport.data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${selectedReport.name}-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="export-button"
            >
              📥 Export as JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
