import React, {useEffect, useState} from 'react';
import {prepareManifest} from './manifest';
import {SceneApp} from './SceneApp';

/** All scenes share this loader, page, interaction, renderer and stylesheet. */
export function SceneDemo({manifestUrl, scenes = []}) {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const abort = new AbortController();
    setLoaded(null); setError(null);
    fetch(manifestUrl, {signal: abort.signal})
      .then(response => {if (!response.ok) throw new Error(`场景清单加载失败：${response.status}`); return response.json();})
      .then(manifest => {
        const config = prepareManifest(manifest, new URL(manifestUrl, location.href).href);
        if (!abort.signal.aborted) setLoaded({url: manifestUrl, config});
      }).catch(error => {if (error.name !== 'AbortError') setError(error);});
    return () => abort.abort();
  }, [manifestUrl]);
  if (error) return <main className="page"><div className="load-error" role="alert">{error.message}</div></main>;
  if (!loaded || loaded.url !== manifestUrl) return <main className="page"><div className="load-error">正在打开场景…</div></main>;
  return <SceneApp key={manifestUrl} config={loaded.config} scenes={scenes}/>;
}
