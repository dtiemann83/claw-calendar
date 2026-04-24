# Mac Deployment

The audio service and web application are installed as launchd agents on the Mac mini to start automatically on boot and restart on crash.

## Overview

- **Target machine**: 2014 Intel Mac mini running macOS Monterey
- **Package manager**: MacPorts (installed at `/opt/local`)
- **Audio service**: FastAPI (uvicorn) listening on `0.0.0.0:8080`
- **Web app**: Next.js production server (port 3000 by default)
- **Auto-restart**: Both services configured with `KeepAlive: true`

## 1. Run the setup script

The setup script verifies all system requirements and prepares the environment:

```bash
chmod +x scripts/mac-setup.sh
./scripts/mac-setup.sh
```

This script will:
- Verify MacPorts is installed at `/opt/local/bin/port`
- Install/update: `python311`, `py311-pip`, `nodejs20`, `npm10`
- Select Python 3.11 as the active `python3` and `python` commands
- Verify Node.js >= 20 is available
- Verify Python 3.11 is available
- Display CPU baseline information (Intel processor, no Metal GPU)
- Print microphone permission setup instructions
- Verify launchd directories exist
- Print detailed installation instructions for launchd plists

## 2. Grant microphone permission

The audio service needs microphone access. On macOS Monterey:

**GUI method:**
1. Open System Preferences
2. Navigate to: Security & Privacy → Privacy → Microphone
3. Click the lock icon to unlock (enter your password if prompted)
4. Ensure the Terminal (or the service application) is checked in the microphone list

**Command-line method** (to reset and re-prompt):
```bash
tccutil reset Microphone
```

After reset, the application will prompt for microphone access on first run.

## 3. Customize and install launchd plists

The launchd plists are located in `scripts/launchd/`:

- `com.family.voice.audio-server.plist` — FastAPI audio service (port 8080)
- `com.family.voice.web.plist` — Next.js web application (port 3000)

**Before installing, customize the paths in each plist:**

- `WorkingDirectory`: Set to the correct installation path for your system
  - Audio server: e.g., `/Users/Shared/claw-calendar/packages/audio-server`
  - Web app: e.g., `/Users/Shared/claw-calendar`
- `StandardOutPath` / `StandardErrorPath`: Optionally customize log locations

**To install:**

```bash
# Copy plists to LaunchAgents directory
cp scripts/launchd/com.family.voice.*.plist ~/Library/LaunchAgents/

# Load the services
launchctl load ~/Library/LaunchAgents/com.family.voice.audio-server.plist
launchctl load ~/Library/LaunchAgents/com.family.voice.web.plist
```

## 4. Verify services are running

Check the status of both services:

```bash
launchctl list | grep com.family.voice
```

Both should show a process ID (PID), e.g.:
```
98765 com.family.voice.audio-server
98766 com.family.voice.web
```

## 5. View service logs

Service logs are written to:

- **Audio server**: `~/Library/Logs/claw-audio-server.log` and `claw-audio-server.error.log`
- **Web app**: `~/Library/Logs/claw-web.log` and `claw-web.error.log`

View logs in real-time:

```bash
tail -f ~/Library/Logs/claw-audio-server.log
tail -f ~/Library/Logs/claw-web.log
```

## 6. Network configuration (optional)

For reliable access to the Mac mini on your local network:

1. **Static DHCP reservation**: Configure your router to assign the Mac mini a fixed IP address
2. **Hostname**: Use mDNS hostname `macmini.local` for DNS resolution

## Troubleshooting

### Service fails to start

Check the error log:
```bash
tail -f ~/Library/Logs/claw-audio-server.error.log
```

Common issues:
- **Python/Node not found**: Verify MacPorts packages are installed (run `scripts/mac-setup.sh`)
- **Permission denied**: Ensure the working directory path in the plist is correct
- **Port in use**: Check if port 8080 or 3000 is already in use
- **Microphone not accessible**: Run `tccutil reset Microphone` and grant permission again

### Manually reload a service

After editing a plist:

```bash
launchctl unload ~/Library/LaunchAgents/com.family.voice.audio-server.plist
launchctl load ~/Library/LaunchAgents/com.family.voice.audio-server.plist
```

### Remove services

To stop and unload:

```bash
launchctl unload ~/Library/LaunchAgents/com.family.voice.audio-server.plist
launchctl unload ~/Library/LaunchAgents/com.family.voice.web.plist
```

Optionally, remove the plist files:
```bash
rm ~/Library/LaunchAgents/com.family.voice.*.plist
```
