const fs = require('fs');
const path = require('path');

const dir = 'd:/Antigravity/input-output/src/assets/docs/user/03_Node';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

for (const file of files) {
  const fp = path.join(dir, file);
  let content = fs.readFileSync(fp, 'utf8');
  
  content = content.replace(/^[ \t]*"height"[ \t]*:[ \t]*\d+,?[ \t]*\r?\n?/gm, '');
  content = content.replace(/,[ \t]*\r?\n([ \t]*})/g, '\n$1'); // Fix dangling commas
  
  fs.writeFileSync(fp, content);
}
console.log('Done');
