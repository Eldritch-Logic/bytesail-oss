#!/usr/bin/env bash
set -euo pipefail

REPO="bytesail/bytesail"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="bytesail"

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Linux*)  OS_NAME="linux" ;;
  Darwin*) OS_NAME="darwin" ;;
  *)
    echo "Error: Unsupported operating system: $OS"
    exit 1
    ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ARCH_NAME="x64" ;;
  aarch64) ARCH_NAME="arm64" ;;
  arm64)   ARCH_NAME="arm64" ;;
  *)
    echo "Error: Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

# Determine latest version
if [ -n "${BYTESAIL_VERSION:-}" ]; then
  VERSION="$BYTESAIL_VERSION"
else
  echo "Fetching latest release..."
  VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"
  if [ -z "$VERSION" ]; then
    echo "Error: Could not determine latest version."
    exit 1
  fi
fi

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}-${OS_NAME}-${ARCH_NAME}"

echo "Downloading ByteSail CLI ${VERSION} for ${OS_NAME}/${ARCH_NAME}..."
TMP_FILE="$(mktemp)"
curl -fsSL -o "$TMP_FILE" "$DOWNLOAD_URL"

echo "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"
  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
else
  sudo mv "$TMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"
  sudo chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
fi

echo ""
echo "ByteSail CLI ${VERSION} installed successfully!"
echo "Run 'bytesail login' to get started."
