import { generateOpenAPIDocument } from '../packages/shared/src/lib/openapi-spec';
import * as fs from 'fs';
import * as path from 'path';

const doc = generateOpenAPIDocument();
const outputPath = path.resolve(__dirname, '../docs/openapi.json');

fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2));
console.log(`OpenAPI spec generated at ${outputPath}`);
