#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { glob } = require('glob');

async function fixAgentFiles() {
  console.log('🔍 Finding agent files...');
  
  // Find all agent files
  const agentFiles = await glob('/Users/resatugurulu/Developer/graphyn-workspace/**/.claude/agents/*.md');
  console.log(`Found ${agentFiles.length} agent files`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const filePath of agentFiles) {
    try {
      console.log(`\n📝 Processing: ${path.basename(filePath)}`);
      
      // Read the file
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Try to parse it
      let parsed;
      try {
        parsed = matter(content);
      } catch (parseError) {
        console.log(`❌ YAML parsing error: ${parseError.message}`);
        
        // Try to fix by cleaning the description field
        const lines = content.split('\n');
        let inFrontmatter = false;
        let frontmatterEnd = 0;
        let descriptionStart = -1;
        let descriptionEnd = -1;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (line === '---') {
            if (!inFrontmatter) {
              inFrontmatter = true;
            } else {
              frontmatterEnd = i;
              break;
            }
            continue;
          }
          
          if (inFrontmatter && line.startsWith('description:')) {
            descriptionStart = i;
            
            // Find the end of the description (next YAML field or end of frontmatter)
            for (let j = i + 1; j < frontmatterEnd; j++) {
              if (lines[j].match(/^[a-zA-Z_][a-zA-Z0-9_]*:\s/)) {
                descriptionEnd = j - 1;
                break;
              }
            }
            if (descriptionEnd === -1) {
              descriptionEnd = frontmatterEnd - 1;
            }
            break;
          }
        }
        
        if (descriptionStart >= 0 && descriptionEnd >= 0) {
          // Extract the description text (everything after 'description:')
          let fullDescription = '';
          for (let i = descriptionStart; i <= descriptionEnd; i++) {
            if (i === descriptionStart) {
              // Remove 'description:' prefix
              fullDescription += lines[i].replace(/^description:\s*/, '');
            } else {
              fullDescription += lines[i];
            }
            if (i < descriptionEnd) fullDescription += '\n';
          }
          
          // Clean the description: remove Examples section and HTML-like tags
          let cleanDescription = fullDescription
            .replace(/\\n/g, '\n')  // Convert literal \n to newlines
            .replace(/Examples:[\s\S]*$/m, '')  // Remove everything from "Examples:" onwards
            .replace(/<example>[\s\S]*?<\/example>/g, '')  // Remove example blocks
            .replace(/<commentary>[\s\S]*?<\/commentary>/g, '')  // Remove commentary blocks
            .trim();
          
          // If description is too long, truncate at sentence boundary
          if (cleanDescription.length > 500) {
            const cutoff = cleanDescription.lastIndexOf('.', 500);
            if (cutoff > 300) {
              cleanDescription = cleanDescription.substring(0, cutoff + 1);
            } else {
              cleanDescription = cleanDescription.substring(0, 497) + '...';
            }
          }
          
          // Replace the description lines with properly quoted version
          const newDescLine = `description: "${cleanDescription.replace(/"/g, '\\"')}"`;
          const newLines = [
            ...lines.slice(0, descriptionStart),
            newDescLine,
            ...lines.slice(descriptionEnd + 1)
          ];
          
          const newContent = newLines.join('\n');
          
          // Try parsing the fixed content
          try {
            matter(newContent);
            fs.writeFileSync(filePath, newContent, 'utf-8');
            console.log(`✅ Fixed YAML parsing for ${path.basename(filePath)}`);
            fixedCount++;
            continue;
          } catch (stillBroken) {
            console.log(`❌ Still broken after fix attempt: ${stillBroken.message}`);
          }
        }
        
        errorCount++;
        continue;
      }
      
      // If parsing was successful, check if description needs cleaning
      let needsUpdate = false;
      let newData = { ...parsed.data };
      
      if (typeof newData.description === 'string' && (
          newData.description.includes('<example>') ||
          newData.description.includes('Examples:') ||
          newData.description.includes('\\n')
        )) {
        
        // Clean the description
        let cleanDescription = newData.description
          .replace(/\\n/g, '\n')
          .replace(/Examples:[\s\S]*$/m, '')
          .replace(/<example>[\s\S]*?<\/example>/g, '')
          .replace(/<commentary>[\s\S]*?<\/commentary>/g, '')
          .trim();
        
        if (cleanDescription.length > 500) {
          const cutoff = cleanDescription.lastIndexOf('.', 500);
          if (cutoff > 300) {
            cleanDescription = cleanDescription.substring(0, cutoff + 1);
          } else {
            cleanDescription = cleanDescription.substring(0, 497) + '...';
          }
        }
        
        newData.description = cleanDescription;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        const newContent = matter.stringify(parsed.content, newData);
        fs.writeFileSync(filePath, newContent, 'utf-8');
        console.log(`✅ Cleaned description for ${path.basename(filePath)}`);
        fixedCount++;
      } else {
        console.log(`✨ Already clean: ${path.basename(filePath)}`);
      }
      
    } catch (error) {
      console.log(`❌ Error processing ${path.basename(filePath)}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Fixed: ${fixedCount} files`);
  console.log(`❌ Errors: ${errorCount} files`);
  console.log(`📁 Total: ${agentFiles.length} files`);
}

// Run the fix
fixAgentFiles().catch(console.error);