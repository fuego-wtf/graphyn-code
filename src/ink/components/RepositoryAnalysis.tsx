import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { RepositoryAnalyzerService } from '../../services/repository-analyzer.js';
import { getAccentColor, getDimColor, getErrorColor, getSuccessColor } from '../theme/colors.js';

interface RepositoryAnalysisProps {
  onComplete?: () => void;
}

interface AnalysisResult {
  name: string;
  type: string;
  language: string;
  framework?: string;
  packages?: string[];
  gitInfo?: {
    branch: string;
    remoteUrl?: string;
  };
  structure: {
    directories: string[];
    files: Record<string, number>;
  };
}

export const RepositoryAnalysis: React.FC<RepositoryAnalysisProps> = ({ onComplete }) => {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string>('Initializing');

  useEffect(() => {
    analyzeRepository();
  }, []);

  const analyzeRepository = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const workDir = process.cwd();
      setStage('Analyzing repository...');
      
      // Simple, direct analysis without caching
      const fs = await import('fs');
      const path = await import('path');
      
      // Read package.json if it exists
      let packageData: any = null;
      try {
        const packagePath = path.join(workDir, 'package.json');
        if (fs.existsSync(packagePath)) {
          const packageContent = fs.readFileSync(packagePath, 'utf-8');
          packageData = JSON.parse(packageContent);
        }
      } catch (e) {
        // Ignore package.json errors
      }
      
      // Count files by extension
      const fileStats: Record<string, number> = {};
      let dirCount = 0;
      
      try {
        const items = fs.readdirSync(workDir);
        for (const item of items) {
          if (item.startsWith('.')) continue;
          const itemPath = path.join(workDir, item);
          const stat = fs.statSync(itemPath);
          
          if (stat.isDirectory()) {
            dirCount++;
          } else {
            const ext = path.extname(item);
            fileStats[ext] = (fileStats[ext] || 0) + 1;
          }
        }
      } catch (e) {
        // Ignore file scanning errors
      }
      
      // Determine framework and language
      let framework = 'unknown';
      let language = 'unknown';
      
      if (packageData) {
        const deps = { ...packageData.dependencies, ...packageData.devDependencies };
        
        if (deps.react && deps.ink) {
          framework = 'ink';
          language = 'typescript';
        } else if (deps.react && deps.next) {
          framework = 'nextjs';
          language = 'typescript';
        } else if (deps.react) {
          framework = 'react';
          language = 'typescript';
        }
        
        if (fileStats['.ts'] || fileStats['.tsx']) {
          language = 'typescript';
        } else if (fileStats['.js'] || fileStats['.jsx']) {
          language = 'javascript';
        }
      }
      
      const analysis = {
        name: packageData?.name?.replace('@graphyn/', '') || 'code',
        type: 'single',
        language,
        framework,
        structure: {
          directories: Array(dirCount).fill('dir'),
          files: fileStats
        }
      };
      
      setResult(analysis as any);
      setLoading(false);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setLoading(false);
    }
  };

  const handleKeyPress = (ch: string, key: any) => {
    if (key.escape || ch === 'q') {
      if (onComplete) {
        onComplete();
      } else {
        exit();
      }
    }
    if (ch === 'r' && error) {
      analyzeRepository();
    }
  };

  useEffect(() => {
    process.stdin.on('keypress', handleKeyPress);
    return () => {
      process.stdin.off('keypress', handleKeyPress);
    };
  }, [error, onComplete]);

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
          <Text bold color="cyan">📊 Repository Analysis</Text>
        </Box>
        
        <Box marginBottom={2}>
          <Spinner type="dots" />
          <Text> {stage}...</Text>
        </Box>
        
        <Box>
          <Text color={getDimColor()}>Analyzing your repository structure and dependencies...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="round" borderColor="red" paddingX={1} marginBottom={1}>
          <Text bold color="red">❌ Analysis Failed</Text>
        </Box>
        
        <Box marginBottom={2}>
          <Text color="red">{error}</Text>
        </Box>
        
        <Box>
          <Text color={getDimColor()}>Press R to retry • ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  if (!result) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">No analysis result available</Text>
      </Box>
    );
  }

  const describeRepository = (analysis: AnalysisResult): string => {
    // Check for CLI-specific indicators first
    if (analysis.name === 'code' || process.cwd().includes('/code')) {
      const hasInkComponents = analysis.structure.directories.some(dir => dir.includes('ink'));
      const hasCliCommands = analysis.structure.directories.some(dir => dir.includes('commands'));
      
      if (hasInkComponents && hasCliCommands) {
        return 'a TypeScript CLI tool with interactive UI components built using Ink (React for CLIs). This appears to be a development tool that provides both interactive and command-line interfaces.';
      }
    }

    // Check for Encore.dev backend indicators
    if (analysis.name === 'backyard' || analysis.structure.directories.some(dir => 
      ['auth', 'api-gateway', 'threads', 'monitoring', 'identity'].some(service => dir.includes(service))
    )) {
      const services = ['auth', 'api-gateway', 'threads', 'monitoring', 'identity', 'settings', 'admin-bff']
        .filter(service => 
          analysis.structure.directories.some(dir => dir.includes(service) && !dir.includes('node_modules'))
        );
      return `an Encore.dev distributed backend system with ${services.length} microservices: ${services.join(', ')}. This appears to be a sophisticated backend API platform.`;
    }

    if (analysis.framework === 'nextjs') {
      return 'a Next.js web application with TypeScript/JavaScript frontend and backend capabilities.';
    } else if (analysis.framework === 'react') {
      return 'a React application for building user interfaces.';
    } else if (analysis.framework === 'nestjs') {
      return 'a NestJS backend API application with TypeScript.';
    } else if (analysis.type === 'monorepo') {
      return `a monorepo containing ${analysis.packages?.length || 'multiple'} packages/applications.`;
    } else if (analysis.language === 'typescript' || analysis.language === 'javascript') {
      return 'a TypeScript/JavaScript project, possibly a web application or Node.js service.';
    } else {
      return 'a software development project with various components and files.';
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="green" paddingX={1} marginBottom={1}>
        <Text bold color="green">✅ Repository Analysis Complete</Text>
      </Box>

      {/* Project Overview */}
      <Box flexDirection="column" marginBottom={2}>
        <Text bold color={getAccentColor()}>📂 Project: {result.name}</Text>
        <Text color={getDimColor()}>
          This is {describeRepository(result)}
        </Text>
      </Box>

      {/* Technical Details */}
      <Box flexDirection="column" marginBottom={2}>
        <Text bold color={getAccentColor()}>🔧 Technical Details:</Text>
        
        <Box marginLeft={2} flexDirection="column">
          <Text>• Type: <Text color={getSuccessColor()}>{result.type}</Text></Text>
          <Text>• Language: <Text color={getSuccessColor()}>{result.language}</Text></Text>
          {result.framework && (
            <Text>• Framework: <Text color={getSuccessColor()}>{result.framework}</Text></Text>
          )}
          {result.gitInfo?.branch && (
            <Text>• Branch: <Text color={getSuccessColor()}>{result.gitInfo.branch}</Text></Text>
          )}
        </Box>
      </Box>

      {/* Structure Overview */}
      <Box flexDirection="column" marginBottom={2}>
        <Text bold color={getAccentColor()}>📁 Structure:</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text>• Directories: <Text color={getSuccessColor()}>{result.structure.directories.length}</Text></Text>
          <Text>• File types: <Text color={getSuccessColor()}>{Object.keys(result.structure.files).length}</Text></Text>
          {Object.keys(result.structure.files).length > 0 && (
            <Text>• Main files: <Text color={getSuccessColor()}>
              {Object.entries(result.structure.files)
                .sort((a: any, b: any) => b[1] - a[1])
                .slice(0, 3)
                .map(([ext, count]) => `${ext} (${count})`)
                .join(', ')}
            </Text></Text>
          )}
        </Box>
      </Box>

      {/* Packages (for monorepos) */}
      {result.packages && result.packages.length > 0 && (
        <Box flexDirection="column" marginBottom={2}>
          <Text bold color={getAccentColor()}>📦 Packages ({result.packages.length}):</Text>
          <Box marginLeft={2} flexDirection="column">
            {result.packages.slice(0, 5).map(pkg => (
              <Text key={pkg}>• {pkg}</Text>
            ))}
            {result.packages.length > 5 && (
              <Text color={getDimColor()}>• ... and {result.packages.length - 5} more</Text>
            )}
          </Box>
        </Box>
      )}

      {/* Help text */}
      <Box marginTop={1}>
        <Text color={getDimColor()}>Press ESC to return to main menu</Text>
      </Box>
    </Box>
  );
};