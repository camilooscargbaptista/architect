/**
 * Structured Logger for Architect
 * Provides leveled logging that respects CLI verbosity and environment.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isVerbose = false;
  private isJson = false;

  setup(options: { verbose?: boolean; json?: boolean }): void {
    if (options.verbose !== undefined) this.isVerbose = options.verbose;
    if (options.json !== undefined) this.isJson = options.json;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (!this.isVerbose) return;
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (!this.isVerbose) return; // Info behaves like verbose debug by default unless needed
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorMeta = error instanceof Error 
      ? { errorMessage: error.message, stack: this.isVerbose ? error.stack : undefined, ...meta } 
      : { rawError: String(error), ...meta };
      
    this.log('error', message, errorMeta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (this.isJson) {
      // In JSON mode, output minimal structured error logic inside stderr so it doesn't break stdout pipes.
      process.stderr.write(JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...meta }) + '\n');
      return;
    }

    // Human-readable CLI formatting
    const timestamp = new Date().toISOString().split('T')[1]!.slice(0, 12);
    const color = {
      debug: '\x1b[38;5;240m', // gray
      info: '\x1b[38;5;33m',   // blue
      warn: '\x1b[38;5;208m',  // orange
      error: '\x1b[38;5;196m', // red
    }[level];
    
    const reset = '\x1b[0m';
    const dim = '\x1b[2m';
    
    let msg = `[${timestamp}] ${color}● ${level.toUpperCase().padEnd(5)}${reset} ${message}`;
    
    if (meta && Object.keys(meta).length > 0) {
      msg += ` ${dim}${JSON.stringify(meta)}${reset}`;
    }

    process.stderr.write(msg + '\n');
  }
}

export const logger = new Logger();
