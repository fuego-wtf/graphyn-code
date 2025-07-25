const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Frame data from the prototype analysis
const frames = [
  { id: '2563:102223', name: 'Terminal-First-time' }
];

class FigmaAssetExtractor {
  constructor(token, fileKey) {
    this.token = token;
    this.fileKey = fileKey;
    this.client = axios.create({
      baseURL: 'https://api.figma.com/v1',
      headers: {
        'X-Figma-Token': token
      }
    });
  }

  async extractFrameImages() {
    console.log('🎨 Starting frame image extraction...');
    
    const designDir = './design/frames';
    
    // Ensure directory exists
    if (!fs.existsSync(designDir)) {
      fs.mkdirSync(designDir, { recursive: true });
    }

    // Process frames in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < frames.length; i += batchSize) {
      const batch = frames.slice(i, i + batchSize);
      
      console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(frames.length / batchSize)}...`);
      
      // Get image URLs for this batch
      const nodeIds = batch.map(f => f.id).join(',');
      
      try {
        const response = await this.client.get(`/images/${this.fileKey}`, {
          params: {
            ids: nodeIds,
            format: 'png',
            scale: 2 // 2x for retina displays
          }
        });

        // Download each image
        for (const frame of batch) {
          if (response.data.images[frame.id]) {
            const imageUrl = response.data.images[frame.id];
            await this.downloadImage(imageUrl, `${frame.name}.png`, designDir);
            console.log(`✅ Downloaded: ${frame.name}.png`);
          } else {
            console.log(`❌ No image URL for: ${frame.name}`);
          }
        }

        // Add delay between batches
        if (i + batchSize < frames.length) {
          console.log('Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Error processing batch: ${error.message}`);
      }
    }

    // Create frame index
    await this.createFrameIndex();
  }

  async downloadImage(url, filename, directory) {
    const filePath = path.join(directory, filename);
    
    try {
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to download ${filename}: ${error.message}`);
    }
  }

  async createFrameIndex() {
    const indexPath = './design/mapping/frame-index.json';
    const mappingDir = path.dirname(indexPath);
    
    if (!fs.existsSync(mappingDir)) {
      fs.mkdirSync(mappingDir, { recursive: true });
    }

    const index = frames.map(frame => ({
      id: frame.id,
      name: frame.name,
      filename: `${frame.name}.png`,
      type: 'frame'
    }));

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    console.log('\n✅ Created frame index at design/mapping/frame-index.json');
  }

  async extractComponents() {
    console.log('\n🔧 Starting component extraction...');
    
    // Get specific frame data to find components
    try {
      // First, get the specific frame node
      const frameResponse = await this.client.get(`/files/${this.fileKey}/nodes`, {
        params: {
          ids: frames.map(f => f.id).join(','),
          depth: 3
        }
      });

      console.log('\n📊 Analyzing frame structure...');
      
      const allComponents = [];
      const designTokens = {
        colors: {},
        typography: {},
        spacing: {},
        shadows: {}
      };
      
      // Process each frame
      for (const frame of frames) {
        const frameNode = frameResponse.data.nodes[frame.id];
        if (frameNode && frameNode.document) {
          console.log(`\nProcessing frame: ${frame.name}`);
          
          // Find components in this frame
          const frameComponents = this.findComponents(frameNode.document);
          allComponents.push(...frameComponents);
          
          // Extract design tokens from frame
          this.extractDesignTokens(frameNode.document, designTokens);
        }
      }
      
      // Also get file-level components
      console.log('\n🔍 Fetching file-level components...');
      const fileResponse = await this.client.get(`/files/${this.fileKey}`, {
        params: {
          depth: 1
        }
      });
      
      // Get component metadata
      const componentSets = {};
      const componentMap = {
        atomic: [],
        molecules: [],
        organisms: [],
        templates: []
      };
      
      // Categorize components
      allComponents.forEach(comp => {
        const category = this.categorizeComponent(comp);
        componentMap[category].push(comp);
        
        // Group by component set
        if (comp.name.includes('/')) {
          const [setName] = comp.name.split('/');
          if (!componentSets[setName]) {
            componentSets[setName] = [];
          }
          componentSets[setName].push(comp);
        }
      });
      
      console.log(`\n📊 Component Analysis:`);
      console.log(`- Atomic: ${componentMap.atomic.length}`);
      console.log(`- Molecules: ${componentMap.molecules.length}`);
      console.log(`- Organisms: ${componentMap.organisms.length}`);
      console.log(`- Templates: ${componentMap.templates.length}`);
      console.log(`- Total: ${allComponents.length}`);
      
      // Save all extracted data
      const mappingDir = './design/mapping';
      if (!fs.existsSync(mappingDir)) {
        fs.mkdirSync(mappingDir, { recursive: true });
      }
      
      // Save component catalog
      fs.writeFileSync(
        path.join(mappingDir, 'components.json'),
        JSON.stringify({
          extractedAt: new Date().toISOString(),
          fileKey: this.fileKey,
          frameIds: frames.map(f => f.id),
          totalComponents: allComponents.length,
          components: componentMap,
          componentSets: componentSets,
          allComponents: allComponents
        }, null, 2)
      );
      
      // Save design tokens
      fs.writeFileSync(
        path.join(mappingDir, 'design-tokens.json'),
        JSON.stringify({
          extractedAt: new Date().toISOString(),
          tokens: designTokens
        }, null, 2)
      );
      
      console.log('\n✅ Saved component catalog to design/mapping/components.json');
      console.log('✅ Saved design tokens to design/mapping/design-tokens.json');
      
    } catch (error) {
      console.error(`❌ Error extracting components: ${error.message}`);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  }

  findComponents(node, components = [], path = '') {
    const nodePath = path ? `${path}/${node.name}` : node.name;
    
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || node.type === 'INSTANCE') {
      const component = {
        id: node.id,
        name: node.name,
        type: node.type,
        path: nodePath,
        description: node.description || '',
        visible: node.visible !== false,
        absoluteBoundingBox: node.absoluteBoundingBox,
        constraints: node.constraints,
        componentId: node.componentId || null,
        mainComponent: node.mainComponent || null
      };
      
      // Extract additional properties
      if (node.fills) component.fills = node.fills;
      if (node.strokes) component.strokes = node.strokes;
      if (node.effects) component.effects = node.effects;
      if (node.layoutMode) component.layoutMode = node.layoutMode;
      
      components.push(component);
    }

    if (node.children) {
      for (const child of node.children) {
        this.findComponents(child, components, nodePath);
      }
    }

    return components;
  }
  
  extractDesignTokens(node, tokens) {
    // Extract colors from fills
    if (node.fills && Array.isArray(node.fills)) {
      node.fills.forEach(fill => {
        if (fill.type === 'SOLID' && fill.color) {
          const colorKey = this.rgbToHex(fill.color);
          tokens.colors[colorKey] = fill.color;
        }
      });
    }
    
    // Extract text styles
    if (node.type === 'TEXT' && node.style) {
      const styleKey = `${node.style.fontSize || 16}px-${node.style.fontWeight || 400}`;
      tokens.typography[styleKey] = {
        fontFamily: node.style.fontFamily || 'Inter',
        fontSize: node.style.fontSize || 16,
        fontWeight: node.style.fontWeight || 400,
        lineHeight: node.style.lineHeightPx || node.style.fontSize * 1.5,
        letterSpacing: node.style.letterSpacing || 0
      };
    }
    
    // Extract effects (shadows)
    if (node.effects && Array.isArray(node.effects)) {
      node.effects.forEach((effect, index) => {
        if (effect.type === 'DROP_SHADOW' && effect.visible !== false) {
          tokens.shadows[`shadow-${index}`] = {
            offset: effect.offset,
            radius: effect.radius,
            color: effect.color
          };
        }
      });
    }
    
    // Recursively process children
    if (node.children) {
      node.children.forEach(child => this.extractDesignTokens(child, tokens));
    }
  }
  
  categorizeComponent(component) {
    const name = component.name.toLowerCase();
    
    // Atomic components
    if (name.includes('button') || name.includes('input') || 
        name.includes('icon') || name.includes('toggle') ||
        name.includes('checkbox') || name.includes('radio')) {
      return 'atomic';
    }
    
    // Templates
    if (name.includes('page') || name.includes('screen') || 
        name.includes('layout') || name.includes('template')) {
      return 'templates';
    }
    
    // Organisms
    if (name.includes('header') || name.includes('footer') || 
        name.includes('nav') || name.includes('sidebar') ||
        name.includes('modal') || name.includes('dialog')) {
      return 'organisms';
    }
    
    // Default to molecules
    return 'molecules';
  }
  
  rgbToHex(color) {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  }
}

// Main execution
async function main() {
  const token = process.env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_PERSONAL_TOKEN;
  const fileKey = 'krhXq0l0ktpeunUgWWXqHj'; // From the URL

  if (!token) {
    console.error('❌ No Figma token found. Set FIGMA_ACCESS_TOKEN or FIGMA_PERSONAL_TOKEN');
    process.exit(1);
  }

  const extractor = new FigmaAssetExtractor(token, fileKey);
  
  try {
    await extractor.extractFrameImages();
    await extractor.extractComponents();
    console.log('\n🎉 Asset extraction complete!');
  } catch (error) {
    console.error(`\n❌ Extraction failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}