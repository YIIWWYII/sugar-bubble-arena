import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ProfileStore} from '../profiles.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=process.env.PROFILE_FILE || path.join(root,'.runtime/profiles.sqlite');
console.log(new ProfileStore(file).backup());
