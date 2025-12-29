const fs = require('fs-extra');
const path = require('path');
const matter = require('gray-matter');
const yaml = require('js-yaml');

// Directories
const BLOCKS_DIR = path.join(__dirname, '../../cms/blocks');
const CASE_STUDY_DIR = path.join(__dirname, '../../cms/case-study');

/**
 * Read all block files and group them by case study
 */
function readBlocks() {
  const blocksDir = BLOCKS_DIR;
  const blockFiles = fs.readdirSync(blocksDir)
    .filter(file => file.endsWith('.md') && file !== 'rss.njk');
  
  const blocksByCaseStudy = {};
  
  for (const file of blockFiles) {
    const filePath = path.join(blocksDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    
    const relativeTo = parsed.data['f_relative-to'];
    if (!relativeTo) {
      console.warn(`⚠️  Block ${file} has no f_relative-to field, skipping`);
      continue;
    }
    
    // Extract case study slug from path like "cms/case-study/custom-study-plans.md"
    const caseStudyMatch = relativeTo.match(/case-study\/(.+)\.md$/);
    if (!caseStudyMatch) {
      console.warn(`⚠️  Block ${file} has invalid f_relative-to: ${relativeTo}, skipping`);
      continue;
    }
    
    const caseStudySlug = caseStudyMatch[1];
    
    if (!blocksByCaseStudy[caseStudySlug]) {
      blocksByCaseStudy[caseStudySlug] = [];
    }
    
    // Convert block to section format
    const section = {
      title: parsed.data.title || '',
      f_header: parsed.data.f_header || parsed.data.title || '',
      'f_range-number': parsed.data['f_range-number'] || 999,
      f_layout: parsed.data.f_layout || 'Left text big (white)',
      body: parsed.content.trim(),
    };
    
    // Add image if present
    if (parsed.data.f_image) {
      section.f_image = {
        url: parsed.data.f_image.url || '',
        alt: parsed.data.f_image.alt || null
      };
      
      if (parsed.data['f_image-alt-text']) {
        section['f_image-alt-text'] = parsed.data['f_image-alt-text'];
      }
    }
    
    blocksByCaseStudy[caseStudySlug].push(section);
  }
  
  // Sort blocks by f_range-number for each case study
  for (const caseStudySlug in blocksByCaseStudy) {
    blocksByCaseStudy[caseStudySlug].sort((a, b) => {
      return (a['f_range-number'] || 999) - (b['f_range-number'] || 999);
    });
    
    // Clean up f_range-number keys to use proper format
    blocksByCaseStudy[caseStudySlug] = blocksByCaseStudy[caseStudySlug].map(section => {
      const cleaned = { ...section };
      if (cleaned['f_range-number']) {
        cleaned['f_range-number'] = cleaned['f_range-number'];
      }
      return cleaned;
    });
  }
  
  return blocksByCaseStudy;
}

/**
 * Read a case study file and return parsed content
 */
function readCaseStudy(caseStudySlug) {
  const filePath = path.join(CASE_STUDY_DIR, `${caseStudySlug}.md`);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Case study file not found: ${filePath}`);
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return matter(content);
}

/**
 * Write a case study file with updated sections
 */
function writeCaseStudy(caseStudySlug, parsed, sections) {
  const filePath = path.join(CASE_STUDY_DIR, `${caseStudySlug}.md`);
  
  // Update frontmatter with sections
  parsed.data.f_sections = sections;
  
  // Stringify with gray-matter, using js-yaml for better formatting
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
  console.log(`✅ Updated ${caseStudySlug}.md with ${sections.length} sections`);
}

/**
 * Main migration function
 */
function migrate() {
  console.log('🚀 Starting migration from blocks to sections...\n');
  
  // Read all blocks
  const blocksByCaseStudy = readBlocks();
  
  console.log(`📦 Found blocks for ${Object.keys(blocksByCaseStudy).length} case studies:\n`);
  for (const caseStudySlug in blocksByCaseStudy) {
    console.log(`  - ${caseStudySlug}: ${blocksByCaseStudy[caseStudySlug].length} blocks`);
  }
  console.log();
  
  // Process each case study
  for (const caseStudySlug in blocksByCaseStudy) {
    const sections = blocksByCaseStudy[caseStudySlug];
    const parsed = readCaseStudy(caseStudySlug);
    
    if (!parsed) {
      continue;
    }
    
    // Check if sections already exist
    if (parsed.data.f_sections && parsed.data.f_sections.length > 0) {
      console.log(`⚠️  ${caseStudySlug}.md already has sections. Skipping to avoid overwriting.`);
      console.log(`   (If you want to overwrite, manually remove f_sections from the file first)\n`);
      continue;
    }
    
    // Write updated case study
    writeCaseStudy(caseStudySlug, parsed, sections);
  }
  
  console.log('\n✨ Migration complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Review the updated case study files');
  console.log('   2. Test the site to ensure everything displays correctly');
  console.log('   3. Once confirmed, you can delete the old block files in cms/blocks/');
}

// Run migration
if (require.main === module) {
  try {
    migrate();
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

module.exports = { migrate, readBlocks, readCaseStudy };

