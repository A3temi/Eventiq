import { createRequire } from 'module';
import { readFileSync } from 'fs'; import { dirname, join } from 'path'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const repo = dirname(dirname(fileURLToPath(import.meta.url)));
for (const f of ['.env','.env.local']) { try { for (const l of readFileSync(join(repo,f),'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m)process.env[m[1]]=m[2].trim();}}catch{} }
const { encode, decode } = require('next-auth/jwt');
const s = process.env.NEXTAUTH_SECRET;
const t = await encode({ token:{email:'stress-bot@eventiq.test',sub:'x'}, secret:s, maxAge:-86400 }); // exp 1 day ago
console.log('EXPIRED1D='+t);
// also show what the decoded payload exp/iat are
try { const d = await decode({ token:t, secret:s }); console.error('decoded payload: '+JSON.stringify(d)); } catch(e){ console.error('decode threw: '+e.message); }
