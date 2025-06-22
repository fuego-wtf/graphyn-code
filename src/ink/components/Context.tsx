import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Loading } from './Loading.js';
import { detectRepository, detectFramework } from '../utils/repository.js';
import { RepositoryDetector } from '../../utils/repository-detector.js';
import { useStore } from '../store.js';
import { useAPI } from '../hooks/useAPI.js';
import path from 'path';
import fs from 'fs';

export const Context: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [stored, setStored] = useState(false);
  const { client } = useAPI();

  useEffect(() => {
    detectContext();
  }, []);

  const detectContext = async () => {
    try {
      setLoading(true);
      
      // Get current working directory
      const cwd = process.cwd();
      
      // Basic repository detection
      const repoInfo = await detectRepository();
      const framework = await detectFramework();
      
      // Enhanced detection using RepositoryDetector
      const detectedContext = await RepositoryDetector.detectRepository(cwd);
      
      // Check for GRAPHYN.md
      const graphynPath = path.join(cwd, 'GRAPHYN.md');
      const hasGraphynMd = fs.existsSync(graphynPath);
      
      // Check for common patterns
      const patterns = {
        customHooks: await checkPattern(cwd, 'use[A-Z]\\w+\\.tsx?', 'Custom React hooks'),
        componentLibrary: await checkPattern(cwd, 'components/(Button|Card|Input)', 'Component library'),
        apiRoutes: await checkPattern(cwd, 'api/.*\\.(ts|js)', 'API routes'),
        stateManagement: await detectStateManagement(cwd),
        testingFramework: await detectTestingFramework(cwd),
        cssFramework: await detectCSSFramework(cwd),
      };
      
      const contextData = {
        cwd,
        repository: repoInfo,
        framework,
        ...detectedContext,
        patterns,
        hasGraphynMd,
      };
      
      setContext(contextData);
      
      // Store context in backend if authenticated
      if (client) {
        try {
          await client.post('/api/v1/repository/context', {
            path: cwd,
            context: contextData,
            detected_at: new Date().toISOString()
          });
          setStored(true);
        } catch (err) {
          // Silent fail - context detection still works locally
          console.error('Failed to store context:', err);
        }
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect context');
    } finally {
      setLoading(false);
    }
  };
  
  const checkPattern = async (dir: string, pattern: string, description: string) => {
    try {
      const { execSync } = await import('child_process');
      const result = execSync(`find "${dir}" -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -E "${pattern}" | head -5`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      
      return {
        found: result.length > 0,
        description,
        examples: result.split('\n').filter(Boolean).slice(0, 3),
      };
    } catch {
      return { found: false, description, examples: [] };
    }
  };
  
  const detectStateManagement = async (dir: string) => {
    const packagePath = path.join(dir, 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps.redux) return 'Redux';
      if (deps.zustand) return 'Zustand';
      if (deps.mobx) return 'MobX';
      if (deps.recoil) return 'Recoil';
      if (deps['@tanstack/react-query']) return 'React Query';
    }
    return 'Context API';
  };
  
  const detectTestingFramework = async (dir: string) => {
    const packagePath = path.join(dir, 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps.jest) return 'Jest';
      if (deps.vitest) return 'Vitest';
      if (deps.mocha) return 'Mocha';
      if (deps['@testing-library/react']) return 'React Testing Library';
    }
    return 'None detected';
  };
  
  const detectCSSFramework = async (dir: string) => {
    const packagePath = path.join(dir, 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps.tailwindcss) return 'Tailwind CSS';
      if (deps['styled-components']) return 'Styled Components';
      if (deps.emotion) return 'Emotion';
      if (deps['@mui/material']) return 'Material-UI';
      if (deps['@chakra-ui/react']) return 'Chakra UI';
    }
    return 'Plain CSS';
  };

  if (loading) {
    return <Loading message="Detecting repository context..." />;
  }

  if (error) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text color="red">❌ Error: {error}</Text>
      </Box>
    );
  }

  if (!context) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text color="yellow">⚠️  No context detected</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="cyan">🔍 Repository Context Detection</Text>
      <Text> </Text>
      
      {/* Basic Info */}
      <Box flexDirection="column" marginLeft={2}>
        <Text>📁 <Text bold>Working Directory:</Text> {context.cwd}</Text>
        <Text>🔧 <Text bold>Framework:</Text> {context.framework || 'Not detected'}</Text>
        <Text>📦 <Text bold>Language:</Text> {context.language || 'Not detected'}</Text>
        <Text>🎯 <Text bold>Project Type:</Text> {context.projectType || 'Unknown'}</Text>
        <Text>📝 <Text bold>GRAPHYN.md:</Text> {context.hasGraphynMd ? '✅ Found' : '❌ Not found'}</Text>
      </Box>
      
      {/* Repository Info */}
      {context.repository && (
        <>
          <Text> </Text>
          <Text bold color="green">📚 Repository</Text>
          <Box flexDirection="column" marginLeft={2}>
            <Text>• Type: {context.repository.type}</Text>
            {context.repository.remote && <Text>• Remote: {context.repository.remote}</Text>}
            {context.repository.branch && <Text>• Branch: {context.repository.branch}</Text>}
          </Box>
        </>
      )}
      
      {/* Detected Patterns */}
      <Text> </Text>
      <Text bold color="green">🎨 Detected Patterns</Text>
      <Box flexDirection="column" marginLeft={2}>
        <Text>• State Management: {context.patterns.stateManagement}</Text>
        <Text>• Testing Framework: {context.patterns.testingFramework}</Text>
        <Text>• CSS Framework: {context.patterns.cssFramework}</Text>
        
        {Object.entries(context.patterns).map(([key, value]: [string, any]) => {
          if (typeof value === 'object' && value.found !== undefined) {
            return (
              <Box key={key} flexDirection="column">
                <Text>• {value.description}: {value.found ? '✅ Found' : '❌ Not found'}</Text>
                {value.found && value.examples.length > 0 && (
                  <Box flexDirection="column" marginLeft={2}>
                    {value.examples.slice(0, 2).map((example: string, i: number) => (
                      <Text key={i} dimColor>  - {path.basename(example)}</Text>
                    ))}
                  </Box>
                )}
              </Box>
            );
          }
          return null;
        })}
      </Box>
      
      {/* Conventions */}
      {context.conventions && Object.keys(context.conventions).length > 0 && (
        <>
          <Text> </Text>
          <Text bold color="green">📐 Conventions</Text>
          <Box flexDirection="column" marginLeft={2}>
            {Object.entries(context.conventions).map(([key, value]) => (
              <Text key={key}>• {key}: {String(value)}</Text>
            ))}
          </Box>
        </>
      )}
      
      <Text> </Text>
      {stored && (
        <>
          <Text color="green">✅ Context stored in Graphyn platform</Text>
          <Text dimColor>   Agents will use this context to understand your codebase</Text>
          <Text> </Text>
        </>
      )}
      <Text dimColor>💡 Tip: Create a GRAPHYN.md file to document your project's specific patterns and conventions!</Text>
    </Box>
  );
};