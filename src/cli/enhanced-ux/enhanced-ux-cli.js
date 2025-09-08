#!/usr/bin/env node
/**
 * Enhanced UX CLI Command
 *
 * Provides split-screen terminal interface integration for Graphyn CLI.
 * Usage: graphyn --split-screen [query]
 */
import { SplitScreenOrchestrator } from './split-screen-orchestrator.js';
/**
 * Enhanced UX CLI implementation
 */
export class EnhancedUXCLI {
    orchestrator = null;
    config;
    constructor(options = {}) {
        this.config = {
            performance: {
                maxRenderTime: 16,
                maxAnalysisTime: 3000,
                maxInputResponseTime: 50,
                maxMemoryUsage: 150 * 1024 * 1024
            },
            layout: {
                streamingRatio: 0.7,
                approvalRatio: 0.2,
                inputRatio: 0.1
            },
            features: {
                enableExitProtection: true,
                enableContextCaching: true,
                enablePerformanceMonitoring: options.performance || false
            }
        };
        if (options.debug) {
            this.enableDebugMode();
        }
    }
    /**
     * Start enhanced UX interface
     */
    async start(query) {
        try {
            // Initialize orchestrator
            this.orchestrator = new SplitScreenOrchestrator(this.config);
            // Setup event handlers
            this.setupEventHandlers();
            // Setup raw input handling
            this.setupRawInput();
            // Start the interface
            await this.orchestrator.start(query);
        }
        catch (error) {
            console.error('❌ Failed to start enhanced UX:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    }
    /**
     * Setup event handlers for orchestrator
     */
    setupEventHandlers() {
        if (!this.orchestrator)
            return;
        this.orchestrator.on('started', () => {
            if (this.config.features.enablePerformanceMonitoring) {
                console.log('🚀 Enhanced UX started with performance monitoring');
            }
        });
        this.orchestrator.on('stopped', () => {
            console.log('\n✅ Enhanced UX session ended');
            process.exit(0);
        });
        this.orchestrator.on('performance_warning', (warning) => {
            if (this.config.features.enablePerformanceMonitoring) {
                console.warn(`⚠️ Performance: ${warning}`);
            }
        });
        this.orchestrator.on('workflow_approved', (approvalState) => {
            console.log(`\n✅ Workflow approved with ${approvalState.tasks.length} tasks`);
            // Here you would integrate with the existing Graphyn CLI execution engine
        });
        this.orchestrator.on('context_updated', (context) => {
            // Context updated - could trigger agent prompt updates in existing system
        });
    }
    /**
     * Setup raw terminal input handling
     */
    setupRawInput() {
        if (!process.stdin.isTTY) {
            throw new Error('Enhanced UX requires a TTY terminal');
        }
        // Set raw mode for character-by-character input
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        // Handle input
        process.stdin.on('data', async (chunk) => {
            if (this.orchestrator) {
                for (const char of chunk) {
                    await this.orchestrator.handleKeyboardInput(char);
                }
            }
        });
        // Hide cursor initially
        process.stdout.write('\x1B[?25l');
    }
    /**
     * Enable debug mode
     */
    enableDebugMode() {
        console.log('🐛 Debug mode enabled');
        // Enhanced error reporting
        process.on('unhandledRejection', (reason, promise) => {
            console.error('🚨 Unhandled Promise Rejection:', reason);
            console.error('Promise:', promise);
        });
        process.on('uncaughtException', (error) => {
            console.error('🚨 Uncaught Exception:', error);
            process.exit(1);
        });
    }
    /**
     * Stop the enhanced UX interface
     */
    async stop() {
        if (this.orchestrator) {
            await this.orchestrator.stop();
            this.orchestrator = null;
        }
        // Restore terminal state
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
            process.stdout.write('\x1B[?25h'); // Show cursor
        }
    }
    /**
     * Get performance report
     */
    getPerformanceReport() {
        if (!this.orchestrator) {
            return 'No active session';
        }
        const metrics = this.orchestrator.getPerformanceMetrics();
        return `
📊 Performance Report:

Split Screen Interface:
  - Render Time: ${metrics.splitScreen.renderTime.toFixed(2)}ms (target: <16ms)
  - Memory Usage: ${(metrics.splitScreen.memoryUsage / 1024 / 1024).toFixed(2)}MB (target: <150MB)

Repository Context Manager:
  - Analysis Time: ${metrics.contextManager.analysisTime.toFixed(2)}ms (target: <3000ms)
  - Memory Usage: ${(metrics.contextManager.memoryUsage / 1024 / 1024).toFixed(2)}MB

Approval Workflow Handler:
  - Input Response Time: ${metrics.workflowHandler.inputResponseTime.toFixed(2)}ms (target: <50ms)
    `.trim();
    }
}
/**
 * Parse command line arguments for enhanced UX
 */
export function parseEnhancedUXArgs(args) {
    const options = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--split-screen':
                options.splitScreen = true;
                break;
            case '--debug':
                options.debug = true;
                break;
            case '--performance':
                options.performance = true;
                break;
            case '--query':
                if (i + 1 < args.length) {
                    options.query = args[i + 1];
                    i++; // Skip next argument
                }
                break;
            default:
                // Treat non-flag arguments as query
                if (!arg.startsWith('--') && !options.query) {
                    options.query = arg;
                }
                break;
        }
    }
    return options;
}
/**
 * Main CLI entry point for enhanced UX
 */
export async function runEnhancedUXCLI(args = process.argv.slice(2)) {
    const options = parseEnhancedUXArgs(args);
    if (!options.splitScreen) {
        console.log('Enhanced UX not requested. Use --split-screen flag to enable.');
        return;
    }
    const cli = new EnhancedUXCLI(options);
    // Handle graceful shutdown
    const shutdown = async () => {
        console.log('\n🛑 Shutting down enhanced UX...');
        await cli.stop();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    try {
        await cli.start(options.query);
    }
    catch (error) {
        console.error('❌ Enhanced UX error:', error instanceof Error ? error.message : String(error));
        await cli.stop();
        process.exit(1);
    }
}
// Run if called directly (Node.js detection)
if (process.argv[1] && process.argv[1].includes('enhanced-ux-cli')) {
    runEnhancedUXCLI().catch(console.error);
}
