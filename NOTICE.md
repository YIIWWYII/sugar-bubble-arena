# NOTICE — 素材授权说明

本文件是 [`LICENSE`](LICENSE)（MIT）的**例外说明**，请一并阅读。

## 本项目开发者

糖泡对战的二次开发与维护作者为 **王艺**。官方仓库为 https://github.com/YIIWWYII/sugar-bubble-arena 。开发者署名适用于本项目修改和新增内容，不替代下述第三方代码及素材的权利声明。

## 代码 —— MIT

本项目的**源代码**（服务端、客户端脚本、样式、测试与工具脚本，即 `public/assets/`
目录以外的全部内容）以 [MIT 许可证](LICENSE) 开源，可自由使用、修改、分发。

## 素材 —— 不适用 MIT，权属腾讯

`public/assets/` 目录下沿用的**原客户端美术、音频与字体素材**：

- 地图图块、角色精灵与动画帧（`tile*.png`、`prince-*.png`、`sailor-*.png`、`water-*.png` 等）
- 用户界面元素（`dlg_*.png`、`gameTop.png`、`timer-digits.png`、光标、图标等）
- 音效与音乐（`*.wav`、`*.ogg`，含 `match.ogg`、`PlayerWin.ogg`、`PlayerLoss.ogg`）

均**提取自原版《QQ堂》客户端**，**著作权归腾讯公司所有**。

这些素材：

- **不在** MIT 许可证的授权范围内；
- 本项目对其**不作任何权利主张**；
- 随源码一并提供**仅出于学习与技术交流目的**；
- **禁止**用于任何其他用途，尤其不得用于商业用途。

本项目**不附带**原版客户端文件。`tools/` 下的导入脚本用于从**你自备的**客户端数据
文件中提取素材，不含任何原始游戏资源。

## 第三方代码来源

本项目基于 [Ker0el/qqt-bun6](https://github.com/Ker0el/qqt-bun6) 修改。原作者版权声明和 MIT 许可完整保留在 LICENSE 中。本地界面名称为“糖泡对战”，不表示原代码或素材的权利归属发生变化。

## 本地新增资源

新增的主题 SVG、原创 music-boss/music-bio/music-survivor/music-water 配乐、站点图标和分享封面不属于上述原客户端提取素材。`public/assets/fonts/` 下的 Fusion Pixel 字体独立遵循 OFL 许可证（目录中保留原文件）；角色调色及部件派生仍以其原素材权利为基础。具体来源见 ASSET-AUDIT.md。

## 同源角色部件

`public/assets/appearance/` 中的部件由 [onlyGuo/QQTang_Local](https://github.com/onlyGuo/QQTang_Local) 的角色散图整理为图集。保留四方向站立和行走帧，用于本项目派生装扮。底层游戏素材不因该仓库的代码许可而获得新授权，仍适用上文原客户端素材权利说明。
