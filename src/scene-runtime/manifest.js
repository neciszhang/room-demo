/** Normalize delivery URLs once; neither UI nor renderer knows asset filenames. */
export function prepareManifest(manifest, manifestUrl) {
  if (manifest.schemaVersion !== 1 || manifest.profile !== 'collectible-scene-v1') throw new Error('不支持的场景清单版本');
  if (!['baked-unlit', 'baked-lightmap-dynamic'].includes(manifest.rendering?.profile)) throw new Error('不支持的场景材质类型');
  if (!manifest.sceneId || !manifest.model?.url || !manifest.assets?.length) throw new Error('场景清单缺少模型或物体');
  const resolve = path => path ? new URL(path, manifestUrl).href : null;
  const ids = new Set(), nodes = new Set();
  const assets = [...manifest.assets].sort((a, b) => a.order - b.order).map(asset => {
    if (!asset.id || ids.has(asset.id)) throw new Error('场景物体 ID 重复或为空');
    ids.add(asset.id);
    if (!asset.node || !asset.parts?.length) throw new Error(`物体缺少节点：${asset.id}`);
    return {...asset, thumbnail: resolve(asset.thumbnail), animations: {activate: null, idle: null, deactivate: null, ...asset.animations}, parts: asset.parts.map(part => {
      if (!part.node || nodes.has(part.node)) throw new Error(`模型节点重复或为空：${part.node}`);
      nodes.add(part.node);
      if (manifest.rendering.profile === 'baked-unlit' && !part.inactiveTexture) throw new Error(`缺少白模贴图：${part.node}`);
      if (manifest.rendering.profile === 'baked-lightmap-dynamic' && asset.lighting !== 'dynamic' && (!part.activeLightmap || !part.inactiveTexture)) throw new Error(`缺少烘焙光照贴图：${part.node}`);
      return {...part, inactiveTexture: resolve(part.inactiveTexture), activeLightmap: resolve(part.activeLightmap)};
    })};
  });
  return {...manifest, model: {...manifest.model, url: resolve(manifest.model.url)}, assets};
}
