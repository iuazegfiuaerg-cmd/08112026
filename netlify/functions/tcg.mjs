import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
const err=(status,message)=>{throw Object.assign(new Error(message),{status})};
export async function handler(event){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const json=(statusCode,data)=>({statusCode,headers,body:JSON.stringify(data)});
 const h=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 try{
  const origin=process.env.SUPABASE_URL?.replace(/\/$/,''),secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!origin||!secret)err(503,'La connexion Supabase reste à configurer dans Netlify.');
  async function request(route,options={}){let response;try{response=await fetch(origin+route,{...options,headers:{apikey:secret,Authorization:'Bearer '+secret,...options.headers}})}catch{err(503,'La base est indisponible. Vérifie que ton projet Supabase n’est pas en pause.')}if(!response.ok){const detail=await response.text();const match=detail.match(/(400|401|403|404|409|429)\|([^"\\]*)/);if(match)err(Number(match[1]),match[2]);err(503,'La base ou le stockage ne répond pas. Vérifie l’installation Supabase et les réglages Netlify.')}return response}
  const rest=async(route,method='GET',body)=>{const r=await request('/rest/v1/'+route,{method,headers:{'Content-Type':'application/json',...(method==='POST'?{Prefer:'return=representation,resolution=ignore-duplicates'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return r.status===204?null:r.json()};
  const rpc=(action,body={},token=session)=>rest('rpc/tcg_action','POST',{a_token:token||'',a_action:action,a_body:body});
  const rawPath=new URL(event.rawUrl||'https://site.invalid'+event.path).pathname;
  let route=(event.path||rawPath).replace(/^\/\.netlify\/functions\/tcg\/?/,'').replace(/^\/api\/?/,'');
  const photo=rawPath.startsWith('/photos/')?rawPath.slice(8):route.startsWith('photo/')?route.slice(6):null;
  const session=h.cookie?.match(/(?:^|; )session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(event.httpMethod==='POST'&&h.origin){const expected=new URL(event.rawUrl||'https://'+h.host+rawPath).origin;if(h.origin!==expected)err(403,'Origine non autorisée.');}
  // Les secrets ne sont lus que dans cette fonction, jamais dans les fichiers publics.
  const users=await rest('tcg_users?select=name&limit=2');
  if(!users.length){const a=process.env.INIT_ANAS_PASSWORD,m=process.env.INIT_MYRIAM_PASSWORD;if(!a||!m||[a,m].some(p=>p.length<10||p.length>128))err(503,'Configure les deux mots de passe initiaux dans Netlify (10 caractères minimum).');await rest('tcg_users?on_conflict=name','POST',[['Anas',a],['Myriam',m]].map(([name,p])=>{const salt=randomBytes(16).toString('hex');return {name,salt,hash:scryptSync(p,salt,64).toString('hex')}}));}
  if(photo!==null){if(!/^[a-f0-9]{32}\.(jpeg|png|webp)$/.test(photo))err(404,'Photo introuvable.');await rpc('check');const r=await request('/storage/v1/object/authenticated/tcg-photos/'+photo);const bytes=Buffer.from(await r.arrayBuffer());return {statusCode:200,headers:{...headers,'Content-Type':r.headers.get('content-type')||'image/jpeg'},isBase64Encoded:true,body:bytes.toString('base64')}}
  if(route==='state'&&event.httpMethod==='GET'){if(!session)return json(200,{login:true});try{return json(200,await rpc('state'))}catch(e){if(e.status===401)return json(200,{login:true});throw e}}
  if(event.httpMethod!=='POST')err(405,'Méthode non autorisée.');
  const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString('utf8'):event.body||'{}';if(Buffer.byteLength(raw)>3*1024*1024)err(413,'Choisis une photo plus légère (2 Mo maximum).');let b;try{b=JSON.parse(raw)}catch{err(400,'Requête incorrecte.')}
  if(route==='login'){
   const ip=h['x-nf-client-connection-ip']||h['client-ip']||'global';const guard=createHash('sha256').update(ip).digest('hex');
   if(!await rest('rpc/tcg_login_guard','POST',{a_key:guard}))err(429,'Trop de tentatives. Réessaie dans 10 minutes.');
   const name=typeof b.name==='string'?b.name:'',password=typeof b.password==='string'&&b.password.length<=128?b.password:'';
   const rows=await rest('tcg_users?select=name,salt,hash&name=eq.'+encodeURIComponent(name));const u=rows[0];const hash=scryptSync(password,u?.salt||'dummy',64);if(!u||!timingSafeEqual(hash,Buffer.from(u.hash,'hex')))err(401,'Prénom ou mot de passe incorrect.');
   const token=randomBytes(32).toString('hex');await rest('tcg_sessions','POST',{token,name:u.name,expires:new Date(Date.now()+7*86400000).toISOString()});await rest('tcg_login_attempts?key=eq.'+guard,'DELETE');
   headers['Set-Cookie']=`session=${token}; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=604800`;return json(200,await rpc('state',{},token));
  }
  if(!session)err(401,'Connecte-toi pour continuer.');
  if(route==='logout'){const result=await rpc('logout');headers['Set-Cookie']='session=; HttpOnly; SameSite=Strict; Secure; Path=/; Max-Age=0';return json(200,result)}
  if(route==='cards'){
   await rpc('check');if(typeof b.title!=='string'||!b.title.trim()||b.title.length>60||typeof b.caption!=='string'||!b.caption.trim()||b.caption.length>200||!Number.isInteger(Number(b.rarity))||Number(b.rarity)<0||Number(b.rarity)>4)err(400,'Vérifie le titre, le souvenir et la rareté.');
   const match=typeof b.photo==='string'&&b.photo.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)err(400,'Choisis une photo JPEG, PNG ou WebP.');const bytes=Buffer.from(match[2],'base64');if(bytes.length>2*1024*1024)err(413,'Photo trop lourde (2 Mo maximum).');const valid=match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216:match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!valid)err(400,'Photo invalide.');
   const file=randomBytes(16).toString('hex')+'.'+match[1];await request('/storage/v1/object/tcg-photos/'+file,{method:'POST',headers:{'Content-Type':'image/'+match[1],'x-upsert':'false'},body:bytes});
   try{return json(200,await rpc('cards',{...b,photo:file,rarity:Number(b.rarity)}))}catch(e){await request('/storage/v1/object/tcg-photos',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[file]})}).catch(()=>{});throw e}
  }
  if(route==='message'&&typeof b.body==='string')b.normalized=b.body.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ');
  if(!['open','message','trade','trade-action'].includes(route))err(404,'Action inconnue.');
  return json(200,await rpc(route,b));
 }catch(e){return json(e.status||500,{error:e.status?e.message:'Une erreur est survenue. Réessaie dans un instant.'})}
}
