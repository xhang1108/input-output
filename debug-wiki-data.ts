
import { getWikiData } from './src/lib/docLoader';

function findNonPlain(obj: any, path: string = ''): void {
    if (obj === null || typeof obj !== 'object') return;

    if (obj instanceof Set) {
        console.log(`FOUND SET at ${path}`);
    } else if (obj instanceof Map) {
        console.log(`FOUND MAP at ${path}`);
    } else if (Array.isArray(obj)) {
        obj.forEach((item, i) => findNonPlain(item, `${path}[${i}]`));
    } else {
        Object.entries(obj).forEach(([key, value]) => {
            findNonPlain(value, `${path}.${key}`);
        });
    }
}

console.log('Testing User Sections...');
const user = getWikiData('user');
findNonPlain(user, 'user');

console.log('Testing Developer Sections...');
const dev = getWikiData('developer');
findNonPlain(dev, 'developer');

console.log('Done.');
