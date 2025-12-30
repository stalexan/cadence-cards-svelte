import fs from 'fs';
import path from 'path';
import type { Card } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { stringify } from 'yaml';

// Log level configuration
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const CURRENT_LOG_LEVEL: LogLevel =
	(process.env.LOG_LEVEL?.toLowerCase() as LogLevel) ||
	(process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	none: 4
};

function shouldLog(messageLevel: LogLevel): boolean {
	return LOG_LEVEL_VALUES[messageLevel] >= LOG_LEVEL_VALUES[CURRENT_LOG_LEVEL];
}

// Determine if we should log to files
const LOG_TO_FILES = process.env.LOG_TO_FILES === 'true';
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// Create log directory if logging to files is enabled
if (LOG_TO_FILES) {
	try {
		if (!fs.existsSync(LOG_DIR)) {
			fs.mkdirSync(LOG_DIR, { recursive: true });
		}
	} catch (error) {
		console.error('Failed to create log directory:', error);
	}
}

// Context that can be attached to log entries
export interface LogContext {
	requestId?: string;
	userId?: string | number;
	ip?: string;
	path?: string;
	method?: string;
	duration?: number;
	[key: string]: unknown;
}

// Structured log entry format
interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: LogContext;
	error?: ErrorDetails;
}

interface ErrorDetails {
	name: string;
	message: string;
	stack?: string;
	code?: string;
	meta?: unknown;
	cause?: unknown;
}

/**
 * Centralized Logger with structured logging support
 */
class Logger {
	/**
	 * Format an error object for logging
	 */
	private formatError(error: unknown): ErrorDetails {
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			return {
				name: 'PrismaClientKnownRequestError',
				message: error.message,
				code: error.code,
				meta: error.meta,
				stack: error.stack
			};
		}

		if (error instanceof Prisma.PrismaClientValidationError) {
			return {
				name: 'PrismaClientValidationError',
				message: error.message,
				stack: error.stack
			};
		}

		if (error instanceof Error) {
			return {
				name: error.name,
				message: error.message,
				stack: error.stack,
				cause: error.cause
			};
		}

		return {
			name: 'UnknownError',
			message: String(error)
		};
	}

	/**
	 * Write log entry to console and optionally to file
	 */
	private writeLog(entry: LogEntry, logType: string = 'app'): void {
		// Format for console - human readable in development, JSON in production
		if (process.env.NODE_ENV === 'production') {
			console.log(JSON.stringify(entry));
		} else {
			// Human-readable format for development
			const emoji = {
				debug: '🔍',
				info: 'ℹ️',
				warn: '⚠️',
				error: '❌',
				none: ''
			}[entry.level];

			console.log(`${emoji} [${entry.level.toUpperCase()}] ${entry.timestamp} - ${entry.message}`);
			if (entry.context && Object.keys(entry.context).length > 0) {
				console.log('  Context:', entry.context);
			}
			if (entry.error) {
				console.log('  Error:', entry.error);
			}
		}

		// Write to file if enabled
		if (LOG_TO_FILES) {
			try {
				const logFile = path.join(
					LOG_DIR,
					`${logType}-${new Date().toISOString().split('T')[0]}.log`
				);
				fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
			} catch (error) {
				console.error('Failed to write to log file:', error);
			}
		}
	}

	/**
	 * Log a debug message
	 */
	debug(message: string, context?: LogContext): void {
		if (!shouldLog('debug')) return;

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: 'debug',
			message,
			context
		};

		this.writeLog(entry);
	}

	/**
	 * Log an info message
	 */
	info(message: string, context?: LogContext): void {
		if (!shouldLog('info')) return;

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: 'info',
			message,
			context
		};

		this.writeLog(entry);
	}

	/**
	 * Log a warning message
	 */
	warn(message: string, context?: LogContext): void {
		if (!shouldLog('warn')) return;

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: 'warn',
			message,
			context
		};

		this.writeLog(entry);
	}

	/**
	 * Log an error message with error details
	 */
	error(message: string, error: unknown, context?: LogContext): void {
		if (!shouldLog('error')) return;

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: 'error',
			message,
			context,
			error: this.formatError(error)
		};

		this.writeLog(entry, 'error');
	}

	/**
	 * Log an API request
	 */
	request(method: string, path: string, context?: LogContext): void {
		this.info(`${method} ${path}`, {
			...context,
			method,
			path
		});
	}

	/**
	 * Log an API response
	 */
	response(
		method: string,
		path: string,
		statusCode: number,
		duration: number,
		context?: LogContext
	): void {
		const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
		const logMethod = level === 'info' ? this.info : level === 'warn' ? this.warn : this.debug;

		logMethod.call(this, `${method} ${path} ${statusCode} - ${duration}ms`, {
			...context,
			method,
			path,
			statusCode,
			duration
		});
	}

	/**
	 * Log a business event (audit trail)
	 */
	audit(event: string, context?: LogContext): void {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: 'info',
			message: `[AUDIT] ${event}`,
			context
		};

		this.writeLog(entry, 'audit');
	}

	/**
	 * Log a security event
	 */
	security(event: string, context?: LogContext): void {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: 'warn',
			message: `[SECURITY] ${event}`,
			context
		};

		this.writeLog(entry, 'security');
	}
}

// Export singleton instance
export const logger = new Logger();

// Export a function to create a child logger with default context
export function createLogger(defaultContext: LogContext) {
	return {
		debug: (message: string, context?: LogContext) =>
			logger.debug(message, { ...defaultContext, ...context }),
		info: (message: string, context?: LogContext) =>
			logger.info(message, { ...defaultContext, ...context }),
		warn: (message: string, context?: LogContext) =>
			logger.warn(message, { ...defaultContext, ...context }),
		error: (message: string, error: unknown, context?: LogContext) =>
			logger.error(message, error, { ...defaultContext, ...context }),
		request: (method: string, path: string, context?: LogContext) =>
			logger.request(method, path, { ...defaultContext, ...context }),
		response: (
			method: string,
			path: string,
			statusCode: number,
			duration: number,
			context?: LogContext
		) => logger.response(method, path, statusCode, duration, { ...defaultContext, ...context }),
		audit: (event: string, context?: LogContext) =>
			logger.audit(event, { ...defaultContext, ...context }),
		security: (event: string, context?: LogContext) =>
			logger.security(event, { ...defaultContext, ...context })
	};
}

/**
 * Log card data in YAML format for study tracking
 *
 * @param card The card to log
 */
export function logCardData(card: Card | Record<string, unknown>): void {
	// Convert to YAML with default formatting (no special options)
	const yamlOutput = stringify(card);

	// Remove trailing newline if present
	const trimmedYaml = yamlOutput.trimEnd();

	// Log with clear boundary markers
	console.log('===== CARD =====');
	console.log(trimmedYaml);
	console.log('===== END CARD =====');
}
