import {assetUrl} from './assetUrl';
import React,{useState,useRef,useEffect,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import Room from './Room';
import {items,storageKey} from './items';
import './style.css';
const filled=()=>Object.fromEntries(items.map(i=>[i.id,1]));
function initial(){try{const raw=JSON.parse(localStorage.getItem(storageKey)||'null');return {counts:Object.fromEntries(items.map(i=>[i.id,Number.isInteger(raw?.counts?.[i.id])&&raw.counts[i.id]>=0?Math.min(raw.counts[i.id],999):1])),activated:items.filter(i=>raw?.activated?.includes(i.id)).map(i=>i.id)};}catch{return {counts:filled(),activated:[]}}}
function App(){
 const [saved]=useState(initial);
 const [counts,setCounts]=useState(saved.counts),[active,setActive]=useState(saved.activated),[ready,setReady]=useState(false),[toast,setToast]=useState(''),[drag,setDrag]=useState(null),[flight,setFlight]=useState(null),[over,setOver]=useState(false),[menu,setMenu]=useState(false),[focus,setFocus]=useState(null),[viewReset,setViewReset]=useState(0);
 const zone=useRef(),scrollTimer=useRef(),api=useRef(),gesture=useRef(),lastDrag=useRef(0),timer=useRef(),flightTimer=useRef(),focusTimer=useRef(),flightLock=useRef(false);
 const exhausted=items.every(i=>counts[i.id]===0);
 const notify=useCallback(t=>{setToast(t);clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),2200)},[]);
 useEffect(()=>()=>{clearTimeout(timer.current);clearTimeout(flightTimer.current);clearTimeout(focusTimer.current);clearTimeout(scrollTimer.current)},[]);
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify({counts,activated:active}))}catch{}},[counts,active]);
 function highlight(id){clearTimeout(focusTimer.current);setFocus(id)}
 function snap(id,start,scrolled=false){
  if(!ready||counts[id]<=0||(flightLock.current&&!scrolled))return;
  const zoneRect=zone.current.getBoundingClientRect();
  if(!scrolled&&zoneRect.top<0){flightLock.current=true;zone.current.scrollIntoView({behavior:'smooth',block:'start'});scrollTimer.current=setTimeout(()=>snap(id,{x:Math.max(40,Math.min(innerWidth-40,start.x)),y:Math.min(innerHeight-80,start.y)},true),420);return;}
  const target=api.current?.project(id);if(!target)return;
  flightLock.current=true;highlight(id);setFlight({id,start,target,arrived:false});
  requestAnimationFrame(()=>requestAnimationFrame(()=>setFlight(f=>f?{...f,arrived:true}:null)));
  flightTimer.current=setTimeout(()=>{
   setCounts(v=>({...v,[id]:Math.max(0,v[id]-1)}));setActive(v=>v.includes(id)?v:[...v,id]);api.current?.bounce(id);setFlight(null);flightLock.current=false;
   notify(`已使用 1 个 · ${items.find(i=>i.id===id).name}`);
   focusTimer.current=setTimeout(()=>setFocus(null),1800);
  },540);
 }
 function inZone(x,y){const r=zone.current.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top+42&&y<=r.bottom-28}
 function down(e,item){if(!ready||counts[item.id]<=0||flightLock.current)return;e.currentTarget.setPointerCapture(e.pointerId);gesture.current={id:item.id,x:e.clientX,y:e.clientY,moved:false}}
 function move(e){const g=gesture.current;if(!g)return;if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>8)g.moved=true;if(!g.moved)return;setDrag({id:g.id,x:e.clientX,y:e.clientY});const isOver=inZone(e.clientX,e.clientY);setOver(isOver);highlight(isOver?g.id:null)}
 useEffect(()=>{if(!drag)return;let raf;const scroll=()=>{const amount=drag.y<95?-10:drag.y>innerHeight-55?8:0;if(amount){window.scrollBy(0,amount);setOver(inZone(drag.x,drag.y))}raf=requestAnimationFrame(scroll)};raf=requestAnimationFrame(scroll);return()=>cancelAnimationFrame(raf)},[drag]);
 function clearDrag(){gesture.current=null;setDrag(null);setOver(false)}
 function end(e){const g=gesture.current;if(!g)return;if(g.moved){lastDrag.current=Date.now();if(inZone(e.clientX,e.clientY))snap(g.id,{x:e.clientX,y:e.clientY});else{setFocus(null);notify('拖入小屋后松手，卡片会自动飞向对应位置')}}clearDrag()}
 function reset(){clearTimeout(scrollTimer.current);clearTimeout(flightTimer.current);clearTimeout(focusTimer.current);flightLock.current=false;setFlight(null);clearDrag();setFocus(null);api.current?.resetMotion();setCounts(filled());setActive([]);setMenu(false);notify('每张图册已恢复为 1 个')}
 function consume(){const next=items.find(i=>counts[i.id]>0);if(!next)return;const r=zone.current.getBoundingClientRect();snap(next.id,{x:r.left+r.width/2,y:r.bottom+100})}
 return <main className="page">
  <header><button className="back" aria-label="还原模型视角" onClick={()=>setViewReset(v=>v+1)}>‹</button><div className="badge"><span>18<small>元免单</small></span><div><b>集齐得免单</b><small>进度：<strong data-testid="progress">{active.length}/{items.length}</strong></small></div></div><button className="more" aria-label="更多操作" aria-expanded={menu} onClick={()=>setMenu(!menu)}>更多</button>{menu&&<div className="menu"><button onClick={reset}>恢复每张 1 个</button><button onClick={()=>{setCounts(Object.fromEntries(items.map(i=>[i.id,['picture','cat','drink'].includes(i.id)?9:1])));setActive(items.map(i=>i.id));setMenu(false)}}>演示全部集齐</button><button onClick={()=>{setViewReset(v=>v+1);setMenu(false)}}>还原模型视角</button></div>}</header>
  <section className="hero" ref={zone} aria-label="模型点亮区域" data-ready={ready} data-drop-active={over}>
   <div className="room"><Room active={active} onReady={setReady} apiRef={api} focus={focus} dragging={!!drag||!!flight} viewReset={viewReset}/></div>
   {over&&<div className="drop-label">松手吸附 · {items.find(i=>i.id===drag?.id)?.name}</div>}
  </section>
  <section className="collection" aria-label="收集的图册"><div className="cards">{items.map(item=>{const count=counts[item.id],lit=count>0;return <button key={item.id} className={`card ${lit?'lit':'empty'} ${drag?.id===item.id?'dragging':''}`} data-item={item.id} data-count={count} aria-label={`${item.name}，数量${count}`} aria-pressed={lit} disabled={!ready||!!flight||count===0} title={item.name} onPointerDown={e=>down(e,item)} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{clearDrag();setFocus(null)}} onClick={e=>{if(Date.now()-lastDrag.current>350){const r=e.currentTarget.getBoundingClientRect();snap(item.id,{x:r.x+r.width/2,y:r.y+r.height/2})}}}><span className="card-state">×{count}</span><img src={assetUrl(`/thumbnails/${item.id}.png`)} alt={item.name} draggable="false"/></button>})}</div></section>
  <footer><button className="reset" onClick={reset} disabled={!ready||!!flight}>重置数量</button><button className="primary" onClick={consume} disabled={!ready||exhausted||!!flight}>{exhausted?'已全部用完':'使用一张图册'}</button><small>使用图册点亮模型，图册用完后置灰</small></footer>
  <div className={`toast ${toast?'visible':''}`} role="status">{toast}</div>
  {drag&&<div className="drag-preview" style={{left:drag.x,top:drag.y}}><img src={assetUrl(`/thumbnails/${drag.id}.png`)} alt=""/></div>}
  {flight&&<div className={`snap-flight ${flight.arrived?'arrived':''}`} data-testid="snap-flight" data-target={flight.id} style={{left:flight.arrived?flight.target.x:flight.start.x,top:flight.arrived?flight.target.y:flight.start.y}}><img src={assetUrl(`/thumbnails/${flight.id}.png`)} alt=""/></div>}
 </main>
}
createRoot(document.getElementById('root')).render(<App/>);
