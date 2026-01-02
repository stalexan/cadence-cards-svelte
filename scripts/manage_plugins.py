#!/usr/bin/env python3
"""
Plugin commands for cadence-cards-svelte.

Includes:
- Database backup/restore
- User management (create, reset-password, delete)
- Data viewing (list users/topics/decks/cards, summary, search)
- Update checking
"""

import os
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Set

from manage import (
    ProjectConfig,
    CommandContext,
    register_command,
    register_subcommand,
    print_status,
    print_success,
    print_warning,
    print_error,
    fatal,
    confirm,
    run,
)

# =============================================================================
# PROJECT CONFIGURATION
# =============================================================================

config = ProjectConfig(
    name="cadence-cards-svelte",
    compose_files=["docker-compose.yml"],
    env_compose_pattern="docker-compose.{env}.yml",
    default_env="dev",
)

# =============================================================================
# DATABASE BACKUP/RESTORE
# =============================================================================

@register_command(
    "backup",
    help="Create a database backup",
    arguments=[
        {"args": ["-o", "--output"], "help": "Output file path"},
        {"args": ["--no-compress"], "action": "store_true", "dest": "no_compress",
         "help": "Do not compress the backup (default: compress)"},
    ]
)
def cmd_backup(ctx: CommandContext) -> None:
    """Create a database backup."""
    service = "db"
    ctx.require_service_running(service)

    compress = not getattr(ctx.args, "no_compress", False)

    # Determine output path
    if ctx.args.output:
        output_path = Path(ctx.args.output)
    else:
        backups_dir = ctx.project_dir / "backups"
        backups_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        ext = ".sql.gz" if compress else ".sql"
        output_path = backups_dir / f"backup-{timestamp}{ext}"

    abs_output_path = output_path.resolve()
    output_file = abs_output_path.name

    print_status(f"Creating backup: {abs_output_path}")

    # Build pg_dump command
    if compress:
        dump_cmd = 'PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -F p | gzip > /tmp/' + output_file
    else:
        dump_cmd = 'PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -F p -f /tmp/' + output_file

    ctx.compose("exec", "-T", service, "sh", "-c", dump_cmd)

    # Copy from container
    run(["docker", "compose", "cp", f"{service}:/tmp/{output_file}", str(abs_output_path)])

    # Clean up
    ctx.compose("exec", "-T", service, "rm", "-f", f"/tmp/{output_file}", check=False)

    print_success(f"Backup created: {abs_output_path}")


@register_command(
    "restore",
    help="Restore database from a backup file",
    arguments=[
        {"args": ["backup_file"], "help": "Path to backup file"},
        {"args": ["-y", "--yes"], "action": "store_true", "help": "Skip confirmation"},
    ]
)
def cmd_restore(ctx: CommandContext) -> None:
    """Restore database from a backup file."""
    service = "db"
    backup_path = Path(ctx.args.backup_file).resolve()

    if not backup_path.exists():
        fatal(f"Backup file not found: {backup_path}")

    if not backup_path.is_file():
        fatal(f"Path is not a file: {backup_path}")

    ctx.require_service_running(service)

    if not ctx.args.yes:
        if not confirm(f"This will REPLACE all data in the database with '{backup_path}'. Continue?"):
            print("Aborted.")
            return

    print_status(f"Restoring backup from: {backup_path}")

    backup_filename = backup_path.name
    container_path = f"/tmp/{backup_filename}"

    # Copy to container
    ctx.compose("cp", str(backup_path), f"{service}:{container_path}")

    try:
        # Drop and recreate schema
        print_status("Dropping existing schema...")
        drop_cmd = 'PGPASSWORD="${POSTGRES_PASSWORD}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
        ctx.compose("exec", "-T", service, "sh", "-c", drop_cmd)

        # Restore
        is_compressed = backup_path.suffix == ".gz" or str(backup_path).endswith(".sql.gz")
        if is_compressed:
            restore_cmd = f'PGPASSWORD="${{POSTGRES_PASSWORD}}" gunzip < {container_path} | psql -U "${{POSTGRES_USER}}" -d "${{POSTGRES_DB}}"'
        else:
            restore_cmd = f'PGPASSWORD="${{POSTGRES_PASSWORD}}" psql -U "${{POSTGRES_USER}}" -d "${{POSTGRES_DB}}" -f {container_path}'

        ctx.compose("exec", "-T", service, "sh", "-c", restore_cmd)
        print_success("Backup restored successfully")
    finally:
        ctx.compose("exec", "-T", service, "rm", "-f", container_path, check=False)


# =============================================================================
# DB COMMAND GROUP
# =============================================================================

@register_command("db", help="Database management commands")
def cmd_db(ctx: CommandContext) -> None:
    """Parent command for database operations."""
    pass


@register_subcommand(
    "db", "create-user",
    help="Create a new user account",
    arguments=[
        {"args": ["--email"], "required": True, "help": "User email address"},
        {"args": ["--name"], "required": True, "help": "User name"},
        {"args": ["--password"], "help": "User password (prompts if not provided)"},
    ]
)
def cmd_db_create_user(ctx: CommandContext) -> None:
    """Create a new user account."""
    service = "web"
    ctx.require_service_running(service)

    compose_cmd = ctx.get_compose_cmd()
    cmd = compose_cmd + ["exec", "-it", service, "npx", "tsx", "scripts/create-user.ts"]

    if ctx.args.email:
        cmd.extend(["--email", ctx.args.email])
    if ctx.args.name:
        cmd.extend(["--name", ctx.args.name])
    if hasattr(ctx.args, "password") and ctx.args.password:
        cmd.extend(["--password", ctx.args.password])

    os.chdir(ctx.project_dir)
    os.execvp(cmd[0], cmd)


@register_subcommand(
    "db", "reset-password",
    help="Reset a user's password",
    arguments=[
        {"args": ["--email"], "help": "User email address"},
        {"args": ["--id"], "type": int, "help": "User ID"},
    ]
)
def cmd_db_reset_password(ctx: CommandContext) -> None:
    """Reset a user's password."""
    service = "web"
    ctx.require_service_running(service)

    compose_cmd = ctx.get_compose_cmd()
    cmd = compose_cmd + ["exec", "-it", service, "npx", "tsx", "scripts/reset-password.ts"]

    if ctx.args.email:
        cmd.extend(["--email", ctx.args.email])
    if ctx.args.id:
        cmd.extend(["--id", str(ctx.args.id)])

    os.chdir(ctx.project_dir)
    os.execvp(cmd[0], cmd)


@register_subcommand(
    "db", "delete-user",
    help="Delete a user account",
    arguments=[
        {"args": ["--email"], "help": "User email address"},
        {"args": ["--id"], "type": int, "help": "User ID"},
        {"args": ["-y", "--yes"], "action": "store_true", "help": "Skip confirmation"},
    ]
)
def cmd_db_delete_user(ctx: CommandContext) -> None:
    """Delete a user account."""
    service = "web"
    ctx.require_service_running(service)

    compose_cmd = ctx.get_compose_cmd()
    cmd = compose_cmd + ["exec", "-it", service, "npx", "tsx", "scripts/delete-user.ts"]

    if ctx.args.email:
        cmd.extend(["--email", ctx.args.email])
    if ctx.args.id:
        cmd.extend(["--id", str(ctx.args.id)])
    if ctx.args.yes:
        cmd.append("--yes")

    os.chdir(ctx.project_dir)
    os.execvp(cmd[0], cmd)


@register_subcommand("db", "summary", help="Show summary statistics")
def cmd_db_summary(ctx: CommandContext) -> None:
    """Show database summary statistics."""
    service = "web"
    ctx.require_service_running(service)
    ctx.compose("exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", "summary")


@register_subcommand(
    "db", "search",
    help="Search cards for text",
    arguments=[
        {"args": ["text"], "help": "Search text"},
        {"args": ["--limit"], "type": int, "help": "Limit number of results"},
        {"args": ["--due"], "action": "store_true", "help": "Show only cards due today"},
    ]
)
def cmd_db_search(ctx: CommandContext) -> None:
    """Search cards for text."""
    service = "web"
    ctx.require_service_running(service)

    cmd = ["exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", "search", ctx.args.text]

    if ctx.args.limit:
        cmd.extend(["--limit", str(ctx.args.limit)])
    if ctx.args.due:
        cmd.append("--due")

    ctx.compose(*cmd)


# =============================================================================
# DB LIST SUBCOMMANDS
# =============================================================================

@register_subcommand("db", "list", help="List data (users, topics, decks, cards)")
def cmd_db_list(ctx: CommandContext) -> None:
    """Parent for list subcommands."""
    pass


# Note: For nested subcommands (db list users), we use separate top-level commands
# since the plugin system doesn't support 3-level nesting

@register_command(
    "db-list-users",
    help="List all users",
    arguments=[
        {"args": ["--limit"], "type": int, "help": "Limit number of results"},
    ]
)
def cmd_db_list_users(ctx: CommandContext) -> None:
    """List all users."""
    service = "web"
    ctx.require_service_running(service)

    cmd = ["exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", "users"]
    if ctx.args.limit:
        cmd.extend(["--limit", str(ctx.args.limit)])

    ctx.compose(*cmd)


@register_command(
    "db-list-topics",
    help="List all topics",
    arguments=[
        {"args": ["user_id"], "nargs": "?", "type": int, "help": "Filter by user ID"},
        {"args": ["--limit"], "type": int, "help": "Limit number of results"},
    ]
)
def cmd_db_list_topics(ctx: CommandContext) -> None:
    """List all topics."""
    service = "web"
    ctx.require_service_running(service)

    cmd = ["exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", "topics"]
    if ctx.args.user_id:
        cmd.append(str(ctx.args.user_id))
    if ctx.args.limit:
        cmd.extend(["--limit", str(ctx.args.limit)])

    ctx.compose(*cmd)


@register_command(
    "db-list-decks",
    help="List all decks",
    arguments=[
        {"args": ["topic_id"], "nargs": "?", "type": int, "help": "Filter by topic ID"},
        {"args": ["--limit"], "type": int, "help": "Limit number of results"},
    ]
)
def cmd_db_list_decks(ctx: CommandContext) -> None:
    """List all decks."""
    service = "web"
    ctx.require_service_running(service)

    cmd = ["exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", "decks"]
    if ctx.args.topic_id:
        cmd.append(str(ctx.args.topic_id))
    if ctx.args.limit:
        cmd.extend(["--limit", str(ctx.args.limit)])

    ctx.compose(*cmd)


@register_command(
    "db-list-cards",
    help="List all cards",
    arguments=[
        {"args": ["deck_id"], "nargs": "?", "type": int, "help": "Filter by deck ID"},
        {"args": ["--limit"], "type": int, "help": "Limit number of results"},
        {"args": ["--due"], "action": "store_true", "help": "Show only cards due today"},
    ]
)
def cmd_db_list_cards(ctx: CommandContext) -> None:
    """List all cards."""
    service = "web"
    ctx.require_service_running(service)

    cmd = ["exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", "cards"]
    if ctx.args.deck_id:
        cmd.append(str(ctx.args.deck_id))
    if ctx.args.limit:
        cmd.extend(["--limit", str(ctx.args.limit)])
    if ctx.args.due:
        cmd.append("--due")

    ctx.compose(*cmd)


@register_command(
    "db-list-card",
    help="Show details for a specific card",
    arguments=[
        {"args": ["card_id"], "type": int, "help": "Card ID"},
    ]
)
def cmd_db_list_card(ctx: CommandContext) -> None:
    """Show details for a specific card."""
    service = "web"
    ctx.require_service_running(service)
    ctx.compose("exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", "card", str(ctx.args.card_id))


@register_command("db-list-all", help="Display all data in hierarchical structure")
def cmd_db_list_all(ctx: CommandContext) -> None:
    """Display all data in hierarchical structure."""
    service = "web"
    ctx.require_service_running(service)
    ctx.compose("exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", "all")


# =============================================================================
# UPDATE CHECKING
# =============================================================================

def _check_docker_images(ctx: CommandContext) -> bool:
    """Check for Docker base image updates."""
    print_status("=== Docker Base Images ===")
    print_status("Checking if newer versions of base images are available...")
    print()

    # Find Dockerfiles
    dockerfiles = []
    for root, dirs, files in os.walk(ctx.project_dir):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', '.svelte-kit', '__pycache__', 'backups')]
        for f in files:
            if f.startswith('Dockerfile'):
                dockerfiles.append(Path(root) / f)

    if not dockerfiles:
        print_warning("No Dockerfiles found")
        return False

    # Extract base images
    base_images: Set[str] = set()
    for dockerfile in dockerfiles:
        try:
            with open(dockerfile) as f:
                for line in f:
                    if line.strip().startswith('#'):
                        continue
                    match = re.match(r"^FROM\s+(\S+)", line.strip(), re.IGNORECASE)
                    if match:
                        image = match.group(1)
                        if image and image != "scratch":
                            base_images.add(image)
                            break
        except Exception as e:
            print_warning(f"Could not read {dockerfile}: {e}")

    if not base_images:
        print_warning("No base images found")
        return False

    print_status("Checking for base image updates...")
    updates_found = False

    for image in sorted(base_images):
        print_status(f"Checking {image}...")
        try:
            cp = run(["docker", "pull", image], capture_output=True)
            output = (cp.stdout or "") + (cp.stderr or "")

            if any(kw in output.lower() for kw in ["downloaded", "pull complete"]):
                print_warning(f"  Updated: {image}")
                updates_found = True
            elif "up to date" in output.lower():
                print_success(f"  Current: {image}")
            else:
                print_status(f"  Checked: {image}")
        except subprocess.CalledProcessError:
            print_error(f"  Failed to check: {image}")

    print()
    if updates_found:
        print_warning("Base image updates found. Rebuild with: ./manage.py rebuild")
    else:
        print_success("All base images are up to date")

    return updates_found


def _check_npm_dependencies(ctx: CommandContext) -> bool:
    """Check for NPM package updates."""
    print_status("=== NPM Dependencies ===")

    service = "web"
    if not ctx.is_service_running(service):
        print_warning(f"{service} is not running - skipping NPM checks")
        return False

    print_status("Checking for safe updates (minor and patch versions)...")
    try:
        cp = ctx.compose(
            "exec", "-T", service, "npx", "ncu", "--target", "minor",
            capture_output=True, check=False
        )
        ncu_output = cp.stdout or ""
        has_updates = bool(re.search(r'^\s*[@a-zA-Z].*→', ncu_output, re.MULTILINE))

        if has_updates:
            print_warning("Safe updates available:")
            print(ncu_output)
            print_status("To apply: ./manage.py shell -s web -> npx ncu --target minor -u && npm install")
        else:
            print_success("All packages are up to date")

        # Check major
        cp = ctx.compose(
            "exec", "-T", service, "npx", "ncu", "--target", "major",
            capture_output=True, check=False
        )
        major_output = cp.stdout or ""
        if re.search(r'^\s*[@a-zA-Z].*→', major_output, re.MULTILINE):
            print_status("Major updates available (require manual review)")

        # Audit
        print()
        print_status("=== NPM Security Audit ===")
        ctx.compose("exec", "-T", service, "npm", "audit", check=False)

        return has_updates
    except Exception as e:
        print_warning(f"Failed to check NPM dependencies: {e}")
        return False


def _check_docker_scout(ctx: CommandContext) -> None:
    """Check Docker images for security vulnerabilities."""
    print_status("=== Docker Scout Scan ===")

    # Check if available
    try:
        subprocess.run(["docker", "scout", "--help"], capture_output=True, check=True)
    except Exception:
        print_warning("Docker Scout not available - skipping security scan")
        return

    # Get project images
    project_name = ctx.config.name
    images = [f"{project_name}-web", f"{project_name}-db"]

    existing = []
    for img in images:
        try:
            subprocess.run(["docker", "image", "inspect", img], capture_output=True, check=True)
            existing.append(img)
        except Exception:
            pass

    if not existing:
        print_warning("No project images found")
        return

    print_status(f"Scanning {len(existing)} images...")

    for image in existing:
        print_status(f"Scanning {image}...")
        try:
            cp = subprocess.run(
                ["docker", "scout", "cves", image, "--only-severity", "high,critical"],
                capture_output=True, text=True
            )
            if "vulnerabilities" in cp.stdout.lower() or "high" in cp.stdout.lower():
                print_warning(f"  Vulnerabilities found in {image}")
            else:
                print_success(f"  No high/critical vulnerabilities")
        except Exception:
            print_warning(f"  Failed to scan {image}")


@register_command("check-updates", help="Check for NPM and Docker image updates")
def cmd_check_updates(ctx: CommandContext) -> None:
    """Check for available updates."""
    print_status("Checking for available updates...")
    print()

    docker_updates = _check_docker_images(ctx)
    print()
    npm_updates = _check_npm_dependencies(ctx)
    print()
    _check_docker_scout(ctx)
    print()

    print_status("Update check completed")
