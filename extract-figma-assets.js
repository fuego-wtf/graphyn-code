const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Frame data from the prototype analysis
const frames = [
  { id: '1568:55865', name: '01-landing-page-unauthenticated' },
  { id: '1614:84180', name: '02-state-placeholder-on' },
  { id: '1568:57961', name: '03-sign-up' },
  { id: '1451:24650', name: '04-state-switch-mode' },
  { id: '1451:26289', name: '05-state-open-commands' },
  { id: '1614:81315', name: '06-state-active' },
  { id: '1614:84226', name: '07-state-placeholder-off' },
  { id: '1315:65341', name: '08-state-typing' },
  { id: '1614:103422', name: '09-type-default-focused' },
  { id: '1568:102242', name: '10-sign-up-filled-input' },
  { id: '1935:249117', name: '11-state-state14' },
  { id: '1568:99043', name: '12-state-add-learning' },
  { id: '1614:85135', name: '13-property-hover' },
  { id: '1451:36583', name: '14-state-added-commands' },
  { id: '1568:102993', name: '15-sign-up-loading' },
  { id: '1935:250093', name: '16-state-state15' },
  { id: '1614:92515', name: '17-property-selected' },
  { id: '2113:58616', name: '18-sign-up-loading-alt' },
  { id: '1624:70913', name: '19-state-done' },
  { id: '1624:68787', name: '20-frame-2' },
  { id: '1627:68293', name: '21-property-compute-2' },
  { id: '1614:90883', name: '22-state-test-mode' },
  { id: '1964:283379', name: '23-thread-view-first-time' },
  { id: '1624:68791', name: '24-frame-3' },
  { id: '1627:68294', name: '25-property-compute-3' },
  { id: '1964:301696', name: '26-thread-view-first-time-sidebar-collapse' },
  { id: '1964:302174', name: '27-thread-view-filled' },
  { id: '1624:68795', name: '28-frame-4' },
  { id: '1964:288080', name: '29-property-collapse-hover' },
  { id: '2066:70465', name: '30-whatsapp-style-testing' },
  { id: '2048:59806', name: '31-thread-view-create-agent-preview' },
  { id: '1624:68799', name: '32-frame-5' },
  { id: '2072:45503', name: '33-thread-view-create-agent-preview-2' },
  { id: '2072:47390', name: '34-thread-view-create-agent-deployed' }
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
    
    const designDir = '/Users/resatugurulu/Developer/graphyn-monorepo/frontend/design/frames';
    
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
    const indexPath = '/Users/resatugurulu/Developer/graphyn-monorepo/frontend/design/mapping/frame-index.json';
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
    
    // Get file data to find components
    try {
      const response = await this.client.get(`/files/${this.fileKey}`, {
        params: {
          depth: 2
        }
      });

      const components = this.findComponents(response.data.document);
      console.log(`Found ${components.length} components`);

      // Save component list
      const componentPath = '/Users/resatugurulu/Developer/graphyn-monorepo/frontend/design/mapping/components.json';
      fs.writeFileSync(componentPath, JSON.stringify(components, null, 2));
      
      console.log('✅ Saved component list to design/mapping/components.json');
    } catch (error) {
      console.error(`❌ Error extracting components: ${error.message}`);
    }
  }

  findComponents(node, components = []) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      components.push({
        id: node.id,
        name: node.name,
        type: node.type,
        description: node.description || ''
      });
    }

    if (node.children) {
      for (const child of node.children) {
        this.findComponents(child, components);
      }
    }

    return components;
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