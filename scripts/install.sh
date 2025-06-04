#!/usr/bin/env bash
#
# Graphyn Code Installer
# This script installs Graphyn Code globally on your system

set -euo pipefail

# Constants
readonly INSTALL_DIR="${GRAPHYN_INSTALL_DIR:-/usr/local/lib/graphyn}"
readonly BIN_DIR="${GRAPHYN_BIN_DIR:-/usr/local/bin}"
readonly USER_HOME_DIR="${HOME}/.graphyn"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Graphyn Brand Colors
if [[ -t 1 ]]; then
    readonly BRIGHT_BLUE='\033[38;2;50;103;245m'
    readonly LIGHT_PURPLE='\033[38;2;192;183;253m'
    readonly TAN_BROWN='\033[38;2;166;119;99m'
    readonly DARK_BROWN='\033[38;2;45;22;11m'
    readonly WHITE='\033[97m'
    readonly GRAY='\033[90m'
    readonly BOLD='\033[1m'
    readonly NC='\033[0m'
else
    readonly BRIGHT_BLUE=''
    readonly LIGHT_PURPLE=''
    readonly TAN_BROWN=''
    readonly DARK_BROWN=''
    readonly WHITE=''
    readonly GRAY=''
    readonly BOLD=''
    readonly NC=''
fi

# Logging functions
log() { echo -e "${LIGHT_PURPLE}◆${NC} $*"; }
info() { echo -e "${BRIGHT_BLUE}ℹ${NC} $*"; }
success() { echo -e "${BRIGHT_BLUE}✓${NC} $*"; }
error() { echo -e "${DARK_BROWN}✗${NC} $*" >&2; }
warn() { echo -e "${TAN_BROWN}⚠${NC} $*" >&2; }

# Show header
show_header() {
    echo
    echo -e "${BRIGHT_BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BRIGHT_BLUE}║${NC}      ${BOLD}${WHITE}Graphyn Code Installer${NC}          ${BRIGHT_BLUE}║${NC}"
    echo -e "${BRIGHT_BLUE}║${NC}  ${LIGHT_PURPLE}Build space for stateful agents${NC}      ${BRIGHT_BLUE}║${NC}"
    echo -e "${BRIGHT_BLUE}╚════════════════════════════════════════╝${NC}"
    echo
}

# Progress indicator
progress() {
    local msg=$1
    echo -n -e "${LIGHT_PURPLE}◆${NC} $msg"
    for i in {1..3}; do
        echo -n "."
        sleep 0.1
    done
    echo " ${BRIGHT_BLUE}✓${NC}"
}

# Check if running as root
check_permissions() {
    if [[ -w "$BIN_DIR" ]]; then
        return 0
    else
        error "Cannot write to $BIN_DIR"
        echo -e "${GRAY}Please run with sudo: ${WHITE}sudo $0${NC}"
        echo -e "${GRAY}Or set a custom location: ${WHITE}GRAPHYN_BIN_DIR=~/.local/bin $0${NC}"
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    local missing=()
    
    for cmd in git jq; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        error "Missing required dependencies: ${missing[*]}"
        echo -e "${GRAY}Please install them first:${NC}"
        
        # OS-specific installation instructions
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo -e "  ${WHITE}brew install ${missing[*]}${NC}"
        elif [[ -f /etc/debian_version ]]; then
            echo -e "  ${WHITE}sudo apt-get install ${missing[*]}${NC}"
        elif [[ -f /etc/redhat-release ]]; then
            echo -e "  ${WHITE}sudo yum install ${missing[*]}${NC}"
        else
            echo -e "  Install: ${missing[*]}"
        fi
        exit 1
    fi
    
    # Check for claude CLI
    if ! command -v claude &> /dev/null; then
        warn "Claude CLI not found"
        echo -e "${GRAY}Install from: ${WHITE}https://claude.ai/cli${NC}"
        echo
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Create directories
create_directories() {
    # System directories (may need sudo)
    if [[ ! -d "$INSTALL_DIR" ]]; then
        mkdir -p "$INSTALL_DIR" || {
            error "Failed to create $INSTALL_DIR"
            echo -e "${GRAY}Try running with sudo or set GRAPHYN_INSTALL_DIR to a writable location${NC}"
            exit 1
        }
    fi
    
    # User directories
    mkdir -p "$USER_HOME_DIR"/{history,sessions,cache,config}
    
    # Set permissions
    chmod 755 "$USER_HOME_DIR"
    chmod 700 "$USER_HOME_DIR"/{history,sessions,cache}
}

# Install files
install_files() {
    log "Installing Graphyn Code files..."
    
    # Copy all necessary files
    cp -r "$ROOT_DIR"/{scripts,prompts,templates} "$INSTALL_DIR/" || {
        error "Failed to copy files to $INSTALL_DIR"
        exit 1
    }
    
    # Create config directory if it doesn't exist
    mkdir -p "$INSTALL_DIR/config"
    
    # Create version file
    echo "2.0.0" > "$INSTALL_DIR/config/version.txt"
    
    # Set permissions
    chmod -R 755 "$INSTALL_DIR"
    chmod 755 "$INSTALL_DIR/scripts/graphyn"
    
    success "Files installed to $INSTALL_DIR"
}

# Create symlink
create_symlink() {
    local symlink_path="$BIN_DIR/graphyn"
    
    # Remove existing symlink if present
    if [[ -L "$symlink_path" ]] || [[ -f "$symlink_path" ]]; then
        rm -f "$symlink_path" || {
            error "Failed to remove existing file at $symlink_path"
            exit 1
        }
    fi
    
    # Create new symlink
    ln -s "$INSTALL_DIR/scripts/graphyn" "$symlink_path" || {
        error "Failed to create symlink"
        exit 1
    }
    
    success "Symlink created at $symlink_path"
}

# Create default configuration
create_default_config() {
    local config_file="$USER_HOME_DIR/config/settings.json"
    
    if [[ ! -f "$config_file" ]]; then
        cat > "$config_file" <<EOF
{
  "version": "2.0.0",
  "editor": "${EDITOR:-vim}",
  "log_level": "info",
  "history_size": 1000,
  "auto_update": true,
  "telemetry": false,
  "api_endpoint": "https://api.graphyn.ai/v1",
  "theme": "graphyn"
}
EOF
        chmod 600 "$config_file"
        success "Created default configuration"
    fi
}

# Update shell configuration
update_shell_config() {
    local shell_name=$(basename "$SHELL")
    local shell_config=""
    
    case "$shell_name" in
        zsh)
            shell_config="$HOME/.zshrc"
            ;;
        bash)
            shell_config="$HOME/.bashrc"
            ;;
        fish)
            shell_config="$HOME/.config/fish/config.fish"
            ;;
        *)
            warn "Unknown shell: $shell_name"
            return
            ;;
    esac
    
    # Check if PATH needs updating
    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        log "Adding $BIN_DIR to PATH..."
        
        if [[ "$shell_name" == "fish" ]]; then
            mkdir -p "$HOME/.config/fish"
            echo "set -gx PATH \$PATH $BIN_DIR" >> "$shell_config"
        else
            {
                echo
                echo "# Graphyn Code"
                echo "export PATH=\"\$PATH:$BIN_DIR\""
            } >> "$shell_config"
        fi
        
        info "Updated $shell_config"
    fi
    
    # Add shell completions
    if [[ "$shell_name" != "fish" ]]; then
        local completion_marker="# Graphyn Code Completions"
        if ! grep -q "$completion_marker" "$shell_config" 2>/dev/null; then
            {
                echo
                echo "$completion_marker"
                echo 'complete -W "auth logout whoami --backend --frontend --architect --chain --context --set-default --list --update --stats --version --help" graphyn'
            } >> "$shell_config"
        fi
    fi
}

# Post-installation setup
post_install() {
    # Check for existing authentication
    if [[ -f "$USER_HOME_DIR/auth.json" ]]; then
        local api_key=$(jq -r '.api_key' "$USER_HOME_DIR/auth.json" 2>/dev/null)
        if [[ -n "$api_key" ]]; then
            info "Existing authentication found (${api_key:0:8}...)"
        fi
    else
        echo
        echo -e "${BOLD}Authentication Required${NC}"
        echo -e "${GRAY}────────────────────────────────────────${NC}"
        echo -e "To use Graphyn Code, you need to authenticate:"
        echo
        echo -e "  1. Get your API key from: ${WHITE}https://graphyn.ai/settings/api${NC}"
        echo -e "  2. Run: ${WHITE}graphyn auth gph_xxxxxxxxxxxx${NC}"
        echo
    fi
}

# Uninstall function
uninstall() {
    echo -e "${BOLD}Uninstalling Graphyn Code${NC}"
    echo
    
    read -p "Remove all Graphyn data including history? (y/N) " -n 1 -r
    echo
    
    # Remove symlink
    rm -f "$BIN_DIR/graphyn"
    
    # Remove installation directory
    if [[ -d "$INSTALL_DIR" ]]; then
        rm -rf "$INSTALL_DIR"
    fi
    
    # Optionally remove user data
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$USER_HOME_DIR"
        log "Removed all user data"
    else
        log "Kept user data in $USER_HOME_DIR"
    fi
    
    success "Graphyn Code uninstalled"
}

# Main installation
main() {
    # Check for uninstall flag
    if [[ "${1:-}" == "--uninstall" ]]; then
        uninstall
        exit 0
    fi
    
    show_header
    
    # Pre-flight checks
    check_permissions
    progress "Checking dependencies"
    check_dependencies
    
    # Installation steps
    progress "Creating directories"
    create_directories
    
    progress "Installing CLI files"
    install_files
    
    progress "Creating symlink"
    create_symlink
    
    progress "Configuring shell"
    update_shell_config
    
    progress "Creating default config"
    create_default_config
    
    # Success!
    echo
    echo -e "${BRIGHT_BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BRIGHT_BLUE}║${NC}    ${BOLD}${WHITE}Installation Complete! 🔷${NC}          ${BRIGHT_BLUE}║${NC}"
    echo -e "${BRIGHT_BLUE}╚════════════════════════════════════════╝${NC}"
    echo
    
    echo -e "${WHITE}Next steps:${NC}"
    echo -e "  ${BRIGHT_BLUE}1.${NC} Restart your shell or run: ${WHITE}source ~/.*rc${NC}"
    echo -e "  ${BRIGHT_BLUE}2.${NC} Authenticate: ${WHITE}graphyn auth gph_xxxxxxxxxxxx${NC}"
    echo -e "  ${BRIGHT_BLUE}3.${NC} Run ${WHITE}graphyn --help${NC} to get started"
    echo
    
    echo -e "${GRAY}Quick examples:${NC}"
    echo -e "  ${WHITE}graphyn${NC} ${LIGHT_PURPLE}\"How do I implement SSE?\"${NC}     ${GRAY}# Auto-detect context${NC}"
    echo -e "  ${WHITE}graphyn --backend${NC} ${LIGHT_PURPLE}\"Create endpoint\"${NC}    ${GRAY}# Explicit context${NC}"
    echo -e "  ${WHITE}graphyn --chain${NC} ${LIGHT_PURPLE}\"add notifications\"${NC}   ${GRAY}# Chain agents${NC}"
    echo
    
    post_install
}

# Run main function
main "$@"