// Regenerates tools/manifest.js from the folders inside /tools.
// Run `node build.js` (or `npm run build`) after adding/removing a tool when hosting on a static host.
const { writeManifest } = require('./scan-tools');
const tools = writeManifest(__dirname);
console.log(`Found ${tools.length} tool(s):`);
tools.forEach(t => console.log(`  - ${t.slug}  [${t.status}]  ${t.name}`));
