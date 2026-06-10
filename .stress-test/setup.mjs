// Build an isolated authenticated test identity:
//  1) load env exactly like Next (.env then .env.local override)
//  2) mint a next-auth session JWT with the project's own encode + real secret
//  3) seed the test user with credits directly in DynamoDB
// Prints COOKIE=<token> and EMAIL=<email> for the bash harness to consume.
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const repo = dirname(dirname(fileURLToPath(import.meta.url)));

function loadEnv(file) {
  let txt = '';
  try { txt = readFileSync(join(repo, file), 'utf8'); } catch { return; }
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;            // .env first
  }
}
function loadEnvOverride(file) {
  let txt = '';
  try { txt = readFileSync(join(repo, file), 'utf8'); } catch { return; }
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;            // override
  }
}
loadEnv('.env');
loadEnvOverride('.env.local');

const EMAIL = 'stress-bot@eventiq.test';
const secret = process.env.NEXTAUTH_SECRET;
if (!secret) { console.error('NO_SECRET'); process.exit(1); }

// --- mint session JWT (same encode the running server uses to decode) ---
const { encode } = require('next-auth/jwt');
const token = await encode({
  token: { name: 'Stress Bot', email: EMAIL, picture: null, sub: EMAIL },
  secret,
  maxAge: 60 * 60 * 24,
});

// --- seed credits directly (init shape from src/lib/db/credits.ts) ---
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const prefix = process.env.DYNAMODB_TABLE_PREFIX || 'eventbot';
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
const now = new Date().toISOString();
const GRANT = 1000;
try {
  await doc.send(new PutCommand({
    TableName: `${prefix}-credits`,
    Item: { PK: `USER#${EMAIL}`, SK: 'CREDITS', userId: EMAIL, balance: GRANT, totalPurchased: GRANT, totalUsed: 0, lastUpdated: now },
  }));
  const check = await doc.send(new GetCommand({ TableName: `${prefix}-credits`, Key: { PK: `USER#${EMAIL}`, SK: 'CREDITS' } }));
  console.error(`SEEDED balance=${check.Item?.balance}`);
} catch (e) {
  console.error('SEED_ERROR ' + e.name + ': ' + e.message);
}

console.log('EMAIL=' + EMAIL);
console.log('COOKIE=' + token);
