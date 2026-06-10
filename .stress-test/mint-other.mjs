import { createRequire } from 'module';
import { readFileSync } from 'fs'; import { dirname, join } from 'path'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const repo = dirname(dirname(fileURLToPath(import.meta.url)));
for (const f of ['.env','.env.local']) { try { for (const l of readFileSync(join(repo,f),'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m)process.env[m[1]]=m[2].trim();}}catch{} }
const { encode } = require('next-auth/jwt');
const t = await encode({ token:{name:'Other User',email:'other-user@eventiq.test',sub:'other'}, secret:process.env.NEXTAUTH_SECRET, maxAge:86400 });
console.log(t);
