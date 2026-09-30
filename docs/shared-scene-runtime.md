# 一套页面，替换场景素材

原小屋与星星阅读角统一使用：

- `src/scene-runtime/SceneApp.jsx`：主页布局、图册数量、点击消耗、长按/鼠标拖拽、吸附反馈、进度、重置、场景入口及本地保存。
- `src/style.css`：唯一页面样式。
- `src/scene-runtime/SceneModel.jsx`：模型加载、相机、锚点投影、材质过渡和动画更新。
- `src/scene-runtime/activation.js`：独立物体的 activate → idle / deactivate 状态机；未制作动画可用 null。
- `src/scene-runtime/materials.js`：清单驱动的材质适配。两种素材格式使用同一套点亮交互。

旧的独立阅读角页面/CSS、原 Room 组件、items.js 和旧 scene-config 已合并移除。

## 新增场景

1. 在 `public/<scene>/` 放入 GLB、贴图、缩略图和 `scene.manifest.json`。
2. 在 `public/scenes.json` 增加一条记录：

```json
{"id":"another-scene","label":"另一个场景","route":"/another-scene","manifest":"another-scene/scene.manifest.json"}
```

3. 打开 `/#/another-scene`；线上带 Vite base 的地址为 `/room-demo/#/another-scene`。场景入口自动出现在“更多”菜单中。

只替换既有场景时，更新该场景清单及素材即可，无需调整注册列表，更无需改 UI、样式或事件代码。不同场景以 sceneId 分开保存进度；同一场景替换素材时维持 asset ID，保留用户已点亮记录。原小屋使用旧 storageKey 延续已有进度。

## 清单职责

参考 `public/star-reading/scene.manifest.json` 或 `public/original-room/scene.manifest.json`。

- `sceneId`：持久化的场景身份；`assets[].id`：物体身份，不能依赖图册顺序。
- `model.url` / `thumbnail` / `parts[].inactiveTexture` / `activeLightmap`：相对清单 URL 解析。
- `assets[].node`、`parts[].node/material`：明确对应真实 GLB 节点/材质，不按中文名字猜测。加载器会通过 glTF 原始节点关联处理 Three.js 对特殊字符的规范化。
- `order`：图册排序；`animations`：真实 clip 名称或 null。新场景不需要前端编写具体动作。
- `camera`：位置、目标点、正交画幅、可选轨道角度限制。
- `anchor`：可选的锚点网格列表、包围盒相对位置、偏移。省略时使用物体中心。
- `rendering`：素材渲染方式及参数，与场景业务身份无关。

### 素材渲染方式

`baked-unlit`：GLB 内是最终彩色烘焙贴图，parts 提供白模最终贴图；不再二次打光。阅读角采用此方式。

`baked-lightmap-dynamic`：静态物体有颜色贴图和两套光照贴图；动态物体使用实时灯光及法线。旧小屋沿用此方式，灯光、调色、特殊物体参数均写入清单。`activationEnd: "rest"` 表示一次反馈动画结束后回到原姿态；默认保留激活动画的终点。

素材必须符合其中一种已支持的渲染合同。换一个符合合同的 GLB 无需写场景专用代码；随意换一个没有物体映射、白模贴图或动画声明的 GLB，不会自动获得这些内容。

贴图仍受最大 1024 尺寸限制。此重构不改变模型文件和烘焙质量。
