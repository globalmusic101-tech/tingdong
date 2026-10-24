/**
 * LGPL-3.0: JavaScript port of edge-tts 7.3.1 src/edge_tts/drm.py.
 * Upstream: https://github.com/rany2/edge-tts (rany and contributors).
 * Modified for Tingdong 2026-10-23: Node buffers, unsigned JS arithmetic,
 * compact SHA rounds; see third-party/edge-tts-LICENSE.txt.
 */
const INITIAL = [0x6A09E667,0xBB67AE85,0x3C6EF372,0xA54FF53A,0x510E527F,0x9B05688C,0x1F83D9AB,0x5BE0CD19];
const STATE = [0xFD9FBEA2,0x91243CE7,0xBE499094,0xCD2E1E0A,0x6C006F49,0x04BD35AB,0xFEB0A7E4,0x03EFFBD2];
const SCHEDULE = [0xEB24BF9E,0x1558691F,0xA0C09EE2,0x0CFA32BA,0xA622EE8C,0xD1DD9491,0xC0DD25A0,0xF9E70AB6,0xF0C31573,0x7058CE4E,0x7188E606,0x00E5AB33,0xD258B060,0x72766564];
const K = [0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0x0FC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x06CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2];
const COEFFICIENTS = [[0xE82E91B1,0xB32700D0],[0x44DE24C6,0x88DFF51D],[0x3BEB65BC,0x29514038],[0xC89C5933,0xB328CBDF],[0x8D1EC211,0xD405B4D5],[0x314EF5D5,0x26E55F3C],[0xE92491B1,0x607801C6],[0xF0A5B9D5,0x82B2C1FB],[0x06064CF3,0xFA51A3DA],[0xDA79FA60,0x207CC464],[0xBED20560,0x3C3C74F3],[0x89F9C9F8,0xD2D14B61],[0x35FA38C6,0xBB04A2C1],[0xCB49E3C6,0xC5626167]];
export const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const ror = (v,n) => (v >>> n) | (v << (32-n));
const rol16 = v => ((v << 16) | (v >>> 16)) >>> 0;
const s0 = v => (ror(v,7)^ror(v,18)^(v>>>3)) >>> 0;
const s1 = v => (ror(v,17)^ror(v,19)^(v>>>10)) >>> 0;
const mul = (a,b) => Math.imul(a,b) >>> 0;
function expand(w, start=16) {
  for(let i=start;i<64;i++) w[i]=(s1(w[i-2])+w[i-7]+s0(w[i-15])+w[i-16])>>>0;
}
function rounds(state,w,start=0) {
  let [a,b,c,d,e,f,g,h]=state;
  for(let i=start;i<64;i++) {
    const k=start===14 && i===14 ? 0xC9DC06A7 : K[i];
    const t1=h+(ror(e,6)^ror(e,11)^ror(e,25))+(g^(e&(f^g)))+k+w[i];
    const t2=(ror(a,2)^ror(a,13)^ror(a,22))+((a&b)|(c&(a|b)));
    [a,b,c,d,e,f,g,h]=[(t1+t2)>>>0,a,b,c,(d+t1)>>>0,e,f,g];
  }
  return [a,b,c,d,e,f,g,h];
}
function digest(data) {
  const w=Array(14).fill(0);
  w.push(data.readUIntBE(0,3),data.readUInt32BE(3));
  for(let i=16;i<30;i++) {
    let v=SCHEDULE[i-16];
    if(i-2>=14) v+=i===16 ? (s1(w[i-2])^0x000B92C0)>>>0 : s1(w[i-2]);
    if(i-7>=14) v+=w[i-7];
    if(i-15>=14) v+=i===29 ? (s0(w[i-15])^0x059C0B80)>>>0 : s0(w[i-15]);
    w.push(v>>>0);
  }
  w.push((s1(w[28])+w[23]+s0(w[15])+w[14]+0xC9DC06A7-K[14])>>>0);
  expand(w,31);
  let state=rounds(STATE,w,14).map((v,i)=>(v+INITIAL[i])>>>0);
  const length=57+data.length;
  const zeros=((55-length)%64+64)%64;
  const padded=Buffer.concat([data.subarray(7),Buffer.from([128]),Buffer.alloc(zeros+8)]);
  padded.writeBigUInt64BE(BigInt(length*8),padded.length-8);
  for(let offset=0;offset<padded.length;offset+=64) {
    const words=Array.from({length:16},(_,i)=>padded.readUInt32BE(offset+i*4));
    expand(words);
    state=rounds(state,words).map((v,i)=>(v+state[i])>>>0);
  }
  const out=Buffer.alloc(32); state.forEach((v,i)=>out.writeUInt32BE(v,i*4)); return out;
}
function cs64(data,hash) {
  const a=(hash.readUInt32LE(0)|1)>>>0, b=(hash.readUInt32LE(4)|1)>>>0;
  const factors=[mul(a,0x82893933),mul(b,0x82893933)];
  const terms=COEFFICIENTS.map(([v],i)=>mul(v,factors[i%2]));
  const offsets=COEFFICIENTS.map(([,v])=>v);
  const words=Buffer.alloc(Math.ceil((data.length+1)/8)*8); data.copy(words,1);
  for(let i=0;i<words.length/4;i++) {
    const word=words.readUInt32LE(i*4);
    let term=mul(word,i%2===0?a:b), offset=mul(rol16(word),i%2===0?0xEF0569FB:0xC31713DB);
    if(i===0) { term+=mul(0xF2F90B1A,factors[0]); offset+=0x0B1A0000; }
    terms.push(term>>>0); offsets.push(offset>>>0);
  }
  let swapAcc=0,swapLast=0,state=0,acc=0;
  for(let i=0;i<terms.length;i+=2) {
    const x=terms[i],y=terms[i+1];
    let q=mul(rol16((offsets[i]+x)>>>0),0x76F50F34);
    swapAcc=(swapAcc+mul(rol16(q),0xC3EFEA97)+q)>>>0;
    q=mul(rol16((offsets[i+1]+y)>>>0),0x1881CE3C);
    swapLast=(mul(rol16(q),0x35BD1EC9)+q)>>>0;
    swapAcc=(swapAcc+swapLast)>>>0;
    state=(mul(state,a)+x)>>>0;
    for(const k of [0xCF98B111,0x87085B9F,0x12CEB96D,0x257E1D83]) state=mul(rol16(state),k);
    acc=(acc+state)>>>0;
    let t=(mul(state,b)+y)>>>0;
    for(const k of [0xA27416F5,0xD38396FF,0x7C932B89,0xBFA49F69]) t=mul(rol16(t),k);
    state=t; acc=(acc+state)>>>0;
  }
  const out=Buffer.alloc(8); out.writeUInt32LE((swapLast^state)>>>0,0); out.writeUInt32LE((swapAcc^acc)>>>0,4); return out;
}
export function generateEdgeToken(unixSeconds=Date.now()/1000) {
  let ticks=unixSeconds+11644473600; ticks-=ticks%300; ticks*=1e7;
  const data=Buffer.from(ticks.toFixed(0)+TRUSTED_CLIENT_TOKEN,'ascii');
  const hash=digest(data);
  return `${cs64(data,hash).toString('hex')}-${hash.toString('hex')}`.toUpperCase();
}
