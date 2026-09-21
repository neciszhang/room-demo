import * as THREE from 'three';

// Scene-specific motion stays in GLB. This player only manages lifecycle and blending.
export class SceneAnimationPlayer {
  constructor(root, clips, config) {
    this.mixer = new THREE.AnimationMixer(root);
    this.config = config.collectibles;
    this.actions = new Map(clips.map(clip => [clip.name, this.mixer.clipAction(clip)]));
    this.active = new Set();
    this.activating = new Map();
    this.fading = new Map();
    this.time = 0;
    this.lastActivation = null;
    for (const [id, item] of Object.entries(this.config)) {
      for (const name of [item.activate, item.idle].filter(Boolean)) {
        if (!this.actions.has(name)) throw new Error(`Missing animation ${name} for ${id}`);
      }
    }
    this.onFinished = ({ action }) => {
      for (const [id, playing] of this.activating) {
        if (action !== playing) continue;
        action.stop();
        this.activating.delete(id);
        if (this.active.has(id)) this.startIdle(id);
      }
    };
    this.mixer.addEventListener('finished', this.onFinished);
  }
  startIdle(id) {
    const action = this.actions.get(this.config[id]?.idle);
    if (!action) return;
    this.fading.delete(id);
    action.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1);
    action.time = this.time % action.getClip().duration;
    action.fadeIn(.25).play();
  }
  setActive(ids) {
    const next = new Set(ids);
    for (const id of this.active) {
      if (next.has(id)) continue;
      this.activating.get(id)?.stop();
      this.activating.delete(id);
      const idle = this.actions.get(this.config[id]?.idle);
      if (idle?.isRunning()) { idle.fadeOut(.25); this.fading.set(id, .25); }
    }
    for (const id of next) {
      if (!this.active.has(id) && !this.activating.has(id)) this.startIdle(id);
    }
    this.active = next;
  }
  activate(id) {
    const action = this.actions.get(this.config[id]?.activate);
    if (!action) return;
    this.lastActivation = id;
    this.actions.get(this.config[id]?.idle)?.stop();
    this.fading.delete(id);
    action.stop();
    action.reset().setEffectiveWeight(1).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    this.activating.set(id, action);
  }
  reset() {
    this.mixer.stopAllAction();
    this.active.clear(); this.activating.clear(); this.fading.clear();
    this.mixer.update(0);
  }
  update(delta) {
    this.time += delta;
    this.mixer.update(delta);
    for (const [id, remaining] of this.fading) {
      if (remaining <= delta) { this.actions.get(this.config[id]?.idle)?.stop(); this.fading.delete(id); }
      else this.fading.set(id, remaining - delta);
    }
    return this.activating.size > 0 || this.fading.size > 0 || [...this.active].some(id => this.config[id]?.idle);
  }
  dispose() { this.mixer.removeEventListener('finished', this.onFinished); this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.mixer.getRoot()); }
}
