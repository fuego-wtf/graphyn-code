# OAuth 2.0 with PKCE Flow Implementation

## Development Environment Setup

### Frontend (app.graphyn.xyz) - http://localhost:3000
### Backend (api.graphyn.xyz) - http://localhost:4000

## Complete OAuth PKCE Flow

### Step 1: CLI Initiates Authentication

```typescript
// When user runs: graphyn "add auth to my app"
const oauthManager = new OAuthManager();
await oauthManager.authenticate();
```

### Step 2: Generate PKCE Values

```typescript
// CLI generates cryptographically secure PKCE values
const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256')
  .update(verifier)
  .digest('base64url');
```

### Step 3: Build Authorization URL

```typescript
const authUrl = new URL('http://localhost:3000/auth');
authUrl.searchParams.set('client_id', 'graphyn-cli-official');
authUrl.searchParams.set('redirect_uri', 'http://localhost:8989/callback');
authUrl.searchParams.set('state', generateState());
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'openid profile email agents:read agents:write');
authUrl.searchParams.set('code_challenge', challenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
```

### Step 4: User Authentication in Browser

1. Browser opens to http://localhost:3000/auth
2. User signs in with GitHub/Google (Better Auth)
3. Consent screen shows requested permissions
4. User approves

### Step 5: Authorization Code Callback

```typescript
// Browser redirects to: http://localhost:8989/callback?code=xxx&state=yyy
// CLI's local server captures the callback
const callbackData = await waitForOAuthCallback(8989, state);
```

### Step 6: Token Exchange (with PKCE verification)

```typescript
// CLI exchanges code for tokens
const response = await fetch('http://localhost:4000/v1/auth/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code: callbackData.code,
    redirect_uri: 'http://localhost:8989/callback',
    client_id: 'graphyn-cli-official',
    code_verifier: verifier  // PKCE verification
  })
});
```

### Step 7: Store Tokens Securely

```typescript
// Tokens stored in ~/.graphyn/auth.json with 0600 permissions
{
  "apiKey": "access_token_here",
  "refreshToken": "refresh_token_here",
  "tokenType": "Bearer",
  "expiresAt": "2025-01-26T10:00:00Z",
  "scope": "openid profile email agents:read agents:write",
  "authType": "oauth"
}
```

## API Endpoints Required

### 1. Authorization Endpoint (Frontend)
**URL**: `http://localhost:3000/auth`
**Purpose**: Display login/consent UI

### 2. Token Endpoint (Backend)
**URL**: `http://localhost:4000/v1/auth/oauth/token`
**Purpose**: Exchange authorization code for tokens

### 3. User Info Endpoint (Backend)
**URL**: `http://localhost:4000/v1/auth/userinfo`
**Purpose**: Get authenticated user details

## Security Considerations

1. **PKCE Protection**: Prevents code interception attacks
2. **State Parameter**: Prevents CSRF attacks
3. **Secure Token Storage**: Files stored with 0600 permissions
4. **Token Rotation**: Automatic refresh token rotation
5. **Short-lived Tokens**: Access tokens expire in 1 hour

## Testing the Flow

```bash
# 1. Start your development servers
cd frontend && npm run dev  # http://localhost:3000
cd backend && npm run dev   # http://localhost:4000

# 2. Set development environment
export NODE_ENV=development

# 3. Run the CLI authentication
npm run build
node dist/cli-main.js

# 4. Follow the browser flow
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - The CLI automatically finds an available port
   - Check `netstat -an | grep 8989`

2. **CORS Errors**
   - Ensure backend allows `http://localhost:3000`
   - Add CORS headers for development

3. **Token Exchange Fails**
   - Verify PKCE verifier matches challenge
   - Check redirect_uri matches exactly
   - Ensure state parameter is valid

## Implementation Checklist

- [ ] Frontend /auth route handles OAuth parameters
- [ ] Backend validates PKCE challenge/verifier
- [ ] Token endpoint implements RFC 7636 (PKCE)
- [ ] Refresh token rotation implemented
- [ ] Proper CORS configuration for development
- [ ] Error handling for all failure cases