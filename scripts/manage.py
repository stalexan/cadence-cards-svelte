#!/usr/bin/env python3

import argparse
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from typing import List, Optional, Set, Tuple

# =============================================================================
# CONFIGURATION
# =============================================================================

# Environment configuration
# Set ENVIRONMENT=prod for production, defaults to dev
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')
COMPOSE_FILE = f'docker-compose.{ENVIRONMENT}.yml'


def _get_compose_cmd() -> List[str]:
    """Get the base docker compose command with environment-specific files."""
    return ["docker", "compose", "-f", "docker-compose.yml", "-f", COMPOSE_FILE]


def fatal(message: str, exit_code: int = 1) -> None:
    print(f"Error: {message}", file=sys.stderr)
    sys.exit(exit_code)


def run(cmd: List[str], check: bool = True, capture_output: bool = False, env: Optional[dict] = None) -> subprocess.CompletedProcess:
    # Print command before execution
    print(f"Running: {' '.join(cmd)}")
    try:
        if capture_output:
            return subprocess.run(cmd, check=check, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        return subprocess.run(cmd, check=check, env=env)
    except subprocess.CalledProcessError as e:
        if capture_output and e.stdout:
            print(e.stdout)
        if e.stderr:
            print(e.stderr, file=sys.stderr)
        raise

def cmd_build(args: argparse.Namespace) -> None:
    compose = _get_compose_cmd()
    cmd = [*compose, "build"]
    if args.no_cache:
        cmd.append("--no-cache")
    if args.pull:
        cmd.append("--pull")
    if args.service:
        cmd.extend(args.service)
    run(cmd)


def cmd_up(args: argparse.Namespace) -> None:
    compose = _get_compose_cmd()
    cmd = [*compose, "up"]
    if args.detached:
        cmd.append("-d")
    if args.service:
        cmd.extend(args.service)
    run(cmd)


def cmd_down(args: argparse.Namespace) -> None:
    compose = _get_compose_cmd()
    cmd = [*compose, "down"]
    run(cmd)


def cmd_logs(args: argparse.Namespace) -> None:
    compose = _get_compose_cmd()
    cmd = [*compose, "logs"]
    if args.follow:
        cmd.append("--follow")
    if args.timestamps:
        cmd.append("--timestamps")
    if args.tail:
        cmd.extend(["--tail", args.tail])
    if args.since:
        cmd.extend(["--since", args.since])
    if args.service:
        cmd.extend(args.service)
    run(cmd)


def cmd_status(_args: argparse.Namespace) -> None:
    compose = _get_compose_cmd()
    cmd = [*compose, "ps"]
    run(cmd)


def _choose_target_service(compose: List[str], preferred: Optional[str]) -> Optional[str]:
    # If user provided a service, trust it
    if preferred:
        return preferred
    # Otherwise, pick the first running service from `compose ps --services --status running`
    try:
        cp = run([*compose, "ps", "--services", "--status", "running"], capture_output=True)
        services = [s.strip() for s in (cp.stdout or "").splitlines() if s.strip()]
        if services:
            return services[0]
    except Exception:
        pass
    # Fallback: any service
    try:
        cp = run([*compose, "ps", "--services"], capture_output=True)
        services = [s.strip() for s in (cp.stdout or "").splitlines() if s.strip()]
        if services:
            return services[0]
    except Exception:
        pass
    return None


def cmd_shell(args: argparse.Namespace) -> None:
    compose = _get_compose_cmd()
    service = _choose_target_service(compose, args.service)
    if not service:
        fatal("Could not determine a target service. Specify one with --service.")

    # Try bash then sh
    for shell_cmd in (["bash"], ["sh"]):
        try:
            cmd = [*compose, "exec", "-it", service, *shell_cmd]
            # Use os.execvp replacement to attach TTY properly
            os.execvp(cmd[0], cmd)
        except FileNotFoundError:
            fatal(f"Command not found: {cmd[0]}")
        except OSError:
            # Fall back to next shell option
            continue
        break
    fatal("Failed to start a shell inside the container (bash/sh not available).")


def confirm(prompt: str) -> bool:
    try:
        ans = input(f"{prompt} [y/N]: ").strip().lower()
    except EOFError:
        return False
    return ans in ("y", "yes")


def cmd_clean(args: argparse.Namespace) -> None:
    if not args.yes:
        if not confirm("This will prune unused containers, networks, images and optionally volumes. Continue?"):
            print("Aborted.")
            return
    # Prune containers, networks, images (dangling + unused), build cache
    run(["docker", "system", "prune", "-f"])
    if args.volumes:
        run(["docker", "volume", "prune", "-f"])


def cmd_stats(_args: argparse.Namespace) -> None:
    # Live stats until interrupted
    run(["docker", "stats"])


def cmd_backup(args: argparse.Namespace) -> None:
    compose = _get_compose_cmd()
    service = "db"

    # Check if db service is running
    try:
        cp = run([*compose, "ps", "--services", "--status", "running"], capture_output=True)
        running_services = [s.strip() for s in (cp.stdout or "").splitlines() if s.strip()]
        if service not in running_services:
            fatal(f"Service '{service}' is not running. Start it with './scripts/manage.py up'")
    except Exception:
        fatal(f"Could not check if service '{service}' is running")

    # Determine output file
    if args.output:
        output_path = args.output
        # Ensure .sql.gz extension if compressing, or .sql if not
        if args.compress and not output_path.endswith(('.gz', '.sql.gz')):
            if not output_path.endswith('.sql'):
                output_path += '.sql'
            output_path += '.gz'
        elif not args.compress and not output_path.endswith('.sql'):
            output_path += '.sql'
    else:
        # Default: timestamped file in backups/ directory
        backups_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backups")
        os.makedirs(backups_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        filename = f"backup-{timestamp}.sql"
        if args.compress:
            filename += ".gz"
        output_path = os.path.join(backups_dir, filename)

    # Get absolute path for mounting
    abs_output_path = os.path.abspath(output_path)
    output_dir = os.path.dirname(abs_output_path)
    output_file = os.path.basename(abs_output_path)

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    print(f"Creating backup: {abs_output_path}")

    # Build pg_dump command
    # Environment variables POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB are available in container
    # Use PGPASSWORD for authentication
    if args.compress:
        # Run pg_dump and pipe through gzip
        # Escape quotes properly for sh -c
        dump_cmd = 'PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -F p | gzip > /tmp/' + output_file
        full_cmd = ["sh", "-c", dump_cmd]
    else:
        dump_cmd = 'PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -F p -f /tmp/' + output_file
        full_cmd = ["sh", "-c", dump_cmd]

    # Execute pg_dump in container
    run([*compose, "exec", "-T", service, *full_cmd])

    # Copy file from container to host
    run(["docker", "compose", "cp", f"{service}:/tmp/{output_file}", abs_output_path])

    # Clean up temp file in container
    try:
        run([*compose, "exec", "-T", service, "rm", "-f", f"/tmp/{output_file}"], check=False)
    except Exception:
        pass  # Ignore errors cleaning up temp file

    print(f"Backup created successfully: {abs_output_path}")


def cmd_restore(args: argparse.Namespace) -> None:
    compose = _get_compose_cmd()
    service = "db"

    # Validate backup file exists
    backup_path = os.path.abspath(args.backup_file)
    if not os.path.exists(backup_path):
        fatal(f"Backup file not found: {backup_path}")

    if not os.path.isfile(backup_path):
        fatal(f"Path is not a file: {backup_path}")

    # Check if db service is running
    try:
        cp = run([*compose, "ps", "--services", "--status", "running"], capture_output=True)
        running_services = [s.strip() for s in (cp.stdout or "").splitlines() if s.strip()]
        if service not in running_services:
            fatal(f"Service '{service}' is not running. Start it with './scripts/manage.py up'")
    except Exception:
        fatal(f"Could not check if service '{service}' is running")

    # Confirm before restoring
    if not args.yes:
        if not confirm(f"This will REPLACE all data in the database with the backup from '{backup_path}'. Continue?"):
            print("Aborted.")
            return

    print(f"Restoring backup from: {backup_path}")

    # Copy backup file into container
    backup_filename = os.path.basename(backup_path)
    container_path = f"/tmp/{backup_filename}"

    compose = _get_compose_cmd()
    run([*compose, "cp", backup_path, f"{service}:{container_path}"])

    try:
        # Drop and recreate public schema to ensure clean restore
        print("Dropping existing schema...")
        drop_cmd = ["sh", "-c", 'PGPASSWORD="${POSTGRES_PASSWORD}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"']
        run([*compose, "exec", "-T", service, *drop_cmd])

        # Determine if file is compressed
        is_compressed = backup_path.endswith('.gz') or backup_path.endswith('.sql.gz')

        if is_compressed:
            # Use gunzip and psql with PGPASSWORD for authentication
            restore_cmd = ["sh", "-c", f'PGPASSWORD="${{POSTGRES_PASSWORD}}" gunzip < {container_path} | psql -U "${{POSTGRES_USER}}" -d "${{POSTGRES_DB}}"']
        else:
            # Use psql directly with PGPASSWORD for authentication
            restore_cmd = ["sh", "-c", f'PGPASSWORD="${{POSTGRES_PASSWORD}}" psql -U "${{POSTGRES_USER}}" -d "${{POSTGRES_DB}}" -f {container_path}']

        # Execute restore
        run([*compose, "exec", "-T", service, *restore_cmd])

        print("Backup restored successfully.")
    finally:
        # Clean up temp file in container
        try:
            run([*compose, "exec", "-T", service, "rm", "-f", container_path], check=False)
        except Exception:
            pass  # Ignore errors cleaning up temp file


def _is_service_running(compose: List[str], service_name: str) -> bool:
    """Check if a service is running."""
    try:
        cp = run([*compose, "ps", "--services", "--status", "running"], capture_output=True)
        running_services = [s.strip() for s in (cp.stdout or "").splitlines() if s.strip()]
        return service_name in running_services
    except Exception:
        return False


def _require_service_running(compose: List[str], service_name: str) -> None:
    """Require a service to be running, exit if not."""
    if not _is_service_running(compose, service_name):
        fatal(f"{service_name} container is not running. Please start it first with: ./scripts/manage.py up -d")


def _print_status(message: str) -> None:
    """Print a status message."""
    print(f"ℹ️  {message}")


def _print_success(message: str) -> None:
    """Print a success message."""
    print(f"✓ {message}")


def _print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"⚠️  {message}", file=sys.stderr)


def _print_error(message: str) -> None:
    """Print an error message."""
    print(f"✗ {message}", file=sys.stderr)


def _check_docker_images() -> bool:
    """Check for Docker base image updates by scanning Dockerfiles."""
    _print_status("=== Docker Base Images ===")
    _print_status("Checking if newer versions of base images (used in Dockerfiles) are available...")
    _print_status("Note: This only checks if newer versions of base images are available, not whether")
    _print_status("our locally built images are using the latest base image versions.")
    print()

    # Get the project root directory (directory where manage.py is located)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = script_dir

    # Find all Dockerfiles in the project
    dockerfiles = []
    # Search recursively for Dockerfiles, but skip common directories
    for root, dirs, files in os.walk(project_root):
        # Skip node_modules and other common directories
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', '.svelte-kit', '__pycache__', 'backups', 'logs')]
        for file in files:
            if file.startswith('Dockerfile'):
                dockerfiles.append(os.path.join(root, file))

    # Show which Dockerfiles were found (for debugging)
    if dockerfiles:
        _print_status(f"Found {len(dockerfiles)} Dockerfile(s):")
        for df in dockerfiles:
            rel_path = os.path.relpath(df, project_root)
            print(f"  - {rel_path}")
        print()

    if not dockerfiles:
        _print_warning("No Dockerfiles found")
        return False

    # Extract base images from Dockerfiles (only the first FROM statement in each file)
    base_images: Set[str] = set()
    for dockerfile in dockerfiles:
        try:
            with open(dockerfile, "r") as f:
                for line in f:
                    # Skip comment lines
                    if line.strip().startswith('#'):
                        continue
                    # Match FROM lines (only the first one in each file is the base image)
                    match = re.match(r"^FROM\s+(.+?)(?:\s+as\s+|$)", line.strip(), re.IGNORECASE)
                    if match:
                        image = match.group(1).strip().split()[0]  # Get first word (image name)
                        if image and image != "scratch":
                            base_images.add(image)
                            break  # Only take the first FROM statement (base image)
        except Exception as e:
            _print_warning(f"Could not read {dockerfile}: {e}")

    if not base_images:
        _print_warning("No base images found in Dockerfiles")
        return False

    base_images = sorted(base_images)
    _print_status("Checking for base image updates...")
    updates_found = False

    for image in base_images:
        _print_status(f"Checking {image}...")
        try:
            # Pull the image to check for updates
            cp = run(["docker", "pull", image], capture_output=True)
            output = cp.stdout or ""
            stderr = cp.stderr or ""

            # Check if anything was actually pulled/downloaded
            if any(keyword in output.lower() or keyword in stderr.lower()
                   for keyword in ["downloaded", "pull complete", "status: downloaded newer image"]):
                _print_warning(f"  Updated: {image}")
                updates_found = True
            elif "status: image is up to date" in output.lower() or "status: image is up to date" in stderr.lower():
                _print_success(f"  Current: {image}")
            else:
                _print_status(f"  Checked: {image}")
        except subprocess.CalledProcessError as e:
            _print_error(f"Failed to check {image}")
            if e.stderr:
                for line in e.stderr.splitlines():
                    print(f"  {line}", file=sys.stderr)

    print()
    if updates_found:
        _print_warning("Base image updates found. Services need rebuilding:")
        _print_status("  docker compose build --pull")
        _print_status("  docker compose up -d")
        return True
    else:
        _print_success("All base images are up to date")
        return False


def _check_npm_audit(compose: List[str], service: str) -> None:
    """Check for NPM security vulnerabilities."""
    _print_status("=== NPM Security Audit ===")
    _print_status("NPM security audit results:")

    try:
        cp = run([*compose, "exec", "-T", service, "npm", "audit"], capture_output=True)
        output = cp.stdout or ""
        print(output)

        # npm audit returns 0 if no vulnerabilities, non-zero if vulnerabilities found
        if cp.returncode == 0:
            _print_success("No security vulnerabilities found")
        else:
            if "vulnerabilities" in output.lower():
                _print_warning("Security vulnerabilities detected - review the audit results above")
            else:
                _print_warning("npm audit completed with warnings - review the results above")
    except subprocess.CalledProcessError as e:
        output = e.stdout or ""
        stderr = e.stderr or ""
        print(output)
        if stderr:
            print(stderr, file=sys.stderr)
        if "vulnerabilities" in output.lower() or "vulnerabilities" in stderr.lower():
            _print_warning("Security vulnerabilities detected - review the audit results above")
        else:
            _print_warning("npm audit completed with errors - review the results above")


def _run_ncu_check(compose: List[str], service: str, target: str) -> Tuple[bool, str]:
    """Run ncu (npm-check-updates) for a specific target. Returns (has_updates, output)."""
    try:
        cp = run([*compose, "exec", "-T", service, "npx", "ncu", "--target", target],
                 capture_output=True, check=False)
        output = cp.stdout or ""
        stderr = cp.stderr or ""

        # Check if ncu output contains actual package updates (lines with → indicating version changes)
        full_output = output + stderr
        has_updates = bool(re.search(r'^\s*[@a-zA-Z].*→', full_output, re.MULTILINE))

        return has_updates, output
    except Exception:
        return False, ""


def _check_npm_dependencies(compose: List[str], service: str) -> bool:
    """Check for NPM package updates in the application."""
    _print_status("=== NPM Dependencies ===")
    _require_service_running(compose, service)

    # Check for minor and patch updates using ncu
    _print_status("Checking for safe updates (minor and patch versions)...")
    has_updates, ncu_output = _run_ncu_check(compose, service, "minor")

    if has_updates:
        _print_warning("Safe updates available (minor/patch versions):")
        print(ncu_output)
        print()
        _print_status("To apply these safe updates:")
        _print_status("  ./scripts/manage.py shell --service web")
        _print_status("  npx ncu --target minor -u && npm install")
        print()
        _print_status("Or update individually:")
        _print_status("  npm update <package-name>")
        print()
    else:
        _print_success("All packages are up to date (minor/patch level)")
        print()

    # Check for major updates but don't warn - just inform
    _print_status("Checking for major version updates...")
    has_major, major_output = _run_ncu_check(compose, service, "major")

    if has_major:
        _print_status("ℹ️  Major version updates available (require manual review):")
        _print_status("  Run: ./scripts/manage.py shell --service web -> npx ncu --target major")
        _print_status("  Review breaking changes before applying major updates")
    else:
        _print_status("No major version updates available")

    print()

    # Run npm audit for security issues
    _check_npm_audit(compose, service)

    return has_updates


def _get_project_images() -> List[str]:
    """Get list of project images that exist locally."""
    # Get project name from directory name (where manage.py is located)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = script_dir
    project_name = os.path.basename(project_root)

    # Common service names that might have built images
    potential_images = [
        f"{project_name}-web",
        f"{project_name}-db",
    ]

    # Check which images actually exist locally
    existing_images = []
    for image in potential_images:
        try:
            cp = run(["docker", "image", "inspect", image], capture_output=True, check=False)
            # docker image inspect returns 0 if image exists, non-zero if not
            if cp.returncode == 0:
                existing_images.append(image)
        except Exception:
            pass

    return existing_images


def _check_docker_scout_version() -> None:
    """Check if Docker Scout is up to date and offer to update it."""
    _print_status("=== Docker Scout Version ===")
    
    # Check if Docker Scout is available
    try:
        cp = run(["docker", "scout", "version"], capture_output=True, check=False)
        if cp.returncode != 0:
            _print_warning("Docker Scout not installed")
            _print_status("Install: curl -sSfL https://raw.githubusercontent.com/docker/scout-cli/main/install.sh | sh -s -- -b ~/.docker/cli-plugins")
            return
        
        version_output = cp.stdout or ""
        
        # Extract current version (format: "version: v1.19.0")
        current_match = re.search(r'version:\s+v?(\d+\.\d+\.\d+)', version_output)
        if not current_match:
            _print_warning("Could not determine Docker Scout version")
            return
        
        current_version = current_match.group(1)
        _print_status(f"Current version: v{current_version}")
        
        # Check for latest version from GitHub API
        try:
            import urllib.request
            import json
            req = urllib.request.Request(
                "https://api.github.com/repos/docker/scout-cli/releases/latest",
                headers={'Accept': 'application/vnd.github.v3+json'}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                latest_version = data.get('tag_name', '').lstrip('v')
                
                if latest_version and latest_version != current_version:
                    _print_warning(f"New version available: v{latest_version}")
                    _print_status("To update: curl -sSfL https://raw.githubusercontent.com/docker/scout-cli/main/install.sh | sh -s -- -b ~/.docker/cli-plugins")
                else:
                    _print_success(f"Docker Scout is up to date (v{current_version})")
        except Exception:
            # If we can't check latest version, just report current
            _print_status(f"Using version v{current_version}")
            
    except Exception as e:
        _print_warning(f"Could not check Docker Scout version: {e}")


def _check_docker_security() -> None:
    """Check Docker images for security vulnerabilities using Docker Scout."""
    _print_status("=== Docker Scout Scan ===")

    # Check if Docker Scout is available
    try:
        run(["docker", "scout", "--help"], capture_output=True, check=False)
    except Exception:
        _print_warning("Docker Scout not available - skipping security scan")
        _print_status("Install: curl -sSfL https://raw.githubusercontent.com/docker/scout-cli/main/install.sh | sh -s -- -b ~/.docker/cli-plugins")
        return

    # Get images to scan
    _print_status("Looking for compose project images...")
    images = _get_project_images()

    if not images:
        _print_warning("No project images found")
        _print_status("Build images first: ./scripts/manage.py build")
        return

    _print_status(f"Found {len(images)} images to scan:")
    for image in images:
        print(f"  - {image}")
    print()

    vulnerabilities_found = False

    for image in images:
        _print_status(f"Scanning {image}...")
        try:
            # Scan for high/critical vulnerabilities only (faster)
            cp = run(["docker", "scout", "cves", image, "--only-severity", "high,critical", "--format", "packages"],
                     capture_output=True, check=False)
            output = cp.stdout or ""
            stderr = cp.stderr or ""
            full_output = output + stderr

            if re.search(r"(vulnerabilities found|HIGH|CRITICAL)", full_output, re.IGNORECASE):
                _print_warning("  └─ High/Critical vulnerabilities found")
                vulnerabilities_found = True
                # Print the detailed output, filtering out non-essential messages
                print()
                # Filter and print only relevant vulnerability information
                lines = full_output.split('\n')
                # Skip lines about storing/indexing, but show the rest
                relevant_lines = []
                for line in lines:
                    # Skip informational messages about storing/indexing
                    if (line.strip().startswith('...') or
                        'storing' in line.lower() or
                        'indexing' in line.lower()):
                        continue
                    # Skip the success checkmarks for storing/indexing
                    if (line.strip().startswith('✓') and
                        ('stored' in line.lower() or 'indexed' in line.lower())):
                        continue
                    # Skip Docker Scout version update messages (can start with 'i' or 'INFO')
                    if ('new version' in line.lower() and
                        ('docker scout' in line.lower() or 'scout-cli' in line.lower())):
                        continue
                    # Also skip lines that are just informational messages starting with 'i'
                    if line.strip().startswith('i ') and 'version' in line.lower():
                        continue
                    # Show everything else
                    if line.strip():
                        relevant_lines.append(line)

                if relevant_lines:
                    print('\n'.join(relevant_lines))
                    print()
            else:
                _print_success("  └─ No high/critical vulnerabilities")
        except Exception as e:
            _print_warning(f"  └─ Scan failed: {e}")

    print()
    if vulnerabilities_found:
        _print_warning("Security issues detected")
        _print_status("For details: docker scout cves <image-name>")
    else:
        _print_success("All images passed security scan")


def cmd_check_updates(_args: argparse.Namespace) -> None:
    """Check for NPM package updates and Docker base image updates."""
    compose = _get_compose_cmd()
    service = "web"  # Node.js service name

    _print_status("Checking for available updates...")
    print()

    # Check Docker Scout version first
    _check_docker_scout_version()
    print()

    # Check base images (always available, no dependencies needed)
    docker_updates = _check_docker_images()
    print()

    # Check NPM dependencies if containers are running
    npm_updates = False
    if _is_service_running(compose, service):
        npm_updates = _check_npm_dependencies(compose, service)
        print()
    else:
        _print_warning(f"{service} service is not running - skipping NPM dependency checks")
        print()

    # Add security check
    _check_docker_security()
    print()

    _print_status("Update check completed")
    print()
    _print_status("To apply updates:")
    _print_status("  Base images: docker compose build --pull")
    if npm_updates:
        _print_status("  NPM packages: ./scripts/manage.py shell -> npm update")


def _wait_for_service_ready(compose: List[str], service: str, timeout: int = 60) -> bool:
    """Poll until service is running and ready. Returns True if ready, False on timeout."""
    start = time.time()
    while time.time() - start < timeout:
        if _is_service_running(compose, service):
            return True
        time.sleep(1)
    return False


def cmd_update_npm_packages(_args: argparse.Namespace) -> None:
    """Update NPM packages to latest minor and patch versions (safe updates only).

    This command:
    1. Only works in development environment
    2. Requires web service to be stopped first
    3. Deletes node_modules volume and package-lock.json for clean install
    4. Temporarily starts web service to run npm update
    5. Stops web service when complete
    """
    # Only allow in dev environment
    if ENVIRONMENT != 'dev':
        fatal("This command is only available in development environment. "
              "Production packages should be managed through the build process.")

    compose = _get_compose_cmd()
    service = "web"

    _print_status("=== Updating NPM Packages (Safe Updates Only) ===")

    # Require service to be stopped
    if _is_service_running(compose, service):
        fatal(f"{service} service is running. Please stop it first with: ./scripts/manage.py down")

    # Confirm destructive action with user
    print()
    _print_warning("This will delete node_modules volume and package-lock.json for a clean update.")
    if not confirm("Continue with NPM package update?"):
        print("Aborted.")
        return

    # Clean slate approach: Delete package-lock.json and node_modules to ensure fresh
    # dependency resolution. While npm install can update these incrementally, starting
    # clean avoids potential conflicts from stale lock files or orphaned packages.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    package_lock = os.path.normpath(os.path.join(script_dir, "..", "web", "package-lock.json"))
    if os.path.exists(package_lock):
        _print_status(f"Deleting {package_lock}...")
        os.remove(package_lock)
        _print_success("Deleted package-lock.json")
    else:
        _print_status("package-lock.json not found (already deleted or missing)")

    # Remove web container and its anonymous volumes (including node_modules)
    _print_status("Removing web container and node_modules volume...")
    try:
        run([*compose, "rm", "-f", "-v", service])
        _print_success("Removed web container and volumes")
    except subprocess.CalledProcessError:
        _print_warning("Failed to remove container (may not exist)")

    # Start web service to run npm update
    _print_status("Starting web service for update...")
    try:
        run([*compose, "up", "-d", service])
    except subprocess.CalledProcessError as e:
        _print_error("Failed to start web service")
        if e.stderr:
            print(e.stderr, file=sys.stderr)
        fatal("Could not start web service for update", 1)

    # Wait for service to be ready
    _print_status("Waiting for service to initialize...")
    if not _wait_for_service_ready(compose, service, timeout=60):
        _print_error("Timed out waiting for web service to start")
        run([*compose, "down"], check=False)
        fatal("Service failed to start within timeout", 1)

    _print_status("Checking for safe updates (minor and patch versions only)...")

    # Check what would be updated first
    try:
        cp = run([*compose, "exec", "-T", service, "npx", "ncu", "--target", "minor"],
                 capture_output=True, check=False)
        ncu_output = cp.stdout or ""
    except Exception:
        ncu_output = ""

    # Check if there are any updates
    has_updates = bool(re.search(r'^\s*[@a-zA-Z].*→', ncu_output, re.MULTILINE))

    if not has_updates:
        _print_success("All packages are already up to date")
        _print_status("Stopping web service...")
        run([*compose, "down"], check=False)
        return

    # Show what will be updated
    _print_status("The following packages will be updated:")
    print(ncu_output)
    print()

    # Apply safe updates to package.json
    _print_status("Updating package.json...")
    try:
        run([*compose, "exec", "-T", service, "npx", "ncu", "--target", "minor", "-u"])
    except subprocess.CalledProcessError as e:
        _print_error("Failed to update package.json")
        if e.stderr:
            print(e.stderr, file=sys.stderr)
        run([*compose, "down"], check=False)
        fatal("Update aborted", 1)

    # Install updated packages
    _print_status("Installing updated packages...")
    try:
        run([*compose, "exec", "-T", service, "npm", "install"])
    except subprocess.CalledProcessError as e:
        _print_error("Failed to install updated packages")
        _print_warning("package.json has been updated but npm install failed")
        _print_status("You may need to fix dependency conflicts manually")
        if e.stderr:
            print(e.stderr, file=sys.stderr)
        run([*compose, "down"], check=False)
        fatal("Installation failed", 1)

    # Stop web service
    _print_status("Stopping web service...")
    run([*compose, "down"], check=False)

    # Success
    print()
    _print_success("Package updates completed successfully!")
    _print_status("Changes have been applied to your source files on the host")
    _print_status("Don't forget to commit package.json and package-lock.json to git!")
    print()
    _print_status("Updated packages:")
    for line in ncu_output.splitlines():
        if re.search(r'→', line):
            print(f"  {line}")


def cmd_db_create_user(args: argparse.Namespace) -> None:
    """Create a new user account."""
    compose = _get_compose_cmd()
    service = "web"
    _require_service_running(compose, service)

    cmd = [*compose, "exec", "-it", service, "npx", "tsx", "scripts/create-user.ts"]
    if args.email:
        cmd.extend(["--email", args.email])
    if args.name:
        cmd.extend(["--name", args.name])
    if args.password:
        cmd.extend(["--password", args.password])

    run(cmd)


def cmd_db_reset_password(args: argparse.Namespace) -> None:
    """Reset a user's password."""
    compose = _get_compose_cmd()
    service = "web"
    _require_service_running(compose, service)

    cmd = [*compose, "exec", "-it", service, "npx", "tsx", "scripts/reset-password.ts"]
    if args.email:
        cmd.extend(["--email", args.email])
    if args.id:
        cmd.extend(["--id", str(args.id)])

    run(cmd)


def cmd_db_delete_user(args: argparse.Namespace) -> None:
    """Delete a user account."""
    compose = _get_compose_cmd()
    service = "web"
    _require_service_running(compose, service)

    cmd = [*compose, "exec", "-it", service, "npx", "tsx", "scripts/delete-user.ts"]
    if args.email:
        cmd.extend(["--email", args.email])
    if args.id:
        cmd.extend(["--id", str(args.id)])
    if args.yes:
        cmd.append("--yes")

    run(cmd)


def cmd_db_list(args: argparse.Namespace) -> None:
    """Execute view-data.ts list commands."""
    compose = _get_compose_cmd()
    service = "web"
    _require_service_running(compose, service)

    # Build the command: npx tsx scripts/view-data.ts [command] [param] [options]
    cmd = [*compose, "exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", args.list_command]
    
    # Get the parameter attribute name from the parser's defaults
    param_attr = getattr(args, 'param_attr', None)
    if param_attr:
        param_value = getattr(args, param_attr, None)
        if param_value is not None:
            cmd.append(str(param_value))
    
    # Add options
    if hasattr(args, 'limit') and args.limit is not None:
        cmd.extend(["--limit", str(args.limit)])
    if hasattr(args, 'due') and args.due:
        cmd.append("--due")

    run(cmd)


def cmd_db_summary(_args: argparse.Namespace) -> None:
    """Show summary statistics."""
    compose = _get_compose_cmd()
    service = "web"
    _require_service_running(compose, service)

    cmd = [*compose, "exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", "summary"]
    run(cmd)


def cmd_db_search(args: argparse.Namespace) -> None:
    """Search cards for text."""
    compose = _get_compose_cmd()
    service = "web"
    _require_service_running(compose, service)

    cmd = [*compose, "exec", "-T", service, "npx", "tsx", "scripts/view-data.ts", "search", args.text]
    
    if args.limit is not None:
        cmd.extend(["--limit", str(args.limit)])
    if args.due:
        cmd.append("--due")

    run(cmd)


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Manage Docker containers for this app",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # build
    p_build = sub.add_parser("build", help="Build images")
    p_build.add_argument("service", nargs="*", help="Optional service(s) to build")
    p_build.add_argument("--no-cache", action="store_true", help="Do not use cache when building the image")
    p_build.add_argument("--pull", action="store_true", help="Always attempt to pull a newer version of the image")
    p_build.set_defaults(func=cmd_build)

    # up
    p_up = sub.add_parser("up", help="Start the stack")
    p_up.add_argument("service", nargs="*", help="Optional service(s) to start")
    p_up.add_argument("-d", "--detached", action="store_true", help="Run containers in the background")
    p_up.set_defaults(func=cmd_up)

    # down
    p_down = sub.add_parser("down", help="Stop and remove containers, networks")
    p_down.set_defaults(func=cmd_down)

    # logs
    p_logs = sub.add_parser("logs", help="Show/Tail logs")
    p_logs.add_argument("service", nargs="*", help="Optional service(s) to show logs for")
    p_logs.add_argument("-f", "--follow", action="store_true", help="Follow log output")
    p_logs.add_argument("--timestamps", action="store_true", help="Show timestamps")
    p_logs.add_argument("--tail", help="Number of lines to show from the end of the logs (e.g. '100')")
    p_logs.add_argument("--since", help="Show logs since a given timestamp or relative (e.g. '5m', '2021-01-02T13:23:00')")
    p_logs.set_defaults(func=cmd_logs)

    # status
    p_status = sub.add_parser("status", help="Show running state/ports")
    p_status.set_defaults(func=cmd_status)

    # shell
    p_shell = sub.add_parser("shell", help="Open an interactive shell in a container")
    p_shell.add_argument("--service", help="Service name to exec into (defaults to first running)")
    p_shell.set_defaults(func=cmd_shell)

    # clean
    p_clean = sub.add_parser("clean", help="Prune unused containers/images/networks and optionally volumes")
    p_clean.add_argument("-y", "--yes", action="store_true", help="Do not prompt for confirmation")
    p_clean.add_argument("--volumes", action="store_true", help="Prune volumes as well")
    p_clean.set_defaults(func=cmd_clean)

    # stats
    p_stats = sub.add_parser("stats", help="Live container resource usage")
    p_stats.set_defaults(func=cmd_stats)

    # backup
    p_backup = sub.add_parser("backup", help="Create a database backup")
    p_backup.add_argument("-o", "--output", help="Output file path (default: backups/backup-TIMESTAMP.sql.gz)")
    p_backup.add_argument("--no-compress", dest="compress", action="store_false", help="Do not compress the backup (default: compress)")
    p_backup.set_defaults(func=cmd_backup, compress=True)

    # restore
    p_restore = sub.add_parser("restore", help="Restore database from a backup file")
    p_restore.add_argument("backup_file", help="Path to backup file to restore")
    p_restore.add_argument("-y", "--yes", action="store_true", help="Do not prompt for confirmation")
    p_restore.set_defaults(func=cmd_restore)

    # check-updates
    p_check_updates = sub.add_parser("check-updates", help="Check for NPM package updates and Docker base image updates")
    p_check_updates.set_defaults(func=cmd_check_updates)

    # update-npm-packages
    p_update_npm = sub.add_parser("update-npm-packages", help="Update NPM packages to latest minor/patch versions (safe updates only)")
    p_update_npm.set_defaults(func=cmd_update_npm_packages)

    # db subcommands
    db_parser = sub.add_parser("db", help="Database management commands (see subcommands)")
    db_sub = db_parser.add_subparsers(dest="db_command", required=True)

    # db create-user
    p_db_create = db_sub.add_parser("create-user", help="Create a new user account")
    p_db_create.add_argument("--email", required=True, help="User email address")
    p_db_create.add_argument("--name", required=True, help="User name")
    p_db_create.add_argument("--password", help="User password (will prompt if not provided)")
    p_db_create.set_defaults(func=cmd_db_create_user)

    # db reset-password
    p_db_reset = db_sub.add_parser("reset-password", help="Reset a user's password")
    p_db_reset.add_argument("--email", help="User email address")
    p_db_reset.add_argument("--id", type=int, help="User ID")
    p_db_reset.set_defaults(func=cmd_db_reset_password)

    # db delete-user
    p_db_delete = db_sub.add_parser("delete-user", help="Delete a user account")
    p_db_delete.add_argument("--email", help="User email address")
    p_db_delete.add_argument("--id", type=int, help="User ID")
    p_db_delete.add_argument("-y", "--yes", action="store_true", help="Skip confirmation prompt")
    p_db_delete.set_defaults(func=cmd_db_delete_user)

    # db summary
    p_db_summary = db_sub.add_parser("summary", help="Show summary statistics")
    p_db_summary.set_defaults(func=cmd_db_summary)

    # db list
    p_db_list = db_sub.add_parser("list", help="List users, topics, decks, or cards (see subcommands)")
    p_db_list_sub = p_db_list.add_subparsers(dest="list_command", required=True)

    # db list users
    p_db_list_users = p_db_list_sub.add_parser("users", help="List all users")
    p_db_list_users.add_argument("--limit", type=int, help="Limit number of results")
    p_db_list_users.set_defaults(func=cmd_db_list)

    # db list topics
    p_db_list_topics = p_db_list_sub.add_parser("topics", help="List all topics")
    p_db_list_topics.add_argument("user_id", nargs="?", type=int, help="Filter by user ID")
    p_db_list_topics.add_argument("--limit", type=int, help="Limit number of results")
    p_db_list_topics.set_defaults(func=cmd_db_list, param_attr="user_id")

    # db list decks
    p_db_list_decks = p_db_list_sub.add_parser("decks", help="List all decks")
    p_db_list_decks.add_argument("topic_id", nargs="?", type=int, help="Filter by topic ID")
    p_db_list_decks.add_argument("--limit", type=int, help="Limit number of results")
    p_db_list_decks.set_defaults(func=cmd_db_list, param_attr="topic_id")

    # db list cards
    p_db_list_cards = p_db_list_sub.add_parser("cards", help="List all cards")
    p_db_list_cards.add_argument("deck_id", nargs="?", type=int, help="Filter by deck ID")
    p_db_list_cards.add_argument("--limit", type=int, help="Limit number of results")
    p_db_list_cards.add_argument("--due", action="store_true", help="Filter cards to show only those due today")
    p_db_list_cards.set_defaults(func=cmd_db_list, param_attr="deck_id")

    # db list card
    p_db_list_card = p_db_list_sub.add_parser("card", help="Show details for a specific card")
    p_db_list_card.add_argument("card_id", type=int, help="Card ID")
    p_db_list_card.set_defaults(func=cmd_db_list, param_attr="card_id")

    # db list all
    p_db_list_all = p_db_list_sub.add_parser("all", help="Display all data in hierarchical structure")
    p_db_list_all.set_defaults(func=cmd_db_list)

    # db search (standalone)
    p_db_search = db_sub.add_parser("search", help="Search cards for text")
    p_db_search.add_argument("text", help="Search text")
    p_db_search.add_argument("--limit", type=int, help="Limit number of results")
    p_db_search.add_argument("--due", action="store_true", help="Filter cards to show only those due today")
    p_db_search.set_defaults(func=cmd_db_search)

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = make_parser()
    args = parser.parse_args(argv)
    try:
        args.func(args)
        return 0
    except KeyboardInterrupt:
        print("Interrupted.")
        return 130
    except SystemExit as e:
        # argparse or fatal() exits already handled
        return int(getattr(e, "code", 1) or 0)
    except Exception as e:
        print(f"Unhandled error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

exit(main())

