const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Frame data for the dog design extraction
const frames = [
  { id: '1171279015', name: 'Frame-1171279015' }
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
    
    const designDir = './design/dog-frames';
    
    // Ensure directory exists
    if (!fs.existsSync(designDir)) {
      fs.mkdirSync(designDir, { recursive: true });
    }

    for (const frame of frames) {
      try {
        console.log(`\nProcessing frame: ${frame.name}...`);
        
        // Get image URL
        const response = await this.client.get(`/images/${this.fileKey}`, {
          params: {
            ids: frame.id,
            format: 'png',
            scale: 2 // 2x for retina displays
          }
        });

        if (response.data.images[frame.id]) {
          const imageUrl = response.data.images[frame.id];
          await this.downloadImage(imageUrl, `${frame.name}.png`, designDir);
          console.log(`✅ Downloaded: ${frame.name}.png`);
        } else {
          console.log(`❌ No image URL for: ${frame.name}`);
        }
      } catch (error) {
        console.error(`❌ Error processing frame: ${error.message}`);
      }
    }
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

  async extractComponents() {
    console.log('\n🔧 Extracting components from Frame 1171279015...');
    
    try {
      // Get the specific frame node with depth
      const frameResponse = await this.client.get(`/files/${this.fileKey}/nodes`, {
        params: {
          ids: '1171279015',
          depth: 10 // Increased depth to get all nested components
        }
      });

      console.log('\n📊 Analyzing frame structure...');
      
      const frameNode = frameResponse.data.nodes['1171279015'];
      if (frameNode && frameNode.document) {
        // Find all components in this frame
        const components = this.findComponents(frameNode.document);
        
        console.log(`\n📊 Found ${components.length} components`);
        
        // Extract design tokens
        const designTokens = {
          colors: {},
          typography: {},
          spacing: {},
          shadows: {}
        };
        
        this.extractDesignTokens(frameNode.document, designTokens);
        
        // Save extracted data
        const mappingDir = './design/dog-mapping';
        if (!fs.existsSync(mappingDir)) {
          fs.mkdirSync(mappingDir, { recursive: true });
        }
        
        // Save component catalog
        fs.writeFileSync(
          path.join(mappingDir, 'components.json'),
          JSON.stringify({
            extractedAt: new Date().toISOString(),
            fileKey: this.fileKey,
            frameId: '1171279015',
            totalComponents: components.length,
            components: components,
            frameStructure: frameNode.document
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
        
        console.log('\n✅ Saved component catalog to design/dog-mapping/components.json');
        console.log('✅ Saved design tokens to design/dog-mapping/design-tokens.json');
        
        // Export component images if they exist
        if (components.length > 0) {
          console.log('\n📸 Exporting component images...');
          await this.exportComponentImages(components);
        }
      }
    } catch (error) {
      console.error(`❌ Error extracting components: ${error.message}`);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
    }
  }

  async exportComponentImages(components) {
    const componentDir = './design/dog-components';
    if (!fs.existsSync(componentDir)) {
      fs.mkdirSync(componentDir, { recursive: true });
    }

    // Process in batches
    const batchSize = 5;
    for (let i = 0; i < components.length; i += batchSize) {
      const batch = components.slice(i, i + batchSize);
      const nodeIds = batch.map(c => c.id).join(',');
      
      try {
        const response = await this.client.get(`/images/${this.fileKey}`, {
          params: {
            ids: nodeIds,
            format: 'png',
            scale: 2
          }
        });

        for (const component of batch) {
          if (response.data.images[component.id]) {
            const imageUrl = response.data.images[component.id];
            const safeName = component.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            await this.downloadImage(imageUrl, `${safeName}.png`, componentDir);
            console.log(`✅ Exported: ${safeName}.png`);
          }
        }

        // Rate limiting
        if (i + batchSize < components.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Error exporting batch: ${error.message}`);
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
        componentId: node.componentId || null
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
          tokens.colors[colorKey] = {
            ...fill.color,
            hex: colorKey,
            usage: node.name
          };
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
          tokens.shadows[`shadow-${Object.keys(tokens.shadows).length}`] = {
            offset: effect.offset,
            radius: effect.radius,
            color: effect.color,
            blur: effect.blur || 0
          };
        }
      });
    }
    
    // Recursively process children
    if (node.children) {
      node.children.forEach(child => this.extractDesignTokens(child, tokens));
    }
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
    console.error('   You can get a token from: https://www.figma.com/developers/api#access-tokens');
    process.exit(1);
  }

  const extractor = new FigmaAssetExtractor(token, fileKey);
  
  try {
    console.log('🚀 Starting extraction for Frame 1171279015...\n');
    await extractor.extractFrameImages();
    await extractor.extractComponents();
    console.log('\n🎉 Extraction complete!');
    console.log('\n📁 Output directories:');
    console.log('   - design/dog-frames/ (frame images)');
    console.log('   - design/dog-components/ (component images)');
    console.log('   - design/dog-mapping/ (JSON data)');
  } catch (error) {
    console.error(`\n❌ Extraction failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}