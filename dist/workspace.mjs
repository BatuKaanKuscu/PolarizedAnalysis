const oils=['Zeytinyağı','Ayçiçek yağı','Diğer bitkisel yağ'],scenarios=['stable','color','light','glare'];
function fields(input){const name=String(input.name||'').trim().slice(0,60);if(!name)throw new Error('Profil adı gerekli.');return {name,organization:String(input.organization||'').trim().slice(0,80),oilType:oils.includes(input.oilType)?input.oilType:oils[0],scenario:scenarios.includes(input.scenario)?input.scenario:'stable'};}
export function createWorkspace(records=[]){const profile={id:'local-default',...fields({name:'Kişisel profil'}),createdAt:new Date().toISOString()};return {version:1,profiles:[profile],activeId:profile.id,records:records.map(r=>({...r,profileId:profile.id,profileName:profile.name})).slice(0,30)};}
export function normalizeWorkspace(raw,validReport){
 if(raw?.version!==1||!Array.isArray(raw.profiles)||!raw.profiles.length)throw new Error('Profil verisi okunamadı.');
 const ids=new Set(),profiles=[];
 for(const p of raw.profiles.slice(0,12)){if(typeof p?.id!=='string'||ids.has(p.id))continue;try{profiles.push({...p,...fields(p)});ids.add(p.id);}catch{}}
 if(!profiles.length)throw new Error('Geçerli profil bulunamadı.');
 const records=[],counts=new Map();for(const r of Array.isArray(raw.records)?raw.records:[]){if(!validReport(r)||!ids.has(r.profileId))continue;const n=counts.get(r.profileId)||0;if(n>=30)continue;counts.set(r.profileId,n+1);records.push(r);}
 return {version:1,profiles,activeId:ids.has(raw.activeId)?raw.activeId:profiles[0].id,records};
}
export function addProfile(state,input,id){if(state.profiles.length>=12)throw new Error('En fazla 12 profil eklenebilir.');if(state.profiles.some(p=>p.id===id))throw new Error('Profil zaten var.');const profile={id,...fields(input),createdAt:new Date().toISOString()};return {...state,profiles:[...state.profiles,profile],activeId:id};}
export function updateProfile(state,id,input){if(!state.profiles.some(p=>p.id===id))throw new Error('Profil bulunamadı.');const next=fields(input);return {...state,profiles:state.profiles.map(p=>p.id===id?{...p,...next}:p)};}
export function removeProfile(state,id){if(state.profiles.length<=1)throw new Error('Son profil silinemez.');const profiles=state.profiles.filter(p=>p.id!==id);return {...state,profiles,activeId:state.activeId===id?profiles[0].id:state.activeId,records:state.records.filter(r=>r.profileId!==id)};}
export function withReport(state,report){if(report.demo)throw new Error('Demo raporları profile kaydedilemez.');const p=state.profiles.find(p=>p.id===state.activeId);if(report.profileId&&report.profileId!==p.id)throw new Error('Rapor başka profile ait.');if(state.records.some(r=>r.id===report.id))return state;const record={...report,profileId:p.id,profileName:report.profileName||p.name},owned=[record,...state.records.filter(r=>r.profileId===p.id)].slice(0,30);return {...state,records:[...owned,...state.records.filter(r=>r.profileId!==p.id)]};}
