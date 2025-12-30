#!/bin/bash
#
# Update Docker Scout to the latest version
#
# This script installs/updates Docker Scout CLI plugin from the official source.
# Docker Scout is not managed by apt/dpkg like Docker Engine, so it needs
# to be updated separately.
#

set -e

echo "Updating Docker Scout..."
echo

# Install/update Docker Scout
curl -sSfL https://raw.githubusercontent.com/docker/scout-cli/main/install.sh | sh -s -- -b ~/.docker/cli-plugins

echo
echo "Docker Scout updated successfully!"
echo

# Show version
docker scout version

