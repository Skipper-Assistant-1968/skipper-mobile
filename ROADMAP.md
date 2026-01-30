# Skipper Mobile App - Development Roadmap
*Last updated: January 30, 2026*

## Overview

This roadmap tracks the development of the Skipper Mobile App from PWA to native app. 

**Goal:** Give Clark instant mobile access to his Skipper ecosystem - tasks, agents, digests, and real-time status.

**Approach:** PWA first (fast deployment), then React Native (enhanced experience).

---

## 📊 Issue Summary

| Phase | Issues | Status |
|-------|--------|--------|
| MVP (Weeks 1-4) | #1-14 | 🔵 In Planning |
| Phase 2 (Weeks 5-8) | #15-17 | ⚪ Not Started |
| Phase 3 (Weeks 9-12) | TBD | ⚪ Not Started |

---

## 🗓️ MVP Phase (Weeks 1-4)

### Week 1: Foundation
**Theme:** Project setup, auth, and core infrastructure

| Issue | Title | Type | Effort | Dependencies |
|-------|-------|------|--------|--------------|
| #1 | Set up React PWA with Vite + TypeScript | infra | 1 day | None |
| #2 | Implement Tailscale authentication | backend/infra | 2 days | None |
| #14 | Build mobile navigation shell and layout components | frontend | 1 day | #1 |
| #13 | Create backend API endpoints for mobile app | backend | 2 days | None |

**Week 1 Deliverable:** PWA shell installable on mobile, basic routing, auth working.

**Parallel Tracks:**
- **Frontend:** #1 → #14 (can start #14 after #1 complete)
- **Backend:** #2 + #13 (can run parallel)

---

### Week 2: Core Features - Chat & API
**Theme:** Chat interface and real-time communication

| Issue | Title | Type | Effort | Dependencies |
|-------|-------|------|--------|--------------|
| #3 | Build basic API client | frontend | 1 day | #1, #2 |
| #4 | Build chat interface (text only) | frontend | 2 days | #3, #14 |
| #12 | Implement WebSocket infrastructure | full-stack | 2 days | #13 |
| #9 | Live heartbeat indicator (always-listening) | full-stack | 2 days | #12, #13 |

**Week 2 Deliverable:** Can send/receive messages with Skipper, live connection status visible.

**Critical Path:** #1 → #3 → #4 (chat depends on API client)

---

### Week 3: Views - Tasks, Digests, Transparency
**Theme:** Information display screens

| Issue | Title | Type | Effort | Dependencies |
|-------|-------|------|--------|--------------|
| #5 | Build Kanban board view (read-only) | frontend | 2 days | #3, #14 |
| #6 | Build YouTube digest browser | frontend | 2 days | #3, #13 |
| #8 | Live status & work transparency system | full-stack | 3 days | #9, #12, #13 |

**Week 3 Deliverable:** View tasks and digests on mobile, see what Skipper is working on.

**Note:** #8 is larger - break into sub-tasks per issue comments.

---

### Week 4: Dashboard & Polish
**Theme:** Agent visibility, notifications, final MVP touches

| Issue | Title | Type | Effort | Dependencies |
|-------|-------|------|--------|--------------|
| #10 | Build Agent Dashboard UI | frontend | 2 days | #8, #9 |
| #11 | Build Activity Log screen | frontend | 2 days | #3, #13 |
| #7 | Implement push notifications | full-stack | 2 days | #12, #13 |

**Week 4 Deliverable:** Full MVP - all screens working, notifications enabled.

**MVP Success Test:** Clark can check tasks, read digests, chat with Skipper, and see agent status while on the boat.

---

## 🚀 Phase 2 (Weeks 5-8)

### Week 5-6: Enhanced Interaction

| Issue | Title | Type | Effort | Dependencies |
|-------|-------|------|--------|--------------|
| #16 | Task editing and creation from mobile | frontend | 3 days | #5 |
| #15 | Voice input/output integration | frontend | 4 days | #4 |

**Deliverable:** Full task management + hands-free voice interaction.

---

### Week 7-8: Native App

| Issue | Title | Type | Effort | Dependencies |
|-------|-------|------|--------|--------------|
| #17 | React Native app migration | full-stack | 8 days | All MVP issues |

**Deliverable:** Native iOS/Android apps with all features.

---

## 🎯 Phase 3 (Weeks 9-12) - Planned

Future issues to create:
- [ ] Advanced offline capabilities
- [ ] Geofenced notifications (boat vs office mode)
- [ ] Calendar integration
- [ ] AI-powered mobile summaries
- [ ] Apple Watch companion
- [ ] Google Assistant integration

---

## 🔗 Dependency Graph

```
                    ┌─────────┐
                    │   #1    │ PWA Setup
                    │ (infra) │
                    └────┬────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │   #14   │    │   #3    │    │   #2    │
    │  NavBar │    │   API   │    │  Auth   │
    └────┬────┘    └────┬────┘    └────┬────┘
         │              │              │
         │         ┌────┴────┐         │
         │         ▼         ▼         │
         │    ┌─────────┐┌─────────┐   │
         │    │   #4    ││   #5    │   │
         │    │  Chat   ││  Tasks  │   │
         │    └─────────┘└─────────┘   │
         │                             │
         └───────────┬─────────────────┘
                     ▼
              ┌─────────────┐
              │    #13      │ Backend APIs
              │  (backend)  │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │   #12   │ │   #6    │ │   #9    │
    │WebSocket│ │ Digest  │ │Heartbeat│
    └────┬────┘ └─────────┘ └────┬────┘
         │                       │
         ▼                       ▼
    ┌─────────┐            ┌─────────┐
    │   #8    │────────────│   #10   │
    │ Status  │            │ Agents  │
    └────┬────┘            └─────────┘
         │
         ▼
    ┌─────────┐
    │   #7    │ Push Notifications
    └─────────┘
```

---

## 📋 Quick Reference

### By Component

**Frontend Only:**
- #1 PWA Setup
- #3 API Client  
- #4 Chat Interface
- #5 Kanban Board
- #10 Agent Dashboard
- #11 Activity Log
- #14 Navigation Shell

**Backend Only:**
- #2 Tailscale Auth
- #13 Backend APIs

**Full Stack:**
- #6 YouTube Digest
- #7 Push Notifications
- #8 Work Transparency
- #9 Heartbeat
- #12 WebSocket

### Blockers to Watch

1. **#2 Tailscale Auth** - If Tailscale mobile SDK has issues, implement API key fallback early
2. **#12 WebSocket** - Mobile network reliability; build polling fallback
3. **#8 Work Transparency** - Requires Skipper behavioral changes (update AGENTS.md)

---

## ✅ Definition of Done

Each issue is complete when:
- [ ] Code merged to main
- [ ] Works on mobile device (iOS Safari + Android Chrome)
- [ ] Acceptance criteria in issue met
- [ ] No TypeScript errors
- [ ] Basic error handling in place

---

## 🏁 Milestones

| Milestone | Target | Success Criteria |
|-----------|--------|------------------|
| **PWA Shell** | Week 1 | Installable app with nav working |
| **Chat Working** | Week 2 | Send/receive messages with Skipper |
| **MVP Complete** | Week 4 | All 5 screens, notifications, can use while fishing |
| **Voice Ready** | Week 6 | Hands-free voice commands work |
| **Native Apps** | Week 8 | iOS TestFlight + Android APK |

---

## 📝 Notes

- **Agent-first architecture** (from ARCHITECTURE.md): Skipper stays in "listening" mode, delegates work to sub-agents. Mobile app should always show responsive status.
- **Work transparency** is a key differentiator - Discord "typing..." is not enough visibility.
- **Mobile is for triage and communication** - deep work stays on desktop.

---

*Roadmap maintained by: Skipper*  
*Review schedule: Weekly during active development*
