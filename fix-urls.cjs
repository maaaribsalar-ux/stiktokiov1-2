const fs = require('fs');
const path = require('path');

// Function to recursively find all .astro files
function findAstroFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            findAstroFiles(filePath, fileList);
        } else if (file.endsWith('.astro')) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

// Function to fix URL patterns in a file
function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Pattern 1: const lang = getLangFromUrl(Astro.url)
    if (content.includes('getLangFromUrl(Astro.url)')) {
        content = content.replace(
            /const\s+lang\s*=\s*getLangFromUrl\(Astro\.url\)/g,
            'const safeUrl = Astro.url || new URL(\'/\', Astro.site || \'http://localhost:4321\');\nconst lang = getLangFromUrl(safeUrl);'
        );
        modified = true;
        console.log(`✅ Fixed Pattern 1 in: ${filePath}`);
    }
    
    // Pattern 2: const safeUrl = Astro.url || { pathname: '/' } as URL;
    if (content.includes('{ pathname: \'/\' } as URL')) {
        content = content.replace(
            /const\s+safeUrl\s*=\s*Astro\.url\s*\|\|\s*{\s*pathname:\s*['"]\/['"]\s*}\s*as\s+URL;/g,
            'const safeUrl = Astro.url || new URL(\'/\', Astro.site || \'http://localhost:4321\');'
        );
        modified = true;
        console.log(`✅ Fixed Pattern 2 in: ${filePath}`);
    }
    
    // Write back if modified
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }
    
    return false;
}

// Main execution
console.log('🔍 Finding all .astro files...');
const astroFiles = findAstroFiles('./src');
console.log(`📁 Found ${astroFiles.length} .astro files`);

let fixedCount = 0;

astroFiles.forEach(file => {
    if (fixFile(file)) {
        fixedCount++;
    }
});

console.log(`\n🎉 Fixed ${fixedCount} files!`);
console.log('✨ All URL patterns have been updated.');

if (fixedCount === 0) {
    console.log('🤔 No files needed fixing. The issue might be elsewhere.');
    console.log('📝 Check your Layout.astro file manually for any remaining patterns.');
}