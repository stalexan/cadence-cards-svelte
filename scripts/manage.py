#!/usr/bin/env python3
"""Manage Docker containers for cadence-cards-svelte."""

import sys
from pathlib import Path

# Add manage submodule to path
script_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(script_dir))

from manage import main

if __name__ == "__main__":
    sys.exit(main(Path(__file__).resolve()))
