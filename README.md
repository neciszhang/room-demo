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

## 共用场景页面

原小屋 `/` 与星星阅读角 `/#/star-reading` 使用同一个 `SceneApp`、`SceneModel` 和 `style.css`。两页都有主页的图册扣数量、点击/拖拽吸附、白模点亮、重置和动画功能。

新增场景只需提供素材及场景清单，并在 `public/scenes.json` 注册，无需复制页面或样式。[配置方式与清单字段](docs/shared-scene-runtime.md)。

- 原小屋清单：`public/original-room/scene.manifest.json`，16 件物体、19 段动画，保留原进度。
- 阅读角清单：`public/star-reading/scene.manifest.json`，9 件物体；当前素材没有动作 clip，动画声明为 null，但图册交互与外观切换完整共用。
- GLB 内含彩色贴图，白模贴图按清单加载；贴图尺寸最大 1024。Draco 与 Meshopt 模型均可加载。

```sh
node tests/scene-activation.test.mjs
node tests/scene-manifest.test.mjs
```

## 构建和部署

```sh
npm run build
npm run preview
```

生产预览地址为 `http://localhost:5198/room-demo/`。推送 main 自动通过 GitHub Actions 构建并部署到 GitHub Pages；仓库 Pages 的 Source 设为 GitHub Actions。

## 运行资产

- `public/models/room-optimized.glb`：Meshopt + WebP 压缩模型，包含骨骼和 19 个动画。
- 星星颜色贴图已嵌入 GLB；旧 PNG 为来源留档，运行时不加载。
- `public/lightmaps`、`public/lightmaps-clay`：彩色和未激活态 JPG 光照。
- `public/thumbnails`：图册缩略图。
- `public/original-room/scene.manifest.json`：原场景图册、动画、相机与渲染配置。
- `src/sceneColorGrade.js`：清单参数驱动的调色函数，亮度/对比度为网页端近似曲线。

仅保留运行必需内容。Blender 源文件、原始未压缩 GLB/PNG 光照图、制作中间文件、本地工具和验证截图不纳入仓库。灯光采用静态烘焙与活动物件实时光照混合；静态遮挡在角色运动时为近似。
