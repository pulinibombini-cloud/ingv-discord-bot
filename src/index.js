import {Client,GatewayIntentBits,EmbedBuilder} from "discord.js";
import http from "node:http";
const T=process.env.DISCORD_BOT_TOKEN,C=process.env.DISCORD_CHANNEL_ID,P=Number(process.env.PORT)||3000,I=10000,R="1497067020708085800",MM=2.5;
if(!T||!C){console.error("Missing env");process.exit(1);}
http.createServer((q,r)=>{r.writeHead(200);r.end("ok");}).listen(P,()=>console.log("http "+P));
const SRC=[{n:"INGV",b:"https://webservices.ingv.it/fdsnws/event/1/query"},{n:"USGS",b:"https://earthquake.usgs.gov/fdsnws/event/1/query"}];
const seen=new Set();let last=null;
const col=m=>m>=5?0xff0000:m>=4?0xff6600:m>=3?0xffaa00:m>=2?0xffee00:0x66cc66;
const emo=m=>m>=5?"🔴":m>=4?"🟠":m>=3?"🟡":m>=2?"🟢":"⚪";
async function fetchSrc(s){const p=new URLSearchParams({format:"geojson",limit:"30",orderby:"time"});if(last)p.set("starttime",new Date(last.getTime()+1000).toISOString());try{const r=await fetch(s.b+"?"+p,{headers:{"User-Agent":"ingv-bot/1.0"}});if(r.status===204||!r.ok)return[];return((await r.json()).features||[]).map(f=>({...f,src:s.n}));}catch(e){console.error(s.n,e);return[];}}
async function fetchAll(){const r=await Promise.all(SRC.map(fetchSrc));return r.flat();}
function key(f){const[lo,la]=f.geometry.coordinates;return Math.floor(new Date(f.properties.time).getTime()/60000)+":"+la.toFixed(1)+":"+lo.toFixed(1);}
function embed(f){const p=f.properties,[lo,la,d]=f.geometry.coordinates,m=p.mag||0,mt=p.magType||"M",pl=p.place||p.flynn_region||"?",t=new Date(p.time),u=Math.floor(t/1000),id=String(p.eventId||p.code||f.id),url=f.src==="INGV"?`https://terremoti.ingv.it/event/${id}`:p.url||`https://earthquake.usgs.gov/earthquakes/eventpage/${id}`;return new EmbedBuilder().setColor(col(m)).setTitle(`${emo(m)} ${mt} ${m.toFixed(1)} — ${pl}`).setURL(url).addFields({name:"Orario",value:`<t:${u}:F> (<t:${u}:R>)`},{name:"Magnitudo",value:`${mt} ${m.toFixed(1)}`,inline:true},{name:"Profondità",value:`${d.toFixed(1)} km`,inline:true},{name:"Coordinate",value:`[${la.toFixed(3)}, ${lo.toFixed(3)}](https://www.google.com/maps?q=${la},${lo})`,inline:true}).setFooter({text:`${f.src} • #${id}`}).setTimestamp(t);}
async function poll(ch){try{const fs=await fetchAll();fs.sort((a,b)=>new Date(a.properties.time)-new Date(b.properties.time));for(const f of fs){const k=key(f);if(seen.has(k))continue;seen.add(k);const t=new Date(f.properties.time);if(!last||t>last)last=t;const m=f.properties.mag||0;await ch.send({content:m>MM?`<@&${R}>`:undefined,embeds:[embed(f)],allowedMentions:{roles:[R]}});console.log("Posted",f.src,k,"M"+m);}if(seen.size>2000){const a=[...seen];seen.clear();a.slice(-1000).forEach(x=>seen.add(x));}}catch(e){console.error(e);}}
const c=new Client({intents:[GatewayIntentBits.Guilds]});
c.once("clientReady",async()=>{console.log("Logged in as "+c.user.tag);const ch=await c.channels.fetch(C);const init=await fetchAll();for(const f of init){seen.add(key(f));const t=new Date(f.properties.time);if(!last||t>last)last=t;}await ch.send({embeds:[new EmbedBuilder().setColor(0x2ecc71).setTitle("🌍 Monitoraggio terremoti mondiale attivo").setDescription(`Fonti: INGV (Italia) + USGS (mondo)\nControllo ogni ${I/1000}s.\nPing del ruolo <@&${R}> per eventi > M${MM}.`).setTimestamp(new Date())]});console.log("Bot pronto");setInterval(()=>poll(ch),I);});
c.login(T);
