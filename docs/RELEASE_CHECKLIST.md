# Release Checklist

## Pre-Release Testing

### 1. Local Package Testing
```bash
npm run test:package
```
This automated script:
- Builds the project
- Creates npm package
- Tests installation in isolated environment
- Verifies CLI commands work
- Checks postinstall execution

### 2. Manual Testing
- [ ] Test all agent commands (backend, frontend, architect, design)
- [ ] Verify auth flow works
- [ ] Check error messages are helpful
- [ ] Test on different terminals

### 3. Cross-Platform Testing
- [ ] macOS: Run test:package
- [ ] Linux: Run in Docker/VM
- [ ] Windows: Test in VM (if available)

## Release Process

### 1. Version Bump
```bash
npm version patch  # or minor/major
```

### 2. Final Test
```bash
npm run test:package
```

### 3. Publish
```bash
npm publish
```
Note: prepublishOnly will automatically run build + test:package

### 4. Post-Release
- [ ] Test global installation: `npm install -g @graphyn/code@latest`
- [ ] Verify on clean machine
- [ ] Update GitHub release notes
- [ ] Monitor npm downloads/issues

## Common Issues to Check

### Postinstall Dependencies
- ✅ Fixed: No external dependencies in postinstall.js
- Uses native ANSI codes instead of chalk
- Test with: `node scripts/postinstall.js`

### File Permissions
- bin/graphyn must be executable
- Test scripts must have +x permission

### Package Contents
- Check with `npm pack --dry-run`
- Ensure all needed files are included
- Verify no sensitive files are packaged

## Automation

GitHub Actions runs tests on:
- Every push to main/develop
- All pull requests
- Multiple OS (Ubuntu, macOS, Windows)
- Multiple Node versions (16, 18, 20)