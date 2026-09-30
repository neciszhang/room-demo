import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {assetUrl} from './assetUrl';
import {SceneDemo} from './scene-runtime/SceneDemo';
import './style.css';

function currentRoute() {
  if (location.hash.startsWith('#/')) return location.hash.slice(1).replace(/\/$/, '') || '/';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = base && location.pathname.startsWith(base + '/') ? location.pathname.slice(base.length) : location.pathname;
  return path.replace(/\/$/, '') || '/';
}
function App() {
  const [route, setRoute] = useState(currentRoute);
  const [scenes, setScenes] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener('hashchange', update); window.addEventListener('popstate', update);
    const abort = new AbortController();
    fetch(assetUrl('scenes.json'), {signal: abort.signal})
      .then(response => {if (!response.ok) throw new Error('场景列表加载失败'); return response.json();})
      .then(setScenes).catch(error => {if (error.name !== 'AbortError') setError(error);});
    return () => {abort.abort(); window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update);};
  }, []);
  if (error) return <main className="page"><div className="load-error" role="alert">{error.message}</div></main>;
  if (!scenes) return <main className="page"><div className="load-error">正在打开场景…</div></main>;
  const scene = scenes.find(scene => scene.route === route);
  if (!scene) return <main className="page"><div className="load-error">场景不存在 <a href={assetUrl('#/')}>返回首页</a></div></main>;
  return <SceneDemo key={scene.id} manifestUrl={assetUrl(scene.manifest)} scenes={scenes}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
