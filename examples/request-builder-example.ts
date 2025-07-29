import { 
  buildAskRequest, 
  AskRequestBuilder,
  detectRepository,
  detectBasicContext,
  contextBuilders 
} from '../src/services/request-builder.js';

// Example 1: Using the convenience function with automatic detection
async function example1() {
  const request = await buildAskRequest(
    "I need to add user authentication to my Next.js app",
    {
      contextMode: 'basic',  // Can be 'basic', 'advanced', 'minimal', or 'custom'
      teamId: 'team_123',
      organizationId: 'org_456'
    }
  );
  
  console.log('Request built with convenience function:');
  console.log(JSON.stringify(request, null, 2));
}

// Example 2: Using the builder pattern for more control
async function example2() {
  // Detect repository info separately
  const repoInfo = await detectRepository();
  console.log('Repository info:', repoInfo);
  
  // Build context separately
  const context = await detectBasicContext();
  console.log('Context:', context);
  
  // Build request step by step
  const request = new AskRequestBuilder()
    .withMessage("I need to add user authentication to my Next.js app")
    .withRepository(repoInfo)
    .withContext(context)
    .withTeamId('team_123')
    .withOrganizationId('org_456')
    .build();
  
  console.log('Request built with builder pattern:');
  console.log(JSON.stringify(request, null, 2));
}

// Example 3: Custom context builder
async function example3() {
  // Register a custom context builder
  contextBuilders.projectSpecific = async (rootPath) => {
    // Start with basic context
    const baseContext = await detectBasicContext(rootPath);
    
    // Add project-specific patterns
    baseContext.patterns = baseContext.patterns || [];
    baseContext.patterns.push('custom-auth-pattern');
    baseContext.patterns.push('multi-tenant');
    
    // Add custom metadata
    return {
      ...baseContext,
      custom_metadata: {
        auth_provider: 'better-auth',
        deployment_target: 'vercel',
        api_style: 'rest'
      }
    };
  };
  
  // Use the custom context builder
  const request = await buildAskRequest(
    "I need to add user authentication to my Next.js app",
    {
      contextMode: 'projectSpecific',
      teamId: 'team_123'
    }
  );
  
  console.log('Request with custom context:');
  console.log(JSON.stringify(request, null, 2));
}

// Example 4: Minimal request (no context)
async function example4() {
  const request = await buildAskRequest(
    "I need to add user authentication to my Next.js app",
    {
      contextMode: 'minimal',
      teamId: 'team_123'
    }
  );
  
  console.log('Minimal request:');
  console.log(JSON.stringify(request, null, 2));
}

// Run examples
console.log('=== Example 1: Convenience Function ===');
await example1();

console.log('\n=== Example 2: Builder Pattern ===');
await example2();

console.log('\n=== Example 3: Custom Context ===');
await example3();

console.log('\n=== Example 4: Minimal Request ===');
await example4();