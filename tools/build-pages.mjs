import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../',import.meta.url));
const target = path.join(root,'dist');
await mkdir(target,{recursive:true});
await cp(path.join(root,'public'),target,{recursive:true});
async function adapt(directory) {
  for (const item of await readdir(directory,{withFileTypes:true})) {
    const filename = path.join(directory,item.name);
    if (item.isDirectory()) { await adapt(filename); continue; }
    if (!/\.(html|mjs|css|json|xml|txt)$/.test(item.name)) continue;
    let text = await readFile(filename,'utf8');
    // Assets and entry files must resolve beneath /sugar-bubble-arena/ on Pages.
    text = text.replace(/(["'`(])\/assets\//g,'$1./assets/');
    if (item.name === 'index.html') {
      text = text.replace('<head>','<head>\n  <meta name="game-runtime" content="local">');
      text = text.replace(/(href|src)="\/(?!\/)/g,'$1="./');
      text = text.replaceAll('多模式联机游戏','单人挑战与 AI 对战').replaceAll('支持角色养成、局内强化和好友联机。','支持角色养成、局内强化与本地存档，联机暂未开放。');
    }
    await writeFile(filename,text);
  }
}
await adapt(target);
await writeFile(path.join(target,'.nojekyll'),'');
console.log('GitHub Pages 单人版已构建至 dist/');
