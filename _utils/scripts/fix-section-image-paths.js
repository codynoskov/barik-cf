const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');
const yaml = require('js-yaml');

const CASE_STUDY_DIR = path.join(__dirname, '../../cms/case-study');

/**
 * Fix image paths in case study sections
 * Converts /assets/images/filename.png to just filename.png (relative to media folder)
 */
function fixImagePaths() {
  console.log('🔧 Fixing image paths in case study sections...\n');
  
  const caseStudyFiles = fs.readdirSync(CASE_STUDY_DIR)
    .filter(file => file.endsWith('.md'));
  
  let totalFixed = 0;
  
  for (const file of caseStudyFiles) {
    const filePath = path.join(CASE_STUDY_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    
    let fileFixed = false;
    
    // Fix image paths in sections
    if (parsed.data.f_sections && Array.isArray(parsed.data.f_sections)) {
      parsed.data.f_sections = parsed.data.f_sections.map(section => {
        if (section.f_image && section.f_image.url) {
          const originalUrl = section.f_image.url;
          
          // Convert /assets/images/filename.png to filename.png
          if (originalUrl.startsWith('/assets/images/')) {
            const filename = originalUrl.replace('/assets/images/', '');
            section.f_image.url = filename;
            fileFixed = true;
            totalFixed++;
            console.log(`  ✅ ${file}: Fixed section image ${originalUrl} → ${filename}`);
          }
        }
        return section;
      });
    }
    
    // Also fix header images if they use /assets/images/ paths (check both f_header-image and f_header_image)
    const headerImage = parsed.data.f_header_image || parsed.data['f_header-image'];
    if (headerImage && headerImage.url) {
      const originalUrl = headerImage.url;
      if (originalUrl.startsWith('/assets/images/')) {
        const filename = originalUrl.replace('/assets/images/', '');
        if (parsed.data.f_header_image) {
          parsed.data.f_header_image.url = filename;
        } else if (parsed.data['f_header-image']) {
          parsed.data['f_header-image'].url = filename;
        }
        fileFixed = true;
        totalFixed++;
        console.log(`  ✅ ${file}: Fixed header image ${originalUrl} → ${filename}`);
      }
    }
    
    if (fileFixed) {
      // Write updated file
      const newContent = matter.stringify(parsed.content, parsed.data, {
        engines: {
          yaml: {
            stringify: (obj) => {
              return yaml.dump(obj, {
                lineWidth: -1,
                noRefs: true,
                skipInvalid: true,
                sortKeys: false,
                quotingType: '"',
                forceQuotes: false
              });
            }
          }
        }
      });
      
      fs.writeFileSync(filePath, newContent, 'utf-8');
    }
  }
  
  console.log(`\n✨ Fixed ${totalFixed} image paths across ${caseStudyFiles.length} case studies`);
}

// Run fix
if (require.main === module) {
  try {
    fixImagePaths();
  } catch (error) {
    console.error('❌ Error fixing image paths:', error);
    process.exit(1);
  }
}

module.exports = { fixImagePaths };

