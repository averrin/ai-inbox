
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

const logs: LogEntry[] = [];
const MAX_LOGS = 1000;

let isInitialized = false;

// Store original methods
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

function formatArgs(args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

function addLog(level: LogEntry['level'], args: any[]) {
  const message = formatArgs(args);
  const timestamp = new Date().toISOString();
  logs.push({ timestamp, level, message });
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

export function initLogger() {
  if (isInitialized) return;

  console.log = (...args) => {
    addLog('info', args);
    originalConsoleLog(...args);
  };

  console.warn = (...args) => {
    addLog('warn', args);
    originalConsoleWarn(...args);
  };

  console.error = (...args) => {
    addLog('error', args);
    originalConsoleError(...args);
  };

  console.info = (...args) => {
    addLog('info', args);
    originalConsoleInfo(...args);
  };

  console.debug = (...args) => {
    addLog('debug', args);
    originalConsoleDebug(...args);
  };

  isInitialized = true;
  console.log('[Logger] Initialized');
}

export function getLogs() {
  // Return reversed copy (newest first)
  return [...logs].reverse();
}

export function clearLogs() {
  logs.length = 0;
}
