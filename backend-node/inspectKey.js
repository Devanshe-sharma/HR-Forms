require('dotenv').config();

const raw = process.env.GOOGLE_PRIVATE_KEY || '';
const unescaped = raw.replace(/\\n/g, '\n');

console.log('--- RAW (as stored in process.env, before any replace) ---');
console.log('First 40 chars:', JSON.stringify(raw.slice(0, 40)));
console.log('Last 40 chars:', JSON.stringify(raw.slice(-40)));
console.log('Total length:', raw.length);

console.log('\n--- AFTER \\\\n -> real newline replace ---');
console.log('First 40 chars:', JSON.stringify(unescaped.slice(0, 40)));
console.log('Last 40 chars:', JSON.stringify(unescaped.slice(-40)));
console.log('Total length:', unescaped.length);