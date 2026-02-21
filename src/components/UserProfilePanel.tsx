import { useState } from 'react';
import { useUserProfile } from '../hooks/useUserProfile';
import './UserProfilePanel.css';

export function UserProfilePanel() {
  const { profile, loading, error, updateDisplayName, updatePhotoURL, updateProfile } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState(profile?.preferences?.theme || 'light');
  const [notifications, setNotifications] = useState(profile?.preferences?.notifications !== false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (displayName !== profile?.displayName) {
        await updateDisplayName(displayName);
      }
      if (photoURL !== profile?.photoURL) {
        await updatePhotoURL(photoURL);
      }
      await updateProfile({
        preferences: {
          theme: theme as 'light' | 'dark',
          notifications,
          language: profile?.preferences?.language || 'en',
        },
      } as any);

      setIsEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-panel">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-panel">
        <p>No profile found</p>
      </div>
    );
  }

  return (
    <div className="profile-panel">
      <div className="profile-header">
        <h2>User Profile</h2>
        <button
          onClick={() => {
            setIsEditing(!isEditing);
            setDisplayName(profile.displayName);
            setPhotoURL(profile.photoURL || '');
            setTheme(profile.preferences?.theme || 'light');
            setNotifications(profile.preferences?.notifications !== false);
          }}
          className="edit-button"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {error && <div className="profile-error">{error}</div>}

      <div className="profile-section">
        <div className="profile-field">
          <label>Email</label>
          <input type="email" value={profile.email} disabled className="disabled-input" />
        </div>

        <div className="profile-field">
          <label>Display Name</label>
          <input
            type="text"
            value={isEditing ? displayName : profile.displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={!isEditing}
            className={isEditing ? '' : 'disabled-input'}
          />
        </div>

        <div className="profile-field">
          <label>Photo URL</label>
          <input
            type="url"
            value={isEditing ? photoURL : profile.photoURL || ''}
            onChange={(e) => setPhotoURL(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            disabled={!isEditing}
            className={isEditing ? '' : 'disabled-input'}
          />
          {photoURL && (
            <div className="photo-preview">
              <img src={photoURL} alt="Profile" />
            </div>
          )}
        </div>

        <div className="profile-field">
          <label>Theme</label>
          <select
            value={isEditing ? theme : profile.preferences?.theme || 'light'}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
            disabled={!isEditing}
            className={isEditing ? '' : 'disabled-input'}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="profile-checkbox">
          <label>
            <input
              type="checkbox"
              checked={isEditing ? notifications : profile.preferences?.notifications !== false}
              onChange={(e) => setNotifications(e.target.checked)}
              disabled={!isEditing}
            />
            Enable Notifications
          </label>
        </div>
      </div>

      {isEditing && (
        <button onClick={handleSave} disabled={isSaving} className="save-button">
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      )}

      <div className="profile-meta">
        <p>
          <small>Created: {new Date(profile.createdAt).toLocaleDateString()}</small>
        </p>
        <p>
          <small>Updated: {new Date(profile.updatedAt).toLocaleDateString()}</small>
        </p>
      </div>
    </div>
  );
}
