// Re-export from the new detector with backward compatibility
export { 
  detectTechStack,
  contextDetector,
  type TechStackContext,
  type FrameworkInfo,
  type DatabaseConfig,
  type GitContext,
  type AIMLContext,
  type CodingConvention,
  type DetectionOptions,
  ContextDetectionError
} from './detector.js';

export { GitDetector, type GitInfo, type SubmoduleInfo } from './git-detector.js';