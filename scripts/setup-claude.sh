#!/usr/bin/env bash
set -euo pipefail

CLI_NAME="claude"
DEFAULT_VERSION="latest"
INSTALL_DIR="${HOME}/.graphyn/bin"

mkdir -p "${INSTALL_DIR}"

if command -v ${CLI_NAME} >/dev/null 2>&1; then
  echo "✅ ${CLI_NAME} already installed at $(command -v ${CLI_NAME})"
  exit 0
fi

if [[ -n "${CLAUDE_CLI_DOWNLOAD:-}" ]]; then
  echo "⬇️  Downloading Claude CLI from ${CLAUDE_CLI_DOWNLOAD}"
  curl -fsSL "${CLAUDE_CLI_DOWNLOAD}" -o "${INSTALL_DIR}/${CLI_NAME}" && chmod +x "${INSTALL_DIR}/${CLI_NAME}"
  echo "export PATH=\"${INSTALL_DIR}:$PATH\"" >> "${HOME}/.graphyn/env"
  echo "✅ Claude CLI installed to ${INSTALL_DIR}/${CLI_NAME}"
else
  echo "⚠️  CLAUDE_CLI_DOWNLOAD not set. Please download the Claude CLI manually and place it in ${INSTALL_DIR}/${CLI_NAME}."
  exit 1
fi
