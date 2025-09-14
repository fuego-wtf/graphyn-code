# Test Fixtures

This directory contains test data, mock files, and fixtures used across the test suite.

## Purpose

Test fixtures provide consistent, reusable test data to ensure:
- Deterministic test results
- Realistic testing scenarios
- Reduced test setup complexity
- Shared test data across test categories

## Structure

```
/fixtures/
├── agents/          # Mock agent configurations and responses
├── repositories/    # Sample repository structures and contexts
├── workflows/       # Sample workflow definitions and states
├── api/            # Mock API responses and schemas
└── configs/        # Test configuration files
```

## Usage

Import fixtures in tests:

```typescript
import { mockAgentConfig } from '../../../fixtures/agents/backend-developer.js';
import { sampleRepository } from '../../../fixtures/repositories/typescript-project.js';
```

## Guidelines

- Keep fixtures realistic and representative
- Use TypeScript for type safety
- Version control all fixture data
- Document complex fixture scenarios
- Avoid sensitive or production data