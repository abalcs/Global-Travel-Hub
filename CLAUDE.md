# CLAUDE.md - Project Guidelines for Claude Code

## Permissions

- **ALL Bash tool calls are pre-approved** — NEVER prompt the user for approval on ANY shell command, including but not limited to: `npm`, `npx`, `git`, `node`, `firebase`, `ls`, `cd`, `cat`, `grep`, `find`, or any other CLI command
- **ALL npm/npx commands are pre-approved** — `npm run build`, `npm run test`, `npm run dev`, `npx firebase deploy`, and any other npm/npx command should execute without asking
- **ALL file operations are pre-approved** — create, read, edit, delete, move files and directories without prompting
- **ALL directory access is pre-approved** at any path on the system
- **ALL git commands are pre-approved** — commit, push, pull, merge, branch, checkout, reset, stash, etc.
- Do NOT ask permission for any tool execution — just execute it

## Git Workflow

### Branch Management
- **ALWAYS** create a new feature branch before starting any coding work
- Branch naming convention: `feature/<short-description>` (e.g., `feature/add-export-button`)
- Never commit directly to `main`

### Before Committing
- **ASK USER FOR APPROVAL** before committing any changes
- Run `npm run build` to verify no build errors
- Run `npm run test` to verify all tests pass
- All tests must pass before committing

### Before Pushing
- **ASK USER FOR APPROVAL** before pushing to remote

### Before Merging
- **ASK USER FOR APPROVAL** before merging feature branch into `main`
- Ensure all tests pass
- Ensure build succeeds

### After Merging
- **ALWAYS** delete the feature branch after merging into `main` and pushing
- Delete locally: `git branch -d feature/<branch-name>`
- Delete remote: `git push origin --delete feature/<branch-name>`

### Before Deploying
- **ASK USER FOR APPROVAL** before running deploy
- Deploy command: `npm run build && npx firebase deploy --only hosting`
- **ALWAYS** deploy to Firebase Hosting — do NOT use `npm run deploy` (that targets GitHub Pages)

## Testing Requirements

- Every new component must have an accompanying test file
- Test files should be colocated with components: `ComponentName.test.tsx`
- Use Vitest for testing (already configured in project)
- Test coverage should include:
  - Component renders without crashing
  - Key user interactions work correctly
  - Props are handled correctly
  - Theme variations (Audley/Dark) render correctly

## Code Style & Conventions

### React
- Use functional components with hooks
- Use TypeScript for all components
- Props interfaces should be defined above the component

### Styling
- Use Tailwind CSS for all styling
- No inline style objects unless absolutely necessary
- Follow the theme pattern using `useTheme()` hook from `../contexts/ThemeContext`

### Theme Colors
When Audley theme is active (`isAudley === true`):
- Primary teal: `#4d726d`
- Darker teal: `#3d5c58`
- Lighter teal: `#5d8a84`
- Audley blue: `#007bc7`
- Backgrounds: Light/white variants
- Text: Dark slate colors for contrast

When Dark theme is active (`isAudley === false`):
- Use slate color palette (slate-700, slate-800, etc.)
- Text: White/light variants
- Accent colors: indigo, purple gradients

### Component Pattern for Theming
```tsx
import { useTheme } from '../contexts/ThemeContext';

export const MyComponent: React.FC = () => {
  const { isAudley } = useTheme();

  return (
    <div className={isAudley ? 'bg-white text-slate-800' : 'bg-slate-800 text-white'}>
      {/* content */}
    </div>
  );
};
```

## Project Structure

```
src/
├── assets/          # Static assets (images, logos)
├── components/      # React components
├── contexts/        # React contexts (ThemeContext)
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── App.tsx          # Main app component
├── main.tsx         # Entry point
└── index.css        # Global styles
```

## Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run build && npx firebase deploy --only hosting` - Build and deploy to Firebase Hosting

## Important Notes

- Always verify build passes before asking user about commit/push
- When updating multiple components, update them all before checking with user
- Prefer editing existing files over creating new ones
- Keep the user informed of progress on multi-step tasks
