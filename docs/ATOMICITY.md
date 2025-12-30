# Database Operation Atomicity

This document describes the atomicity guarantees implemented for database
operations in Cadence Cards, ensuring data integrity and preventing race
conditions.

## Overview

All database write operations (create, update, delete, bulk import) are
designed to be **atomic** - meaning they either fully succeed or fully fail,
with no partial state changes. This prevents race conditions where concurrent
operations could lead to data inconsistencies or unauthorized access.

## Implementation Approach

### 1. Transaction-Based Authorization Checks

All create and update operations wrap authorization checks and writes in database transactions:

```typescript
async createDeck(params: CreateDeckParams) {
  try {
    const deck = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Check authorization within transaction
      const topic = await tx.topic.findFirst({
        where: { id: topicId, userId },
      });

      if (!topic) {
        throw new Error("Topic not found or does not belong to the user");
      }

      // Create deck - atomic with authorization check
      return await tx.deck.create({
        data: { name, topicId },
      });
    });

    return deck;
  } catch (error: unknown) {
    // Handle errors...
  }
}
```

**Benefits:**
- Authorization check and write are atomic
- If ownership changes between check and write, transaction prevents unauthorized operation
- Consistent error handling

### 2. Database Constraint-Based Duplicate Detection

Duplicate detection is handled by database unique constraints, ensuring atomic
uniqueness checks:

```typescript
async createTopic(params: CreateTopicParams) {
  try {
    // Create directly - database enforces uniqueness atomically
    const topic = await prisma.topic.create({
      data: { name, userId, ... },
    });
    return topic;
  } catch (error: unknown) {
    // Handle unique constraint violation
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      error.meta?.target?.includes("name")
    ) {
      throw new Error("A topic with this name already exists");
    }
    throw error;
  }
}
```

**Benefits:**
- Eliminates race condition window
- Single database round-trip instead of two (read + write)
- Database enforces uniqueness atomically
- Simpler code path

## Implementation Details

### Operations Using Transactions

#### Create Operations
- **`createCard()`** - Checks deck ownership, creates card
- **`createDeck()`** - Checks topic ownership, creates deck
- **`createTopic()`** - Creates topic (no authorization check needed - user owns their topics)
- **`importCards()`** - Checks deck ownership, bulk imports cards

#### Update Operations
- **`updateCard()`** - Checks card ownership, validates new deck (if changing), updates card
- **`updateDeck()`** - Checks deck ownership, validates new topic (if changing), updates deck
- **`updateTopic()`** - Checks topic ownership, updates topic

#### Delete Operations
- **`deleteUser()`** (admin script) - Deletes cards, decks, topics, and user in transaction
- **`deleteTopic()`** - Deletes topic (cascading deletes handled by database)
- **`deleteDeck()`** - Deletes deck (cascading deletes handled by database)
- **`deleteCard()`** - Deletes individual card

### Cascading Deletes

Cascading deletes are handled automatically by the database through foreign key
constraints with `onDelete: Cascade`. These operations are inherently atomic
because PostgreSQL executes them as part of a single DELETE statement.

**Cascade Chain:**
```
User deletion → Topics → Decks → Cards
Topic deletion → Decks → Cards
Deck deletion → Cards
```

**Schema Definition:**
```prisma
model Topic {
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Deleting a User automatically deletes all their Topics
}

model Deck {
  topic Topic @relation(fields: [topicId], references: [id], onDelete: Cascade)
  // Deleting a Topic automatically deletes all its Decks
}

model Card {
  deck Deck @relation(fields: [deckId], references: [id], onDelete: Cascade)
  // Deleting a Deck automatically deletes all its Cards
}
```

**Benefits:**
- **Atomic**: All related records are deleted in a single database operation
- **Automatic**: No application code needed to handle cascading deletions
- **Consistent**: Database ensures referential integrity
- **Efficient**: Single SQL statement handles the entire cascade chain

**Example:**
When deleting a topic, the database automatically:
1. Deletes all decks belonging to that topic
2. Deletes all cards belonging to those decks
3. All within a single atomic operation

This ensures data consistency - you can never have orphaned decks or cards.

### Database Constraints

The following unique constraints are defined in the Prisma schema:

```prisma
model Topic {
  @@unique([name, userId]) // Prevents duplicate topic names for the same user
}

model Deck {
  @@unique([name, topicId]) // Prevents duplicate deck names in the same topic
}

model User {
  email String? @unique // Prevents duplicate emails
}
```

These constraints are enforced at the database level, ensuring atomic uniqueness checks.

### Optimistic Locking

Card updates use optimistic locking via a `version` field to prevent concurrent modification conflicts:

```typescript
async updateCard(cardId: number, userId: number, updateData: UpdateCardParams) {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Authorization check...
    
    // Optimistic locking: version check in WHERE clause
    const whereClause: Prisma.CardWhereUniqueInput = { id: cardId };
    if (updateData.version !== undefined) {
      whereClause.version = updateData.version;
      data.version = { increment: 1 };
    }

    return await tx.card.update({ where: whereClause, data });
  });
}
```

If the version doesn't match, Prisma throws `P2025` (record not found), which
we handle as a version conflict.

## Error Handling

### Unique Constraint Violations

When a unique constraint is violated, Prisma throws `P2002`:

```typescript
if (
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002" &&
  error.meta?.target?.includes("name")
) {
  throw new Error("A topic with this name already exists");
}
```

### Authorization Errors

Authorization errors are thrown within transactions and propagate naturally:

```typescript
if (!topic) {
  throw new Error("Topic not found or does not belong to the user");
}
```

### Version Conflicts

Optimistic locking conflicts are detected via `P2025`:

```typescript
if (
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2025"
) {
  const versionError: Error & { code?: string } = new Error(
    "This card was modified by another request. Please refresh and try again."
  );
  versionError.code = "VERSION_CONFLICT";
  throw versionError;
}
```

## Performance Considerations

### Transaction Overhead

Transactions add minimal overhead:
- **Read operations**: No overhead (authorization checks are reads)
- **Write operations**: Transaction ensures consistency at the cost of slightly longer lock duration
- **Bulk operations**: Transaction ensures all-or-nothing behavior

### YAML Parsing Optimization

For bulk imports, YAML parsing happens **outside** the transaction:

```typescript
// Parse YAML (pure computation, no DB access)
const { valid: validCards, invalid: invalidCards } = 
  importCardsFromYaml(yamlContent);

// Only DB operations are in transaction
await prisma.$transaction(async (tx) => {
  // Authorization check + bulk insert
});
```

This minimizes transaction duration and lock contention.


## Summary

All database write operations in Cadence Cards guarantee atomicity through:

1. **Transactions** for authorization checks and writes
2. **Database constraints** for duplicate detection
3. **Optimistic locking** for concurrent modification prevention

This ensures data integrity, prevents unauthorized operations, and eliminates
race conditions across all write operations.

