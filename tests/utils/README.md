# Test Utilities

This directory contains reusable testing utilities, helpers, and shared test infrastructure.

## Purpose

Test utilities provide:
- Common test setup/teardown procedures
- Shared assertion helpers
- Mock factory functions
- Test environment configuration
- Performance testing tools

## Structure

```
/utils/
├── test-helpers.ts     # Common test setup and assertion utilities
├── mock-factories.ts   # Factory functions for creating test mocks
├── performance.ts      # Performance testing and benchmarking tools
├── fixtures-loader.ts  # Dynamic fixture loading utilities
└── async-helpers.ts    # Async testing utilities and timeout management
```

## Usage

Import utilities in tests:

```typescript
import { createMockOrchestrator, setupTestEnvironment } from '../../utils/test-helpers.js';
import { measurePerformance } from '../../utils/performance.js';
```

## Guidelines

- Keep utilities generic and reusable
- Follow TypeScript best practices
- Document complex utility functions
- Include performance benchmarks for utility functions
- Maintain backward compatibility