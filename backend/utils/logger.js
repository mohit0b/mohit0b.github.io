class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.currentLevel = process.env.NODE_ENV === 'development' ? 3 : 2;
  }

  log(level, message, meta = {}) {
    const numericLevel = this.levels[level];
    if (numericLevel > this.currentLevel) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    const output = JSON.stringify(logEntry);

    if (level === 'ERROR') {
      console.error(output);
    } else if (level === 'WARN') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  error(message, meta) {
    this.log('ERROR', message, meta);
  }

  warn(message, meta) {
    this.log('WARN', message, meta);
  }

  info(message, meta) {
    this.log('INFO', message, meta);
  }

  debug(message, meta) {
    this.log('DEBUG', message, meta);
  }
}

module.exports = new Logger();
