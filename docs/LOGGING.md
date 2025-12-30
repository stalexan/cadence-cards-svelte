# Logging System

## Overview

Cadence Cards now implements a comprehensive structured logging system with request tracing, detailed error context, and audit trails.

## Features

### 1. Structured Logging

All logs are now structured with consistent formatting:

```typescript
{
  timestamp: "2024-01-15T10:30:00.000Z",
  level: "info",
  message: "Next card selected for study",
  context: {
    requestId: "uuid-here",
    userId: 123,
    cardId: 456,
    topicId: 789,
    priority: "A",
    operation: "next_card"
  }
}
```

### 2. Request Tracing

Every request receives a unique `x-request-id` header for end-to-end tracing:
- Generated in middleware
- Attached to all request headers
- Included in all log entries
- Returned in response headers

### 3. Log Levels

- **debug**: Detailed diagnostic information (development only by default)
- **info**: General informational messages
- **warn**: Warning messages and potential issues
- **error**: Error messages with full stack traces
- **none**: Disable logging

### 4. Environment Variables

Configure logging behavior:

```bash
# Set log level (debug, info, warn, error, none)
LOG_LEVEL=info

# Enable file logging
LOG_TO_FILES=true

# Custom log directory (defaults to ./logs)
LOG_DIR=/var/log/cadence-cards
```

### 5. Output Formats

**Development Mode:**
- Human-readable console output with emojis
- Pretty-printed context and error details

**Production Mode:**
- JSON-formatted logs for parsing
- Machine-readable structured format
- Compatible with log aggregation tools

## Log Types

### Request/Response Logging

Automatic logging of API requests with:
- Method, path, status code
- Request duration
- Client IP address
- User ID (when authenticated)

### Error Logging

Enhanced error logging with:
- Full error details (name, message, stack trace)
- Prisma-specific error handling
- Request context (user, IP, operation)
- Input parameters

### Audit Logging

Security-sensitive operations are logged:
- User authentication (success/failure)
- Card grading and updates
- Card deletion
- Account lockouts
- Rate limit violations

### Security Logging

Security events are tracked:
- Failed authentication attempts
- Account lockouts
- IP blocks from rate limiting
- Invalid credentials

### Performance Logging

Automatic performance metrics:
- Claude API request duration
- Token usage statistics
- Slow operations

## Usage Examples

### Basic Logging

```typescript
import { logger } from "@/lib/logger";

// Info logging
logger.info("Operation completed", { userId: 123, operation: "fetch_cards" });

// Error logging
logger.error("Database query failed", error, { 
  userId: 123, 
  operation: "update_card" 
});
```

### With Request Context

```typescript
import { getRequestContext } from "@/lib/request-utils";

const context = getRequestContext(request, {
  userId,
  cardId,
  operation: "grade_card",
});

logger.audit("Card graded", context);
```

### Audit Trail

```typescript
logger.audit("User password changed", {
  userId,
  ip,
  operation: "password_change",
});
```

### Security Events

```typescript
logger.security("Failed login attempt", {
  email,
  ip,
  reason: "invalid_password",
});
```

## File Organization

When `LOG_TO_FILES=true`, logs are organized by type and date:

```
logs/
├── app-2024-01-15.log        # General application logs
├── error-2024-01-15.log      # Error logs
├── audit-2024-01-15.log      # Audit trail
└── security-2024-01-15.log   # Security events
```

## Error Details

### Prisma Errors

Prisma-specific errors are automatically detected and logged with:
- Error code (e.g., P2002 for unique constraint)
- Meta information
- Full stack trace

### Standard Errors

All errors include:
- Error name and message
- Full stack trace
- Cause chain (if present)
- Request context

## Integration Points

### Middleware

- Generates request IDs
- Tracks rate limiting
- Logs security events

### API Routes

- Error context with user/request details
- Audit logging for sensitive operations
- Performance metrics

### Authentication

- Login success/failure tracking
- Account lockout monitoring
- IP-based attack detection

### Claude API Client

- Request/response logging (detailed)
- Performance metrics
- Token usage tracking
- Error handling

## Best Practices

1. **Always include context**: Add userId, operation, and relevant IDs
2. **Use appropriate log levels**: Debug for diagnostics, info for normal flow, error for failures
3. **Log security events**: Use `logger.security()` for authentication/authorization
4. **Audit sensitive operations**: Use `logger.audit()` for data changes
5. **Include operation names**: Makes searching logs easier

## Next Steps (Future Phases)

### Phase 2: Observability
- Performance timing for critical paths
- Database query performance monitoring
- Business metrics logging

### Phase 3: Security & Compliance
- Enhanced audit logging
- Log retention policies
- GDPR compliance features

### Phase 4: Production Ready
- Error tracking service integration (Sentry)
- Log aggregation (ELK, Datadog)
- Alerting and dashboards

## Backward Compatibility

The existing logging utility (`logging.ts`) remains functional:
- `logCardData()` continues to output YAML format
- Structured logging via `logger.ts` handles all application logging
- Claude API logging is now integrated into the main logger with structured context

