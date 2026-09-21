import config from './scene-config.json';
import {assetUrl} from './assetUrl';
import React,{useMemo,useEffect,useRef,Suspense,Component} from 'react';
import {Canvas,useFrame,useThree,useLoader} from '@react-three/fiber';
import {useGLTF,useTexture,Html,OrbitControls,SoftShadows} from '@react-three/drei';
import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {sceneColorGrade,sceneColorGradeGLSL} from './sceneColorGrade';
import {SceneAnimationPlayer} from './SceneAnimationPlayer';
const cream=new THREE.Color('#f1e5d5');
function Model({active,onReady,apiRef,focus,dragging,viewReset}){
 const {scene,animations}=useGLTF(assetUrl(config.model));
 const {camera,size,gl,invalidate}=useThree();
 const controls=useRef();

 const files=useMemo(()=>{const names=[];scene.traverse(o=>{if(o.isMesh&&o.userData.lightmap)names.push(assetUrl('/lightmaps/'+o.userData.lightmap.replace(/\.png$/,'.jpg')))});return [...new Set(names)]},[scene]);
 const lightmaps=useTexture(files);
 const clayFiles=useMemo(()=>files.map(f=>f.replace('/lightmaps/','/lightmaps-clay/')),[files]);
 const clayMaps=useTexture(clayFiles);
 const overrides=useMemo(()=>Object.entries(config.collectibles).filter(([,item])=>item.baseColorMap),[config]);
 const overrideURLs=useMemo(()=>overrides.map(([,item])=>assetUrl(item.baseColorMap)),[overrides]);
 const overrideTextures=useTexture(overrideURLs);
 const targets=useRef(new Set(active));targets.current=new Set(active);
 const focused=useRef(focus);focused.current=focus;
 const data=useMemo(()=>{
  const baseMaps=Object.fromEntries(overrides.map(([id],i)=>{const t=overrideTextures[i];t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;return[id,t]}));
  const textures=Object.fromEntries(files.map((file,i)=>{const t=lightmaps[i];t.flipY=false;t.channel=0;t.colorSpace=THREE.SRGBColorSpace;return[file,t]}));
  const clayTextures=Object.fromEntries(files.map((file,i)=>{const t=clayMaps[i];t.flipY=false;t.channel=0;t.colorSpace=THREE.SRGBColorSpace;return[file,t]}));
  const root=cloneSkeleton(scene),materials=[],groups={};
  root.updateMatrixWorld(true);
  root.traverse(o=>{
   if(!o.isMesh)return;
   const id=o.userData.collectible;
   const dynamic=config.collectibles[id]?.lighting==='dynamic';
   o.castShadow=true;o.receiveShadow=dynamic;
   if(!groups[id])groups[id]=[];groups[id].push(o);
   const create=source=>{
    const Material=dynamic?THREE.MeshStandardMaterial:THREE.MeshBasicMaterial;
    const m=new Material({map:baseMaps[id]||source.map,color:baseMaps[id]?0xffffff:source.color,side:source.side,transparent:source.transparent,opacity:source.opacity,alphaTest:source.alphaTest,lightMap:dynamic?null:textures[assetUrl('/lightmaps/'+o.userData.lightmap.replace(/\.png$/,'.jpg'))],lightMapIntensity:4*Math.PI});
    if(dynamic){m.roughness=.85;m.metalness=0;m.normalMap=source.normalMap;m.normalScale.set(.25,.25);}
    const reveal={value:targets.current.has(id)?1:0},glow={value:0};
    m.onBeforeCompile=shader=>{
     shader.uniforms.uClayDetail={value:id==='picture'?.7:['star','phone'].includes(id)?.45:id==='cat'?.25:0};shader.uniforms.uClayLightMap={value:clayTextures[assetUrl('/lightmaps/'+o.userData.lightmap.replace(/\.png$/,'.jpg'))]};shader.uniforms.uReveal=reveal;shader.uniforms.uClay={value:cream};shader.uniforms.uFocus=glow;
     shader.fragmentShader='uniform sampler2D uClayLightMap; uniform float uClayDetail; uniform float uReveal; uniform vec3 uClay; uniform float uFocus;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat detailValue=sqrt(clamp(dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722)),0.0,1.0)); vec3 claySurface=uClay*mix(1.0,mix(0.78,1.02,detailValue),uClayDetail); diffuseColor.rgb=mix(claySurface,diffuseColor.rgb,uReveal);');
     shader.fragmentShader=shader.fragmentShader.replace('vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );','vec4 lightMapTexel = mix(texture2D(uClayLightMap, vLightMapUv), texture2D(lightMap, vLightMapUv), uReveal);');
     shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight = max(vec3(0.0), (outgoingLight - vec3(0.18)) * 1.10 + vec3(0.18)); outgoingLight += vec3(0.22,0.12,0.025)*uFocus;\n#include <opaque_fragment>');
     if(id==='star')shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
// Photoshop Selective Color: Yellows, Relative, C=-44 M=-42 Y=80 K=52.
// Apply to display RGB, matching the rendered screenshot reference.
vec3 psRGB=gl_FragColor.rgb;
float psMin=min(psRGB.r,min(psRGB.g,psRGB.b));
float psMax=max(psRGB.r,max(psRGB.g,psRGB.b));
float psMid=psRGB.r+psRGB.g+psRGB.b-psMin-psMax;
float psScale=psRGB.b<=psMin ? psMid-psMin : 0.0;
vec3 psCMY=vec3(-0.44,-0.42,0.80);
vec3 psDelta=((-vec3(1.0)-psCMY)*0.52-psCMY)*(vec3(1.0)-psRGB);
psDelta=clamp(psDelta,-psRGB,vec3(1.0)-psRGB);
gl_FragColor.rgb=clamp(psRGB+psDelta*psScale*uReveal,0.0,1.0);
`);
     // Append after star's selective-color block, so every mesh shares the same order.
     shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',sceneColorGradeGLSL+'\n#include <fog_fragment>');
    };m.customProgramCacheKey=()=> 'baked-collectible-clay-v5-'+id;materials.push({id,m,reveal,glow});return m;
   };
   o.material=Array.isArray(o.material)?o.material.map(create):create(o.material);
  });
  const anchors={};
  for(const [id,objects]of Object.entries(groups)){
   let chosen=objects;
   if(id==='succulent')chosen=objects.filter(o=>o.name.includes('GROUND'));
   if(id==='drink')chosen=objects.filter(o=>!o.name.startsWith('Right_'));
   if(id==='wall')chosen=objects.filter(o=>!o.name.startsWith('Platform_'));
   const box=new THREE.Box3();chosen.forEach(o=>box.expandByObject(o));anchors[id]=box.getCenter(new THREE.Vector3());
   // Put feedback on visible surfaces rather than behind the star/chair.
   if(id==='wall')anchors[id].y=box.max.y-.25;
   if(id==='rug'){anchors[id].z=box.max.z-.16;anchors[id].y=box.max.y+.02;}
   if(id==='lamp')anchors[id].y=box.max.y-.28;
   if(id==='chair'){anchors[id].y=box.min.y+.55;anchors[id].z=box.max.z-.22;}
  }
  const pivots={};
  for(const [id,item]of Object.entries(config.collectibles)){
   const pivot=root.getObjectByName(item.root);
   if(!pivot)throw new Error('Missing collectible root: '+item.root);
   pivots[id]={pivot,base:pivot.position.clone()};
  }
  const player=new SceneAnimationPlayer(root,animations,config);
  return{root,materials,anchors,pivots,player};
 },[scene,animations,config,files,lightmaps,clayMaps,overrides,overrideTextures]);
 useEffect(()=>{data.player.setActive(active);invalidate()},[active,data,invalidate]);
 useEffect(()=>{
  const aspect=size.width/size.height,height=Math.max(config.camera.minFrameHeight,config.camera.frameWidth/aspect);
  camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.near=.1;camera.far=100;camera.updateProjectionMatrix();invalidate();
 },[camera,size,invalidate]);
 useEffect(()=>{
  // Flush remaining orbit momentum before restoring the camera.
  if(controls.current){controls.current.enableDamping=false;controls.current.update();}
  camera.position.fromArray(config.camera.position);camera.lookAt(...config.camera.target);
  if(controls.current){controls.current.target.fromArray(config.camera.target);controls.current.update();controls.current.enableDamping=true;}
  invalidate();
 },[camera,viewReset,invalidate]);
 useEffect(()=>{invalidate()},[active,focus,invalidate]);
 function rootPoint(v,p){data.root.worldToLocal(v);v.sub(p.base).multiply(p.pivot.scale).add(p.pivot.position);data.root.localToWorld(v);}
 useEffect(()=>{
  apiRef.current={bounce(id){data.player.activate(id);invalidate();},resetMotion(){data.player.reset();invalidate();},project(id){const v=data.anchors[id]?.clone();if(!v)return null;const p=data.pivots[id];if(p){rootPoint(v,p)}v.project(camera);const r=gl.domElement.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2}}};
  window.__roomSource=scene;window.__roomDisplay=data.root;window.__THREE=THREE;
  onReady(true);invalidate();
  return()=>{apiRef.current=null;data.player.dispose();data.materials.forEach(x=>x.m.dispose())};
 },[apiRef,data,scene,gl,camera,onReady,invalidate]);
 useFrame((_,delta)=>{
  let complete=true;
  const animating=data.player.update(Math.min(delta,.05));
  for(const e of data.materials){const t=targets.current.has(e.id)?1:0,g=focused.current===e.id?1:0;e.reveal.value=THREE.MathUtils.damp(e.reveal.value,t,5,Math.min(delta,.05));e.glow.value=THREE.MathUtils.damp(e.glow.value,g,8,Math.min(delta,.05));if(Math.abs(e.reveal.value-t)>.008||Math.abs(e.glow.value-g)>.008)complete=false;}
  if(!complete||animating)invalidate();
  window.__roomState={ready:true,colorGrade:sceneColorGrade,bouncing:[...data.player.activating.keys()],lastBounce:data.player.lastActivation,clips:animations.map(a=>a.name),idle:[...data.player.active].filter(id=>config.collectibles[id]?.idle&&!data.player.activating.has(id)),active:[...targets.current],focus:focused.current,transitionComplete:complete,meshCount:data.materials.length,lighting:'Baked scenery + dynamic animated props',camera:camera.position.toArray(),anchors:Object.fromEntries(Object.keys(data.anchors).map(id=>[id,apiRef.current?.project(id)]))};
 });
 return <><primitive object={data.root}/><OrbitControls ref={controls} makeDefault enabled={!dragging} target={config.camera.target} enablePan={false} enableZoom={false} minPolarAngle={.95} maxPolarAngle={1.45} rotateSpeed={.65} enableDamping dampingFactor={.12}/>{focus&&data.anchors[focus]&&<Html position={data.anchors[focus]} center style={{pointerEvents:'none'}}><div className="model-target"><i/><span>✦</span></div></Html>}</>;
}
class Boundary extends Component{state={failed:false};static getDerivedStateFromError(){return{failed:true}}render(){return this.state.failed?<div className="load-error">小屋加载失败<button onClick={()=>location.reload()}>重新加载</button></div>:this.props.children}}
export default function Room(props){return <Boundary><Canvas shadows frameloop="demand" orthographic dpr={[1,1.75]} camera={{manual:true,position:[1.05,6,12]}} gl={{alpha:true,antialias:true,preserveDrawingBuffer:true}} onCreated={({gl})=>{gl.toneMapping=THREE.AgXToneMapping;gl.toneMappingExposure=1.35;}}><Suspense fallback={<Html center><div className="loading"><span/>正在布置你的小屋…</div></Html>}><ambientLight intensity={1.05}/><hemisphereLight args={['#fff6e7','#b29a82',1.2]}/><directionalLight position={[-3,7,5]} intensity={3.0} color="#fff1db" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={7} shadow-camera-bottom={-3} shadow-normalBias={.025}/><directionalLight position={[4,4,2]} intensity={.6} color="#ffe4c9"/><SoftShadows size={18} samples={8}/><Model {...props}/></Suspense></Canvas></Boundary>}
