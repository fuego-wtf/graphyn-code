#!/usr/bin/env node

/**
 * Validate package integrity to prevent NPM installation issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const errors = [];
const warnings = [];

console.log('🔍 Validating Graphyn Code package...\n');

// 1. Check package.json
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Required fields
  const requiredFields = ['name', 'version', 'main', 'bin', 'engines'];
  requiredFields.forEach(field => {
    if (!pkg[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Check bin paths exist
  if (pkg.bin) {
    Object.entries(pkg.bin).forEach(([cmd, binPath]) => {
      if (!fs.existsSync(binPath)) {
        errors.push(`Bin file missing: ${cmd} -> ${binPath}`);
      }
    });
  }
  
  // Check main file exists
  if (pkg.main && !fs.existsSync(pkg.main)) {
    errors.push(`Main file missing: ${pkg.main}`);
  }
  
  // Check files array
  if (pkg.files) {
    pkg.files.forEach(file => {
      // Check if pattern or exact file
      if (!file.includes('*') && !fs.existsSync(file)) {
        warnings.push(`File/directory in 'files' array missing: ${file}`);
      }
    });
  }
  
} catch (e) {
  errors.push(`Failed to read package.json: ${e.message}`);
}

// 2. Check dist directory
if (!fs.existsSync('dist')) {
  errors.push('dist/ directory missing - run npm run build');
} else {
  // Check critical files
  const criticalFiles = [
    'dist/ink/cli.js',
    'dist/graphyn-wrapper.js'
  ];
  
  criticalFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      errors.push(`Critical file missing: ${file}`);
    }
  });
}

// 3. Check dependencies
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const installedDeps = fs.readdirSync('node_modules').filter(d => !d.startsWith('.'));
  
  Object.keys(pkg.dependencies || {}).forEach(dep => {
    if (!installedDeps.includes(dep)) {
      warnings.push(`Dependency not installed: ${dep}`);
    }
  });
} catch (e) {
  warnings.push('Could not verify dependencies');
}

// 4. Check for problematic patterns
const checkProblematicPatterns = () => {
  // Check for absolute paths
  const filesToCheck = ['dist/ink/cli.js', 'dist/graphyn-wrapper.js'];
  
  filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for absolute paths
      if (content.includes('/Users/') || content.includes('C:\\Users\\')) {
        warnings.push(`Absolute paths found in ${file}`);
      }
      
      // Check for missing shebang
      if (file.endsWith('cli.js') && !content.startsWith('#!/usr/bin/env node')) {
        errors.push(`Missing shebang in ${file}`);
      }
    }
  });
};

checkProblematicPatterns();

// 5. Test npm pack
console.log('📦 Testing npm pack...');
try {
  execSync('npm pack --dry-run', { stdio: 'pipe' });
  console.log('✅ npm pack test passed\n');
} catch (e) {
  errors.push('npm pack failed - package may not publish correctly');
}

// 6. Check file permissions
if (process.platform !== 'win32') {
  const executableFiles = ['dist/graphyn-wrapper.js', 'dist/ink/cli.js'];
  
  executableFiles.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.accessSync(file, fs.constants.X_OK);
      } catch (e) {
        warnings.push(`File not executable: ${file}`);
      }
    }
  });
}

// Report results
console.log('═══════════════════════════════════\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Package validation passed!');
  console.log('\nPackage is ready for publishing.');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`❌ Found ${errors.length} error(s):\n`);
    errors.forEach(err => console.log(`  • ${err}`));
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  Found ${warnings.length} warning(s):\n`);
    warnings.forEach(warn => console.log(`  • ${warn}`));
  }
  
  console.log('\nPlease fix these issues before publishing.');
  process.exit(errors.length > 0 ? 1 : 0);
}