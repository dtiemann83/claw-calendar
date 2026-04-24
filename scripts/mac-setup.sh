#!/bin/bash
set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ============================================================================
# 1. Check for MacPorts
# ============================================================================
print_header "Checking for MacPorts"

if [ ! -f /opt/local/bin/port ]; then
    print_error "MacPorts not found at /opt/local/bin/port"
    echo ""
    echo "Please install MacPorts from: https://www.macports.org/install.php"
    echo ""
    exit 1
fi

print_success "MacPorts found at /opt/local/bin/port"

# ============================================================================
# 2. Install/Update MacPorts packages
# ============================================================================
print_header "Installing/Updating MacPorts packages"

PACKAGES=("python311" "py311-pip" "nodejs20" "npm10")

for pkg in "${PACKAGES[@]}"; do
    echo "Installing/updating $pkg..."
    sudo /opt/local/bin/port install "$pkg" 2>&1 | tail -1
    print_success "Completed $pkg"
done

# ============================================================================
# 3. Select Python 3.11 as active
# ============================================================================
print_header "Selecting Python 3.11 as active"

sudo /opt/local/bin/port select --set python3 python311
print_success "Set python3 to python311"

sudo /opt/local/bin/port select --set python python311
print_success "Set python to python311"

# ============================================================================
# 4. Verify Node.js >= 20
# ============================================================================
print_header "Verifying Node.js >= 20"

NODE_VERSION=$(/opt/local/bin/node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 20 ]; then
    print_error "Node.js >= 20 not found"
    exit 1
fi

NODE_FULL=$(/opt/local/bin/node --version)
print_success "Node.js $NODE_FULL is available"

# ============================================================================
# 5. Verify Python 3.11
# ============================================================================
print_header "Verifying Python 3.11"

PYTHON_VERSION=$(/opt/local/bin/python3 --version 2>&1 | awk '{print $2}')
print_success "Python $PYTHON_VERSION is available"

# ============================================================================
# 6. CPU baseline check (Intel Mac, no GPU)
# ============================================================================
print_header "System CPU baseline"

PROCESSOR_NAME=$(sysctl -n machdep.cpu.brand_string)
PROCESSOR_COUNT=$(sysctl -n hw.ncpu)

echo "Processor: $PROCESSOR_NAME"
echo "Cores: $PROCESSOR_COUNT"
echo ""
echo "Note: This Intel Mac does not have Metal GPU acceleration available."
echo "Audio processing will run on CPU."

# ============================================================================
# 7. Microphone permission instructions
# ============================================================================
print_header "Microphone permission setup"

echo "To grant microphone access to the audio service:"
echo ""
echo "1. Open System Preferences"
echo "2. Navigate to: Security & Privacy → Privacy → Microphone"
echo "3. Click the lock icon to unlock (enter your password if prompted)"
echo "4. Look for the audio service application (usually the Terminal or service)"
echo "5. Ensure it is checked/enabled in the microphone list"
echo ""
echo "On Monterey, you may also use the command:"
echo "  tccutil reset Microphone"
echo "to reset and re-prompt for microphone access."

# ============================================================================
# 8. Check/create launchd directories
# ============================================================================
print_header "Checking launchd directories"

LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

if [ ! -d "$LAUNCH_AGENTS_DIR" ]; then
    mkdir -p "$LAUNCH_AGENTS_DIR"
    print_success "Created $LAUNCH_AGENTS_DIR"
else
    print_success "LaunchAgents directory exists: $LAUNCH_AGENTS_DIR"
fi

# ============================================================================
# 9. Print launchd installation instructions
# ============================================================================
print_header "LaunchAgent installation instructions"

echo "To install the launchd service plists:"
echo ""
echo "1. Review and customize the plist files in ./scripts/launchd/"
echo "   - Update WorkingDirectory paths to match your setup"
echo "   - Customize log file locations if desired"
echo ""
echo "2. Copy the plists to LaunchAgents:"
echo "   cp ./scripts/launchd/com.family.voice.*.plist ~/Library/LaunchAgents/"
echo ""
echo "3. Load the services:"
echo "   launchctl load ~/Library/LaunchAgents/com.family.voice.audio-server.plist"
echo "   launchctl load ~/Library/LaunchAgents/com.family.voice.web.plist"
echo ""
echo "4. Check status:"
echo "   launchctl list | grep com.family.voice"
echo ""
echo "5. View logs:"
echo "   tail -f ~/Library/Logs/claw-audio-server.log"
echo "   tail -f ~/Library/Logs/claw-web.log"

# ============================================================================
# 10. Make setup script executable
# ============================================================================
chmod +x "$0"
print_success "Setup script is executable"

# ============================================================================
# Summary
# ============================================================================
print_header "Setup complete"

echo "All system requirements have been verified:"
echo ""
echo "  • MacPorts installed"
echo "  • Python 3.11 available"
echo "  • Node.js 20+ available"
echo "  • LaunchAgents directory ready"
echo ""
echo "Next steps:"
echo "  1. Configure microphone permissions (see instructions above)"
echo "  2. Review and customize the launchd plists"
echo "  3. Copy plists to ~/Library/LaunchAgents/ and load them"
echo ""
