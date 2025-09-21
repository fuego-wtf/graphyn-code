/**
 * Figma MCP Integration Example
 * 
 * Demonstrates how to use MCP tools to analyze Figma prototypes
 * and extract design information for implementation using the provided prototype URL
 */

import { FigmaPrototypeAnalyzer } from '@graphyn/agents/analyzers/FigmaPrototypeAnalyzer.js';
import { promises as fs } from 'fs';
import path from 'path';

async function analyzeFigmaPrototype() {
  console.log('🎨 Starting Figma Prototype Analysis');
  console.log('📋 Using provided prototype URL from Graphyn Delivery design');
  
  const prototypeUrl = 'https://www.figma.com/proto/krhXq0l0ktpeunUgWWXqHj/Graphyn---Delivery?node-id=2490-105142&t=odveUSdyNnntFjD6-1';
  const outputDir = './.temp';
  
  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Initialize Figma prototype analyzer
    const analyzer = new FigmaPrototypeAnalyzer({
      prototypeUrl,
      nodeId: '2490:105142', // Extracted from URL
      clientFrameworks: 'react',
      clientLanguages: 'typescript',
      outputDir,
      extractComponents: true,
      extractVariables: true,
      extractScreenshots: true,
      generateCode: true
    });

    console.log('🔍 Analyzing Figma prototype...');
    const analysisResult = await analyzer.analyze();

    if (analysisResult.success) {
      console.log('✅ Figma prototype analysis completed successfully!');
      console.log(`📊 Extracted:`);
      console.log(`   • ${analysisResult.designTokens.length} design tokens`);
      console.log(`   • ${analysisResult.components.length} components`);
      console.log(`   • ${Object.keys(analysisResult.screenshots).length} screenshots`);
      console.log(`   • ${Object.keys(analysisResult.generatedCode).length} code files`);
      
      // Generate implementation report
      console.log('📝 Generating implementation report...');
      const report = await analyzer.generateImplementationReport(analysisResult);
      
      // Save report to file
      const reportPath = path.join(outputDir, 'figma-analysis-report.md');
      await fs.writeFile(reportPath, report, 'utf8');
      console.log(`📄 Implementation report saved: ${reportPath}`);
      
      // Save analysis data as JSON
      const dataPath = path.join(outputDir, 'figma-analysis-data.json');
      await fs.writeFile(dataPath, JSON.stringify(analysisResult, null, 2), 'utf8');
      console.log(`💾 Analysis data saved: ${dataPath}`);
      
      // Display summary
      console.log('\n🎯 Analysis Summary:');
      if (analysisResult.designTokens.length > 0) {
        console.log('🎨 Design Tokens:');
        analysisResult.designTokens.slice(0, 5).forEach(token => {
          console.log(`   • ${token.name} (${token.type}): ${token.value}`);
        });
        if (analysisResult.designTokens.length > 5) {
          console.log(`   • ... and ${analysisResult.designTokens.length - 5} more`);
        }
      }
      
      if (analysisResult.components.length > 0) {
        console.log('🧩 Components:');
        analysisResult.components.forEach(component => {
          console.log(`   • ${component.name} (${component.type})`);
        });
      }
      
    } else {
      console.error('❌ Figma prototype analysis failed:', analysisResult.error);
      throw new Error(analysisResult.error);
    }
    
  } catch (error) {
    console.error('❌ Figma analysis failed:', error);
    
    // Check if it's an MCP connection issue
    if (error instanceof Error && error.message.includes('MCP')) {
      console.log('\n💡 MCP Server Setup Help:');
      console.log('   Make sure you have the Figma MCP server running.');
      console.log('   Set environment variables:');
      console.log('   • FIGMA_MCP_SERVER_COMMAND=<path-to-figma-mcp-server>');
      console.log('   • FIGMA_MCP_SERVER_ARGS=<server-arguments>');
      console.log('   \n   Or run without MCP server for simulation mode.');
    }
    
    throw error;
  }
}

// Export for CLI usage
export { analyzeFigmaPrototype };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeFigmaPrototype().catch(console.error);
}