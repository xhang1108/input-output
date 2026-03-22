import { getWikiData, DocSection } from './src/lib/docLoader.js';

const user: DocSection[] = getWikiData('user');
const dev: DocSection[] = getWikiData('developer');

console.log('USER SECTIONS:', user.map((s: DocSection) => s.id));
console.log('DEV SECTIONS:', dev.map((s: DocSection) => s.id));
