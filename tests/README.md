# Graphyn CLI Testing Architecture

This directory contains all tests for the Graphyn CLI Platform Orchestration engine, organized into a professional testing structure for production-ready code.

## Directory Structure

```
/tests/
├── unit/           # Unit tests for individual components
│   ├── orchestrator/   # Core orchestration engine tests
│   ├── agents/         # Agent system tests
│   └── entities/       # Business entity tests
├── integration/    # Integration tests for CLI flows
├── contract/       # Contract tests for external interfaces
├── fixtures/       # Test data and fixtures
└── utils/          # Test utilities and helpers
```

## Test Categories

### Unit Tests (`/unit/`)
- **Purpose**: Test individual components in isolation
- **Scope**: Single class/function/module testing
- **Dependencies**: Mocked external dependencies
- **Speed**: Very fast (< 100ms per test)

### Integration Tests (`/integration/`)
- **Purpose**: Test component interactions and workflows
- **Scope**: Multi-component integration scenarios
- **Dependencies**: Real internal dependencies, mocked externals
- **Speed**: Fast (< 1s per test)

### Contract Tests (`/contract/`)
- **Purpose**: Validate external API contracts and interfaces
- **Scope**: External API compliance and schema validation
- **Dependencies**: Real external services (when available)
- **Speed**: Medium (< 5s per test)

## Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:watch       # Watch mode for development
npm run test:coverage    # Generate coverage report

# Run tests for specific components
npx vitest run tests/unit/orchestrator/
npx vitest run tests/integration/
npx vitest run tests/contract/
```

## Testing Standards

### Performance Requirements
- **Unit Tests**: < 100ms execution time
- **Integration Tests**: < 1s execution time
- **Contract Tests**: < 5s execution time
- **Total Test Suite**: < 30s execution time

### Coverage Requirements
- **Overall Coverage**: > 90%
- **Critical Paths**: 100% coverage
- **Error Handling**: 100% coverage
- **Edge Cases**: > 80% coverage

### Test Quality Standards
- Clear, descriptive test names
- Proper setup/teardown procedures
- Isolated test environments
- Deterministic test outcomes
- Comprehensive error scenarios

## Contributing

When adding new tests:
1. Place tests in the appropriate category directory
2. Follow existing naming conventions
3. Include both success and failure scenarios
4. Update this README if adding new test categories
5. Ensure tests meet performance requirements