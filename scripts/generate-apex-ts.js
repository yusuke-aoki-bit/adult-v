const fs = require('fs');
const path = require('path');

const APEX_JSON_PATH = path.join(__dirname, '../data/apex.json');
const APEX_TS_PATH = path.join(__dirname, '../data/apex.ts');

async function generateApexTs() {
  try {
    const jsonData = fs.readFileSync(APEX_JSON_PATH, 'utf-8');
    const data = JSON.parse(jsonData);
    
    const tsContent = `// This file is auto-generated. Do not edit manually.
// Run: node scripts/generate-apex-ts.js

export const apexData = ${JSON.stringify(data, null, 2)} as const;
`;

    fs.writeFileSync(APEX_TS_PATH, tsContent, 'utf-8');
    console.log(`[generate-apex-ts] Generated ${APEX_TS_PATH} with ${data.length} entries`);
  } catch (error) {
    console.error('Error generating apex.ts:', error);
    process.exit(1);
  }
}

generateApexTs();

