/**
 * Skipper Mobile API Server
 * 
 * Provides real-time status, heartbeat, and work log endpoints
 * for the Skipper Mobile PWA.
 * 
 * Runs on port 3031 alongside the kanban API (3030)
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3031;

// Paths to memory files
const MEMORY_DIR = path.join(__dirname, '../../memory');
const STATUS_FILE = path.join(MEMORY_DIR, 'status.json');
const WORK_LOG_DIR = path.join(MEMORY_DIR, 'work-log');
const CHAT_LOG_FILE = path.join(MEMORY_DIR, 'chat-messages.json');

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

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',        // Vite dev server
    'http://localhost:3031',        // Self
    'http://localhost:3030',        // Kanban API
    'https://skipper-assistant-1968.tail*.ts.net', // Tailscale
    /\.tail.*\.ts\.net$/,           // Any Tailscale domain
  ],
  credentials: true
}));
app.use(express.json());

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
  
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return res.status(400).json({
      error: 'Invalid date format',
      message: 'Date must be in YYYY-MM-DD format',
      example: getToday()
    });
  }

  const logPath = path.join(WORK_LOG_DIR, `${requestedDate}.md`);
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
// CHAT ENDPOINTS
// ===================

/**
 * POST /api/chat/send
 * Send a message to Skipper
 * Body: { message: string }
 */
app.post('/api/chat/send', (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Message is required and must be a non-empty string'
    });
  }

  const timestamp = new Date().toISOString();
  const userMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: 'user',
    content: message.trim(),
    timestamp: timestamp,
    status: 'sent'
  };

  // Store the message
  chatMessages.push(userMessage);
  saveChatMessages();

  console.log(`💬 Chat message received: "${message.trim().substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

  // Add a simulated Skipper acknowledgment after a short delay
  setTimeout(() => {
    const ackMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: `Message received! I'm Skipper, Clark's AI assistant. I've logged your message and will process it. (Note: Full two-way chat is coming soon!)`,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    };
    chatMessages.push(ackMessage);
    saveChatMessages();
  }, 500);

  res.json({
    success: true,
    message: userMessage,
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
// ERROR HANDLING
// ===================

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} does not exist`,
    availableEndpoints: [
      'GET /api/heartbeat',
      'GET /api/status',
      'GET /api/work-log/:date?',
      'GET /api/work-logs',
      'POST /api/chat/send',
      'GET /api/chat/history',
      'DELETE /api/chat/history'
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
  console.log(`   GET  /api/heartbeat      - Alive status, state, agent count`);
  console.log(`   GET  /api/status         - Current focus, agents, recent tasks`);
  console.log(`   GET  /api/work-log/:date - Work log entries`);
  console.log(`   GET  /api/work-logs      - List available logs`);
  console.log(`   POST /api/chat/send      - Send a chat message`);
  console.log(`   GET  /api/chat/history   - Get chat history`);
  console.log(`   DELETE /api/chat/history - Clear chat history`);
});

module.exports = app;
