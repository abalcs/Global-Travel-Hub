import { useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { getReports, deleteReport } from '../services/firestoreService';
import './ReportsList.css';

interface Report {
  id?: string;
  name: string;
  type: string;
  description?: string;
  createdAt: any;
  updatedAt: any;
  tags?: string[];
  data: any[];
}

export function ReportsList() {
  const { user } = useAuthContext();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadReports = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getReports(user.uid);
        setReports(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load reports';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [user]);

  const handleDelete = async (reportId: string | undefined) => {
    if (!reportId || !user) return;

    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }

    setIsDeleting(reportId);
    try {
      await deleteReport(user.uid, reportId);
      setReports(reports.filter(r => r.id !== reportId));
      setSelectedReport(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
    } finally {
      setIsDeleting(null);
    }
  };

  if (!user) {
    return (
      <div className="reports-container">
        <p>Please log in to view reports</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="reports-container">
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h3>Saved Reports</h3>
        {reports.length > 0 && <span className="reports-count">{reports.length}</span>}
      </div>

      {error && <div className="reports-error">{error}</div>}

      {reports.length === 0 ? (
        <div className="reports-empty">
          <p>No reports yet. Upload files and save them to see them here!</p>
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
                  Created: {new Date(report.createdAt.toMillis?.() || report.createdAt).toLocaleDateString()}
                </small>
                <small>
                  Records: {report.data?.length || 0}
                </small>
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

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(report.id);
                }}
                disabled={isDeleting === report.id}
                className="delete-button"
              >
                {isDeleting === report.id ? 'Deleting...' : '🗑️ Delete'}
              </button>
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
              <label>Type</label>
              <p>{selectedReport.type}</p>
            </div>

            <div className="detail-section">
              <label>Records</label>
              <p>{selectedReport.data?.length || 0}</p>
            </div>

            <div className="detail-section">
              <label>Created</label>
              <p>
                {new Date(selectedReport.createdAt.toMillis?.() || selectedReport.createdAt).toLocaleString()}
              </p>
            </div>

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
                a.download = `${selectedReport.name}.json`;
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
