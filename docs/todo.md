# Fuego CLI - Development Tasks

## High Priority

- [x] Create project structure and initialize Fuego CLI directory
- [x] Implement main Fuego CLI script with Graphyn branding and colors
- [x] Create agent prompt files (backend, frontend, architect)
- [x] Implement authentication system with Graphyn API key

## Medium Priority

- [x] Add context detection logic for auto-selecting agents
- [x] Create installation and setup scripts
- [x] Add inter-agent communication features

## Low Priority

- [x] Create README and documentation
- [x] Test the CLI and ensure all features work correctly

## Features to Implement

### Core Features
- Unified `fuego` command with context flags
- API key-based authentication with secure storage
- Auto-detection of agent context based on:
  - Current directory path
  - Presence of specific files (encore.app, package.json, etc.)
  - Git branch name
  - Saved default preference

### Agent Communication
- Agents can share context and results
- Chain multiple agents for complex tasks
- Pass information between agents using Graphyn API

### Visual Design
- Use Graphyn brand colors:
  - Primary Blue: #3267F5
  - Light Purple: #C0B7FD
  - Tan Brown: #A67763
  - Dark Brown: #2D160B
- Clean, spacious terminal UI
- Animated progress indicators
- Visual feedback for operations

### Security
- API keys stored securely with 600 permissions
- Keys validated against expected format (gph_xxxxxxxxxxxx)
- Authentication status tracking

## Terminal Demo Integration 🚧 IN PROGRESS

### Authentication Updates
- [ ] Update Fuego CLI to support terminal-demo backend:
    - [ ] Change API URL to point to terminal-demo (localhost:4000 in dev)
    - [ ] Update API key validation to accept keys from terminal-demo
    - [ ] Add environment variable support for API URL
- [ ] Modify authentication flow:
    - [ ] Support both Graphyn AI and terminal-demo endpoints
    - [ ] Add --api-url flag to auth command
    - [ ] Store API URL with authentication credentials
- [ ] Update API client functions:
    - [ ] Use stored API URL for all requests
    - [ ] Add proper error handling for terminal-demo responses
    - [ ] Support terminal-demo's auth header format

### New Commands
- [ ] Add terminal-demo specific commands:
    - [ ] `fuego connect` - Connect to terminal-demo instance
    - [ ] `fuego agents list` - List available agents from terminal-demo
    - [ ] `fuego chat <agent>` - Start chat session with specific agent
    - [ ] `fuego sessions` - List previous chat sessions

### Configuration
- [ ] Update config structure:
    - [ ] Add api_url field to auth.json
    - [ ] Support multiple authentication profiles
    - [ ] Add profile switching command