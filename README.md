# Cadence Cards

Cadence Cards is a modern flashcard application built with SvelteKit and
PostgreSQL. It implements an SM-2 based spaced repetition algorithm and
integrates with Claude.AI for enhanced learning across any subject matter.

**Note:** This is a personal project I've open sourced. I use it daily and
maintain it actively, but this isn't a commercial product with formal support.

## Features

- **User Management:** Create accounts, update profiles, change passwords, and more
- **Topics & Decks:** Organize your flashcards into topics and decks
- **Spaced Repetition:** Uses an SM-2 based algorithm for efficient learning
- **Claude-Assisted Card Creation:** AI-powered flashcard generation
- **Study Mode:** Interactive study sessions with Claude.AI integration
- **Chat Interface:** Discuss topics with Claude.AI to enhance learning
- **Import/Export:** Share decks with YAML import/export functionality
- **Statistics:** Track your progress with detailed statistics
- **Structured Logging:** Comprehensive request tracing and audit trails
- **Rate Limiting:** Protection against brute force attacks and API abuse
- **Optimistic Locking:** Prevents concurrent edit conflicts on cards
- **Responsive Design:** Works on desktop and mobile devices

## Technologies

- **Frontend:** SvelteKit, Svelte, TailwindCSS
- **Backend:** SvelteKit API Routes
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** Auth.js (@auth/sveltekit)
- **AI Integration:** Claude.AI API
- **Build Tool:** Vite
- **Orchestration:** Docker Compose
- **Development Tools:** ESLint, Prettier, TypeScript

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Claude.AI API Key

### Installation

1. Clone the repository:
   ```bash
   git clone git@github.com:stalexan/cadence-cards.git
   cd cadence-cards
   ```

2. Create a `.env` file from the template:
   ```bash
   cp .env.example .env
   ```

3. Edit the `.env` file and fill in the required values:
   - Generate a random string for `AUTH_SECRET`
   - Add your Claude.AI API key for `CLAUDE_API_KEY`
   - Set secure passwords for PostgreSQL

   `.env` also configures orchestration: `COMPOSE_FILE` selects which compose files are
   layered (defaults to the **development** stack) and `SHARED_NETWORK_NAME` names the external
   network the web container joins.

4. Create the external Docker network the web container attaches to (only needed once). The
   name comes from `SHARED_NETWORK_NAME` in `.env`:
   ```bash
   docker network create "$(grep -E '^SHARED_NETWORK_NAME=' .env | cut -d= -f2)"
   # or simply: docker network create cadence-cards-shared
   ```

5. Build and start the development environment (uses `COMPOSE_FILE` from `.env`):
   ```bash
   docker compose build
   docker compose up -d
   ```

6. Run the database migrations (inside the running web container):
   ```bash
   docker compose exec web npx prisma migrate dev
   ```

7. Seed the database with sample data (optional):
   ```bash
   docker compose exec web npx prisma db seed
   ```

8. Access the application at http://localhost:5173

   The Vite dev server (`npm run dev`) starts automatically inside the container. To run other
   commands, open a shell in the web container with `docker compose exec web bash`.

## Development vs Production

The project supports both development and production environments via layered Docker Compose
files: the base `docker-compose.yml` plus an environment override
(`docker-compose.dev.yml` or `docker-compose.prod.yml`).

The simplest way to select an environment is the `COMPOSE_FILE` variable in `.env`, which a
bare `docker compose` command reads automatically. The default in `.env.example` selects
development:

```bash
COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml
```

For production, either change `COMPOSE_FILE` accordingly or pass the files explicitly on each
command:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Port Configuration

The application uses different ports for development and production:

- **Development (Port 5173):** Uses the Vite dev server (`npm run dev`) which
  provides hot module reloading, fast refresh, and development tooling. Port
  5173 is Vite's default.
- **Production (Port 3000):** Uses the compiled Node.js application (`node
  build`) after running `npm run build`. The production build creates optimized
  static assets and runs as a standard Node.js server without Vite. Port 3000
  is the conventional port for Node.js applications.

This is the standard pattern for SvelteKit applications where the development
server provides enhanced tooling, while production runs the optimized built
output directly.

### Development Mode (Default)

- **Access:** Available at `http://localhost:5173`
- **Features:**
  - Source code mounted as volumes for live development
  - Hot reload enabled
  - Development tools included

**Start development** (with the default `COMPOSE_FILE` from `.env`):
```bash
docker compose build
docker compose up -d
```

In development, source is mounted into the container and migrations are **not** run
automatically — apply them with `docker compose exec web npx prisma migrate dev`.

### Production Mode

- **Access:** Available via reverse proxy at your configured domain
- **Features:**
  - Optimized multi-stage Docker build
  - Production build with `npm run build`
  - Restart policies enabled
  - Database migrations applied automatically on startup (`npx prisma migrate deploy` in
    `web/entrypoint.sh`)

**Start production:**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Note:** Configure your reverse proxy to forward requests to the application container. It
reaches the container over the external `SHARED_NETWORK_NAME` network via the
`cadence-cards` alias (e.g. `cadence-cards:3000`).

## Testing

Unit tests run with Vitest (node-only) inside the web container:

```bash
docker compose exec web npm run test
```

See [docs/TESTING.md](docs/TESTING.md) for watch and coverage modes, the configuration, and how to
add new tests.

## Maintenance & Admin

Common operational tasks run through plain `docker compose`. The repository also ships a few
dependency-free sample scripts in `scripts/` that wrap these commands — feel free to adapt
them for your own deployments.

### Container operations

```bash
docker compose ps                 # List containers
docker compose logs -f web        # Follow web logs
docker compose restart web        # Restart a service
docker compose down               # Stop and remove containers
docker compose exec web bash      # Open a shell in the web container
```

### Database backup & restore

```bash
scripts/backup.sh                 # -> backups/backup-<timestamp>.sql.gz
scripts/restore.sh backups/backup-<timestamp>.sql.gz
```

### User & data administration

User and data management are implemented as TypeScript scripts under `web/scripts/`, run with
`tsx` inside the web container:

```bash
docker compose exec -it web npx tsx scripts/create-user.ts
docker compose exec -it web npx tsx scripts/reset-password.ts
docker compose exec -it web npx tsx scripts/delete-user.ts
docker compose exec -it web npx tsx scripts/view-data.ts      # list users/topics/decks/cards
```

## Keeping Dependencies Updated

### Automated Update Checks

Check for outdated npm packages and image CVEs:

```bash
scripts/check-updates.sh
```

This script checks:
- **NPM packages:** Identifies outdated JavaScript dependencies (via `npm-check-updates` in
  the web container)
- **Security vulnerabilities:** Scans the built images for CVEs using Docker Scout (if
  `docker scout` is installed)

### Updating Components

**Docker Engine** (automatically updated via apt):
```bash
# Docker Engine is installed as an Ubuntu package and stays updated with:
sudo apt update && sudo apt upgrade
```

**Docker Scout** (needs manual updates):
```bash
# Quick update:
./scripts/update-docker-scout.sh

# Or manually:
curl -sSfL https://raw.githubusercontent.com/docker/scout-cli/main/install.sh | sh -s -- -b ~/.docker/cli-plugins
```

**NPM packages** (safe minor/patch updates):
```bash
# 1. Check what's available
scripts/check-updates.sh

# 2. Apply updates (run inside the web container)
docker compose exec web sh -c 'npx npm-check-updates --target minor -u && npm install'
```

This workflow:
- Only updates to safe minor/patch versions (no breaking changes)
- Updates both `package.json` and `package-lock.json`
- Runs inside the web container, where the Node toolchain lives

**Docker base images and full rebuild:**
```bash
# Pull latest base images and rebuild
docker compose build --pull

# Or for a completely fresh build:
docker compose build --no-cache --pull
```

### Recommended Maintenance Schedule

- **Weekly:** Run `scripts/check-updates.sh` to monitor for security issues
- **Monthly:** Update NPM packages (see "NPM packages" above)
- **As needed:** Update Docker Scout when new versions are released
- **After security alerts:** Rebuild images immediately with `docker compose build --pull`

## Project Structure

```
web/
├── src/
│   ├── routes/                         # SvelteKit routes
│   │   ├── (dashboard)/                # Authenticated routes
│   │   ├── api/                        # API Routes
│   │   ├── login/                      # Authentication
│   │   ├── register/                   # User registration
│   │   ├── +layout.svelte              # Root layout
│   │   └── +page.svelte                # Home page
│   ├── lib/                            # Utility functions and components
│   ├── hooks.server.ts                 # Server-side hooks
│   └── auth.ts                         # Authentication configuration
├── prisma/                             # Prisma files
└── static/                             # Static assets
```

## Database Schema

The application uses the following database schema:

- **User:** User accounts and authentication information
- **Topic:** High-level categories for organizing flashcards
- **Deck:** Collections of flashcards within topics
- **Card:** Individual flashcards with front, back, and SM-2 parameters

## Study Algorithm

Cadence Cards implements an SM-2 based spaced repetition algorithm with the
following parameters:

- **Grade:** User's self-assessment of recall (perfect, hesitation, incorrect)
- **Interval:** Days between reviews
- **Easiness:** Factor affecting interval growth
- **Priority:** A/B/C classification for importance

## Import/Export Format

Cards can be imported and exported in YAML format:

```yaml
- Front: "Question or prompt"
  Back: "Answer or explanation"
  Note: "Optional additional information or context"
  Priority: A  # A, B, or C
  Tags: [tag1, tag2]  # Optional array of tags
```

## Sharing Decks

You can easily share decks with other users:

### Sharing a Deck

1. Open the deck you want to share
2. Click the **"Share Deck"** button (or use the quick share icon in the deck list)
3. Copy the YAML content from the share modal
4. Send it to others via email, chat, or any messaging platform

The shared YAML includes metadata about the deck:
- Format version
- Deck name
- Creator name (your username)
- Export date
- Card count

**Note:** Your username will be included in the shared deck metadata.

### Importing a Shared Deck

1. Navigate to the **Import** page
2. Paste the YAML content you received, or upload a `.yaml` file
3. Select a topic and choose an existing deck or create a new one
4. Click **Import** to add the cards to your deck

The import process handles YAML with or without metadata comments, ensuring backward compatibility.

## Claude.AI Integration

The application integrates with Claude.AI in multiple ways:

1. **Claude-Assisted Card Creation:** Generate flashcards from text input with
   AI assistance

2. **Study Mode:** Claude generates contextual questions based on card content
   to test understanding, provides feedback on answers, and offers explanations
   when needed

3. **Chat Interface:** Interactive conversations about topics to enhance
   learning and understanding

## Security Features

- **Authentication:** Secure user authentication with Auth.js
- **Rate Limiting:** Protection against brute force attacks and API abuse
- **Structured Logging:** Comprehensive audit trails and request tracing
- **Optimistic Locking:** Prevents data corruption from concurrent edits

## Acknowledgments

The spaced repetition algorithm used by this project is based on the the
SuperMemo 2 (SM-2) algorithm developed by Piotr Woźniak. 

Source: [Application of a computer to improve the results obtained in working with the SuperMemo method](https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method).

## Contributing

I built this for my own use and I'm sharing it in case it's useful to others.
Contributions, bug reports, and feature ideas are welcome!

Since this is a side project, I can't promise specific timelines or support,
but I do actively use and maintain this. If you need something specific, PRs
are encouraged.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
