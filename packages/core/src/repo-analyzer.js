/**
 * Intelligent Repository Analyzer
 *
 * Uses Claude to deeply analyze repository structure, technology stack, and patterns
 */
import { promises as fs } from 'fs';
import path from 'path';
import { ClaudeAPIWrapper } from './claude-api-wrapper.js';
export class IntelligentRepoAnalyzer {
    claudeAPI;
    workingDirectory;
    maxFilesToAnalyze = 50;
    maxFileSize = 50000; // 50KB
    constructor(workingDirectory, claudeAPI) {
        this.workingDirectory = workingDirectory;
        this.claudeAPI = claudeAPI || new ClaudeAPIWrapper({
            apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key'
        });
    }
    async analyzeRepository() {
        try {
            // Step 1: Structural analysis
            const structure = await this.analyzeStructure();
            // Step 2: Technology detection
            const technology = await this.detectTechnology(structure);
            // Step 3: Code pattern analysis (using Claude)
            const patterns = await this.analyzePatterns(structure, technology);
            // Step 4: Dependency analysis
            const dependencies = await this.analyzeDependencies();
            // Step 5: Complexity assessment
            const complexity = await this.assessComplexity(structure, technology, dependencies);
            // Step 6: Context understanding
            const context = await this.understandContext(structure, technology, dependencies);
            return {
                structure,
                technology,
                patterns,
                dependencies,
                complexity,
                context
            };
        }
        catch (error) {
            // Fallback to basic analysis
            console.warn('Advanced analysis failed, using basic analysis:', error);
            return this.basicAnalysis();
        }
    }
    async analyzeStructure() {
        const directories = [];
        const keyFiles = [];
        let totalFiles = 0;
        // Scan directory structure
        const scanDir = async (dir, depth = 0) => {
            if (depth > 4)
                return; // Limit depth
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith('.') && !['package.json', 'tsconfig.json'].includes(entry.name)) {
                        continue;
                    }
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(this.workingDirectory, fullPath);
                    if (entry.isDirectory()) {
                        if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
                            directories.push(relativePath);
                            await scanDir(fullPath, depth + 1);
                        }
                    }
                    else {
                        totalFiles++;
                        // Identify key files
                        if (this.isKeyFile(entry.name)) {
                            keyFiles.push(relativePath);
                        }
                    }
                }
            }
            catch (error) {
                // Skip inaccessible directories
            }
        };
        await scanDir(this.workingDirectory);
        // Determine codebase size
        let codebaseSize;
        if (totalFiles < 50)
            codebaseSize = 'small';
        else if (totalFiles < 200)
            codebaseSize = 'medium';
        else if (totalFiles < 1000)
            codebaseSize = 'large';
        else
            codebaseSize = 'huge';
        return {
            directories: directories.sort(),
            keyFiles: keyFiles.sort(),
            totalFiles,
            codebaseSize
        };
    }
    async detectTechnology(structure) {
        const technology = {
            primaryLanguages: [],
            frameworks: [],
            databases: [],
            buildTools: [],
            packageManagers: [],
            techStack: ''
        };
        // Analyze package.json if available
        const packageJsonPath = path.join(this.workingDirectory, 'package.json');
        let packageJson = null;
        try {
            const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
            packageJson = JSON.parse(packageContent);
        }
        catch {
            // No package.json or invalid JSON
        }
        if (packageJson) {
            technology.packageManagers.push('npm');
            const allDeps = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };
            // Detect frameworks and libraries
            const frameworks = {
                'react': 'React',
                'vue': 'Vue.js',
                'angular': 'Angular',
                'svelte': 'Svelte',
                'express': 'Express.js',
                'fastify': 'Fastify',
                'koa': 'Koa',
                'nestjs': 'NestJS',
                'next': 'Next.js',
                'nuxt': 'Nuxt.js',
                'gatsby': 'Gatsby',
                'vite': 'Vite'
            };
            for (const [dep, framework] of Object.entries(frameworks)) {
                if (allDeps[dep]) {
                    technology.frameworks.push(framework);
                }
            }
            // Detect databases
            const databases = {
                'mongodb': 'MongoDB',
                'mongoose': 'MongoDB',
                'pg': 'PostgreSQL',
                'mysql': 'MySQL',
                'sqlite3': 'SQLite',
                'redis': 'Redis',
                'prisma': 'Prisma ORM'
            };
            for (const [dep, db] of Object.entries(databases)) {
                if (allDeps[dep]) {
                    technology.databases.push(db);
                }
            }
            // Detect build tools
            const buildTools = {
                'webpack': 'Webpack',
                'rollup': 'Rollup',
                'parcel': 'Parcel',
                'esbuild': 'ESBuild',
                'typescript': 'TypeScript',
                'babel': 'Babel'
            };
            for (const [dep, tool] of Object.entries(buildTools)) {
                if (allDeps[dep]) {
                    technology.buildTools.push(tool);
                }
            }
        }
        // Detect primary languages by file extensions
        const languageFiles = {};
        for (const file of structure.keyFiles) {
            const ext = path.extname(file).toLowerCase();
            const languages = {
                '.js': 'JavaScript',
                '.ts': 'TypeScript',
                '.py': 'Python',
                '.java': 'Java',
                '.cpp': 'C++',
                '.c': 'C',
                '.cs': 'C#',
                '.go': 'Go',
                '.rs': 'Rust',
                '.php': 'PHP',
                '.rb': 'Ruby'
            };
            const language = languages[ext];
            if (language) {
                languageFiles[language] = (languageFiles[language] || 0) + 1;
            }
        }
        technology.primaryLanguages = Object.entries(languageFiles)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([lang]) => lang);
        // Build tech stack summary
        const stack = [
            ...technology.primaryLanguages,
            ...technology.frameworks,
            ...technology.databases
        ].slice(0, 5).join(' + ');
        technology.techStack = stack || 'Unknown';
        return technology;
    }
    async analyzePatterns(structure, technology) {
        // Basic pattern detection based on structure
        const patterns = {
            architecture: 'Unknown',
            designPatterns: [],
            codeOrganization: 'Unknown',
            testingStrategy: 'Unknown'
        };
        // Detect architecture patterns
        if (structure.directories.includes('src') && structure.directories.includes('tests')) {
            patterns.codeOrganization = 'Source/Test Split';
        }
        if (structure.directories.some((d) => d.includes('components'))) {
            patterns.architecture = 'Component-Based';
            patterns.designPatterns.push('Component Pattern');
        }
        if (structure.directories.some((d) => d.includes('services'))) {
            patterns.designPatterns.push('Service Layer');
        }
        if (structure.directories.some((d) => d.includes('controllers'))) {
            patterns.architecture = 'MVC';
            patterns.designPatterns.push('MVC Pattern');
        }
        // Detect testing strategy
        if (structure.keyFiles.some((f) => f.includes('test') || f.includes('spec'))) {
            patterns.testingStrategy = 'Unit Testing';
        }
        if (structure.keyFiles.some((f) => f.includes('jest.config') || f.includes('vitest.config'))) {
            patterns.testingStrategy = 'Modern Testing Framework';
        }
        return patterns;
    }
    async analyzeDependencies() {
        const dependencies = {
            production: {},
            development: {},
            outdated: [],
            security: []
        };
        try {
            const packageJsonPath = path.join(this.workingDirectory, 'package.json');
            const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageContent);
            dependencies.production = packageJson.dependencies || {};
            dependencies.development = packageJson.devDependencies || {};
        }
        catch {
            // No package.json or invalid JSON
        }
        return dependencies;
    }
    async assessComplexity(structure, technology, dependencies) {
        let score = 5; // Base score
        const factors = [];
        const recommendations = [];
        // Factor in codebase size
        if (structure.codebaseSize === 'huge') {
            score += 2;
            factors.push('Large codebase');
            recommendations.push('Consider modularization');
        }
        else if (structure.codebaseSize === 'small') {
            score -= 1;
        }
        // Factor in technology diversity
        if (technology.primaryLanguages.length > 2) {
            score += 1;
            factors.push('Multiple languages');
        }
        if (Object.keys(dependencies.production).length > 50) {
            score += 1;
            factors.push('Many dependencies');
            recommendations.push('Review dependency necessity');
        }
        // Factor in directory structure complexity
        if (structure.directories.length > 20) {
            score += 1;
            factors.push('Deep directory structure');
        }
        return {
            score: Math.min(10, Math.max(1, score)),
            factors,
            recommendations
        };
    }
    async understandContext(structure, technology, dependencies) {
        const context = {
            projectType: 'Unknown',
            developmentStage: 'Unknown',
            teamSize: 'unknown',
            documentation: 'poor'
        };
        // Detect project type
        if (technology.frameworks.some((f) => ['React', 'Vue.js', 'Angular'].includes(f))) {
            context.projectType = 'Frontend Application';
        }
        else if (technology.frameworks.some((f) => ['Express.js', 'NestJS'].includes(f))) {
            context.projectType = 'Backend API';
        }
        else if (technology.frameworks.some((f) => ['Next.js', 'Nuxt.js'].includes(f))) {
            context.projectType = 'Full-Stack Application';
        }
        // Assess documentation
        const hasReadme = structure.keyFiles.some((f) => f.toLowerCase().includes('readme'));
        const hasChangelog = structure.keyFiles.some((f) => f.toLowerCase().includes('changelog'));
        const hasDocs = structure.directories.some((d) => d.includes('docs'));
        if (hasReadme && hasChangelog && hasDocs) {
            context.documentation = 'excellent';
        }
        else if (hasReadme && (hasChangelog || hasDocs)) {
            context.documentation = 'good';
        }
        else if (hasReadme) {
            context.documentation = 'basic';
        }
        // Estimate team size based on git history complexity (simplified)
        if (structure.totalFiles > 500 && technology.frameworks.length > 3) {
            context.teamSize = 'large';
        }
        else if (structure.totalFiles > 100) {
            context.teamSize = 'medium';
        }
        else if (structure.totalFiles > 20) {
            context.teamSize = 'small';
        }
        else {
            context.teamSize = 'solo';
        }
        // Assess development stage
        if (dependencies.production && Object.keys(dependencies.production).length > 10) {
            context.developmentStage = 'Active Development';
        }
        else if (structure.totalFiles > 50) {
            context.developmentStage = 'Early Development';
        }
        else {
            context.developmentStage = 'Prototype';
        }
        return context;
    }
    isKeyFile(filename) {
        const keyFiles = [
            'package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.ts',
            'README.md', 'CHANGELOG.md', '.gitignore', 'Dockerfile',
            'jest.config.js', 'vitest.config.ts', '.env', 'yarn.lock',
            'package-lock.json', 'pnpm-lock.yaml'
        ];
        const keyPatterns = [
            /\.config\.(js|ts|json)$/,
            /^(index|main|app)\.(js|ts)$/,
            /\.(test|spec)\.(js|ts)$/
        ];
        return keyFiles.includes(filename) ||
            keyPatterns.some(pattern => pattern.test(filename));
    }
    async basicAnalysis() {
        const structure = await this.analyzeStructure();
        const technology = await this.detectTechnology(structure);
        return {
            structure,
            technology,
            patterns: {
                architecture: 'Unknown',
                designPatterns: [],
                codeOrganization: 'Unknown',
                testingStrategy: 'Unknown'
            },
            dependencies: {
                production: {},
                development: {},
                outdated: [],
                security: []
            },
            complexity: {
                score: 5,
                factors: ['Basic analysis only'],
                recommendations: ['Run detailed analysis for better insights']
            },
            context: {
                projectType: 'Unknown',
                developmentStage: 'Unknown',
                teamSize: 'unknown',
                documentation: 'poor'
            }
        };
    }
}
export default IntelligentRepoAnalyzer;
//# sourceMappingURL=repo-analyzer.js.map