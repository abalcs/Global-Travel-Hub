# Firebase Complete Setup Guide

## ✅ What's Been Set Up

### 1. Authentication
- **Email/Password Auth** — Users can sign up and log in with email
- **Persistent Sessions** — Users stay logged in across browser sessions
- **Protected Routes** — App requires login to access
- **User Profiles** — Firestore profiles auto-created on signup

### 2. Firestore Database
- **User Profiles** (`/users/{uid}`)
  - email, displayName, photoURL
  - preferences (theme, notifications, language)
  - createdAt, updatedAt timestamps
- **User Reports** (`/users/{uid}/reports/`)
- **User Uploads** (`/users/{uid}/uploads/`)
- **Security Rules** — Users can only access their own data

### 3. Firestore Hooks
- **useFirestoreDoc** — Read/write/update single documents with real-time sync
- **useFirestoreQuery** — Query documents with filtering
- **useUserProfile** — Manage user profile (name, photo, settings)

### 4. UI Components
- **AuthUI** — Beautiful login/signup forms
- **UserProfilePanel** — Edit profile, preferences, theme settings
- **LogoutButton** — In app header (shows email + logout)

### 5. Deployment
- **firebase.json** — Hosting configuration
- **deploy.sh** — Automated build + deploy script
- **npm run deploy:firebase** — One-command deployment

---

## 🚀 Quick Start

### First Time Setup

1. **Install Firebase CLI** (if you haven't already):
   ```bash
   npm install -g firebase-tools
   ```

2. **Initialize Firebase in your project**:
   ```bash
   cd gtt-firebase-integration
   firebase login
   firebase init hosting
   # Select your project
   # Build folder: dist
   # Single page app: yes
   ```

3. **Deploy Firestore Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Deploy Your App

```bash
npm run deploy:firebase
```

Or manually:

```bash
npm run build
firebase deploy --only hosting
```

---

## 📚 Using Firestore Hooks

### Read/Write a User Document

```typescript
import { useFirestoreDoc } from './hooks/useFirestore';

function MyComponent() {
  const { data, loading, error, set, update } = useFirestoreDoc('users/123');

  return (
    <div>
      {loading ? 'Loading...' : data?.email}
      <button onClick={() => update({ displayName: 'New Name' })}>
        Update Name
      </button>
    </div>
  );
}
```

### Query Multiple Documents

```typescript
import { useFirestoreQuery } from './hooks/useFirestore';

function ReportsList() {
  const { data: reports, loading } = useFirestoreQuery('users/123/reports');

  return (
    <ul>
      {reports.map(report => (
        <li key={report.id}>{report.name}</li>
      ))}
    </ul>
  );
}
```

### Manage User Profile

```typescript
import { useUserProfile } from './hooks/useUserProfile';

function ProfileEditor() {
  const { profile, updateDisplayName, updatePhotoURL, updateProfile } = useUserProfile();

  return (
    <div>
      <button onClick={() => updateDisplayName('John Doe')}>
        Update Name
      </button>
      <button onClick={() => updatePhotoURL('https://...')}>
        Update Photo
      </button>
    </div>
  );
}
```

---

## 🔐 Firestore Security Rules

Rules are auto-generated and already deployed. They ensure:

✅ **Users can only access their own data**
✅ **Profiles auto-sync with authentication**
✅ **Timestamps auto-updated**
✅ **System collections admin-only**

View/edit rules at: `firestore.rules` in this directory

---

## 🎨 Customization

### Change Authentication Methods

Add to `firebase.config.ts`:

```typescript
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}
```

### Store Reports in Firestore

```typescript
// In your app component
import { useFirestoreDoc } from './hooks/useFirestore';

const { set: saveReport } = useFirestoreDoc(
  `users/${user.uid}/reports/report-1`
);

await saveReport({
  name: 'Q1 Sales Report',
  data: [...],
  createdAt: Date.now(),
});
```

### Real-Time Sync

All Firestore hooks use real-time listeners by default. Changes sync instantly across devices.

---

## 📊 File Structure

```
src/
├── hooks/
│   ├── useAuth.ts              # Auth state & actions
│   ├── useFirestore.ts         # Firestore read/write/query
│   └── useUserProfile.ts       # User profile management
├── contexts/
│   └── AuthContext.tsx         # Auth context provider
├── components/
│   ├── AuthUI.tsx              # Login/signup form
│   ├── UserProfilePanel.tsx    # Profile editor
│   └── LogoutButton.tsx        # In App.tsx header
├── firebase.config.ts          # Firebase config (from env)
└── main.tsx                    # AuthProvider wrapper

firebase.json                   # Hosting config
firestore.rules                 # Firestore security rules
.env.local                      # Firebase credentials
```

---

## 🐛 Troubleshooting

### "Cannot read property 'email' of null"
- User not authenticated. Check AuthUI is showing and sign up/login works.

### Firestore operations failing
- Check Firestore security rules: `firebase deploy --only firestore:rules`
- Check Firestore is enabled in Firebase Console

### Deploy fails
- Run `firebase login` again
- Make sure Firebase CLI is installed: `npm install -g firebase-tools`
- Check you're in the right directory (has firebase.json)

### Real-time updates not working
- Check browser console for errors
- Verify Firestore listener is active (should see `onSnapshot` calls)
- Check network tab for blocked requests

---

## 🎯 Next Steps

1. **Add more authentication methods** (Google, GitHub, etc.)
2. **Create Firestore collections for reports, uploads, etc.**
3. **Add offline persistence** (`enableIndexedDbPersistence`)
4. **Set up Firebase Storage** for file uploads
5. **Add email verification** before app access

---

## 📞 Support

- **Firebase Docs**: https://firebase.google.com/docs
- **Firestore Docs**: https://firebase.google.com/docs/firestore
- **GitHub Issues**: Report bugs here

---

**Last Updated**: 2026-02-21
**Status**: ✅ Production Ready
