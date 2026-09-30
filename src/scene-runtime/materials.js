import * as THREE from 'three';
import {colorGradeGLSL} from '../sceneColorGrade';

export function createSceneMaterial(source, asset, rendering, {activeLightmap, inactiveTexture}, reveal, glow) {
  if (rendering.profile === 'baked-unlit') {
    const m = new THREE.MeshBasicMaterial({map: source.map, color: 0xffffff, side: source.side, transparent: source.transparent, opacity: source.opacity, alphaTest: source.alphaTest, toneMapped: false});
    m.onBeforeCompile = shader => {
      shader.uniforms.uClayMap = {value: inactiveTexture};
      shader.uniforms.uReveal = reveal;
      shader.uniforms.uFocus = glow;
      shader.fragmentShader = 'uniform sampler2D uClayMap; uniform float uReveal; uniform float uFocus;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        vec4 colorTexel = texture2D(map, vMapUv);
        vec4 clayTexel = texture2D(uClayMap, vMapUv);
        diffuseColor *= mix(clayTexel, colorTexel, uReveal);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight += vec3(0.22,0.12,0.025)*uFocus;\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => 'collectible-dual-bake';
    return m;
  }
  const dynamic = asset.lighting === 'dynamic';
  const Material = dynamic ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial;
  const m = new Material({map: source.map, color: source.color, side: source.side, transparent: source.transparent, opacity: source.opacity, alphaTest: source.alphaTest, lightMap: dynamic ? null : activeLightmap, lightMapIntensity: rendering.lightMapIntensity ?? 4 * Math.PI});
  if (dynamic) {m.roughness = .85; m.metalness = 0; m.normalMap = source.normalMap; m.normalScale.set(.25, .25);}
  const cream = new THREE.Color(rendering.clayColor || '#f1e5d5');
    m.onBeforeCompile=shader=>{
     shader.uniforms.uClayDetail={value:asset.clayDetail||0};shader.uniforms.uClayLightMap={value:inactiveTexture||null};shader.uniforms.uReveal=reveal;shader.uniforms.uClay={value:cream};shader.uniforms.uFocus=glow;
     shader.fragmentShader='uniform sampler2D uClayLightMap; uniform float uClayDetail; uniform float uReveal; uniform vec3 uClay; uniform float uFocus;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat detailValue=sqrt(clamp(dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722)),0.0,1.0)); vec3 claySurface=uClay*mix(1.0,mix(0.78,1.02,detailValue),uClayDetail); diffuseColor.rgb=mix(claySurface,diffuseColor.rgb,uReveal);');
     shader.fragmentShader=shader.fragmentShader.replace('vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );','vec4 lightMapTexel = mix(texture2D(uClayLightMap, vLightMapUv), texture2D(lightMap, vLightMapUv), uReveal);');
     shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight = max(vec3(0.0), (outgoingLight - vec3(0.18)) * 1.10 + vec3(0.18)); outgoingLight += vec3(0.22,0.12,0.025)*uFocus;\n#include <opaque_fragment>');
     if(asset.selectiveColor)shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
// Optional selective-color correction supplied by the asset manifest.
// Apply to display RGB, matching the rendered screenshot reference.
vec3 psRGB=gl_FragColor.rgb;
float psMin=min(psRGB.r,min(psRGB.g,psRGB.b));
float psMax=max(psRGB.r,max(psRGB.g,psRGB.b));
float psMid=psRGB.r+psRGB.g+psRGB.b-psMin-psMax;
float psScale=psRGB.b<=psMin ? psMid-psMin : 0.0;
vec3 psCMY=vec3(${asset.selectiveColor.cmy.map(value=>Number(value).toFixed(6)).join(',')});
vec3 psDelta=((-vec3(1.0)-psCMY)*${Number(asset.selectiveColor.black).toFixed(6)}-psCMY)*(vec3(1.0)-psRGB);
psDelta=clamp(psDelta,-psRGB,vec3(1.0)-psRGB);
gl_FragColor.rgb=clamp(psRGB+psDelta*psScale*uReveal,0.0,1.0);
`);
     // Apply scene grading after optional per-asset correction.
     if(rendering.colorGrade)shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',colorGradeGLSL(rendering.colorGrade)+'\n#include <fog_fragment>');
    };m.customProgramCacheKey=()=> 'collectible-hybrid-'+asset.id;
  return m;
}
