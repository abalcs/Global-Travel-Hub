import { useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { saveReport } from '../services/firestoreService';
import './FirestoreSavePanel.css';

interface FirestoreSavePanelProps {
  metricsData?: any[];
  reportName?: string;
  reportType?: string;
  onSaveComplete?: (reportId: string) => void;
}

export function FirestoreSavePanel({
  metricsData,
  reportName = 'Untitled Report',
  reportType = 'metrics',
  onSaveComplete,
}: FirestoreSavePanelProps) {
  const { user } = useAuthContext();
  const [name, setName] = useState(reportName);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="save-panel-container">
        <p className="save-panel-message">Please log in to save reports</p>
      </div>
    );
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = async () => {
    if (!metricsData || metricsData.length === 0) {
      setError('No data to save. Please upload files first.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const reportId = await saveReport(user.uid, {
        name: name || 'Untitled Report',
        type: reportType,
        description,
        data: metricsData,
        tags: tags.length > 0 ? tags : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      setSuccess(`Report saved successfully! ID: ${reportId}`);
      setName('');
      setDescription('');
      setTags([]);

      if (onSaveComplete) {
        onSaveComplete(reportId);
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save report';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="save-panel">
      <div className="save-panel-header">
        <h3>Save to Firestore</h3>
        <p className="save-panel-subtitle">Saving as: {user.email}</p>
      </div>

      {error && <div className="save-panel-error">{error}</div>}
      {success && <div className="save-panel-success">{success}</div>}

      <div className="save-panel-form">
        <div className="form-group">
          <label htmlFor="report-name">Report Name</label>
          <input
            id="report-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Q1 2024 Sales Report"
            disabled={isSaving}
          />
        </div>

        <div className="form-group">
          <label htmlFor="report-desc">Description (optional)</label>
          <textarea
            id="report-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes about this report..."
            rows={3}
            disabled={isSaving}
          />
        </div>

        <div className="form-group">
          <label>Tags (optional)</label>
          <div className="tag-input-group">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              disabled={isSaving}
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={isSaving || !tagInput.trim()}
              className="add-tag-button"
            >
              Add
            </button>
          </div>

          {tags.length > 0 && (
            <div className="tags-container">
              {tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    disabled={isSaving}
                    className="remove-tag"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="form-group data-summary">
          <label>Data Summary</label>
          <div className="summary-box">
            <p>
              <strong>Records:</strong> {metricsData?.length || 0}
            </p>
            <p>
              <strong>Report Type:</strong> {reportType}
            </p>
            <p>
              <strong>Size:</strong> {(JSON.stringify(metricsData).length / 1024).toFixed(2)} KB
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="save-button"
        >
          {isSaving ? '💾 Saving...' : '💾 Save Report to Firestore'}
        </button>
      </div>
    </div>
  );
}
