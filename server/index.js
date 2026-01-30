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

const app = express();
const PORT = process.env.PORT || 3031;

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
    
    // Check Tailscale domain (exact match only, not wildcard)
    if (origin === `https://${TAILSCALE_DOMAIN}` || origin === `http://${TAILSCALE_DOMAIN}`) {
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

  // Transform agents array into richer format
  const activeAgents = (status.agents || []).map((agent, index) => ({
    id: agent.label || `agent-${index}`,
    label: agent.label || `Agent ${index + 1}`,
    name: formatAgentName(agent.label),
    task: agent.task || 'Working...',
    model: agent.model || 'unknown',
    status: 'active',
    startedAt: agent.startedAt || status.lastUpdate || new Date().toISOString(),
    progress: agent.progress || null // Could be 0-100 or null for indeterminate
  }));

  // Include recently completed agents if tracked
  const completedAgents = (status.completedAgents || []).map((agent, index) => ({
    id: agent.label || `completed-${index}`,
    label: agent.label || `Completed ${index + 1}`,
    name: formatAgentName(agent.label),
    task: agent.task || 'Task completed',
    model: agent.model || 'unknown',
    status: agent.status || 'completed',
    completedAt: agent.completedAt || null,
    result: agent.result || null
  }));

  res.json({
    active: activeAgents,
    completed: completedAgents.slice(0, 10), // Last 10 completed
    totalActive: activeAgents.length,
    totalCompleted: completedAgents.length,
    lastUpdate: status.lastUpdate || null
  });
});

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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Skipper Mobile API running at http://localhost:${PORT}`);
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
});

module.exports = app;
