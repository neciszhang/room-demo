# Room Demo

React Three Fiber 互动小屋：使用图册点亮模型，支持吸附、模型动画与水平 360° 旋转。

[在线演示](https://neciszhang.github.io/room-demo/)

## 本地运行

需要 Node.js 24。

```sh
npm ci
npm run dev
```

初始图册各 1 张，模型未激活。点击或拖入图册后数量减 1，对应模型点亮；星星摇头，音符和小花漂浮。重置恢复初始状态。进度保存在浏览器本地，无后端接口。

## 构建和部署

```sh
npm run build
npm run preview
```

生产预览地址为 `http://localhost:5198/room-demo/`。推送 main 自动通过 GitHub Actions 构建并部署到 GitHub Pages；仓库 Pages 的 Source 设为 GitHub Actions。

## 运行资产

- `public/models/room-optimized.glb`：Meshopt + WebP 压缩模型，包含骨骼和 19 个动画。
- `public/models/star-albedo-vivid.png`：星星颜色贴图。
- `public/lightmaps`、`public/lightmaps-clay`：彩色和未激活态 JPG 光照。
- `public/thumbnails`：图册缩略图。
- `src/scene-config.json`：图册、动画、相机配置。
- `src/sceneColorGrade.js`：场景整体调色；非旧版亮度/对比度为网页端近似曲线。

仅保留运行必需内容。Blender 源文件、原始未压缩 GLB/PNG 光照图、制作中间文件、本地工具和验证截图不纳入仓库。灯光采用静态烘焙与活动物件实时光照混合；静态遮挡在角色运动时为近似。
