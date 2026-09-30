import {AnimationMixer, LoopOnce, LoopRepeat} from 'three';

/** Independent activation state machines. Clip names come only from the manifest. */
export function createActivationController(root, clips, assets) {
  const mixer = new AnimationMixer(root);
  const byName = new Map(clips.map(clip => [clip.name, clip]));
  const states = new Map(assets.map(asset => [asset.id, {asset, active: false, phase: 'inactive', action: null}]));
  for (const asset of assets) {
    for (const name of Object.values(asset.animations)) {
      if (name !== null && !byName.has(name)) throw new Error(`Missing animation clip: ${name}`);
    }
  }
  function play(state, phase) {
    state.action?.stop();
    state.action = null;
    state.phase = phase;
    const name = state.asset.animations[phase];
    if (!name) {
      if (phase === 'activate') play(state, 'idle');
      else state.phase = state.active ? 'active' : 'inactive';
      return;
    }
    const action = mixer.clipAction(byName.get(name));
    action.reset().setLoop(phase === 'idle' ? LoopRepeat : LoopOnce, phase === 'idle' ? Infinity : 1);
    action.clampWhenFinished = true;
    action.enabled = true;
    state.action = action;
    action.play();
  }
  const finished = ({action}) => {
    for (const state of states.values()) {
      if (state.action !== action) continue;
      if (state.active && state.phase === 'activate') {
        if (state.asset.animations.idle) play(state, 'idle');
        else {
          if (state.asset.activationEnd === 'rest') {action.stop(); state.action = null;}
          state.phase = 'active';
        }
      } else if (!state.active && state.phase === 'deactivate') {
        action.stop(); state.action = null; state.phase = 'inactive';
      }
    }
  };
  mixer.addEventListener('finished', finished);
  return {
    setActive(ids) {
      const selected = new Set(ids);
      for (const state of states.values()) {
        const active = selected.has(state.asset.id);
        if (active === state.active) continue;
        state.active = active;
        play(state, active ? 'activate' : 'deactivate');
      }
    },
    reset() {
      mixer.stopAllAction();
      for (const state of states.values()) {state.active = false; state.phase = 'inactive'; state.action = null;}
      mixer.update(0);
    },
    update(delta) {mixer.update(delta); return [...states.values()].some(state => state.action?.isRunning());},
    snapshot() {return Object.fromEntries([...states].map(([id, state]) => [id, state.phase]));},
    dispose() {mixer.removeEventListener('finished', finished); mixer.stopAllAction(); mixer.uncacheRoot(root);},
  };
}
