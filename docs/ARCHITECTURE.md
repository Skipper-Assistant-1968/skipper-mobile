# Skipper Mobile App - Architecture & Planning
*Created: January 30, 2026*

## Executive Summary

Design a mobile app that gives Clark instant access to his Skipper ecosystem while fishing, traveling, or between meetings. **Mobile-first approach**: Start with PWA for immediate deployment, then native apps for enhanced functionality.

**Core principle**: A busy executive needs information fast and actions to be frictionless. Every screen should answer "What do I need to know?" and "What can I do about it?" in 3 seconds.

---

## 1. Architecture Document

### Frontend Technology Decision Matrix

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **PWA (Phase 1)** | ✅ Instant deployment<br>✅ Share codebase with web<br>✅ Push notifications<br>✅ Offline capable | ❌ Limited native features<br>❌ iOS Safari restrictions | **Start here** |
| **React Native (Phase 2)** | ✅ Single codebase<br>✅ Native performance<br>✅ Clark's team familiar with React | ❌ Bridge overhead<br>❌ Platform-specific bugs | **Next step** |
| **Flutter (Alternative)** | ✅ High performance<br>✅ Pixel-perfect UI | ❌ New language (Dart)<br>❌ Larger learning curve | **Skip for now** |

**Decision**: Start with PWA using React + TypeScript, upgrade to React Native in Phase 2.

### Backend APIs

#### Existing APIs (Extend)
```
GET  /api/tasks              # Kanban board data ✅ EXISTS
POST /api/tasks              # Create task ✅ EXISTS  
PUT  /api/tasks/:id          # Update task ✅ EXISTS
GET  /api/digests/youtube    # YouTube summaries (NEW)
```

#### New APIs Needed
```
# Chat & Messages
GET  /api/chat/history          # Recent conversations
POST /api/chat/message          # Send message to Skipper
GET  /api/chat/stream           # WebSocket for live chat

# Agent Management  
GET  /api/agents                # Active agents list
GET  /api/agents/:id            # Agent details & status
POST /api/agents/:id/interrupt  # Stop/modify agent

# Activity Feed
GET  /api/activity              # Combined activity log
GET  /api/activity/notifications # Unread items

# Authentication
POST /api/auth/tailscale        # Tailscale identity verification
GET  /api/auth/status           # Current user session
```

### Authentication Strategy

**Primary**: Tailscale identity verification
- Clark already uses Tailscale for secure access
- Mobile app authenticates via Tailscale client
- Zero additional passwords/tokens to manage

**Fallback**: API key for offline/limited access
- Read-only access to digests and activity log
- No task modification or agent control

**Implementation**:
```typescript
// Mobile app checks Tailscale connection
const auth = await TailscaleAuth.verify()
if (auth.isValid) {
  // Full access mode
  initializeFullApp(auth.token)
} else {
  // Offline/limited mode
  initializeLimitedApp(fallbackKey)
}
```

### Real-Time Updates

**WebSocket Architecture**:
```
Mobile App ←→ WebSocket Server ←→ Skipper Agent System
```

**Update Types**:
- Agent status changes (spawned, completed, failed)
- New chat messages from Skipper
- Task updates (Kanban board changes)
- New YouTube digests available
- System alerts/notifications

**Connection Management**:
- Auto-reconnect on network changes
- Graceful degradation to polling when WebSocket unavailable
- Background sync when app returns from background

---

## 2. Feature Breakdown

### 🗨️ Chat Interface

**Primary Use Case**: "Talk to Skipper like Discord, but mobile-optimized"

**Core Features**:
- Send text messages to Skipper
- Receive responses with typing indicators
- Voice-to-text input (especially for fishing/driving)
- Voice responses from Skipper (TTS)

**Data Model**:
```typescript
interface ChatMessage {
  id: string
  content: string
  sender: 'clark' | 'skipper'
  timestamp: Date
  type: 'text' | 'voice' | 'system'
  metadata?: {
    voiceUrl?: string
    agentId?: string    // If from spawned agent
    priority?: 'low' | 'normal' | 'urgent'
  }
}
```

**API Endpoints**:
```
GET  /api/chat/history?limit=50     # Recent messages
POST /api/chat/message              # Send message
WS   /api/chat/stream               # Live updates
```

**Wireframe (Text-based)**:
```
┌─────────────────────────┐
│ 🏠 ⚓ Skipper         📱 │
├─────────────────────────┤
│                         │
│ 🤖 Hey Clark! Your      │
│    morning digest is    │
│    ready. 3 important   │
│    videos today.        │
│    [2 mins ago]        │
│                         │
│           You 👨‍💼        │
│     Any urgent tasks    │
│     for the boat? 🎣   │
│     [Just now]         │
│                         │
│ 🎤 [Voice] ━━━━━━━━ 📤   │
│ [Type a message...]     │
└─────────────────────────┘
```

### 📋 Kanban Board

**Primary Use Case**: "Quick task overview while mobile - what's urgent?"

**Mobile Optimization**:
- Horizontal scroll through columns
- Swipe gestures for quick status changes
- Tap to expand task details
- Voice commands: "Add task: Call VIO accountant"

**Data Model** (extends existing):
```typescript
interface MobileTask {
  // ... existing fields
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimatedMinutes?: number
  location?: 'office' | 'boat' | 'anywhere'
  mobileNotes?: string  // Quick mobile annotations
}
```

**Wireframe (Text-based)**:
```
┌─────────────────────────┐
│ 📋 Tasks            ⚙️ │
├─────────────────────────┤
│ ← TODO   DOING   DONE → │
│                         │
│ 🔴 VIO payroll          │
│    Due today            │
│    [Tap to edit]        │
│                         │
│ 🟡 Review digests       │
│    📍 Anywhere          │
│                         │
│ ➕ Add Task             │
│                         │
│ [Swipe cards ← →]       │
└─────────────────────────┘
```

### 📺 YouTube Digest

**Primary Use Case**: "Catch up on important content during breaks"

**Features**:
- Browse daily digests by date
- Filter by topics/channels
- "Hot Topics" - AI-identified trending themes
- "Executive Brief" mode - ultra-condensed summaries
- Mark videos to watch later (when back at desktop)

**Data Model**:
```typescript
interface DigestEntry {
  videoId: string
  title: string
  channel: string
  duration: number
  summary: string
  executiveBrief: string      // 2-sentence summary
  topics: string[]            // AI-extracted topics
  priority: number            // AI confidence score
  watchLater: boolean
  mobileOptimized: boolean    // Summary designed for mobile
}

interface DailyDigest {
  date: string
  entries: DigestEntry[]
  hotTopics: string[]         // Cross-video themes
  totalVideos: number
  estimatedReadTime: number   // Minutes
}
```

**Wireframe (Text-based)**:
```
┌─────────────────────────┐
│ 📺 Digest      📅 Today │
├─────────────────────────┤
│ 🔥 HOT TOPICS           │
│ • AI Regulation Updates │
│ • Credit Card Changes   │
│                         │
│ 📹 Lex Fridman         │
│    "AI Safety Research" │
│    🎯 High priority     │
│    ⏱️ 3 min read        │
│                         │
│ 📹 WSJ                  │
│    "Market Update"      │
│    💰 Watch later       │
│                         │
│ [Executive Brief] [Full]│
└─────────────────────────┘
```

### 🤖 Agent Dashboard

**Primary Use Case**: "What's my team of agents working on right now?"

**Features**:
- Live status of spawned agents
- Estimated completion times
- Interrupt/modify running agents
- Agent output previews
- Completion notifications

**Data Model**:
```typescript
interface AgentStatus {
  id: string
  name: string
  task: string
  status: 'spawned' | 'working' | 'waiting' | 'completed' | 'failed'
  progress: number            // 0-100 percentage
  estimatedCompletion?: Date
  lastUpdate: Date
  output?: string            // Preview of current work
  canInterrupt: boolean
  priority: 'low' | 'normal' | 'high'
}
```

**Wireframe (Text-based)**:
```
┌─────────────────────────┐
│ 🤖 Agents           (3) │
├─────────────────────────┤
│ 🟢 Research Agent       │
│    "VIO competitor      │
│     analysis"           │
│    ▓▓▓▓▓░░░ 60%         │
│    ~15 min left         │
│                         │
│ 🟡 Email Agent          │
│    "Processing inbox"   │
│    ▓▓░░░░░░ 25%         │
│    [⏸️ Pause]           │
│                         │
│ ✅ D&D Scheduler        │
│    "Session planned"    │
│    [View Results]       │
└─────────────────────────┘
```

### 📊 Activity Log

**Primary Use Case**: "What has Skipper accomplished while I was busy?"

**Features**:
- Chronological feed of all Skipper activities
- Filter by type (tasks, messages, agent work)
- Quick actions from activity items
- Time-based grouping (Today, Yesterday, This Week)

**Data Model**:
```typescript
interface ActivityEntry {
  id: string
  timestamp: Date
  type: 'task_completed' | 'message_sent' | 'agent_spawned' | 'digest_created'
  title: string
  description: string
  relatedId?: string         // Task ID, Agent ID, etc.
  priority: 'info' | 'normal' | 'important'
  actionable: boolean        // Can Clark do something with this?
  quickActions?: QuickAction[]
}

interface QuickAction {
  label: string              // "View Task", "Approve"
  action: string             // API endpoint or navigation
  style: 'primary' | 'secondary' | 'danger'
}
```

**Wireframe (Text-based)**:
```
┌─────────────────────────┐
│ 📊 Activity        🔔3  │
├─────────────────────────┤
│ TODAY                   │
│                         │
│ ⚡ Agent completed       │
│    "VIO competitor      │
│     research"           │
│    [View Results] 2:30p │
│                         │
│ 📧 Processed 12 emails  │
│    3 need your          │
│    attention            │
│    [Review] 1:45p       │
│                         │
│ YESTERDAY               │
│ 📋 Task: "Update VIO    │
│     website" → Done     │
│                         │
└─────────────────────────┘
```

### 🔍 Work Transparency System

**Primary Use Case**: "What is Skipper actually doing right now?"

Discord shows "typing..." but that doesn't convey what's happening. This feature provides real visibility into Skipper's work.

**Features**:
- **Real-time status**: Current focus, active task description
- **Agent visibility**: Number of sub-agents, what each is working on
- **15-minute recaps**: Automatic progress summaries during active work
- **Work log**: Chain-of-thought micro-memories for crash recovery

**Data Models**:
```typescript
interface SkipperStatus {
  currentFocus: string           // "Building mobile app project"
  startedAt: Date
  agents: AgentStatus[]          // Active sub-agents
  recentTasks: string[]          // Last 3-5 completed items
  lastUpdate: Date
}

interface WorkLogEntry {
  timestamp: Date
  task: string
  completed: string[]            // What was done
  inProgress: string[]           // What's being worked on
  nextSteps: string[]            // What's planned
  notes?: string                 // Chain-of-thought context
}
```

**Backend Files**:
```
memory/status.json               # Current real-time status
memory/work-log/YYYY-MM-DD.md    # Daily work log entries
```

**API Endpoints**:
```
GET  /api/status                 # Current status + active agents
GET  /api/work-log               # Recent work log entries  
GET  /api/work-log/:date         # Specific day's log
WS   /api/status/stream          # Real-time status updates
```

**Wireframe (Text-based)**:
```
┌─────────────────────────┐
│ 🔍 Status          LIVE │
├─────────────────────────┤
│ ⚓ Current Focus:       │
│ "Setting up mobile app  │
│  GitHub project"        │
│ Started: 13:55          │
│                         │
│ 🤖 Active Agents (1)    │
│ • Research: competitor  │
│   analysis [60%]        │
│                         │
│ ✅ Recent:              │
│ • Created 7 MVP issues  │
│ • Set up PWA skeleton   │
│                         │
│ 📝 Last recap: 14:00    │
│ [View Work Log]         │
└─────────────────────────┘
```

**15-Minute Recap Example** (sent to Discord):
```
⚓ **Progress Update** (14:15)

**Working on:** Skipper Mobile App setup

**Done:**
- Created GitHub repo with PWA skeleton
- Added 8 issues for MVP tracking
- Set up work transparency system

**In Progress:**
- Documenting status system in architecture

**Next:**
- Wait for Clark's feedback on priorities
```

**Benefits**:
- Clark knows what's happening without asking
- Crash recovery via work log
- Accountability/audit trail
- Better async collaboration

---

## 3. Implementation Plan

### 🚀 MVP Phase (Weeks 1-4)
**Goal**: Core mobile access to existing Skipper features

**Week 1-2: Foundation**
- Set up React PWA with TypeScript
- Tailscale authentication integration
- Basic REST API client
- Chat interface (text only)

**Week 3-4: Essential Features**
- Kanban board view (read-only first)
- YouTube digest browser (existing data)
- Basic push notifications
- Offline data caching

**MVP Success Criteria**:
- Clark can check tasks while fishing
- Read YouTube digests on phone
- Send messages to Skipper
- Receive notifications for urgent items

**Time Estimate**: 3-4 weeks for experienced React developer

### 📈 Phase 2 (Weeks 5-8)
**Goal**: Enhanced mobile experience + native app

**Features**:
- Task editing/creation from mobile
- Voice input/output integration
- Agent dashboard with real-time status
- React Native app (iOS + Android)
- Advanced offline capabilities

**Time Estimate**: 4 weeks

### 🎯 Phase 3 (Weeks 9-12)
**Goal**: Advanced mobile-specific features

**Features**:
- Activity log with smart filtering
- AI-powered mobile summaries
- Geofenced notifications (boat vs office)
- Integration with calendar/contacts
- Advanced voice commands

**Time Estimate**: 4 weeks

### 📱 Native App Considerations (Phase 2+)

**iOS Specific**:
- Shortcuts app integration
- Siri voice commands
- Focus modes integration
- Apple Watch companion

**Android Specific**:
- Google Assistant integration
- Adaptive icons
- Android Auto support

---

## 4. Visual Mockups

### Main Navigation
```
┌─────────────────────────┐
│ ⚓ Skipper            🔔 │
├─────────────────────────┤
│                         │
│   🗨️    📋    📺      │
│  Chat  Tasks Videos     │
│                         │
│   🤖    📊             │
│ Agents Activity         │
│                         │
│                         │
│ ┌─ Quick Actions ─────┐ │
│ │ 📧 Check Email      │ │
│ │ 🎣 Boat Mode        │ │
│ │ 🔊 Voice Mode       │ │
│ └───────────────────── │ │
└─────────────────────────┘
```

### Chat Screen (Full Detail)
```
┌─────────────────────────┐
│ ← ⚓ Skipper          📱 │
├─────────────────────────┤
│                         │
│ 🤖 Morning update:      │
│    • 5 new emails       │
│    • VIO appointment    │
│      rescheduled        │
│    • Weather perfect    │
│      for fishing! 🎣    │
│    [3 mins ago]         │
│                         │
│ 👨‍💼 What's urgent for   │
│     today?              │
│     [Just now]          │
│                         │
│ 🤖 Typing...            │
│                         │
│ ┌─────────────────────┐ │
│ │🎤 Voice  [📱📝Text] │ │
│ │ Tap to speak        │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### Kanban View (Mobile-Optimized)
```
┌─────────────────────────┐
│ ← 📋 Tasks          ⚙️📱 │
├─────────────────────────┤
│ 🔴 URGENT (2)    ← → →  │
│                         │
│ ┌─────────────────────┐ │
│ │ VIO Payroll Due     │ │
│ │ 🕐 Today 5pm       │ │
│ │ 💰 $12,450          │ │
│ │ [Complete] [Delay]  │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ Call Accountant     │ │
│ │ 📞 Priority High    │ │
│ │ [Call Now] [Later]  │ │
│ └─────────────────────┘ │
│                         │
│ ➕ Quick Add            │
└─────────────────────────┘
```

### Digest Browser
```
┌─────────────────────────┐
│ ← 📺 Digest    Jan 30📱 │
├─────────────────────────┤
│ ⏱️ 8 min read • 15 videos│
│                         │
│ 🔥 TRENDING TOPICS      │
│ ┌─────────────────────┐ │
│ │ 🏛️ AI Regulation   │ │
│ │ 💳 Credit Changes   │ │
│ │ 🔒 Privacy Updates  │ │
│ └─────────────────────┘ │
│                         │
│ 📹 PRIORITY VIDEOS      │
│ • Lex Fridman: AI Safety│
│   ⭐ Executive: New     │
│   regulations may       │
│   impact VIO data...    │
│                         │
│ • WSJ: Market Update    │
│   💰 Executive: Fed     │
│   signals rate...       │
│                         │
│ [Executive] [📖 Full]   │
└─────────────────────────┘
```

### Agent Dashboard
```
┌─────────────────────────┐
│ ← 🤖 Agents       (3)📱 │
├─────────────────────────┤
│ 🟢 ACTIVE               │
│                         │
│ ┌─────────────────────┐ │
│ │ 📊 Research Agent   │ │
│ │ "VIO Q1 Analysis"   │ │
│ │ ████████░░ 80%      │ │
│ │ ~5 minutes left     │ │
│ │ [Pause] [Preview]   │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ 📧 Email Agent      │ │
│ │ "Processing Inbox"  │ │
│ │ ███░░░░░░░ 30%      │ │
│ │ [⏸️ Interrupt]      │ │
│ └─────────────────────┘ │
│                         │
│ ✅ COMPLETED TODAY (2)  │
└─────────────────────────┘
```

---

## 5. User Experience Considerations

### Executive Mobile Patterns
**Context switching**: Clark checks phone between meetings, while walking, during boat prep. Each interaction should be valuable within 10-30 seconds.

**Interruption-friendly**: App should save state instantly. If Clark gets interrupted mid-task, resuming should be seamless.

**Glanceable information**: Most screens should communicate key information before Clark even taps anything.

### Security & Privacy
- **VIO compliance**: Since Clark handles HIPAA-sensitive data for VIO, the app must be secure by default
- **Tailscale-only access**: No data leaves the secure network
- **Local caching**: Sensitive data cached locally, encrypted at rest
- **Session timeout**: Auto-logout after inactivity

### Performance Targets
- **Initial load**: < 2 seconds on 4G
- **Navigation**: < 300ms between screens
- **Offline mode**: Core features work without internet
- **Battery**: Minimal background drain

### Accessibility
- **Voice navigation**: Full voice control for fishing/driving scenarios
- **Large touch targets**: Minimum 44px for thumb navigation
- **High contrast**: Readable in bright outdoor light
- **Haptic feedback**: Confirms actions without looking

---

## 6. Technical Implementation Details

### Progressive Web App Setup
```typescript
// package.json dependencies
{
  "react": "^18.0.0",
  "typescript": "^5.0.0", 
  "@tailwindcss/forms": "^0.5.0",
  "workbox-webpack-plugin": "^7.0.0",
  "react-query": "^3.39.0",        // API state management
  "react-hook-form": "^7.45.0",    // Forms
  "framer-motion": "^10.0.0",      // Animations
  "tailscale-js": "^1.0.0"         // Auth (hypothetical)
}
```

### API Client Architecture
```typescript
class SkipperAPI {
  constructor(private auth: TailscaleAuth) {}
  
  async getTasks(): Promise<Task[]> {
    return this.request('/api/tasks')
  }
  
  async sendChatMessage(message: string): Promise<void> {
    return this.request('/api/chat/message', {
      method: 'POST',
      body: { content: message }
    })
  }
  
  async getAgentStatus(): Promise<AgentStatus[]> {
    return this.request('/api/agents')
  }
  
  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(
      `${this.baseURL}${endpoint}`,
      {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.auth.token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      }
    )
    
    if (!response.ok) {
      throw new APIError(response.status, await response.text())
    }
    
    return response.json()
  }
}
```

### Offline Strategy
```typescript
// Service Worker cache strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  if (url.pathname.startsWith('/api/')) {
    // API requests - cache with network fallback
    event.respondWith(
      caches.open('api-cache').then(cache => {
        return fetch(event.request)
          .then(response => {
            cache.put(event.request, response.clone())
            return response
          })
          .catch(() => cache.match(event.request))
      })
    )
  } else {
    // Static assets - cache first
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    )
  }
})
```

### Real-time Updates
```typescript
class SkipperWebSocket {
  private ws: WebSocket | null = null
  private listeners = new Map<string, Function[]>()
  
  connect() {
    this.ws = new WebSocket(
      `wss://${this.hostname}/api/chat/stream`,
      ['skipper-protocol']
    )
    
    this.ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data)
      this.notify(type, data)
    }
    
    // Auto-reconnect on failure
    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 5000)
    }
  }
  
  subscribe(eventType: string, callback: Function) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType)!.push(callback)
  }
  
  private notify(eventType: string, data: any) {
    const callbacks = this.listeners.get(eventType) || []
    callbacks.forEach(cb => cb(data))
  }
}
```

---

## 7. Success Metrics

### MVP Success (Week 4)
- [ ] Clark successfully uses chat while on boat
- [ ] Task checking takes < 30 seconds
- [ ] YouTube digests read on commute
- [ ] Zero authentication friction

### Phase 2 Success (Week 8)  
- [ ] 80% of task management done via mobile
- [ ] Voice input used regularly
- [ ] Native app performance > PWA
- [ ] Agent interruption works seamlessly

### Long-term Success (Week 12+)
- [ ] Clark prefers mobile for quick Skipper interactions
- [ ] App prevents 3+ "I need to check that later" moments per day
- [ ] Battery usage < 5% per day
- [ ] Zero Tailscale connection issues

---

## 8. Risk Assessment

### Technical Risks
**High**: Tailscale mobile integration complexity
- *Mitigation*: Build fallback API key auth early

**Medium**: WebSocket reliability on mobile networks
- *Mitigation*: Graceful degradation to polling

**Low**: PWA limitations on iOS
- *Mitigation*: Fast-track React Native if blocking

### User Experience Risks  
**High**: Feature creep - trying to replicate full desktop experience
- *Mitigation*: Ruthless mobile-first prioritization

**Medium**: Voice input reliability in noisy environments (boat)
- *Mitigation*: Always provide text alternative

### Business Risks
**Low**: Clark workflow changes - might prefer desktop
- *Mitigation*: Mobile app supplements, doesn't replace

---

## 9. Next Steps

1. **Week 1**: Set up development environment, basic PWA shell
2. **Week 1**: Implement Tailscale auth + basic API client
3. **Week 2**: Chat interface with text messaging
4. **Week 2**: Kanban board read-only view  
5. **Week 3**: YouTube digest browser
6. **Week 3**: Push notification foundation
7. **Week 4**: MVP testing with Clark on boat/mobile scenarios

**First User Test**: Take the PWA fishing. If Clark can check his tasks and send a message to Skipper while prepping the boat, we've succeeded.

---

## 10. Appendix: Clark's Mobile Context

### When Clark Uses Mobile
- **Morning coffee**: Quick check while Helen gets ready
- **Boat prep**: Loading gear, checking weather, travel time
- **Fishing**: Downtime between bites, checking priorities
- **Travel**: Airport delays, Uber rides, waiting rooms
- **Meetings**: Quick task add during breaks
- **Evening**: Post-dinner check before YouTube time

### What Clark Needs Most
1. **Status awareness**: "What's urgent right now?"
2. **Quick captures**: "Add task: follow up with..."
3. **Agent monitoring**: "Is anything stuck?"
4. **Communication**: "Tell Skipper about..."
5. **Information**: "What did I miss?"

### What Clark Doesn't Need on Mobile
- Long-form reading (save for desktop)
- Complex task editing (quick edits only)
- Agent creation (spawning new agents)
- System administration
- Deep YouTube analysis

**Mobile is about triage and communication. Desktop is about deep work.**

---

*Plan completed: January 30, 2026*  
*Next review: After MVP (Week 4)*

⚓ **This plan prioritizes Clark's executive workflow: Quick information access, effortless communication, and mobile-optimized task management. The PWA-first approach ensures rapid deployment while the phased approach allows for learning and iteration.**