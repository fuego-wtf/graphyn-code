/**
 * ESLint Configuration for Ultimate Orchestration Platform
 *
 * Enforces TypeScript naming conventions:
 * - Classes: PascalCase (UltimateOrchestrator, AgentSessionManager)
 * - Interfaces: PascalCase without I prefix (TaskNode, AgentPersona)
 * - Methods/Functions: camelCase (orchestrateQuery, createSession)
 * - Constants: UPPER_CASE (MAX_PARALLEL_AGENTS, DEFAULT_TIMEOUT_MS)
 * - Enums: PascalCase with UPPER_CASE members (TaskStatus.PENDING)
 * - Variables: camelCase (taskDecomposer, sessionManager)
 */

module.exports = {
  root: true,
  extends: [
    '@eslint/js/recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: [
    '@typescript-eslint'
  ],
  env: {
    node: true,
    es2022: true
  },
  rules: {
    // TypeScript Naming Convention Enforcement
    '@typescript-eslint/naming-convention': [
      'error',
      // Classes - PascalCase
      {
        selector: 'class',
        format: ['PascalCase'],
        custom: {
          regex: '^[A-Z][a-zA-Z0-9]*$',
          match: true
        }
      },
      // Interfaces - PascalCase, NO "I" prefix
      {
        selector: 'interface',
        format: ['PascalCase'],
        custom: {
          regex: '^(?!I[A-Z])[A-Z][a-zA-Z0-9]*$',
          match: true
        },
        filter: {
          regex: '^I[A-Z]',
          match: false
        }
      },
      // Type aliases - PascalCase, NO "T" prefix
      {
        selector: 'typeAlias',
        format: ['PascalCase'],
        custom: {
          regex: '^(?!T[A-Z])[A-Z][a-zA-Z0-9]*$',
          match: true
        }
      },
      // Enums - PascalCase
      {
        selector: 'enum',
        format: ['PascalCase'],
        custom: {
          regex: '^[A-Z][a-zA-Z0-9]*$',
          match: true
        }
      },
      // Enum members - UPPER_CASE
      {
        selector: 'enumMember',
        format: ['UPPER_CASE'],
        custom: {
          regex: '^[A-Z][A-Z0-9_]*$',
          match: true
        }
      },
      // Variables - camelCase (but allow UPPER_CASE for constants)
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow'
      },
      // Functions and methods - camelCase
      {
        selector: ['function', 'method'],
        format: ['camelCase'],
        custom: {
          regex: '^[a-z][a-zA-Z0-9]*$',
          match: true
        }
      },
      // Parameters - camelCase
      {
        selector: 'parameter',
        format: ['camelCase'],
        leadingUnderscore: 'allow'
      },
      // Properties - camelCase (allow UPPER_CASE for constants)
      {
        selector: 'property',
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow'
      },
      // Class methods - camelCase
      {
        selector: 'classMethod',
        format: ['camelCase'],
        modifiers: ['private', 'protected', 'public']
      },
      // Class properties - camelCase
      {
        selector: 'classProperty',
        format: ['camelCase', 'UPPER_CASE'],
        modifiers: ['private', 'protected', 'public', 'readonly']
      }
    ],

    // Code Quality Rules
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/explicit-function-return-type': ['warn', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true
    }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',

    // Performance and Best Practices
    '@typescript-eslint/prefer-for-of': 'error',
    '@typescript-eslint/prefer-includes': 'error',
    '@typescript-eslint/prefer-string-starts-ends-with': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',

    // Import/Export Rules
    'no-duplicate-imports': 'error',
    'sort-imports': ['error', {
      ignoreCase: true,
      ignoreDeclarationSort: true,
      ignoreMemberSort: false,
      memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      allowSeparatedGroups: true
    }],

    // General JavaScript Rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'no-nested-ternary': 'error',
    'no-unneeded-ternary': 'error',

    // Documentation Rules
    'spaced-comment': ['error', 'always', {
      block: { balanced: true },
      line: { markers: ['/'] }
    }],

    // Ultimate Orchestration Platform Specific Rules
    'no-magic-numbers': ['warn', {
      ignore: [0, 1, -1, 2, 10, 100, 1000],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true
    }]
  },

  overrides: [
    // Test files - relaxed rules
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-magic-numbers': 'off'
      }
    },

    // Configuration files - allow different naming
    {
      files: ['**/*.config.ts', '**/*.config.js', '**/.*.js', '**/.*.ts'],
      rules: {
        '@typescript-eslint/naming-convention': 'off',
        'no-console': 'off'
      }
    },

    // Constants files - enforce UPPER_CASE
    {
      files: ['**/constants.ts', '**/constants/**/*.ts'],
      rules: {
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'variable',
            format: ['UPPER_CASE'],
            custom: {
              regex: '^[A-Z][A-Z0-9_]*$',
              match: true
            }
          }
        ]
      }
    },

    // Types files - focus on interface naming
    {
      files: ['**/types.ts', '**/*.types.ts', '**/types/**/*.ts'],
      rules: {
        '@typescript-eslint/naming-convention': [
          'error',
          // Extra strict interface naming for type files
          {
            selector: 'interface',
            format: ['PascalCase'],
            custom: {
              regex: '^(?!I[A-Z])[A-Z][a-zA-Z0-9]*$',
              match: true
            },
            filter: {
              regex: '^I[A-Z]',
              match: false
            }
          },
          // Ensure no legacy I-prefixed interfaces
          {
            selector: 'interface',
            format: [],
            custom: {
              regex: '^I[A-Z]',
              match: false
            }
          }
        ]
      }
    }
  ],

  ignorePatterns: [
    'dist/',
    'build/',
    'node_modules/',
    '*.d.ts',
    'coverage/',
    '.next/',
    '.cache/',
    'public/',
    'docs/temp/**/*'
  ]
};