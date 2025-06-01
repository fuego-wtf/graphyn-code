# 🚀 Graphyn Code Production Deployment Guide

This guide covers the complete infrastructure setup for launching Graphyn Code at graphyn.xyz.

## 📋 Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  graphyn.xyz                    api.graphyn.xyz             │
│  ┌─────────────────┐            ┌─────────────────┐         │
│  │  Frontend       │            │  Backend        │         │
│  │  - Landing page │◄──────────►│  - Encore.dev   │         │
│  │  - API key gen  │            │  - PostgreSQL   │         │
│  │  - Install page │            │  - Redis        │         │
│  └─────────────────┘            └─────────────────┘         │
│                                                             │
│  cli.graphyn.xyz                                            │
│  ┌─────────────────┐                                        │
│  │  Install Script │                                        │
│  │  - Auto-install │                                        │
│  │  - CLI binaries │                                        │
│  └─────────────────┘                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Deployment Priority Order

### Phase 1: Core Infrastructure (Launch Blockers)
1. **Domain & SSL Setup**
2. **Backend Deployment** 
3. **Frontend Landing Page**
4. **API Key System**
5. **Install Script Distribution**

### Phase 2: Features & Polish
1. **API Contract Fixes**
2. **Frontend Dashboard**
3. **Agent Streaming**
4. **Team Features**

## 🔧 Phase 1: Core Infrastructure Setup

### 1. Domain Configuration

**DNS Records needed:**
```
# Main domain
graphyn.xyz           A     <frontend-ip>
www.graphyn.xyz       CNAME graphyn.xyz

# API subdomain  
api.graphyn.xyz       A     <backend-ip>

# Install endpoint
cli.graphyn.xyz       A     <install-server-ip>
```

**SSL Certificates:**
- Use Let's Encrypt for free SSL
- Wildcard cert: `*.graphyn.xyz`
- Auto-renewal setup

### 2. Backend Deployment (api.graphyn.xyz)

**Encore.dev Production Setup:**
```bash
# Deploy to Encore Cloud
encore app create graphyn-backend
encore env create prod --cloud

# Configure secrets
encore secret set --env prod ClerkSecretKey <clerk-key>
encore secret set --env prod API_KEY_ENCRYPTION_KEY <encryption-key>

# Deploy
encore deploy --env prod
```

**Environment Variables:**
```bash
# Production config
ENVIRONMENT=production
API_URL=https://api.graphyn.xyz
FRONTEND_URL=https://graphyn.xyz
CORS_ORIGINS=https://graphyn.xyz,https://cli.graphyn.xyz

# Database
DATABASE_URL=<encore-provided>
REDIS_URL=<encore-provided>

# Auth
CLERK_SECRET_KEY=<secret>
API_KEY_ENCRYPTION_KEY=<secret>
```

### 3. Frontend Deployment (graphyn.xyz)

**Option A: Vercel (Recommended)**
```bash
# Deploy to Vercel
vercel --prod
vercel domains add graphyn.xyz
```

**Option B: Netlify**
```bash
# Deploy to Netlify
netlify deploy --prod --dir=dist
netlify domains:add graphyn.xyz
```

**Option C: Custom Server**
```bash
# Nginx configuration
server {
    listen 80;
    listen 443 ssl;
    server_name graphyn.xyz www.graphyn.xyz;
    
    # SSL config
    ssl_certificate /etc/letsencrypt/live/graphyn.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/graphyn.xyz/privkey.pem;
    
    # Serve landing page
    location / {
        root /var/www/graphyn;
        try_files $uri $uri/ /index.html;
    }
    
    # Install script endpoint
    location /code {
        proxy_pass http://localhost:3000/install.sh;
        add_header Content-Type text/plain;
    }
}
```

### 4. Install Script Server (cli.graphyn.xyz)

**Simple Node.js server:**
```javascript
// install-server.js
const express = require('express');
const fs = require('fs');
const app = express();

app.get('/install.sh', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(fs.readFileSync('./scripts/install.sh', 'utf8'));
});

app.listen(3000);
```

**Or use graphyn.xyz/code directly:**
- Serve install.sh at `/code` endpoint
- Redirect `/code` to install script

### 5. API Key Generation System

**Backend endpoint (already implemented):**
```typescript
// In backend/platform/api_keys.ts
export const createPublicApiKey = api(
  { method: "POST", path: "/public/api-keys", expose: true, auth: false },
  async ({ email, claudeCodeUser }: { 
    email: string; 
    claudeCodeUser: boolean; 
  }): Promise<{ apiKey: string }> => {
    
    // Validate Claude Code user
    if (!claudeCodeUser) {
      throw new APIError("This offer is only for Claude Code users", {
        code: "INVALID_USER",
        statusCode: 403
      });
    }
    
    // Generate API key
    const keyId = uuidv4();
    const keyPrefix = "gph";
    const keySecret = crypto.randomBytes(16).toString('hex');
    const fullKey = `${keyPrefix}_${keySecret}`;
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    
    // Store in database
    await db.exec`
      INSERT INTO public_api_keys (
        id, email, key_hash, key_prefix, permissions, created_at
      ) VALUES (
        ${keyId}, ${email}, ${keyHash}, ${keyPrefix}, 
        ${['read', 'create_agents', 'chat']}, ${new Date()}
      )
    `;
    
    return { apiKey: fullKey };
  }
);
```

## 🚀 Phase 2: Feature Deployment

### 1. API Contract Standardization

**Complete camelCase conversion:**
```bash
# Run standardization script
npm run standardize-api-responses

# Test all endpoints
npm run test:api-contracts

# Deploy
encore deploy --env prod
```

### 2. Frontend Dashboard Deployment

**Build and deploy dashboard:**
```bash
cd frontend
npm run build
vercel --prod
```

### 3. Agent Streaming Setup

**Connect to Letta backend:**
- Configure Letta API endpoints
- Set up streaming infrastructure
- Test agent conversations

## 📊 Monitoring & Analytics

### Health Checks
```bash
# Backend health
curl https://api.graphyn.xyz/health

# Frontend availability 
curl https://graphyn.xyz

# Install script
curl https://graphyn.xyz/code
```

### Error Monitoring
- Set up Sentry for error tracking
- Configure log aggregation
- Monitor API response times

### Usage Analytics
- Track CLI installations
- Monitor API key generation
- Measure user engagement

## 🔒 Security Checklist

### SSL/TLS
- [x] Wildcard SSL certificate
- [x] HTTPS redirect
- [x] HSTS headers
- [x] Certificate auto-renewal

### API Security
- [x] CORS configuration
- [x] Rate limiting
- [x] API key validation
- [x] Input sanitization

### Data Protection
- [x] API key encryption
- [x] Secure secret storage
- [x] No sensitive data logging
- [x] GDPR compliance

## 🚀 Launch Sequence

### Pre-Launch (T-24 hours)
1. Final security audit
2. Load testing
3. Backup procedures
4. Rollback plan

### Launch Day (T-0)
1. Deploy backend to production
2. Deploy frontend landing page
3. Configure DNS
4. Test install flow end-to-end
5. Monitor for issues

### Post-Launch (T+24 hours)
1. Monitor error rates
2. Track user signups
3. Collect feedback
4. Plan first update

## 📈 Success Metrics

### Week 1 Targets
- 100 CLI installations
- 50 API key generations  
- <2s average page load
- 99.9% uptime

### Month 1 Targets
- 1,000 active users
- 10,000 CLI installations
- 95% positive feedback
- Feature parity with roadmap

## 🛠️ Maintenance

### Daily
- Monitor error rates
- Check SSL certificate status
- Review user feedback

### Weekly  
- Security updates
- Performance optimization
- Feature deployment

### Monthly
- Infrastructure review
- Cost optimization
- User growth analysis

---

**Ready for deployment!** This guide ensures a smooth production launch with proper monitoring and security.