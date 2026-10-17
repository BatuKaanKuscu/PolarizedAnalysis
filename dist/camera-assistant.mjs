// Only control the device. Never brighten or recolor individual measurement areas.
export function exposurePlan(frame,range,current){
 if(!range||![range.min,range.max,current].every(Number.isFinite)||range.max<=range.min)return null;
 const a=frame.reference,b=frame.sample;
 if(Math.min(a.brightness,b.brightness)<40&&Math.max(a.clipped,b.clipped)>.08)return null;
 if(Math.min(a.brightness,b.brightness)<40&&Math.max(a.brightness,b.brightness)>210)return null;
 const direction=Math.min(a.brightness,b.brightness)<55?1:Math.max(a.brightness,b.brightness)>220||Math.max(a.clipped,b.clipped)>.08?-1:0;
 if(!direction)return null;
 const step=range.step>0?range.step:1/3;
 const value=Math.max(range.min,Math.min(range.max,range.min+Math.round((current+direction*Math.max(step,1/3)-range.min)/step)*step));
 return Math.abs(value-current)<1e-6?null:Number(value.toFixed(6));
}
export class CameraAssistant{
 constructor(track){this.track=track;this.active=true;this.pending=Promise.resolve();this.desired={};this.original=track.getConstraints?.()||{};this.capabilities=track.getCapabilities?.()||{};this.initial=this.snapshot();this.log=[];}
 settings(){return this.track.getSettings?.()||{};}
 snapshot(){const s=this.settings();return Object.fromEntries(['exposureMode','exposureCompensation','focusMode','whiteBalanceMode','torch','width','height','frameRate'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));}
 set(key,value){
  const task=this.pending.then(async()=>{
   if(!this.active)return {ok:false,reason:'cancelled'};
   const previous={...this.desired},next={...previous,[key]:value};
   try{await this.track.applyConstraints({...this.original,advanced:[...(this.original.advanced||[]),next]});}catch{return {ok:false,reason:'rejected'};}
   if(!this.active)return {ok:false,reason:'cancelled'};
   const actual=this.settings()[key],ok=typeof value==='number'?typeof actual==='number'&&Math.abs(actual-value)<=Math.max(.01,(this.capabilities[key]?.step||0)/2):actual===value;
   // Retain accepted constraints even when the browser cannot verify readback.
   this.desired=next;this.log.push({key,requested:value,actual:actual??null,verified:ok});this.log=this.log.slice(-100);
   return {ok,reason:ok?'verified':'unverified',actual};
  });this.pending=task.catch(()=>{});return task;
 }
 async configure(){const results=[];for(const key of ['exposureMode','focusMode','whiteBalanceMode'])if(this.capabilities[key]?.includes('continuous'))results.push({key,...await this.set(key,'continuous')});return results;}
 async adjust(frame,{allowTorch=false}={}){
  if(!this.active)return {ok:false,reason:'cancelled'};
  const settings=this.settings(),caps=this.capabilities;
  if(Math.max(frame.reference.clipped,frame.sample.clipped)>.08&&settings.torch===true)return {key:'torch',...await this.set('torch',false)};
  if(allowTorch&&Math.max(frame.reference.clipped,frame.sample.clipped)<.02&&Math.max(frame.reference.brightness,frame.sample.brightness)<40&&caps.torch===true&&settings.torch===false)return {key:'torch',...await this.set('torch',true)};
  const plan=exposurePlan(frame,caps.exposureCompensation,settings.exposureCompensation);
  if(plan===null)return {ok:false,reason:'no-adjustment'};
  if(caps.exposureMode&&!['continuous','single-shot'].includes(settings.exposureMode))return {ok:false,reason:'mode'};
  return {key:'exposureCompensation',...await this.set('exposureCompensation',plan)};
 }
 async reset(){await this.pending;if(!this.active)return;const restore=Object.fromEntries(['exposureMode','exposureCompensation','focusMode','whiteBalanceMode','torch'].filter(k=>this.capabilities[k]!==undefined&&this.initial[k]!==undefined).map(k=>[k,this.initial[k]]));await this.track.applyConstraints({...this.original,advanced:[...(this.original.advanced||[]),restore]});this.desired=restore;this.log=[];}
 dispose(){this.active=false;}
}
