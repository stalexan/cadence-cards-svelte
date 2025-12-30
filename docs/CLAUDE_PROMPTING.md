# Claude AI Prompting Architecture

This document explains how the Cadence Cards application integrates with Claude
AI for intelligent flashcard creation and study assistance.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Message Structure](#message-structure)
5. [Use Cases](#use-cases)
6. [Topic Configuration](#topic-configuration)
7. [API Endpoints](#api-endpoints)
8. [Prompt Engineering Patterns](#prompt-engineering-patterns)
9. [Token Tracking](#token-tracking)
10. [Environment Variables](#environment-variables)
11. [Error Handling](#error-handling)
12. [References](#references)

## Overview

The application uses Claude AI (Anthropic's API) to provide three main features:

1. **AI-Assisted Card Creation**: Generate flashcards from user instructions
2. **Topic Chat**: General conversation about a topic to enhance learning
3. **Study Mode**: Generate contextual questions and provide feedback on answers

All Claude interactions follow a consistent architecture built around system
prompts, message history, and structured responses.

## Architecture

The Claude integration is organized into modular components:

```
web/lib/claude/
├── client.ts               # Core API client and message generation
├── types.ts                # TypeScript interfaces
├── prompts/                # Prompt templates
│   ├── card-creation.ts    # Card generation prompts
│   └── study-assistance.ts # Study mode prompts
└── services/               # High-level service functions
    ├── card-creation.ts    # Card generation logic
    └── study-assistance.ts # Study assistance logic
```

### Design Principles

1. **Separation of Concerns**: Prompts, API calls, and business logic are separate
2. **Topic-Based Customization**: Each topic can configure Claude's behavior
3. **Structured Responses**: Use XML tags for parsing Claude's output
4. **Context Management**: Carefully manage message history for conversations
5. **Token Efficiency**: Track usage and use appropriate max_tokens settings

## Core Components

### 1. Claude Client (`lib/claude/client.ts`)

The client provides low-level API interaction with Claude:

```typescript
// Core interface for Claude messages
export interface ClaudeMessageOptions {
  model?: string;
  system?: string;  // System prompt defining Claude's role
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  max_tokens?: number;
  temperature?: number;
}

// Main API call function
export async function generateMessage(
  options: ClaudeMessageOptions
): Promise<Anthropic.Message>

// Helper to extract text from response
export function extractTextFromResponse(
  response: Anthropic.Message
): string

// Convenience function: generate and extract in one call
export async function generateText(
  options: ClaudeMessageOptions
): Promise<string>
```

**Configuration**:
- Model: `claude-sonnet-4-20250514` (configurable via `CLAUDE_MODEL` env var)
- Default temperature: `0.7`
- Default max_tokens: `1000` (configurable via `CLAUDE_MAX_TOKENS` env var)
- API key: `CLAUDE_API_KEY` environment variable

**Features**:
- Detailed logging of requests and responses
- Token usage tracking
- Error handling with duration metrics
- Singleton Anthropic client instance

### 2. Token Tracker

Built into the client, tracks token usage across all API calls:

```typescript
class TokenTracker {
  private messageInput: number;    // Last message input tokens
  private messageOutput: number;   // Last message output tokens
  private totalInput: number;      // Cumulative input tokens
  private totalOutput: number;     // Cumulative output tokens
}
```

### 3. Services

High-level functions that combine prompts with API calls:

**Card Creation Service** (`lib/claude/services/card-creation.ts`):
- `formatCardPrompt()`: Build prompts for card generation
- `parseCardResponse()`: Extract structured data from Claude's response
- `validateCardData()`: Ensure card has required fields
- `generateCardCreationSystemPrompt()`: Create system prompt
- `formatRefinementPrompt()`: Build prompts for refining existing cards

**Study Assistance Service** (`lib/claude/services/study-assistance.ts`):
- `getInitialChatMessage()`: Generate welcome message for a topic
- `chatAboutTopic()`: Handle general topic discussions
- `generateQuestion()`: Create practice questions from flashcards
- `chatAboutQuestion()`: Provide feedback on user answers

### 4. Prompts

Template strings with placeholder variables for dynamic content.

## Message Structure

Claude uses the Messages API format:

```typescript
{
  model: "claude-sonnet-4-20250514",
  system: "You are a Spanish tutor...",  // System prompt
  messages: [
    { role: "user", content: "..." },
    { role: "assistant", content: "..." },
    { role: "user", content: "..." }
  ],
  max_tokens: 1000,
  temperature: 0.7
}
```

### System Prompts

System prompts define Claude's role and behavior. They are:
- Set once per conversation
- Separate from the message history
- Used to establish identity, expertise, and guidelines

### Message History

The `messages` array alternates between `user` and `assistant` roles:
- **First message**: Always from user
- **Pattern**: User → Assistant → User → Assistant...
- **Context injection**: Hidden system instructions can be included as user messages

## Use Cases

### 1. AI-Assisted Card Creation

**Flow**:
1. User provides instruction in natural language
2. System sends structured prompt to Claude
3. Claude responds with XML-formatted card data
4. System parses response and extracts card fields

**System Prompt**:
```
You are an expert assistant for creating flashcards for studying {{TOPIC_NAME}}. 
Your task is to create high-quality, educational flashcards with clear questions/prompts 
on the front and concise but comprehensive answers on the back.

Always respond with properly formatted content using the requested XML tags...
```

**User Prompt Template**:
```
I need your help creating a flashcard for studying {{TOPIC_NAME}}. 
This card will be added to the "{{DECK_NAME}}" deck.

User instruction: {{INSTRUCTION}}

Please generate a high-quality flashcard based on this instruction...

Format your response using the following XML tags:
<front>Write a clear question, prompt, or concept here</front>
<back>Write a concise but comprehensive answer or explanation here</back>
<note>Optional: Additional context, examples, or memory aids</note>
<priority>A, B, or C</priority>
<tags>comma,separated,tags</tags>
```

**Example Request**:
```javascript
await generateMessage({
  system: "You are an expert assistant for creating flashcards for studying Spanish...",
  messages: [{ 
    role: "user", 
    content: "I need your help creating a flashcard... User instruction: Create a card about the verb 'hablar'" 
  }],
  temperature: 0.7
});
```

**Example Response** (parsed):
```javascript
{
  front: "What is the Spanish word for 'to speak' and how is it conjugated in present tense?",
  back: "hablar (ah-BLAR) - to speak, to talk\nPresent tense: hablo, hablas, habla, hablamos, habláis, hablan",
  note: "Regular -ar verb following standard conjugation patterns",
  priority: Priority.B,
  tags: ["verb", "regular", "essential"]
}
```

**API Endpoint**: `POST /api/cards/claude-assisted`

**Card Refinement**:

Users can also refine generated cards with follow-up instructions:

```
I'm working on a flashcard with the following content:

Front: {{FRONT}}
Back: {{BACK}}
{{NOTE}}

I'd like to make the following changes:
{{REFINEMENT_INSTRUCTION}}
```

**API Endpoint**: `POST /api/cards/claude-assisted/refine`

### 2. Topic Chat

**Flow**:
1. User asks a question about a topic
2. System constructs messages with topic configuration
3. Claude responds with educational content
4. Message history is maintained for context

**System Prompt** (generated from topic config):
```
You are a knowledgeable {{TOPIC}} {{EXPERTISE}}, specializing in {{TOPIC_DESC}}. 
Your role is to help users practice and learn {{TOPIC}} through flashcard exercises, 
provide explanations about {{FOCUS}}, and offer {{CONTEXT_TYPE}} when relevant.
```

**Context Injection** (first message only):
```
H: {{GENERAL_INSTRUCTIONS}}  // Includes role, features, examples, guardrails
A: Understood.
H: {{USER_MESSAGE}}
```

For subsequent messages, only the user's message and history are sent (no re-injection).

**Topic Configuration**: Each topic in the database has customizable fields:
- `expertise`: Role Claude should take (e.g., "tutor", "expert")
- `focus`: What to emphasize (e.g., "concepts and principles")
- `contextType`: What additional info to provide (e.g., "cultural context")
- `example`: Custom interaction examples
- `question`: Special instructions for generating questions

**Example**:

*Initial message*:
```javascript
messages: [
  { role: "user", content: "<static_context>...</static_context><examples>...</examples>" },
  { role: "assistant", content: "Understood." },
  { role: "user", content: "What's the difference between ser and estar?" }
]
```

*Follow-up*:
```javascript
messages: [
  { role: "user", content: "What's the difference between ser and estar?" },
  { role: "assistant", content: "Let me explain the difference..." },
  { role: "user", content: "Can you give me more examples?" }
]
```

**API Endpoint**: `POST /api/chat`

### 3. Study Mode

Study mode has two distinct Claude interactions:

#### A. Generate Practice Question

**Flow**:
1. User sees a flashcard (front/back/note)
2. System asks Claude to generate a contextual question
3. User attempts to answer
4. Question is displayed to user

**Prompt Structure**:
```
System: You are a knowledgeable {{TOPIC}} {{EXPERTISE}}...

Messages:
  User: {{STATIC_CONTEXT}}
  Assistant: I will help generate a practice question.
  User: Here's the card to create a question for:
        <card>
        <front>{{FRONT}}</front>
        <back>{{BACK}}</back>
        <notes>{{NOTE}}</notes>
        </card>
        
        Place the question in an XML tag called question.
        {{QUESTION_GUIDELINES}}  // Optional topic-specific guidelines
```

**Response Parsing**:
```javascript
const match = text.match(/<question>([\s\S]*?)<\/question>/);
const question = match?.[1]?.trim() || text;
```

**API Endpoint**: `POST /api/study/generate-question`

#### B. Chat About User's Answer

**Flow**:
1. User provides an answer to the practice question
2. System sends card content + conversation history to Claude
3. Claude provides feedback, corrections, or additional explanation
4. User can continue the conversation

**Prompt Structure**:
```
System: You are a knowledgeable {{TOPIC}} {{EXPERTISE}}...

Messages:
  User: {{GENERAL_INSTRUCTIONS}}
        {{PRACTICE_INSTRUCTIONS}}  // Special guidelines for practice mode
        
        Here's the card to practice:
        <card>{{CARD_XML}}</card>
        
  Assistant: Understood.
  
  [Previous conversation messages filtered]
  
  User: {{USER_ANSWER}}
```

**Practice Instructions**:
```
We are now in practice mode. Help the user practice their {{TOPIC}} knowledge using flashcards.

Important guidelines:
- Do not offer a "next card" option since there is a separate button for that
- Do not use images or say anything about showing images
- Don't say you are waiting for them
- Do not repeat back to the user any instructions you've been given
- If they ask for the answer, provide it along with a brief explanation
- Focus specifically on how the concept is used in the context of {{TOPIC}}
```

**Message Filtering**: The system filters out hidden context messages before showing to user, but includes them when sending to Claude.

**API Endpoint**: `POST /api/study/chat-about-question`

## Topic Configuration

Topics are stored in the database with customizable prompting fields:

```prisma
model Topic {
  id               Int      @id @default(autoincrement())
  name             String   // e.g., "Spanish"
  topicDescription String?  // e.g., "Conversational Spanish for beginners"
  expertise        String?  // e.g., "tutor", "expert", "professor"
  focus            String?  // e.g., "grammar and vocabulary", "real-world usage"
  contextType      String?  // e.g., "cultural context", "etymology"
  example          String?  // Custom example interaction
  question         String?  // Special guidelines for generating questions
}
```

### Prompt Generation from Topic Config

The system dynamically builds prompts based on topic settings:

**Identity Prompt**:
```
You are a knowledgeable {{TOPIC}} {{EXPERTISE}}, specializing in {{TOPIC_DESC}}. 
Your role is to help users practice and learn {{TOPIC}} through flashcard exercises, 
provide explanations about {{FOCUS}}, and offer {{CONTEXT_TYPE}} when relevant.
```

**Static Context**:
```
<static_context>
{{TOPIC}} Learning Assistant

Role:
- Help users practice {{TOPIC}} {{FOCUS}} through flashcards
- Provide clear explanations of {{TOPIC}} concepts
- Offer {{CONTEXT_TYPE}} for better understanding
- Guide users through their learning journey with patience and encouragement

Key Features:
- Focus on {{TOPIC}} concepts and principles
- Contextual examples for better understanding
- Detailed explanations when needed
- Additional notes for deeper comprehension
</static_context>
```

**Examples**: Custom or generic examples of good interactions

**Guardrails**:
```
Please adhere to the following guidelines:
1. Always provide accurate information about {{TOPIC}}
2. When relevant, point out different perspectives or approaches within {{TOPIC}}
3. Provide contextual information when it adds value to understanding
4. Be encouraging and patient with learners
5. Use clear explanations appropriate to the learner's level
```

### Default Values

If topic fields are not set:
- `expertise`: "tutor"
- `focus`: "concepts and principles"
- `contextType`: "additional context"
- `example`: Generic learning example
- `question`: No special guidelines

## API Endpoints

All endpoints use authentication middleware (`withAuthAndErrorHandling`).

### Card Creation

**`POST /api/cards/claude-assisted`**

Generate a new flashcard from user instruction.

Request:
```json
{
  "instruction": "Create a card about the verb 'hablar'",
  "topicId": "123",
  "topicName": "Spanish",
  "deckId": "456",
  "deckName": "Verbs"
}
```

Response:
```json
{
  "front": "What is the Spanish word for 'to speak'...",
  "back": "hablar (ah-BLAR) - to speak...",
  "note": "Regular -ar verb...",
  "priority": "B",
  "tags": ["verb", "regular", "essential"]
}
```

**`POST /api/cards/claude-assisted/refine`**

Refine an existing card based on feedback.

Request:
```json
{
  "front": "What is 'hablar'?",
  "back": "To speak",
  "note": null,
  "priority": "B",
  "tags": ["verb"],
  "refinementInstruction": "Add pronunciation and conjugation"
}
```

Response: Same format as card creation

### Chat

**`POST /api/chat/initial`**

Get initial welcome message for a topic.

Request:
```json
{
  "topicId": "123",
  "topicName": "Spanish"
}
```

Response:
```json
{
  "message": "Hello! I'm Claude, your Spanish assistant..."
}
```

**`POST /api/chat`**

Continue a conversation about a topic.

Request:
```json
{
  "message": "What's the difference between ser and estar?",
  "topicId": "123",
  "topicName": "Spanish",
  "previousMessages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ],
  "isFirstMessage": false
}
```

Response:
```json
{
  "response": "Great question! Ser and estar both mean 'to be'..."
}
```

### Study Mode

**`POST /api/study/generate-question`**

Generate a practice question for a flashcard.

Request:
```json
{
  "cardFront": "What is 'hablar'?",
  "cardBack": "To speak",
  "cardNote": "Regular -ar verb",
  "topicId": "123"
}
```

Response:
```json
{
  "question": "How would you conjugate 'hablar' in the present tense for 'I speak'?"
}
```

**`POST /api/study/chat-about-question`**

Get feedback on a user's answer.

Request:
```json
{
  "userAnswer": "I think it's 'hablo'",
  "cardFront": "What is 'hablar'?",
  "cardBack": "To speak",
  "cardNote": "Regular -ar verb",
  "previousMessages": [],
  "topicId": "123"
}
```

Response:
```json
{
  "response": "Excellent! That's correct. 'Hablo' is indeed..."
}
```

## Prompt Engineering Patterns

### 1. XML-Structured Responses

The application uses XML tags to get structured data from Claude:

**Benefits**:
- Easy to parse with regex
- Clear delimiters for multi-line content
- Less prone to formatting errors than JSON
- Natural for Claude to generate

**Example**:
```xml
<front>Question here</front>
<back>Answer here</back>
<note>Context here</note>
<priority>B</priority>
<tags>tag1,tag2,tag3</tags>
```

**Parsing**:
```javascript
const frontMatch = responseText.match(/<front>([\s\S]*?)<\/front>/);
const front = frontMatch?.[1]?.trim();
```

### 2. Context Injection via Hidden Messages

To provide instructions without cluttering the visible conversation:

```javascript
messages: [
  { role: "user", content: "{{SYSTEM_INSTRUCTIONS}}" },
  { role: "assistant", content: "Understood." },
  ...actualConversation
]
```

The "Understood." response signals Claude has processed the instructions without producing visible output.

### 3. Example-Based Learning

Prompts include examples of good interactions:

```
<example 1>
H: [User question]

A: [Ideal response format]
</example 1>
```

This helps Claude understand the desired output format and tone.

### 4. Explicit Guardrails

Specific don'ts for practice mode:
- Don't offer "next card" (UI handles it)
- Don't mention images (not supported)
- Don't repeat instructions back
- Don't say "waiting for user"

These prevent common Claude behaviors that don't fit the UX.

### 5. Role-Based System Prompts

System prompts establish expertise and scope:
```
You are a knowledgeable Spanish tutor, specializing in conversational Spanish.
Your role is to help users practice and learn Spanish through flashcard exercises...
```

### 6. Topic-Specific Customization

Allow users/admins to customize Claude's behavior per topic:
- Teaching style (tutor vs. expert vs. professor)
- What to emphasize (grammar vs. conversation vs. culture)
- What extra context to provide

### 7. Validation and Defaults

Always validate Claude's responses and provide sensible defaults:

```javascript
const cardData = {
  front: parsedCard.front || "",
  back: parsedCard.back || "",
  note: parsedCard.note || null,
  priority: parsedCard.priority || Priority.B,
  tags: parsedCard.tags || []
};
```

## Token Tracking

The `TokenTracker` class monitors API usage:

```javascript
export const tokenTracker = new TokenTracker();

// After each API call
await tokenTracker.updateStats(response);

// Get current stats
const stats = tokenTracker.getStats();
console.log(stats);
// {
//   message: { input: 245, output: 178 },
//   total: { input: 12345, output: 8901 }
// }
```

**Logged Metrics**:
- Input tokens (prompt)
- Output tokens (response)
- Duration (ms)
- Model used
- Stop reason
- Message count

**Cost Management**:
- Default `max_tokens`: 1000 (prevents runaway costs)
- Configurable via environment variable
- Can be overridden per request

## Environment Variables

Required configuration:

```bash
# API Key (required)
CLAUDE_API_KEY=sk-ant-...

# Model (optional, defaults to claude-sonnet-4-20250514)
CLAUDE_MODEL=claude-sonnet-4-20250514

# Max tokens (optional, defaults to 1000)
CLAUDE_MAX_TOKENS=1000

# API URL (optional, for testing/proxies)
CLAUDE_API_URL=https://api.anthropic.com
```

## Error Handling

All API calls include comprehensive error handling:

```javascript
try {
  const response = await anthropic.messages.create({ ... });
  logger.info("Claude API request completed", { ... });
  return response;
} catch (error) {
  logger.error("Claude API request failed", error, {
    model,
    duration,
    messageCount,
    operation: "claude_api_request"
  });
  throw error;
}
```

Errors are logged with:
- Operation context
- Duration
- Request parameters
- Full error details

API routes wrap calls with `withAuthAndErrorHandling` for consistent error responses.

## References

- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
- [Prompt Engineering Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering)
- [Claude Models](https://docs.anthropic.com/en/docs/about-claude/models)

