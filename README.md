# ⚓ Skipper Mobile

A progressive web app (PWA) companion for Skipper AI assistant.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Features

- **Mobile-first design** - Optimized for phone screens with safe area support
- **PWA installable** - Add to home screen for native-like experience
- **Dark theme** - Slate-900 background with Skipper branding
- **Bottom navigation** - 5 tabs: Chat, Tasks, Digests, Agents, Activity
- **Live status bar** - Shows gateway connection heartbeat

## Project Structure

```
src/
├── components/       # Shared UI components
│   ├── Navigation.tsx    # Bottom tab bar
│   ├── StatusBar.tsx     # Top status bar with heartbeat
│   └── PageContainer.tsx # Page wrapper with safe areas
├── pages/           # Route pages
│   ├── ChatPage.tsx      # Main chat interface
│   ├── TasksPage.tsx     # Task management
│   ├── DigestsPage.tsx   # News/digest feed
│   ├── AgentsPage.tsx    # Agent status/control
│   └── ActivityPage.tsx  # Activity log
├── hooks/           # React hooks
│   └── useHeartbeat.ts   # Gateway connection status
├── lib/             # Utilities
│   └── api.ts            # API client for gateway
├── App.tsx          # Main app with routing
├── main.tsx         # Entry point with providers
└── index.css        # Global styles + Tailwind
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **TanStack Query** - Data fetching
- **Framer Motion** - Animations
- **vite-plugin-pwa** - PWA support

## PWA Installation

The app is installable as a PWA:

1. Open in mobile browser
2. Tap "Add to Home Screen" (iOS Safari) or install prompt (Android Chrome)
3. App runs in standalone mode without browser chrome

## Environment Variables

Create `.env.local` for local overrides:

```env
VITE_GATEWAY_URL=http://localhost:3030
```

## Development

The app is designed as a shell that other agents can extend:

- Add new pages in `src/pages/`
- Add components in `src/components/`
- Add hooks in `src/hooks/`
- Add API methods in `src/lib/api.ts`

## Serving Externally

For testing on mobile devices on the same network:

```bash
npm run dev
# Access via http://<your-ip>:5173
```

Or use Tailscale/tunnel for external access.
