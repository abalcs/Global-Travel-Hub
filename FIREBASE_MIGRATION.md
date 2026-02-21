# Firebase Integration - Migration Guide

## What's Been Created

### 1. Configuration (`src/firebase.config.ts`)
- Firebase initialization with environment variables
- Auth, Firestore, and Storage setup
- Ready to use after adding `.env.local` credentials

### 2. Services

#### Firestore Service (`src/services/firestoreService.ts`)
- CRUD operations for uploads, teams, seniors, new hires
- Upload records with timestamps and audit trail
- Firestore schema helper functions
- Error handling and logging

#### Auth Service (`src/services/authService.ts`)
- `signUp(email, password)` - Create new user
- `login(email, password)` - Sign in existing user
- `logout()` - Sign out
- `getCurrentUser()` - Get current auth user
- `onAuthChange(callback)` - Listen for auth state changes

### 3. React Integration

#### Firebase Auth Context (`src/contexts/FirebaseAuthContext.tsx`)
- `FirebaseAuthProvider` - Wrap your app with this
- `useFirebaseAuth()` - Hook to access user & logout
- Automatic auth state management

#### Sync Hooks (`src/hooks/useFirebaseSync.ts`)
- `useFirebaseTeams()` - Sync teams with Firestore
- `useFirebaseSeniors()` - Sync seniors with Firestore
- `useFirebaseNewHires()` - Sync new hires with Firestore
- All hooks include localStorage fallback for offline support

## Integration Steps

### Step 1: Add Environment Variables

1. Copy `.env.example` to `.env.local`
2. Go to [Firebase Console](https://console.firebase.google.com)
3. Select/create your project
4. Click "Project Settings" (gear icon)
5. Scroll to "Your apps" → click "Web app"
6. Copy the config and paste into `.env.local`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXXXX
```

### Step 2: Update App.tsx

Replace the existing setup with:

```tsx
import { FirebaseAuthProvider } from './contexts/FirebaseAuthContext'

function App() {
  return (
    <FirebaseAuthProvider>
      {/* Your existing app component */}
    </FirebaseAuthProvider>
  )
}
```

### Step 3: Firestore Security Rules

In Firebase Console → Firestore → Rules, set:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /uploads/{document=**} {
      allow read, write: if request.auth.uid == resource.data.userId
    }
    
    match /configurations/{userId} {
      allow read, write: if request.auth.uid == userId
    }
  }
}
```

### Step 4: Replace Storage Calls

Old code (localStorage):
```tsx
const teams = loadTeams();
saveTeams(newTeams);
```

New code (Firestore with fallback):
```tsx
import { useFirebaseTeams } from './hooks/useFirebaseSync'

const { teams, saveTeams, loading } = useFirebaseTeams()

if (loading) return <div>Loading...</div>

// Use teams and saveTeams normally
```

### Step 5: Save Uploads

When processing new files:

```tsx
import * as firestore from './services/firestoreService'
import { useFirebaseAuth } from './contexts/FirebaseAuthContext'

const { user } = useFirebaseAuth()

// After processing files
if (user) {
  await firestore.saveUpload(user.uid, {
    dateRange: { start: '2026-02-01', end: '2026-02-21' },
    fileName: 'gtt-reports-2026-02-21.xlsx',
    status: 'success',
    metrics: calculatedMetrics,
    timeseries: timeSeriesData,
  })
}
```

## File Structure

```
src/
├── firebase.config.ts          # Firebase initialization
├── services/
│   ├── authService.ts         # Auth functions
│   └── firestoreService.ts    # Database CRUD
├── contexts/
│   └── FirebaseAuthContext.tsx # Auth provider
├── hooks/
│   └── useFirebaseSync.ts     # Data sync hooks
└── ...existing components
```

## What Happens Next

1. Users will be prompted to sign up/login
2. Teams, seniors, new hires are synced from Firestore
3. Upload history is stored with timestamps
4. Multi-user support works automatically
5. Offline mode falls back to localStorage
6. All changes are audited with timestamps

## Testing

1. Deploy to Firebase Hosting: `firebase deploy`
2. Sign up with test account
3. Create teams/seniors/new hires
4. Verify in Firebase Console → Firestore
5. Log in from another browser → verify data syncs
6. Go offline, make changes, go online → verify sync

## Benefits Achieved

✅ Persistent data across devices
✅ Multi-user support
✅ Upload audit trail with timestamps
✅ Offline fallback
✅ Real-time sync
✅ Secure database rules
✅ No backend server needed

## Deployment

When ready to deploy to production:

```bash
npm run build
firebase deploy
```

The app will be live at: `https://your-project-id.web.app`
