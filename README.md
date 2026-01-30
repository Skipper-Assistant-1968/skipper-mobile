# Skipper Mobile ⚓

Mobile companion app for Skipper, Clark's AI assistant.

**Philosophy**: Mobile is for triage and communication. Desktop is for deep work.

## Quick Start

```bash
npm install
npm run dev
```

## Tech Stack

- **Phase 1 (MVP)**: PWA with React + TypeScript
- **Phase 2**: React Native for iOS/Android
- **Auth**: Tailscale identity verification
- **Backend**: Extends existing Skipper API (port 3030)

## Features

| Feature | MVP | Phase 2 | Phase 3 |
|---------|-----|---------|---------|
| 🗨️ Chat with Skipper | ✅ Text | 🎤 Voice | Full TTS |
| 📋 Kanban Board | 👀 Read-only | ✏️ Edit | 🎯 Priority views |
| 📺 YouTube Digests | 📖 Browse | 🔥 Hot topics | 🎙️ Audio summaries |
| 🤖 Agent Dashboard | — | 👀 Status | ⏸️ Control |
| 📊 Activity Log | — | 📜 Basic | 🔔 Smart alerts |

## Project Structure

```
skipper-mobile/
├── docs/               # Architecture & design docs
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks
│   ├── api/            # API client
│   ├── store/          # State management
│   └── utils/          # Helpers
├── public/             # Static assets
└── tests/              # Test files
```

## Development Timeline

- **Weeks 1-4**: MVP (chat, read-only kanban, digests)
- **Weeks 5-8**: Enhanced features + React Native
- **Weeks 9-12**: Advanced features + polish

## Links

- [Architecture & Planning](./docs/ARCHITECTURE.md)
- [Skipper Brain (Tasks)](https://github.com/Skipper-Assistant-1968/skipper-brain)

---

*Built for quick access while fishing 🎣*
