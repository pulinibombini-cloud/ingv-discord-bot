import {Client,GatewayIntentBits,EmbedBuilder} from "discord.js";
import http from "node:http";
const T=process.env.DISCORD_BOT_TOKEN,C=process.env.DISCORD_CHANNEL_ID,P=Number(process.env.PORT)||3000,I=30000;
if(!T||!C){console.error("Missing env");process.exit(1);}
http.createServer((q,r)=>{r.writeHead(200);r.end("ok");}).listen(P,()=>console.log("http "+P));
const seen=new Set();let last=null;
const col=m=>m>=5?0xff0000:m>=4?0xff6600:m>=3?0xffaa00:m>=2?0xffee00:0x66cc66;
const emo=m=>m>=5?"🔴":m>=4?"🟠":m>=3?"🟡":m>=2?"🟢":"⚪";
async function fetchEq(){const p=new URLSearchParams({format:"geojson",limit:"20",orderby:"time"});if(last)p.set("starttime",new Date(last.getTime()+1000).toISOString());const r=await fetch("https://webservices.ingv.it/fdsnws/event/1/query?"+p,{headers:{"User-Agent":"ingv-bot/1.0"}});if(r.status===204)return[];if(!r.ok)throw new Error("INGV "+r.status);return(await r.json()).features||[];}
function embed(f){const p=f.properties,[lo,la,d]=f.geometry.coordinates,m=p.mag||0,mt=p.magType||"M",pl=p.place||"?",t=new Date(p.time),u=Math.floor(t/1000),id=String(p.eventId||f.id);return new EmbedBuilder().setColor(col(m)).setTitle(`${emo(m)} ${mt} ${m.toFixed(1)} — ${pl}`).setURL(`https://terremoti.ingv.it/event/${id}`).addFields({name:"Orario",value:`<t:${u}:F> (<t:${u}:R>)`},{name:"Magnitudo",value:`${mt} ${m.toFixed(1)}`,inline:true},{name:"Profondità",value:`${d.toFixed(1)} km`,inline:true},{name:"Coordinate",value:`[${la.toFixed(3)}, ${lo.toFixed(3)}](https://www.google.com/maps?q=${la},${lo})`,inline:true}).setFooter({text:`INGV • #${id}`}).setTimestamp(t);}
async function poll(ch){try{const fs=await fetchEq();fs.sort((a,b)=>new Date(a.properties.time)-new Date(b.properties.time));for(const f of fs){const id=String(f.properties.eventId||f.id);if(seen.has(id))continue;seen.add(id);const t=new Date(f.properties.time);if(!last||t>last)last=t;await ch.send({embeds:[embed(f)]});console.log("Posted",id);}if(seen.size>1000){const a=[...seen];seen.clear();a.slice(-500).forEach(x=>seen.add(x));}}catch(e){console.error(e);}}
const c=new Client({intents:[GatewayIntentBits.Guilds]});
c.once("clientReady",async()=>{console.log("Logged in as "+c.user.tag);const ch=await c.channels.fetch(C);const init=await fetchEq();for(const f of init){seen.add(String(f.properties.eventId||f.id));const t=new Date(f.properties.time);if(!last||t>last)last=t;}await ch.send({embeds:[new EmbedBuilder().setColor(0x2ecc71).setTitle("🌍 Monitoraggio terremoti INGV attivo").setDescription(`Controllo INGV ogni ${I/1000}s.`).setTimestamp(new Date())]});console.log("Bot pronto");setInterval(()=>poll(ch),I);});
c.login(T);
