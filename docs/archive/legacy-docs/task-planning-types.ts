/**
 * Standardized Task Planning Format (STPF) v1.0 - Type Definitions
 * Comprehensive type system for algorithmically-processable task planning
 */

// ========================================
// CORE TASK DEFINITION TYPES
// ========================================

export interface TaskDefinition {
  // Core Identification
  id: string; // Format: (ARCH|BACK|FRONT|INFRA|TEST)-###
  title: string;
  description: string;
  
  // IEEE 830 Specification Structure
  specification: IEEE830Specification;
  
  // RFC 2119 Requirement Levels
  requirementLevel: RFC2119Level;
  
  // INVEST Criteria Validation
  investCriteria: INVESTValidation;
  
  // Acceptance Criteria (BDD Format)
  acceptanceCriteria: AcceptanceCriterion[];
  
  // Estimation (Fibonacci Sequence)
  estimation: TaskEstimation;
  
  // MoSCoW Prioritization
  priority: TaskPriority;
  
  // Complexity Classification
  complexity: TaskComplexity;
  
  // Dependency Management
  dependencies: TaskDependencies;
  
  // API Contract Specification
  apiContract?: OpenAPIContract;
  
  // Testing Requirements
  testing: TestingRequirements;
  
  // Performance Targets
  performance?: PerformanceTargets;
  
  // Definition of Ready/Done
  definitionOfReady?: DefinitionOfReady;
  definitionOfDone?: DefinitionOfDone;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  assignee?: string;
  reviewer?: string;
  status: TaskStatus;
}

// ========================================
// RFC 2119 REQUIREMENT LEVELS
// ========================================

export type RFC2119Level = 
  | "MUST" 
  | "MUST_NOT" 
  | "SHOULD" 
  | "SHOULD_NOT" 
  | "MAY" 
  | "OPTIONAL";

// ========================================
// IEEE 830 SPECIFICATION STRUCTURE
// ========================================

export interface IEEE830Specification {
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  constraints: string[];
  assumptions: string[];
  userClasses?: UserClass[];
  systemFeatures?: SystemFeature[];
  externalInterfaces?: ExternalInterface[];
}

export interface UserClass {
  name: string;
  description: string;
  privileges: string[];
  characteristics: string[];
}

export interface SystemFeature {
  id: string;
  name: string;
  description: string;
  stimulusResponse: string;
  functionalRequirements: string[];
}

export interface ExternalInterface {
  type: "user" | "hardware" | "software" | "communications";
  name: string;
  description: string;
  requirements: string[];
}

// ========================================
// INVEST CRITERIA VALIDATION
// ========================================

export interface INVESTValidation {
  independent: boolean;
  negotiable: boolean;
  valuable: boolean;
  estimable: boolean;
  small: boolean;
  testable: boolean;
  validationNotes?: string;
  lastValidated: string;
  validatedBy: string;
}

// ========================================
// ACCEPTANCE CRITERIA (BDD FORMAT)
// ========================================

export interface AcceptanceCriterion {
  scenario: string;
  given: string[];
  when: string[];
  then: string[];
  examples?: Record<string, any>[];
  tags?: string[];
  priority: "HIGH" | "MEDIUM" | "LOW";
}

// ========================================
// TASK ESTIMATION (FIBONACCI)
// ========================================

export interface TaskEstimation {
  storyPoints: FibonacciPoints;
  confidence: EstimationConfidence;
  estimationMethod: "PLANNING_POKER" | "T_SHIRT" | "EXPERT" | "HISTORICAL";
  estimationNotes?: string;
  estimatedBy: string[];
  estimatedAt: string;
  actualPoints?: number; // For retrospective analysis
}

export type FibonacciPoints = 1 | 2 | 3 | 5 | 8 | 13 | 21 | 34 | 55 | 89;
export type EstimationConfidence = "HIGH" | "MEDIUM" | "LOW";

// ========================================
// MOSCOW PRIORITIZATION
// ========================================

export interface TaskPriority {
  moscow: MoSCoWLevel;
  businessValue: number; // 1-100
  technicalRisk: RiskLevel;
  marketPriority?: number; // 1-100
  costOfDelay?: number; // Per day/week impact
  dependencyImpact?: number; // How many tasks depend on this
}

export type MoSCoWLevel = "MUST" | "SHOULD" | "COULD" | "WONT";
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

// ========================================
// TASK COMPLEXITY
// ========================================

export interface TaskComplexity {
  level: ComplexityLevel;
  factors: ComplexityFactor[];
  complexityNotes?: string;
  unknowns?: string[]; // List of uncertainties
  researchRequired?: boolean;
  prototypeRequired?: boolean;
}

export type ComplexityLevel = "SIMPLE" | "COMPLEX" | "EPIC";
export type ComplexityFactor = 
  | "TECHNICAL" 
  | "BUSINESS" 
  | "INTEGRATION" 
  | "PERFORMANCE" 
  | "SECURITY"
  | "UI_UX"
  | "DATA"
  | "INFRASTRUCTURE";

// ========================================
// DEPENDENCY MANAGEMENT
// ========================================

export interface TaskDependencies {
  blockedBy?: string[]; // Tasks that must complete before this one
  blocks?: string[]; // Tasks that depend on this one
  dependencyType: DependencyType;
  externalDependencies?: ExternalDependency[];
  resourceDependencies?: string[]; // Required resources/people
}

export type DependencyType = "HARD" | "SOFT" | "PREFERENTIAL";

export interface ExternalDependency {
  name: string;
  type: "VENDOR" | "TEAM" | "SYSTEM" | "APPROVAL";
  description: string;
  expectedResolution?: string;
  contactPerson?: string;
  impact: RiskLevel;
}

// ========================================
// OPENAPI CONTRACT SPECIFICATION
// ========================================

export interface OpenAPIContract {
  endpoints: APIEndpoint[];
  schemas: APISchema[];
  authentication?: AuthenticationMethod[];
  rateLimit?: RateLimit;
  validation?: {
    requestValidation: boolean;
    responseValidation: boolean;
    schema: string; // JSON Schema URL or inline
  };
  documentation?: {
    specUrl?: string;
    examples?: Record<string, any>;
  };
}

export interface APIEndpoint {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  operationId: string;
  description: string;
  parameters?: APIParameter[];
  requestBody?: APIRequestBody;
  responses: APIResponse[];
  security?: string[];
}

export interface APIParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required: boolean;
  schema: APISchema;
  description?: string;
}

export interface APIRequestBody {
  description?: string;
  required: boolean;
  content: Record<string, MediaType>;
}

export interface APIResponse {
  statusCode: number;
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, APISchema>;
}

export interface MediaType {
  schema: APISchema;
  examples?: Record<string, any>;
}

export interface APISchema {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  format?: string;
  properties?: Record<string, APISchema>;
  items?: APISchema;
  required?: string[];
  example?: any;
}

export interface AuthenticationMethod {
  type: "bearer" | "basic" | "apiKey" | "oauth2";
  scheme?: string;
  bearerFormat?: string;
}

export interface RateLimit {
  requests: number;
  window: string; // e.g., "1m", "1h", "1d"
  scope: "user" | "ip" | "global";
}

// ========================================
// TESTING REQUIREMENTS
// ========================================

export interface TestingRequirements {
  testingApproach: TestingApproach;
  unitTests?: UnitTestRequirements;
  integrationTests?: IntegrationTestRequirements;
  e2eTests?: E2ETestRequirements;
  performanceTests?: PerformanceTestRequirements;
  securityTests?: SecurityTestRequirements;
  testData?: TestDataRequirements;
}

export type TestingApproach = "TDD" | "BDD" | "ATDD" | "HYBRID";

export interface UnitTestRequirements {
  required: boolean;
  coverageTarget: number; // 0-100
  testFramework?: string;
  mockingStrategy?: "FULL" | "PARTIAL" | "NONE";
  criticalPaths: string[];
}

export interface IntegrationTestRequirements {
  required: boolean;
  testScenarios: string[];
  systemsToIntegrate: string[];
  mockExternalSystems?: boolean;
}

export interface E2ETestRequirements {
  required: boolean;
  criticalPaths: string[];
  userJourneys: string[];
  browsers?: string[];
  devices?: string[];
}

export interface PerformanceTestRequirements {
  required: boolean;
  loadTests?: boolean;
  stressTests?: boolean;
  scalabilityTests?: boolean;
  targets: PerformanceTargets;
}

export interface SecurityTestRequirements {
  required: boolean;
  vulnerabilityScanning?: boolean;
  penetrationTesting?: boolean;
  authenticationTesting?: boolean;
  authorizationTesting?: boolean;
  dataEncryptionTesting?: boolean;
}

export interface TestDataRequirements {
  syntheticData?: boolean;
  productionDataSubset?: boolean;
  dataPrivacyCompliance?: boolean;
  dataSize?: "SMALL" | "MEDIUM" | "LARGE";
}

// ========================================
// PERFORMANCE TARGETS
// ========================================

export interface PerformanceTargets {
  responseTime?: ResponseTimeTarget;
  throughput?: ThroughputTarget;
  resourceUsage?: ResourceUsageTarget;
  availability?: AvailabilityTarget;
  scalability?: ScalabilityTarget;
}

export interface ResponseTimeTarget {
  target: string; // e.g., "<50ms", "<200ms"
  measurement: "P50" | "P90" | "P95" | "P99";
  endpoint?: string; // Specific endpoint if applicable
}

export interface ThroughputTarget {
  target: string; // e.g., "1000 req/sec", "10K ops/min"
  sustainedDuration?: string; // e.g., "1h", "24h"
}

export interface ResourceUsageTarget {
  cpu?: string; // e.g., "<80%"
  memory?: string; // e.g., "<2GB"
  storage?: string; // e.g., "<100MB"
  network?: string; // e.g., "<10MB/s"
}

export interface AvailabilityTarget {
  uptime: string; // e.g., "99.9%", "99.99%"
  maxDowntime?: string; // e.g., "8.76h/year", "4.38h/year"
  recoveryTime?: string; // e.g., "<5min", "<30s"
}

export interface ScalabilityTarget {
  users?: string; // e.g., "10K concurrent", "100K daily"
  dataVolume?: string; // e.g., "1TB", "10M records"
  transactions?: string; // e.g., "1M/day", "100K/hour"
}

// ========================================
// DEFINITION OF READY/DONE
// ========================================

export interface DefinitionOfReady {
  criteria: string[];
  checkedBy?: string;
  checkedAt?: string;
  additionalNotes?: string;
}

export interface DefinitionOfDone {
  criteria: string[];
  checkedBy?: string;
  checkedAt?: string;
  additionalNotes?: string;
  releaseNotes?: string;
}

// ========================================
// TASK STATUS & WORKFLOW
// ========================================

export type TaskStatus = 
  | "BACKLOG"
  | "READY"
  | "IN_PROGRESS"
  | "CODE_REVIEW"
  | "TESTING"
  | "BLOCKED"
  | "DONE"
  | "DEPLOYED"
  | "ARCHIVED";

// ========================================
// ALGORITHM RESULT TYPES
// ========================================

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  score: number; // 0-100
  recommendations?: string[];
}

export interface CriticalPathResult {
  criticalPath: string[];
  totalDuration: number;
  taskDetails: Map<string, {
    earliestStart: number;
    latestStart: number;
    earliestFinish: number;
    latestFinish: number;
    slack: number;
    isCritical: boolean;
    duration: number;
  }>;
}

export interface ParallelBatch {
  batchId: number;
  tasks: string[];
  estimatedDuration: number;
  requiredResources: string[];
  startTime: number;
  endTime: number;
  dependencies?: string[]; // Batch dependencies
}

export interface ProjectMetrics {
  velocity: {
    plannedStoryPoints: number;
    completedStoryPoints: number;
    burndownRate: number;
    completionPercentage: number;
  };
  quality: {
    investCompliance: number; // 0-100
    testCoverage: number; // 0-100
    performanceCompliance: number; // 0-100
    defectPotential: number; // 0-100
  };
  efficiency: {
    criticalPathLength: number;
    parallelizationRatio: number;
    resourceUtilization: number; // 0-100
    throughput: number; // Points per batch
  };
  predictability: {
    estimationAccuracy: number; // 0-100
    scheduleVariance: number; // Days ahead/behind
    riskScore: number; // 0-100
  };
}

export interface ResourceAllocation {
  resourceId: string;
  capacity: number;
  allocatedTasks: string[];
  utilization: number; // 0-100
  skills: string[];
  availability: TimeSlot[];
}

export interface TimeSlot {
  start: string; // ISO datetime
  end: string; // ISO datetime
  available: boolean;
}

// ========================================
// SCHEDULING ALGORITHM OPTIONS
// ========================================

export interface SchedulingOptions {
  resourceConstraints?: Map<string, number>;
  maxBatchSize?: number;
  prioritizeBy?: "BUSINESS_VALUE" | "RISK" | "DEPENDENCIES" | "COMPLEXITY";
  allowFastTracking?: boolean; // Overlapping dependent tasks
  maxParallelism?: number;
  bufferPercentage?: number; // 0-100, adds buffer time
}

export interface OptimizationResult {
  schedule: ParallelBatch[];
  metrics: ProjectMetrics;
  criticalPath: CriticalPathResult;
  validationReport: Map<string, ValidationResult>;
  recommendations: string[];
  alternativeSchedules?: ParallelBatch[][];
}

// ========================================
// REPORTING & ANALYTICS
// ========================================

export interface TaskAnalytics {
  taskId: string;
  actualDuration?: number;
  actualComplexity?: ComplexityLevel;
  defectsFound?: number;
  reworkCycles?: number;
  teamFeedback?: TeamFeedback;
  lessonsLearned?: string[];
}

export interface TeamFeedback {
  estimation: "ACCURATE" | "OVER" | "UNDER";
  complexity: "ACCURATE" | "OVER" | "UNDER";
  clarity: "CLEAR" | "CONFUSING" | "INCOMPLETE";
  dependencies: "COMPLETE" | "MISSING" | "INCORRECT";
  comments?: string;
}

export interface ProjectReport {
  summary: ProjectSummary;
  scheduleAnalysis: ScheduleAnalysis;
  qualityMetrics: QualityMetrics;
  riskAssessment: RiskAssessment;
  recommendations: Recommendation[];
  appendices: {
    taskDetails: TaskDefinition[];
    validationResults: Map<string, ValidationResult>;
    dependencyGraph: string; // DOT format
  };
}

export interface ProjectSummary {
  totalTasks: number;
  totalStoryPoints: number;
  estimatedDuration: number; // In story points or time units
  criticalPathTasks: string[];
  highRiskTasks: string[];
  resourceRequirements: string[];
}

export interface ScheduleAnalysis {
  parallelBatches: number;
  maxParallelTasks: number;
  bottlenecks: string[];
  optimizationOpportunities: string[];
}

export interface QualityMetrics {
  investCompliance: number;
  testCoverageExpected: number;
  performanceTargetsSet: number;
  documentationCompleteness: number;
}

export interface RiskAssessment {
  overallRiskScore: number;
  highRiskTasks: string[];
  dependencyRisks: string[];
  technicalRisks: string[];
  mitigationStrategies: string[];
}

export interface Recommendation {
  category: "SCHEDULING" | "QUALITY" | "RISK" | "PROCESS";
  priority: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  impact: string;
  effort: "LOW" | "MEDIUM" | "HIGH";
  timeline?: string;
}

// ========================================
// EXPORT ALL TYPES
// ========================================

export type * from './task-planning-types';