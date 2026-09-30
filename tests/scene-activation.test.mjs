import assert from 'node:assert/strict';
import {Group, AnimationClip, NumberKeyframeTrack} from 'three';
import {createActivationController} from '../src/scene-runtime/activation.js';
const root=new Group();
const assets=['asset_001','asset_002'].map(id=>{
  const group=new Group();group.name=id;const motion=new Group();motion.name=id+'__motion';group.add(motion);root.add(group);
  return {id,animations:{activate:id+'__activate',idle:id+'__idle',deactivate:id+'__deactivate'}};
});
const clips=assets.flatMap(a=>[
  new AnimationClip(a.animations.activate,1,[new NumberKeyframeTrack(a.id+'__motion.position[y]',[0,1],[0,1])]),
  new AnimationClip(a.animations.idle,2,[new NumberKeyframeTrack(a.id+'__motion.position[y]',[0,1,2],[1,1.2,1])]),
  new AnimationClip(a.animations.deactivate,1,[new NumberKeyframeTrack(a.id+'__motion.position[y]',[0,1],[1,0])]),
]);
const motion=id=>root.getObjectByName(id+'__motion');
const controller=createActivationController(root,clips,assets);
controller.setActive(['asset_001']);controller.update(.4);
assert(Math.abs(motion('asset_001').position.y-.4)<1e-5);
assert.equal(motion('asset_002').position.y,0);
controller.setActive(['asset_001']);controller.update(.2);
assert(Math.abs(motion('asset_001').position.y-.6)<1e-5,'same selection must not restart');
controller.update(.5);assert.equal(controller.snapshot().asset_001,'idle');
controller.setActive(['asset_001','asset_002']);controller.update(.3);
controller.setActive(['asset_001']);controller.update(1.1);
assert.equal(controller.snapshot().asset_001,'idle');assert.equal(controller.snapshot().asset_002,'inactive');
assert.equal(motion('asset_002').position.y,0);
controller.setActive([]);controller.update(1.1);assert.equal(motion('asset_001').position.y,0);
controller.setActive(['asset_001']);controller.update(.1);controller.setActive([]);controller.update(.1);controller.setActive(['asset_001']);controller.update(1.1);
assert.equal(controller.snapshot().asset_001,'idle','stale deactivation must not cancel new activation');
controller.dispose();assert.equal(motion('asset_001').position.y,0);
const noClips=createActivationController(root,[],[{id:'asset_001',animations:{activate:null,idle:null,deactivate:null}}]);
noClips.setActive(['asset_001']);assert.equal(noClips.update(.1),false);noClips.setActive([]);assert.equal(noClips.snapshot().asset_001,'inactive');noClips.dispose();
assert.throws(()=>createActivationController(root,[],assets),/Missing animation/);
console.log('PASS: independent clips, activate→idle, repeat activation, deactivation/rest pose, rapid toggles, null clips, missing clip failure');
// Legacy feedback clips return to rest, while ordinary clips hold their endpoint.
const legacy=createActivationController(root,clips,[{...assets[0],activationEnd:'rest',animations:{...assets[0].animations,idle:null}}]);
legacy.setActive(['asset_001']);legacy.update(1.1);assert.equal(legacy.snapshot().asset_001,'active');assert.equal(motion('asset_001').position.y,0);
legacy.reset();assert.equal(legacy.snapshot().asset_001,'inactive');legacy.dispose();
const held=createActivationController(root,clips,[{...assets[0],animations:{...assets[0].animations,idle:null}}]);
held.setActive(['asset_001']);held.update(1.1);assert.equal(motion('asset_001').position.y,1);held.reset();assert.equal(motion('asset_001').position.y,0);held.dispose();
console.log('PASS: legacy feedback returns to rest; default activation holds; reset restores pose');
