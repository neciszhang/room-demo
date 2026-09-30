import React, {Component, Suspense, useEffect, useMemo, useRef} from 'react';
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {Html, OrbitControls, SoftShadows, useGLTF, useTexture} from '@react-three/drei';
import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {assetUrl} from '../assetUrl';
import {createActivationController} from './activation';
import {createSceneMaterial} from './materials';

function Model({config, active, onReady, apiRef, focus, dragging, viewReset}) {
  const {scene, animations, parser} = useGLTF(config.model.url, assetUrl('/decoders/draco/'));
  const {camera, size, gl, invalidate} = useThree();
  const controls = useRef(), activeRef = useRef(active), focusRef = useRef(focus), lastActivation = useRef(null);
  activeRef.current = active; focusRef.current = focus;
  const textureURLs = useMemo(() => [...new Set(config.assets.flatMap(asset => asset.parts.flatMap(part => [part.activeLightmap, part.inactiveTexture].filter(Boolean))))], [config]);
  const textures = useTexture(textureURLs);
  const data = useMemo(() => {
    const textureByURL = new Map(textureURLs.map((url, i) => {
      const texture = textures[i]; texture.flipY = false; texture.channel = 0; texture.colorSpace = THREE.SRGBColorSpace;
      return [url, texture];
    }));
    const root = cloneSkeleton(scene), materials = [], groups = {}, anchors = {}, parts = new Map();
    for (const asset of config.assets) for (const part of asset.parts) parts.set(part.node, {asset, part});
    const found = new Set(), sourceNodes = new Map();
    // Parser associations belong to the source objects, before SkeletonUtils clones them.
    scene.traverse(object => {
      const index = parser.associations.get(object)?.nodes;
      if (index !== undefined) sourceNodes.set(object.name, parser.json.nodes[index].name);
    });
    root.traverse(object => {
      if (!object.isMesh) return;
      const sourceName = sourceNodes.get(object.name) || object.name;
      const entry = parts.get(sourceName);
      if (!entry) throw new Error(`清单未声明模型节点：${object.name}`);
      const {asset, part} = entry, source = object.material;
      if (Array.isArray(source) || source.name !== part.material) throw new Error(`材质映射不匹配：${object.name}`);
      found.add(part.node);
      object.userData.deliveryNode = part.node;
      object.userData.assetId = asset.id;
      object.castShadow = !!config.rendering.lighting;
      object.receiveShadow = asset.lighting === 'dynamic';
      (groups[asset.id] ||= []).push(object);
      const reveal = {value: activeRef.current.includes(asset.id) ? 1 : 0}, glow = {value: 0};
      const material = createSceneMaterial(source, asset, config.rendering, {activeLightmap: textureByURL.get(part.activeLightmap), inactiveTexture: textureByURL.get(part.inactiveTexture)}, reveal, glow);
      object.material = material; materials.push({id: asset.id, material, reveal, glow});
    });
    for (const name of parts.keys()) if (!found.has(name)) throw new Error(`模型缺少清单节点：${name}`);
    root.updateMatrixWorld(true);
    for (const asset of config.assets) {
      const pivot = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(asset.node));
      if (!pivot) throw new Error(`模型缺少物体根节点：${asset.node}`);
      const selected = asset.anchor?.nodes ? groups[asset.id].filter(object => asset.anchor.nodes.includes(object.userData.deliveryNode)) : groups[asset.id];
      if (!selected.length) throw new Error(`物体锚点为空：${asset.id}`);
      const box = new THREE.Box3(); selected.forEach(object => box.expandByObject(object));
      const relative = new THREE.Vector3().fromArray(asset.anchor?.relative || [.5, .5, .5]);
      const point = box.getSize(new THREE.Vector3()).multiply(relative).add(box.min).add(new THREE.Vector3().fromArray(asset.anchor?.offset || [0, 0, 0]));
      anchors[asset.id] = {pivot, local: pivot.worldToLocal(point.clone()), rest: root.worldToLocal(point.clone())};
    }
    return {root, materials, anchors, controller: createActivationController(root, animations, config.assets)};
  }, [scene, animations, parser, config, textures, textureURLs]);
  useEffect(() => {data.controller.setActive(active); invalidate();}, [active, data, invalidate]);
  useEffect(() => {
    const aspect = size.width / size.height;
    const height = Math.max(config.camera.minFrameHeight ?? config.camera.frameHeight, (config.camera.frameWidth ?? config.camera.frameHeight) / aspect);
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2; camera.top = height / 2; camera.bottom = -height / 2;
    camera.near = .01; camera.far = 100; camera.updateProjectionMatrix(); invalidate();
  }, [camera, size, config, invalidate]);
  useEffect(() => {
    if (controls.current) {controls.current.enableDamping = false; controls.current.update();}
    camera.position.fromArray(config.camera.position); camera.lookAt(...config.camera.target);
    if (controls.current) {controls.current.target.fromArray(config.camera.target); controls.current.update(); controls.current.enableDamping = true;}
    invalidate();
  }, [camera, config, viewReset, invalidate]);
  useEffect(() => {invalidate();}, [focus, active, invalidate]);
  useEffect(() => {
    apiRef.current = {
      // The active-ID transition owns playback, preventing duplicate clip starts.
      bounce(id) {lastActivation.current = id; invalidate();},
      resetMotion() {data.controller.reset(); lastActivation.current = null; invalidate();},
      project(id) {
        const anchor = data.anchors[id]; if (!anchor) return null;
        data.root.updateMatrixWorld(true);
        const point = anchor.pivot.localToWorld(anchor.local.clone()).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return {x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2};
      },
    };
    window.__sceneSource = scene; window.__sceneDisplay = data.root;
    onReady(true); invalidate();
    return () => {apiRef.current = null; data.controller.dispose(); data.materials.forEach(entry => entry.material.dispose());};
  }, [apiRef, data, scene, camera, gl, onReady, invalidate]);
  useFrame((_, delta) => {
    let complete = true;
    const dt = Math.min(delta, .05), animating = data.controller.update(dt);
    for (const entry of data.materials) {
      const target = activeRef.current.includes(entry.id) ? 1 : 0, glow = focusRef.current === entry.id ? 1 : 0;
      entry.reveal.value = THREE.MathUtils.damp(entry.reveal.value, target, 5, dt);
      entry.glow.value = THREE.MathUtils.damp(entry.glow.value, glow, 8, dt);
      if (Math.abs(entry.reveal.value - target) > .008 || Math.abs(entry.glow.value - glow) > .008) complete = false;
    }
    if (!complete || animating) invalidate();
    const animationStates = data.controller.snapshot();
    window.__sceneState = {ready: true, sceneId: config.sceneId, active: [...activeRef.current], transitionComplete: complete, animationStates, idle: Object.keys(animationStates).filter(id => animationStates[id] === 'idle'), bouncing: Object.keys(animationStates).filter(id => animationStates[id] === 'activate'), lastBounce: lastActivation.current, clips: animations.map(clip => clip.name), meshCount: data.materials.length, camera: camera.position.toArray(), renderInfo: {calls: gl.info.render.calls, triangles: gl.info.render.triangles, textures: gl.info.memory.textures}, anchors: Object.fromEntries(config.assets.map(asset => [asset.id, apiRef.current?.project(asset.id)]))};
  });
  return <>
    <primitive object={data.root}/>
    <OrbitControls ref={controls} makeDefault enabled={!dragging} target={config.camera.target} enablePan={false} enableZoom={false} minPolarAngle={config.camera.minPolarAngle ?? .6} maxPolarAngle={config.camera.maxPolarAngle ?? 1.55} rotateSpeed={.65} enableDamping dampingFactor={.12}/>
    {focus && data.anchors[focus] && <Html position={data.anchors[focus].rest} center style={{pointerEvents: 'none'}}><div className="model-target"><i/><span>✦</span></div></Html>}
  </>;
}
class Boundary extends Component {
  state = {error: null};
  static getDerivedStateFromError(error) {return {error};}
  render() {return this.state.error ? <div className="load-error" role="alert">场景加载失败：{this.state.error.message}<button onClick={() => location.reload()}>重新加载</button></div> : this.props.children;}
}
function Lighting({config}) {
  const lighting = config.rendering.lighting;
  if (!lighting) return null;
  return <>
    <ambientLight intensity={lighting.ambient}/>
    <hemisphereLight args={[lighting.hemisphere.sky, lighting.hemisphere.ground, lighting.hemisphere.intensity]}/>
    <directionalLight {...lighting.key} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={7} shadow-camera-bottom={-3} shadow-normalBias={.025}/>
    <directionalLight {...lighting.fill}/><SoftShadows size={18} samples={8}/>
  </>;
}
export default function SceneModel(props) {
  const {config} = props;
  return <Boundary><Canvas shadows={!!config.rendering.lighting} frameloop="demand" orthographic dpr={[1, 1.75]} camera={{manual: true, position: config.camera.position}} gl={{alpha: true, antialias: true, preserveDrawingBuffer: true}} onCreated={({gl}) => {gl.toneMapping = config.rendering.toneMapping === 'agx' ? THREE.AgXToneMapping : THREE.NoToneMapping; gl.toneMappingExposure = config.rendering.exposure ?? 1; gl.outputColorSpace = THREE.SRGBColorSpace;}}>
    <Suspense fallback={<Html center><div className="loading"><span/>正在布置你的小屋…</div></Html>}><Lighting config={config}/><Model {...props}/></Suspense>
  </Canvas></Boundary>;
}
