export function dockPosition(width,height,panelWidth,panelHeight,fraction={x:.5,y:1}){
 const gap=8,maxX=Math.max(gap,width-panelWidth-gap),maxY=Math.max(gap,height-panelHeight-gap);
 return {x:gap+Math.max(0,Math.min(1,fraction.x))*(maxX-gap),y:gap+Math.max(0,Math.min(1,fraction.y))*(maxY-gap)};
}
export function floatingDock(stage,panel,handle,reset){
 let fraction={x:.5,y:1},drag=null;
 function paint(){const p=dockPosition(stage.clientWidth,stage.clientHeight,panel.offsetWidth,panel.offsetHeight,fraction);panel.style.left=p.x+'px';panel.style.top=p.y+'px';}
 function move(x,y){const w=Math.max(0,stage.clientWidth-panel.offsetWidth-16),h=Math.max(0,stage.clientHeight-panel.offsetHeight-16);fraction={x:w?Math.max(0,Math.min(1,(x-8)/w)):.5,y:h?Math.max(0,Math.min(1,(y-8)/h)):1};paint();}
 handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const s=stage.getBoundingClientRect(),p=panel.getBoundingClientRect();drag={pointer:e.pointerId,x:e.clientX-p.left,y:e.clientY-p.top};handle.setPointerCapture(e.pointerId);panel.classList.add('dragging');};
 handle.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;e.preventDefault();const s=stage.getBoundingClientRect();move(e.clientX-s.left-drag.x,e.clientY-s.top-drag.y);};
 const stop=()=>{drag=null;panel.classList.remove('dragging');};handle.onpointerup=stop;handle.onpointercancel=stop;handle.onlostpointercapture=stop;
 reset.onclick=()=>{fraction={x:.5,y:1};paint();};
 handle.onkeydown=e=>{if(e.key==='Home'){e.preventDefault();reset.click();return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const p=dockPosition(stage.clientWidth,stage.clientHeight,panel.offsetWidth,panel.offsetHeight,fraction),step=e.shiftKey?1:10;move(p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),p.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));};
 const observer=new ResizeObserver(paint);observer.observe(stage);observer.observe(panel);paint();return {refresh:paint};
}
