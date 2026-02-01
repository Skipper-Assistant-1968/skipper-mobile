/**
 * Skipper Mobile API Server
 * 
 * Provides real-time status, heartbeat, and work log endpoints
 * for the Skipper Mobile PWA.
 * 
 * Runs on port 3031 alongside the kanban API (3030)
 * 
 * Security: Designed for Tailscale-only access. See SECURITY.md.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
// Port 3032 because Tailscale serve proxies 3031 -> 3032
const PORT = process.env.PORT || 3032;
// WebSocket on 3034, Tailscale proxies 3033 -> 3034
const WS_PORT = process.env.WS_PORT || 3034;

// ===================
// SECURITY MIDDLEWARE
// ===================

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:*", "https://*.ts.net"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for PWA
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

// Trust proxy (required for Tailscale serve acting as reverse proxy)
app.set('trust proxy', 1);

// Rate limiting - general API
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests', message: 'Please slow down. Max 100 requests per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for write operations
const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 write requests per minute
  message: { error: 'Too many requests', message: 'Write operations limited to 20 per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/chat/send', writeLimiter);
app.use('/api/chat/history', writeLimiter); // DELETE method

// Paths to memory files
const MEMORY_DIR = path.join(__dirname, '../../memory');
const STATUS_FILE = path.join(MEMORY_DIR, 'status.json');
const WORK_LOG_DIR = path.join(MEMORY_DIR, 'work-log');
const CHAT_LOG_FILE = path.join(MEMORY_DIR, 'chat-messages.json');
const PENDING_FILE = path.join(MEMORY_DIR, 'mobile-chat-pending.json');

// Paths to digest files
const DIGESTS_DIR = path.join(__dirname, '../../digests');

// Server start time for uptime tracking
const SERVER_START = Date.now();

// ===================
// WEBSOCKET SERVER
// ===================

const wsServer = new WebSocket.Server({ port: WS_PORT });
const wsClients = new Set();

wsServer.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');
  wsClients.add(ws);
  
  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    timestamp: new Date().toISOString(),
    message: 'Connected to Skipper WebSocket'
  }));
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWsMessage(ws, message);
    } catch (err) {
      console.error('WebSocket parse error:', err.message);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    wsClients.delete(ws);
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    wsClients.delete(ws);
  });
});

// Handle incoming WebSocket messages
function handleWsMessage(ws, message) {
  const { type, payload } = message;
  
  switch (type) {
    case 'chat:message':
      // Client sends a message - same as POST /api/chat/send but via WS
      handleWsChatMessage(ws, payload);
      break;
      
    case 'chat:typing':
      // Broadcast typing indicator to all other clients
      broadcastToOthers(ws, { type: 'chat:typing', payload });
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;
      
    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
  }
}

// Handle chat message via WebSocket
function handleWsChatMessage(ws, payload) {
  const { content } = payload || {};
  
  if (!content || typeof content !== 'string' || !content.trim()) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Message content is required' 
    }));
    return;
  }
  
  const timestamp = new Date().toISOString();
  const userMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: 'user',
    content: content.trim(),
    timestamp: timestamp,
    status: 'sent'
  };
  
  // Store the message
  chatMessages.push(userMessage);
  saveChatMessages();
  
  // Add to pending queue for Skipper
  addToPending(userMessage);
  
  console.log(`💬 [WS] Chat message received: "${content.trim().substring(0, 50)}..."`);
  
  // Acknowledge to sender
  ws.send(JSON.stringify({
    type: 'chat:message:ack',
    payload: userMessage
  }));
  
  // Broadcast to all other clients (e.g., other devices)
  broadcastToOthers(ws, {
    type: 'chat:message',
    payload: userMessage
  });
}

// Broadcast message to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Broadcast to all except sender
function broadcastToOthers(sender, message) {
  const data = JSON.stringify(message);
  for (const client of wsClients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Broadcast Skipper's response to all clients
function broadcastResponse(responseMessage) {
  broadcast({
    type: 'chat:response',
    payload: responseMessage
  });
}

// Broadcast status update to all clients
function broadcastStatusUpdate(status) {
  broadcast({
    type: 'status:update',
    payload: status
  });
}

// In-memory chat messages (persisted to disk)
let chatMessages = [];

// Load existing chat messages on startup
function loadChatMessages() {
  try {
    if (fs.existsSync(CHAT_LOG_FILE)) {
      const content = fs.readFileSync(CHAT_LOG_FILE, 'utf-8');
      chatMessages = JSON.parse(content);
      console.log(`📝 Loaded ${chatMessages.length} chat messages from disk`);
    }
  } catch (error) {
    console.error('Error loading chat messages:', error.message);
    chatMessages = [];
  }
}

// Save chat messages to disk
function saveChatMessages() {
  try {
    fs.writeFileSync(CHAT_LOG_FILE, JSON.stringify(chatMessages, null, 2));
  } catch (error) {
    console.error('Error saving chat messages:', error.message);
  }
}

// Initialize chat messages
loadChatMessages();

// ===================
// PENDING MESSAGE QUEUE (for Skipper to see)
// ===================

function loadPendingMessages() {
  try {
    if (fs.existsSync(PENDING_FILE)) {
      return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading pending messages:', error.message);
  }
  return [];
}

function savePendingMessages(pending) {
  try {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2));
  } catch (error) {
    console.error('Error saving pending messages:', error.message);
  }
}

function addToPending(message) {
  const pending = loadPendingMessages();
  pending.push({
    ...message,
    pending: true,
    addedAt: new Date().toISOString()
  });
  savePendingMessages(pending);
  console.log(`📬 Message added to pending queue (${pending.length} total)`);
}

// CORS - Tailscale-only in production
const ALLOWED_ORIGINS = [
  'http://localhost:5173',        // Vite dev server
  'http://localhost:3031',        // Self
  'http://localhost:3030',        // Kanban API
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3031',
  'http://127.0.0.1:3030',
];

// Allow specific Tailscale domain (configured via env or hardcoded)
const TAILSCALE_DOMAIN = process.env.TAILSCALE_DOMAIN || 'skipper-assistant-1968.tail5697f1.ts.net';

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (same-origin, curl, mobile apps)
    if (!origin) return callback(null, true);
    
    // Check explicit allowlist
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // Check Tailscale domain (with or without port)
    // Matches: https://domain, https://domain:5173, https://domain:3031, etc.
    const tailscalePattern = new RegExp(`^https?://${TAILSCALE_DOMAIN.replace(/\./g, '\\.')}(:\\d+)?$`);
    if (tailscalePattern.test(origin)) {
      return callback(null, true);
    }
    
    // Reject unknown origins
    console.warn(`⚠️ CORS blocked origin: ${origin}`);
    return callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 86400, // Cache preflight for 24 hours
}));

// Request body size limit (prevent large payload attacks)
app.use(express.json({ limit: '10kb' }));

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 second timeout
  next();
});

// Helper: Read JSON file safely
function readJsonFile(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return defaultValue;
  }
}

// Helper: Read markdown file
function readMarkdownFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

// Helper: Get today's date in YYYY-MM-DD format
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// Helper: Count active agents from status
function countAgents(status) {
  if (!status || !status.agents) return 0;
  return Array.isArray(status.agents) ? status.agents.length : 0;
}

// ===================
// API ENDPOINTS
// ===================

/**
 * GET /api/heartbeat
 * Returns alive status, timestamp, current state, agent count
 */
app.get('/api/heartbeat', (req, res) => {
  const status = readJsonFile(STATUS_FILE, {
    state: 'unknown',
    agents: []
  });

  const heartbeat = {
    alive: true,
    timestamp: new Date().toISOString(),
    serverUptime: Math.floor((Date.now() - SERVER_START) / 1000),
    state: status.state || 'unknown',
    agentCount: countAgents(status),
    lastHeartbeat: status.lastHeartbeat || null,
    version: '1.0.0'
  };

  res.json(heartbeat);
});

/**
 * GET /api/agents
 * Returns list of active and recent agents with status info
 */
app.get('/api/agents', (req, res) => {
  const status = readJsonFile(STATUS_FILE, {
    agents: [],
    completedAgents: []
  });

  // Get recent sessions to correlate with agents
  const recentSessions = getRecentSessions(20);

  // Transform agents array into richer format
  const activeAgents = (status.agents || []).map((agent, index) => {
    // Try to find a matching session
    const matchedSession = findSessionForAgent(agent, recentSessions);
    return {
      id: agent.label || `agent-${index}`,
      label: agent.label || `Agent ${index + 1}`,
      name: formatAgentName(agent.label),
      task: agent.task || 'Working...',
      model: agent.model || 'unknown',
      status: 'active',
      startedAt: agent.startedAt || status.lastUpdate || new Date().toISOString(),
      progress: agent.progress || null, // Could be 0-100 or null for indeterminate
      sessionId: agent.sessionId || (matchedSession ? matchedSession.id : null)
    };
  });

  // Include recently completed agents if tracked
  const completedAgents = (status.completedAgents || []).map((agent, index) => {
    const matchedSession = findSessionForAgent(agent, recentSessions);
    return {
      id: agent.label || `completed-${index}`,
      label: agent.label || `Completed ${index + 1}`,
      name: formatAgentName(agent.label),
      task: agent.task || 'Task completed',
      model: agent.model || 'unknown',
      status: agent.status || 'completed',
      completedAt: agent.completedAt || null,
      result: agent.result || null,
      sessionId: agent.sessionId || (matchedSession ? matchedSession.id : null)
    };
  });

  res.json({
    active: activeAgents,
    completed: completedAgents.slice(0, 10), // Last 10 completed
    totalActive: activeAgents.length,
    totalCompleted: completedAgents.length,
    lastUpdate: status.lastUpdate || null,
    recentSessions: recentSessions.slice(0, 5) // Include recent sessions for discovery
  });
});

/**
 * Get recent sessions from the sessions directory
 */
function getRecentSessions(limit = 10) {
  const sessionsDir = path.join(process.env.HOME, '.clawdbot/agents/main/sessions');
  try {
    if (!fs.existsSync(sessionsDir)) return [];
    
    const files = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.jsonl') && !f.includes('.deleted'))
      .map(f => {
        const filePath = path.join(sessionsDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          id: f.replace('.jsonl', ''),
          mtime: stats.mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit);
    
    // Extract basic info from each session
    return files.map(file => {
      try {
        const content = fs.readFileSync(path.join(sessionsDir, file.filename), 'utf-8');
        const firstLines = content.split('\n').slice(0, 10);
        let task = null;
        let timestamp = null;
        
        for (const line of firstLines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'session') {
              timestamp = entry.timestamp;
            }
            if (entry.type === 'message' && entry.message?.role === 'user') {
              // Extract first 200 chars of task
              const text = entry.message.content?.[0]?.text || entry.message.content;
              task = typeof text === 'string' ? text.substring(0, 200) : null;
              break;
            }
          } catch (e) { continue; }
        }
        
        return {
          id: file.id,
          timestamp: timestamp || file.mtime.toISOString(),
          task: task,
          mtime: file.mtime.toISOString()
        };
      } catch (e) {
        return { id: file.id, timestamp: file.mtime.toISOString(), task: null };
      }
    });
  } catch (e) {
    console.error('Error reading sessions:', e.message);
    return [];
  }
}

/**
 * Try to match an agent with a session based on task similarity
 */
function findSessionForAgent(agent, sessions) {
  if (!agent.task || !sessions.length) return null;
  
  const agentTaskLower = agent.task.toLowerCase();
  const agentWords = agentTaskLower.split(/\s+/).filter(w => w.length > 3);
  
  // Find session with best matching task
  let bestMatch = null;
  let bestScore = 0;
  
  for (const session of sessions) {
    if (!session.task) continue;
    const sessionTaskLower = session.task.toLowerCase();
    
    // Count matching words
    let score = 0;
    for (const word of agentWords) {
      if (sessionTaskLower.includes(word)) score++;
    }
    
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestMatch = session;
    }
  }
  
  return bestMatch;
}

// Helper: Format agent label into readable name
function formatAgentName(label) {
  if (!label) return 'Agent';
  // Convert "mvp-task-breakdown" to "MVP Task Breakdown"
  return label
    .split('-')
    .map(word => {
      // Handle common acronyms
      if (['mvp', 'api', 'pwa', 'ui', 'ux'].includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * GET /api/status
 * Returns current focus, active agents, recent tasks
 */
app.get('/api/status', (req, res) => {
  const status = readJsonFile(STATUS_FILE, {
    state: 'unknown',
    currentFocus: null,
    agents: [],
    recentTasks: [],
    lastUpdate: null
  });

  // Enhance with computed fields
  const response = {
    state: status.state || 'unknown',
    currentFocus: status.currentFocus || null,
    agents: status.agents || [],
    agentCount: countAgents(status),
    recentTasks: status.recentTasks || [],
    lastUpdate: status.lastUpdate || null,
    lastHeartbeat: status.lastHeartbeat || null,
    // State emoji mapping
    stateEmoji: getStateEmoji(status.state),
    stateLabel: getStateLabel(status.state)
  };

  res.json(response);
});

/**
 * GET /api/work-log/:date?
 * Returns work log entries for a specific date (default: today)
 */
app.get('/api/work-log/:date?', (req, res) => {
  const requestedDate = req.params.date || getToday();
  
  // Strict date validation (prevents path traversal)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return res.status(400).json({
      error: 'Invalid date format',
      message: 'Date must be in YYYY-MM-DD format',
      example: getToday()
    });
  }

  // Additional validation: ensure it's a valid date
  const dateObj = new Date(requestedDate);
  if (isNaN(dateObj.getTime())) {
    return res.status(400).json({
      error: 'Invalid date',
      message: 'The provided date is not valid'
    });
  }

  // Security: Ensure the path stays within WORK_LOG_DIR (defense in depth)
  const logPath = path.join(WORK_LOG_DIR, `${requestedDate}.md`);
  const resolvedPath = path.resolve(logPath);
  if (!resolvedPath.startsWith(path.resolve(WORK_LOG_DIR))) {
    console.error(`⚠️ Path traversal attempt blocked: ${requestedDate}`);
    return res.status(400).json({
      error: 'Invalid path',
      message: 'Invalid date parameter'
    });
  }
  const content = readMarkdownFile(logPath);

  if (!content) {
    return res.status(404).json({
      error: 'Work log not found',
      date: requestedDate,
      message: `No work log exists for ${requestedDate}`,
      availableLogs: getAvailableLogs()
    });
  }

  // Parse markdown into structured entries
  const entries = parseWorkLog(content);

  res.json({
    date: requestedDate,
    raw: content,
    entries: entries,
    entryCount: entries.length
  });
});

/**
 * GET /api/work-log
 * Returns list of available work logs
 */
app.get('/api/work-logs', (req, res) => {
  const logs = getAvailableLogs();
  res.json({
    logs: logs,
    count: logs.length,
    latest: logs[0] || null
  });
});

// ===================
// HELPER FUNCTIONS
// ===================

function getStateEmoji(state) {
  const emojis = {
    'listening': '🟢',
    'processing': '🔵',
    'orchestrating': '🟡',
    'offline': '🔴',
    'unknown': '⚪'
  };
  return emojis[state] || '⚪';
}

function getStateLabel(state) {
  const labels = {
    'listening': 'Listening',
    'processing': 'Processing',
    'orchestrating': 'Working (agents active)',
    'offline': 'Offline',
    'unknown': 'Unknown'
  };
  return labels[state] || 'Unknown';
}

function getAvailableLogs() {
  try {
    if (!fs.existsSync(WORK_LOG_DIR)) {
      return [];
    }
    return fs.readdirSync(WORK_LOG_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''))
      .sort()
      .reverse();
  } catch (error) {
    console.error('Error listing work logs:', error.message);
    return [];
  }
}

function parseWorkLog(content) {
  const entries = [];
  
  // Split by H2 headers (## Time - Title)
  const sections = content.split(/^## /gm).filter(s => s.trim());
  
  for (const section of sections) {
    const lines = section.split('\n');
    const headerLine = lines[0] || '';
    
    // Parse header: "13:55 - Skipper Mobile App Project Created"
    const headerMatch = headerLine.match(/^(\d{1,2}:\d{2})\s*-\s*(.+)$/);
    
    if (headerMatch) {
      const [, time, title] = headerMatch;
      const body = lines.slice(1).join('\n').trim();
      
      entries.push({
        time: time,
        title: title.trim(),
        body: body,
        // Extract trigger if present
        trigger: extractField(body, 'Trigger'),
        completed: extractListField(body, 'Completed'),
        next: extractField(body, 'Next')
      });
    }
  }
  
  return entries;
}

function extractField(text, fieldName) {
  const regex = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|\\n---|\$)`, 's');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function extractListField(text, fieldName) {
  const regex = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*\\n([\\s\\S]+?)(?=\\n\\*\\*|\\n---|\$)`);
  const match = text.match(regex);
  if (!match) return [];
  
  // Parse bullet points
  return match[1]
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.replace(/^-\s*/, '').trim());
}

// ===================
// INPUT VALIDATION HELPERS
// ===================

// Constants for input validation
const MAX_MESSAGE_LENGTH = 5000;
const MAX_LIMIT = 200;

/**
 * Sanitize user input for safe logging (prevents log injection)
 */
function sanitizeForLog(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\r\n]/g, ' ')  // Remove newlines
    .substring(0, 100);       // Truncate
}

// ===================
// CHAT ENDPOINTS
// ===================

/**
 * POST /api/chat/send
 * Send a message to Skipper (from mobile app)
 * Body: { message: string }
 */
app.post('/api/chat/send', (req, res) => {
  const { message } = req.body;

  // Type validation
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Message is required and must be a non-empty string'
    });
  }

  // Length validation
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`
    });
  }

  const timestamp = new Date().toISOString();
  const userMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: 'user',
    content: message.trim(),  // Store raw; client must escape when rendering
    timestamp: timestamp,
    status: 'sent'
  };

  // Store the message in chat history
  chatMessages.push(userMessage);
  saveChatMessages();

  // Add to pending queue for Skipper to see
  addToPending(userMessage);

  console.log(`💬 Chat message received: "${sanitizeForLog(message)}"`);

  res.json({
    success: true,
    message: userMessage,
    timestamp: timestamp
  });
});

/**
 * GET /api/chat/pending
 * Get pending messages for Skipper to process
 * Used by Skipper during heartbeat or polling
 */
app.get('/api/chat/pending', (req, res) => {
  const pending = loadPendingMessages();
  res.json({
    pending: pending,
    count: pending.length,
    hasMessages: pending.length > 0
  });
});

/**
 * DELETE /api/chat/pending/:id
 * Mark a message as processed (remove from pending)
 * Used by Skipper after responding
 */
app.delete('/api/chat/pending/:id', (req, res) => {
  const { id } = req.params;
  let pending = loadPendingMessages();
  const before = pending.length;
  pending = pending.filter(m => m.id !== id);
  savePendingMessages(pending);
  
  const removed = before - pending.length;
  console.log(`✅ Removed ${removed} message(s) from pending queue`);
  
  res.json({
    success: removed > 0,
    removed: removed,
    remaining: pending.length
  });
});

/**
 * DELETE /api/chat/pending
 * Clear all pending messages
 */
app.delete('/api/chat/pending', (req, res) => {
  const pending = loadPendingMessages();
  const count = pending.length;
  savePendingMessages([]);
  console.log(`🗑️ Cleared ${count} pending messages`);
  
  res.json({
    success: true,
    cleared: count
  });
});

/**
 * POST /api/chat/respond
 * Skipper sends a response to the user
 * Body: { message: string, replyTo?: string }
 */
app.post('/api/chat/respond', (req, res) => {
  const { message, replyTo } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Message is required and must be a non-empty string'
    });
  }

  const timestamp = new Date().toISOString();
  const assistantMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    content: message.trim(),
    timestamp: timestamp,
    status: 'delivered',
    replyTo: replyTo || null
  };

  // Store the response in chat history
  chatMessages.push(assistantMessage);
  saveChatMessages();

  // If replyTo is provided, remove that message from pending
  if (replyTo) {
    let pending = loadPendingMessages();
    pending = pending.filter(m => m.id !== replyTo);
    savePendingMessages(pending);
  }

  console.log(`🤖 Skipper response sent: "${message.trim().substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

  // Broadcast response via WebSocket to all connected clients
  broadcastResponse(assistantMessage);

  res.json({
    success: true,
    message: assistantMessage,
    timestamp: timestamp
  });
});

/**
 * GET /api/chat/history
 * Returns chat message history
 * Query params: limit (default 50), before (message id), after (message id)
 */
app.get('/api/chat/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const before = req.query.before;
  const after = req.query.after;

  let messages = [...chatMessages];

  // Filter by before/after if provided
  if (after) {
    const afterIndex = messages.findIndex(m => m.id === after);
    if (afterIndex !== -1) {
      messages = messages.slice(afterIndex + 1);
    }
  }

  if (before) {
    const beforeIndex = messages.findIndex(m => m.id === before);
    if (beforeIndex !== -1) {
      messages = messages.slice(0, beforeIndex);
    }
  }

  // Return last N messages
  messages = messages.slice(-limit);

  res.json({
    messages: messages,
    total: chatMessages.length,
    returned: messages.length,
    hasMore: messages.length < chatMessages.length
  });
});

/**
 * DELETE /api/chat/history
 * Clear chat history
 */
app.delete('/api/chat/history', (req, res) => {
  const count = chatMessages.length;
  chatMessages = [];
  saveChatMessages();
  
  console.log(`🗑️ Chat history cleared (${count} messages)`);
  
  res.json({
    success: true,
    message: `Cleared ${count} messages`
  });
});

// ===================
// ACTIVITY FEED ENDPOINT
// ===================

/**
 * GET /api/activity
 * Returns combined activity feed from work logs, chat messages, and status
 * Query params: limit (default 50), types (comma-separated: task,chat,agent,system)
 */
app.get('/api/activity', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const typeFilter = req.query.types ? req.query.types.split(',') : null;
  
  const activities = [];
  
  // 1. Parse work log entries (last 7 days)
  const logs = getAvailableLogs().slice(0, 7);
  for (const logDate of logs) {
    const logPath = path.join(WORK_LOG_DIR, `${logDate}.md`);
    const content = readMarkdownFile(logPath);
    if (content) {
      const entries = parseWorkLog(content);
      for (const entry of entries) {
        // Convert time like "13:55" to ISO timestamp
        const timestamp = `${logDate}T${entry.time.padStart(5, '0')}:00.000Z`;
        activities.push({
          id: `worklog_${logDate}_${entry.time.replace(':', '')}`,
          type: 'task',
          title: entry.title,
          description: entry.trigger || (entry.completed?.[0] || entry.body?.substring(0, 100) || ''),
          timestamp: timestamp,
          source: 'work-log',
          meta: {
            completed: entry.completed,
            next: entry.next
          }
        });
      }
    }
  }
  
  // 2. Include chat messages
  for (const msg of chatMessages) {
    activities.push({
      id: msg.id,
      type: 'chat',
      title: msg.role === 'user' ? 'Message from user' : 'Skipper response',
      description: msg.content.substring(0, 150) + (msg.content.length > 150 ? '...' : ''),
      timestamp: msg.timestamp,
      source: 'chat',
      meta: {
        role: msg.role,
        status: msg.status
      }
    });
  }
  
  // 3. Include status/agent activity
  const status = readJsonFile(STATUS_FILE, {});
  if (status.agents && status.agents.length > 0) {
    for (const agent of status.agents) {
      activities.push({
        id: `agent_${agent.label}`,
        type: 'agent',
        title: `Agent: ${agent.label}`,
        description: agent.task || 'Working...',
        timestamp: status.lastUpdate || new Date().toISOString(),
        source: 'status',
        meta: {
          model: agent.model,
          label: agent.label
        }
      });
    }
  }
  
  // Add current state as system activity
  if (status.state) {
    activities.push({
      id: 'current_state',
      type: 'system',
      title: `State: ${getStateLabel(status.state)}`,
      description: status.currentFocus || 'No current focus',
      timestamp: status.lastUpdate || new Date().toISOString(),
      source: 'status',
      meta: {
        state: status.state,
        stateEmoji: getStateEmoji(status.state)
      }
    });
  }
  
  // Filter by type if specified
  let filtered = typeFilter 
    ? activities.filter(a => typeFilter.includes(a.type))
    : activities;
  
  // Sort by timestamp, newest first
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Apply limit
  filtered = filtered.slice(0, limit);
  
  // Group by date
  const grouped = groupByDate(filtered);
  
  res.json({
    activities: filtered,
    grouped: grouped,
    total: filtered.length,
    sources: ['work-log', 'chat', 'status']
  });
});

/**
 * Group activities by date (Today, Yesterday, Earlier, or specific dates)
 */
function groupByDate(activities) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  
  const groups = {
    today: [],
    yesterday: [],
    earlier: []
  };
  
  for (const activity of activities) {
    const actDate = activity.timestamp.split('T')[0];
    if (actDate === today) {
      groups.today.push(activity);
    } else if (actDate === yesterday) {
      groups.yesterday.push(activity);
    } else {
      groups.earlier.push(activity);
    }
  }
  
  return groups;
}

// ===================
// HOT TOPICS ENDPOINT
// ===================

/**
 * GET /api/hot-topics
 * Returns hot topics from recent YouTube digests (last 5 days)
 * Topics covered by multiple channels with synthesis and analysis
 */
app.get('/api/hot-topics', (req, res) => {
  const youtubeDir = path.join(DIGESTS_DIR, 'youtube');
  const daysToLook = parseInt(req.query.days) || 5;
  
  try {
    if (!fs.existsSync(youtubeDir)) {
      return res.json({
        hotTopics: [],
        count: 0,
        message: 'No YouTube digests directory found'
      });
    }
    
    // Get available digest files sorted by date (newest first)
    const files = fs.readdirSync(youtubeDir)
      .filter(f => f.endsWith('.json') && /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, daysToLook);
    
    // Collect hot topics from each day
    const allHotTopics = [];
    
    for (const file of files) {
      const date = file.replace('.json', '');
      const filePath = path.join(youtubeDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        if (data.hotTopics && Array.isArray(data.hotTopics)) {
          // Add date to each topic and include it
          data.hotTopics.forEach(topic => {
            allHotTopics.push({
              ...topic,
              date,
              // Ensure all expected fields exist
              topic: topic.topic || 'Unknown Topic',
              synthesis: topic.synthesis || '',
              keyTakeaway: topic.keyTakeaway || '',
              executiveBriefing: topic.executiveBriefing || '',
              channelVideos: topic.channelVideos || [],
              heat: topic.heat || 'medium',
              videoCount: topic.videoCount || 0
            });
          });
        }
      } catch (e) {
        console.error(`Error reading digest ${date}:`, e.message);
        continue;
      }
    }
    
    // Sort by heat level (high > medium > low) and then by video count
    const heatOrder = { high: 3, medium: 2, low: 1 };
    allHotTopics.sort((a, b) => {
      const heatDiff = (heatOrder[b.heat] || 0) - (heatOrder[a.heat] || 0);
      if (heatDiff !== 0) return heatDiff;
      return (b.videoCount || 0) - (a.videoCount || 0);
    });
    
    res.json({
      hotTopics: allHotTopics,
      count: allHotTopics.length,
      daysIncluded: files.map(f => f.replace('.json', '')),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching hot topics:', error.message);
    res.status(500).json({
      error: 'Failed to fetch hot topics',
      message: error.message
    });
  }
});

// ===================
// RESEARCH/LEARNING ENDPOINTS
// ===================

const RESEARCH_DIR = path.join(MEMORY_DIR, 'research');

/**
 * GET /api/learn
 * Returns curated learning content from research files
 * Parses markdown files and extracts key sections for mobile display
 */
app.get('/api/learn', (req, res) => {
  const daysToLook = parseInt(req.query.days) || 7;
  
  try {
    if (!fs.existsSync(RESEARCH_DIR)) {
      return res.json({
        content: [],
        count: 0,
        message: 'No research directory found'
      });
    }
    
    // Get recent research files
    const files = fs.readdirSync(RESEARCH_DIR)
      .filter(f => f.endsWith('.md') && /^\d{4}-\d{2}-\d{2}/.test(f))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 20); // Last 20 files
    
    const content = [];
    
    for (const file of files) {
      const filePath = path.join(RESEARCH_DIR, file);
      
      try {
        const markdown = fs.readFileSync(filePath, 'utf-8');
        const lines = markdown.split('\n');
        
        // Extract title from first H1
        const titleMatch = lines.find(l => l.startsWith('# '));
        const title = titleMatch ? titleMatch.replace('# ', '').trim() : file.replace('.md', '');
        
        // Extract date from filename
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
        const date = dateMatch ? dateMatch[1] : null;
        
        // Extract topic from filename (after date)
        const topicMatch = file.match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/);
        const topic = topicMatch ? topicMatch[1].replace(/-/g, ' ') : 'Research';
        
        // Extract executive summary if present
        let summary = '';
        let inSummary = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.toLowerCase().includes('executive summary') || line.toLowerCase().includes('## summary')) {
            inSummary = true;
            continue;
          }
          if (inSummary) {
            if (line.startsWith('## ') || line.startsWith('# ')) {
              break;
            }
            if (line.trim() && !line.startsWith('**')) {
              summary += line.trim() + ' ';
            }
          }
        }
        
        // If no summary section, use first paragraph after title
        if (!summary) {
          let foundTitle = false;
          for (const line of lines) {
            if (line.startsWith('# ')) {
              foundTitle = true;
              continue;
            }
            if (foundTitle && line.trim() && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-') && !line.startsWith('|')) {
              summary = line.trim();
              break;
            }
          }
        }
        
        // Truncate summary
        summary = summary.slice(0, 300).trim();
        if (summary.length >= 300) summary += '...';
        
        // Extract key takeaways (bullet points after "Key Takeaways" or "Top" sections)
        const takeaways = [];
        let inTakeaways = false;
        for (const line of lines) {
          if (line.toLowerCase().includes('key takeaway') || 
              line.toLowerCase().includes('top 5') ||
              line.toLowerCase().includes('actionable')) {
            inTakeaways = true;
            continue;
          }
          if (inTakeaways) {
            if (line.startsWith('## ') || line.startsWith('# ')) {
              break;
            }
            // Match patterns like "1. **Bold text**" or "- **Bold text**"
            if (line.match(/^[\d]+\.\s+\*\*.+\*\*/) || line.match(/^[\-\*]\s+\*\*.+\*\*/)) {
              // Extract just the bold portion as the takeaway
              const boldMatch = line.match(/\*\*([^*]+)\*\*/);
              if (boldMatch) {
                const cleanTakeaway = boldMatch[1].trim();
                if (cleanTakeaway) takeaways.push(cleanTakeaway.slice(0, 150));
              }
            }
          }
        }
        
        // Extract YouTube video links
        const videos = [];
        const videoRegex = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)[^\)]+)\)/g;
        let match;
        while ((match = videoRegex.exec(markdown)) !== null) {
          videos.push({
            title: match[1].slice(0, 100),
            url: match[2]
          });
        }
        
        // Also check for video IDs mentioned in text
        const videoIdRegex = /\(([a-zA-Z0-9_-]{11})\)/g;
        while ((match = videoIdRegex.exec(markdown)) !== null) {
          const existingByUrl = videos.find(v => v.url.includes(match[1]));
          if (!existingByUrl) {
            videos.push({
              title: 'Video',
              url: `https://youtube.com/watch?v=${match[1]}`
            });
          }
        }
        
        // Determine category based on keywords
        const lowerContent = markdown.toLowerCase();
        let category = 'Research';
        if (lowerContent.includes('clawdbot') || lowerContent.includes('claude') || lowerContent.includes('anthropic')) {
          category = 'AI Tools';
        } else if (lowerContent.includes('game') || lowerContent.includes('dnd') || lowerContent.includes('minecraft')) {
          category = 'Gaming & AI';
        } else if (lowerContent.includes('voice') || lowerContent.includes('audio') || lowerContent.includes('tts')) {
          category = 'Voice Tech';
        } else if (lowerContent.includes('database') || lowerContent.includes('vector') || lowerContent.includes('embedding')) {
          category = 'Data & Infrastructure';
        }
        
        content.push({
          id: file.replace('.md', ''),
          title,
          topic,
          date,
          category,
          summary: summary || 'Research findings and analysis.',
          takeaways: takeaways.slice(0, 5),
          videos: videos.slice(0, 5),
          filename: file
        });
      } catch (e) {
        console.error(`Error parsing research file ${file}:`, e.message);
        continue;
      }
    }
    
    // Filter to recent days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToLook);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    const recentContent = content.filter(c => c.date && c.date >= cutoffStr);
    
    res.json({
      content: recentContent,
      count: recentContent.length,
      totalAvailable: content.length,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching learning content:', error.message);
    res.status(500).json({
      error: 'Failed to fetch learning content',
      message: error.message
    });
  }
});

// ===================
// DIGEST ENDPOINTS
// ===================

/**
 * GET /api/digests/youtube
 * Returns list of available YouTube digests by date
 */
app.get('/api/digests/youtube', (req, res) => {
  const youtubeDir = path.join(DIGESTS_DIR, 'youtube');
  
  try {
    if (!fs.existsSync(youtubeDir)) {
      return res.json({
        digests: [],
        count: 0,
        message: 'No YouTube digests directory found'
      });
    }
    
    const files = fs.readdirSync(youtubeDir)
      .filter(f => f.endsWith('.json') && /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map(f => {
        const date = f.replace('.json', '');
        const filePath = path.join(youtubeDir, f);
        const stats = fs.statSync(filePath);
        
        // Read just the header info without full content
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          return {
            date,
            totalVideos: data.totalVideos || 0,
            channelCount: data.channelCount || 0,
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString()
          };
        } catch (e) {
          return {
            date,
            totalVideos: 0,
            channelCount: 0,
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString()
          };
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Newest first
    
    res.json({
      digests: files,
      count: files.length,
      latest: files[0] || null
    });
  } catch (error) {
    console.error('Error listing YouTube digests:', error.message);
    res.status(500).json({
      error: 'Failed to list digests',
      message: error.message
    });
  }
});

/**
 * GET /api/digests/youtube/:date
 * Returns a specific day's YouTube digest
 * Query params: 
 *   - brief=true for executive briefing mode (compact summaries)
 *   - channel=name to filter by channel
 */
app.get('/api/digests/youtube/:date', (req, res) => {
  const { date } = req.params;
  const brief = req.query.brief === 'true';
  const channelFilter = req.query.channel;
  
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      error: 'Invalid date format',
      message: 'Date must be in YYYY-MM-DD format',
      example: getToday()
    });
  }
  
  const filePath = path.join(DIGESTS_DIR, 'youtube', `${date}.json`);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: 'Digest not found',
      date,
      message: `No YouTube digest exists for ${date}`
    });
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Transform data for frontend consumption
    let channels = data.channels || [];
    
    // Filter by channel if requested
    if (channelFilter) {
      channels = channels.filter(c => 
        c.channelName.toLowerCase().includes(channelFilter.toLowerCase())
      );
    }
    
    // Transform videos for output
    const transformedChannels = channels.map(channel => ({
      channelName: channel.channelName,
      videos: channel.videos.map(video => {
        const baseVideo = {
          videoId: video.videoId,
          title: video.title,
          url: video.url,
          channelName: video.channelName,
          publishedAt: video.publishedAt,
          sentiment: video.sentiment,
          sentimentLabel: video.sentimentLabel,
          topics: video.topics || [],
          timestamps: video.timestamps || []
        };
        
        if (brief) {
          // Executive brief mode - compact view
          return {
            ...baseVideo,
            summary: video.executiveBriefing || video.takeaways || 'No summary available',
            topBullets: video.topBullets || []
          };
        } else {
          // Full mode
          return {
            ...baseVideo,
            description: video.description,
            summary: video.executiveBriefing || video.takeaways || 'No summary available',
            topBullets: video.topBullets || [],
            fullTranscript: video.fullTranscript,
            metadata: video.metadata
          };
        }
      })
    }));
    
    // Flatten videos for easier frontend rendering
    const allVideos = transformedChannels.flatMap(c => c.videos);
    
    res.json({
      date: data.date,
      totalVideos: data.totalVideos,
      channelCount: data.channelCount,
      channels: transformedChannels,
      videos: allVideos,
      briefMode: brief
    });
  } catch (error) {
    console.error(`Error reading digest ${date}:`, error.message);
    res.status(500).json({
      error: 'Failed to read digest',
      message: error.message
    });
  }
});

// ===================
// SESSIONS ENDPOINTS
// ===================

/**
 * GET /api/sessions
 * Returns list of recent sessions with basic metadata
 */
app.get('/api/sessions', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const sessions = getRecentSessions(limit);
  
  res.json({
    sessions,
    count: sessions.length
  });
});

// ===================
// AGENT TRANSCRIPT ENDPOINT
// ===================

/**
 * GET /api/agents/:sessionKey/transcript
 * Returns transcript messages for a specific agent session
 * sessionKey format: "agent:main:subagent:uuid" - we extract the uuid part
 */
app.get('/api/agents/:sessionKey/transcript', (req, res) => {
  const { sessionKey } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  
  // Extract session ID (UUID) from session key
  // Format: "agent:main:subagent:uuid" or just "uuid"
  const parts = sessionKey.split(':');
  const sessionId = parts.length > 1 ? parts[parts.length - 1] : sessionKey;
  
  // Validate session ID format (UUID)
  if (!/^[a-f0-9-]{36}$/i.test(sessionId)) {
    return res.status(400).json({
      error: 'Invalid session ID',
      message: 'Session ID must be a valid UUID'
    });
  }
  
  // Build path to session file
  const sessionsDir = path.join(process.env.HOME, '.clawdbot/agents/main/sessions');
  const sessionFile = path.join(sessionsDir, `${sessionId}.jsonl`);
  
  // Security: Ensure path is within sessions directory
  const resolvedPath = path.resolve(sessionFile);
  if (!resolvedPath.startsWith(path.resolve(sessionsDir))) {
    return res.status(400).json({
      error: 'Invalid path',
      message: 'Invalid session ID'
    });
  }
  
  if (!fs.existsSync(sessionFile)) {
    return res.status(404).json({
      error: 'Session not found',
      sessionKey,
      sessionId,
      message: `No transcript found for session ${sessionId}`
    });
  }
  
  try {
    const content = fs.readFileSync(sessionFile, 'utf-8');
    const lines = content.trim().split('\n');
    
    // Parse JSONL and extract relevant entries
    const entries = [];
    let sessionInfo = null;
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        // Capture session metadata
        if (entry.type === 'session') {
          sessionInfo = {
            id: entry.id,
            timestamp: entry.timestamp,
            cwd: entry.cwd
          };
          continue;
        }
        
        // Skip non-message entries (model changes, etc)
        if (entry.type !== 'message') continue;
        
        const msg = entry.message;
        if (!msg) continue;
        
        // Parse message content
        const parsed = {
          id: entry.id,
          timestamp: entry.timestamp,
          role: msg.role,
          model: msg.model,
          thinking: [],
          text: [],
          toolCalls: [],
          toolResults: []
        };
        
        // Parse content array
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === 'thinking') {
              parsed.thinking.push(block.thinking);
            } else if (block.type === 'text') {
              parsed.text.push(block.text);
            } else if (block.type === 'toolCall' || block.type === 'tool_use') {
              parsed.toolCalls.push({
                id: block.id,
                name: block.name,
                arguments: block.arguments || block.input
              });
            } else if (block.type === 'tool_result') {
              parsed.toolResults.push({
                toolUseId: block.tool_use_id,
                content: block.content
              });
            }
          }
        } else if (typeof msg.content === 'string') {
          parsed.text.push(msg.content);
        }
        
        // Only include entries with actual content
        if (parsed.thinking.length > 0 || parsed.text.length > 0 || 
            parsed.toolCalls.length > 0 || parsed.toolResults.length > 0) {
          entries.push(parsed);
        }
      } catch (parseErr) {
        // Skip malformed lines
        continue;
      }
    }
    
    // Return last N entries
    const recentEntries = entries.slice(-limit);
    
    res.json({
      sessionKey,
      sessionId,
      sessionInfo,
      entries: recentEntries,
      totalEntries: entries.length,
      returned: recentEntries.length,
      hasMore: entries.length > limit
    });
  } catch (error) {
    console.error(`Error reading transcript ${sessionId}:`, error.message);
    res.status(500).json({
      error: 'Failed to read transcript',
      message: error.message
    });
  }
});

// ===================
// ERROR HANDLING
// ===================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} does not exist`,
    availableEndpoints: [
      'GET /api/heartbeat',
      'GET /api/status',
      'GET /api/agents',
      'GET /api/work-log/:date?',
      'GET /api/work-logs',
      'POST /api/chat/send',
      'GET /api/chat/history',
      'DELETE /api/chat/history',
      'GET /api/chat/pending',
      'DELETE /api/chat/pending/:id',
      'DELETE /api/chat/pending',
      'POST /api/chat/respond',
      'GET /api/hot-topics',
      'GET /api/digests/youtube',
      'GET /api/digests/youtube/:date'
    ]
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// ===================
// START SERVER
// ===================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Skipper Mobile API running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running at ws://localhost:${WS_PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   GET  /api/heartbeat       - Alive status, state, agent count`);
  console.log(`   GET  /api/status          - Current focus, agents, recent tasks`);
  console.log(`   GET  /api/agents          - Active/completed agent list`);
  console.log(`   GET  /api/work-log/:date  - Work log entries`);
  console.log(`   GET  /api/work-logs       - List available logs`);
  console.log(`   POST /api/chat/send       - Send a chat message (from mobile)`);
  console.log(`   GET  /api/chat/history    - Get chat history`);
  console.log(`   DELETE /api/chat/history  - Clear chat history`);
  console.log(`   GET  /api/chat/pending    - Pending messages for Skipper`);
  console.log(`   DELETE /api/chat/pending  - Clear pending messages`);
  console.log(`   POST /api/chat/respond    - Skipper sends response`);
  console.log(`   GET  /api/hot-topics      - Hot topics from recent digests`);
  console.log(`📡 WebSocket Events:`);
  console.log(`   chat:message    - Client sends message`);
  console.log(`   chat:response   - Skipper sends response`);
  console.log(`   chat:typing     - Typing indicator`);
  console.log(`   status:update   - Status changes`);
});

module.exports = { app, broadcast, broadcastResponse, broadcastStatusUpdate };
