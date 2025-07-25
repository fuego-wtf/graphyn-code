#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const figmaUrl = args[0];
const frameSpecifier = args.find(arg => arg.startsWith('--frame='))?.split('=')[1];

if (!figmaUrl || !figmaUrl.includes('figma.com')) {
  console.error('Usage: node extract-frame-components.js <figma-url> [--frame="Frame Name"]');
  process.exit(1);
}

// Extract file key and node ID from URL
const urlMatch = figmaUrl.match(/figma\.com\/(?:file|design)\/([^/]+)\/[^?]*(?:\?node-id=([^&]+))?/);
if (!urlMatch) {
  console.error('Invalid Figma URL format');
  process.exit(1);
}

const fileKey = urlMatch[1];
const nodeId = urlMatch[2]?.replace(/-/g, ':'); // Convert URL format to API format

console.log('🎨 Figma Component Extraction');
console.log('━'.repeat(50));
console.log(`File Key: ${fileKey}`);
console.log(`Node ID: ${nodeId || 'Not specified'}`);
console.log(`Frame: ${frameSpecifier || 'Not specified'}`);
console.log('━'.repeat(50));

// Create design directory structure
const designDir = path.join(process.cwd(), 'design');
const dirs = ['frames', 'components', 'icons', 'assets', 'mapping'];

dirs.forEach(dir => {
  const dirPath = path.join(designDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Create extraction context for Claude
const extractionContext = `# Figma Component Extraction Task

## Target Information
- **Figma URL**: ${figmaUrl}
- **File Key**: ${fileKey}
${nodeId ? `- **Node ID**: ${nodeId}` : ''}
${frameSpecifier ? `- **Target Frame**: ${frameSpecifier}` : ''}

## Extraction Requirements

### 1. Use Figma MCP Tools to Extract:
- Component definitions from the specified frame
- Design tokens (colors, typography, spacing)
- Component hierarchy and relationships
- Frame structure and layout

### 2. Organize Extracted Data:
\`\`\`
/design/
├── mapping/
│   ├── components.json      # Component catalog
│   ├── design-tokens.json   # Design system tokens
│   ├── frame-structure.json # Frame hierarchy
│   └── component-usage.json # Usage patterns
├── components/             # Component images (if needed)
├── frames/                # Frame screenshots
└── assets/                # Other design assets
\`\`\`

### 3. MCP Tool Commands to Use:

\`\`\`typescript
// Get the specific frame/node data
await mcp__figma-mcp-server__figma_get_file_nodes({
  fileKey: "${fileKey}",
  ids: "${nodeId || ''}",
  depth: 3
});

// Get file components
await mcp__figma-mcp-server__figma_get_file_components({
  fileKey: "${fileKey}"
});

// Get design styles
await mcp__figma-mcp-server__figma_get_file_styles({
  fileKey: "${fileKey}"
});

// Get images for visual reference
await mcp__figma-mcp-server__figma_get_images({
  fileKey: "${fileKey}",
  ids: "${nodeId || ''}",
  format: "png",
  scale: 2
});
\`\`\`

### 4. Process and Save Results:

1. **Extract Component Definitions**:
   - Identify all components in the frame
   - Categorize by type (atomic, molecular, organism)
   - Note component variants and states
   - Track component usage patterns

2. **Extract Design Tokens**:
   - Colors (primary, secondary, semantic)
   - Typography (font families, sizes, weights)
   - Spacing system
   - Border radius values
   - Shadow definitions

3. **Generate Component Map**:
   - Component hierarchy
   - Parent-child relationships
   - Shared vs unique components
   - Component properties and variants

4. **Save to JSON Files**:
   - \`/design/mapping/components.json\` - Complete component catalog
   - \`/design/mapping/design-tokens.json\` - Design system tokens
   - \`/design/mapping/frame-structure.json\` - Frame hierarchy
   - \`/design/mapping/component-usage.json\` - Usage analysis

### 5. Expected Output Structure:

\`\`\`json
// components.json
{
  "extractedAt": "2025-01-24T...",
  "fileKey": "${fileKey}",
  "frameName": "${frameSpecifier || 'Unknown'}",
  "components": {
    "atomic": [
      {
        "id": "component-id",
        "name": "Button/Primary",
        "type": "COMPONENT",
        "category": "atomic",
        "instances": 5,
        "properties": {...}
      }
    ],
    "molecules": [...],
    "organisms": [...],
    "templates": [...]
  },
  "componentSets": {
    "Button": ["Primary", "Secondary", "Tertiary"],
    "Input": ["Default", "Error", "Disabled"]
  }
}

// design-tokens.json
{
  "colors": {
    "primary": { "500": "#3B82F6", "600": "#2563EB" },
    "gray": { "100": "#F3F4F6", "900": "#111827" }
  },
  "typography": {
    "heading1": { "fontSize": 32, "fontWeight": 700 },
    "body": { "fontSize": 16, "fontWeight": 400 }
  },
  "spacing": {
    "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32
  }
}
\`\`\`

## Execution Steps:

1. First, use the MCP tools to fetch the frame/node data
2. Analyze the response to identify all components
3. Extract design tokens from the styles and properties
4. Generate the component hierarchy and relationships
5. Save all data to the appropriate JSON files
6. Create a summary report of what was extracted

Please proceed with the extraction using the Figma MCP tools.`;

// Launch Claude with the extraction context
console.log('\n🚀 Launching Claude Code with extraction context...\n');

const claudeProcess = spawn('claude', [extractionContext], {
  stdio: 'inherit',
  shell: true
});

claudeProcess.on('error', (error) => {
  console.error('❌ Failed to launch Claude:', error.message);
  console.log('\n💡 Make sure Claude Code is installed and available in PATH');
  process.exit(1);
});

claudeProcess.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ Component extraction completed!');
    console.log('📁 Check /design/mapping/ for extracted data');
  } else {
    console.log(`\n⚠️  Claude exited with code ${code}`);
  }
});