# Rate Limiting System

Protects against brute force attacks and API abuse with progressive penalties and automatic cleanup.

## Features

- **Authentication**: 3 failed attempts/IP per 30min, progressive lockouts (3 fails = 5min, 5+ fails = 15min)
- **Account Protection**: 3 failed attempts/email = 30min lockout (30min window)
- **General Routes**: 100 requests/IP per 15min for protected API routes
- **Auto Cleanup**: Expired entries cleaned hourly
- **Development Bypass**: Set `DISABLE_RATE_LIMITING=true`

## Implementation

### Middleware (`/proxy.ts`)

- Monitors `/api/auth/*` for failed auth attempts (signin, callback)
- Rate limits protected routes: `/api/study/`, `/api/cards/`, `/api/decks/`, `/api/topics/`, `/api/chat/`, `/api/claude/`, `/api/import/`, `/api/import-export/`, `/api/user/`
- Extracts real IP from proxy headers (cf-connecting-ip, x-real-ip, x-forwarded-for)

### Rate Limiter (`/lib/rate-limiter.ts`)

- In-memory storage with automatic cleanup
- Tracks IP rate limits, auth failures, and email failures
- Progressive lockout logic with configurable windows

### Authentication Config (`/lib/auth.ts`)

- Integrates rate limiting directly into NextAuth.js authentication flow
- Checks account lockouts before processing login attempts
- Records failed authentication attempts (both IP and email-based)
- Clears failed attempts immediately upon successful authentication

## Rate Limits

```typescript
// Failed authentication attempts only
checkAuthAttemptRateLimit(ip)  // 3 failed attempts/30min

// General endpoints
checkIPRateLimit(ip, 15 * 60 * 1000, 100)       // 100/15min

// Progressive IP lockouts
3 failures = 5 minute lockout
5+ failures = 15 minute lockout

// Account lockouts
3 failures per email = 30 minute lockout (30min window)
```

## API Responses

Rate limited requests return 429 with:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many failed authentication attempts",
  "retryAfter": 900
}
```

## Protected Routes

The following API routes are protected by general rate limiting:

- `/api/study/*` - Study sessions
- `/api/cards/*` - Card operations
- `/api/decks/*` - Deck management
- `/api/topics/*` - Topic management
- `/api/chat/*` - Chat API
- `/api/claude/*` - Claude API
- `/api/import/*` - Import functionality
- `/api/import-export/*` - Import/export operations
- `/api/user/*` - User profile operations

## Development

To disable rate limiting in development, set:

```bash
DISABLE_RATE_LIMITING=true
```

## Shared Code Note

The rate limiter implementation (`lib/rate-limiter.ts`) is currently duplicated
between `nextjs-home` and `cadence-cards`. This should be extracted to
a separate npm package (`@yourusername/rate-limiter`) for better code sharing
and maintenance.
