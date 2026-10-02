// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ProfileStore} from '../profiles.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=process.env.PROFILE_FILE || path.join(root,'.runtime/profiles.sqlite');
console.log(new ProfileStore(file).backup());
