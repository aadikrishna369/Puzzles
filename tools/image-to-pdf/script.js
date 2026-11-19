(function(){
  const $=s=>document.querySelector(s);
  const grid=$('#grid'),drop=$('#drop'),input=$('#file');
  let items=[],mode='fit',sortMode='custom',uid=0,dragEl=null,startOrder='',estTok=0,estTimer;
  const cache=new Map();
  const get=id=>items.find(i=>i.id==id);
  const rotOf=it=>((it.rot%360)+360)%360;
  const bg=()=>$('#bg').value;
  const fmt=n=>n<1048576?Math.max(1,Math.round(n/1024))+' KB':(n/1048576).toFixed(2)+' MB';

  function toast(t,k){const el=$('#toast');el.textContent=t;el.className='toast show '+(k||'');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2800)}

  /* ---------- adding / cards ---------- */
  function addFiles(list){
    const files=[...list].filter(f=>f.type.startsWith('image/'));
    if(!files.length){toast('No image files found','bad');return}
    files.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
    files.forEach((f,i)=>{
      const it={id:++uid,file:f,url:URL.createObjectURL(f),rot:0};
      items.push(it);
      const c=document.createElement('div');
      c.className='card fresh';c.draggable=true;c.dataset.id=it.id;
      c.style.animationDelay=Math.min(i,12)*40+'ms';
      c.innerHTML='<div class="img"></div><div class="num"></div><button class="x" data-a="x" title="Remove">✕</button><div class="tools"><button data-a="l" title="Move earlier">◀</button><button data-a="rl" title="Rotate left">↺</button><button data-a="rr" title="Rotate right">↻</button><button data-a="r" title="Move later">▶</button></div><div class="meta"></div>';
      c.querySelector('.img').style.backgroundImage='url("'+it.url+'")';
      c.querySelector('.meta').textContent=f.name;
      grid.appendChild(c);
    });
    sortMode==='custom'?sync():applySort();
  }

  grid.addEventListener('animationend',e=>e.target.classList.remove('fresh'));
  grid.addEventListener('click',e=>{
    const b=e.target.closest('button[data-a]');if(!b)return;
    const c=b.closest('.card'),a=b.dataset.a,it=get(c.dataset.id);
    if(a==='x'){URL.revokeObjectURL(it.url);items=items.filter(i=>i!==it);dropCache(it.id);c.remove()}
    else if(a==='rl'||a==='rr'){it.rot+=a==='rl'?-90:90;c.querySelector('.img').style.transform='rotate('+it.rot+'deg)'}
    else if(a==='l'&&c.previousElementSibling){grid.insertBefore(c,c.previousElementSibling);setSort('custom')}
    else if(a==='r'&&c.nextElementSibling){grid.insertBefore(c.nextElementSibling,c);setSort('custom')}
    sync();
  });
  grid.addEventListener('dragstart',e=>{
    const c=e.target.closest('.card');if(!c)return;
    dragEl=c;startOrder=order();c.classList.add('drag');e.dataTransfer.effectAllowed='move';
    try{e.dataTransfer.setData('text/plain','card')}catch(_){}
  });
  grid.addEventListener('dragover',e=>{
    const c=e.target.closest('.card');if(!dragEl||!c||c===dragEl)return;
    e.preventDefault();
    const r=c.getBoundingClientRect();
    grid.insertBefore(dragEl,(e.clientX-r.left)>r.width/2?c.nextSibling:c);
  });
  grid.addEventListener('dragend',()=>{
    if(!dragEl)return;
    dragEl.classList.remove('drag');dragEl=null;
    if(order()!==startOrder)setSort('custom');
    sync();
  });
  const order=()=>[...grid.children].map(c=>c.dataset.id).join();

  function sync(){
    items=[...grid.children].map(c=>get(c.dataset.id)).filter(Boolean);
    [...grid.children].forEach((c,i)=>c.querySelector('.num').textContent=i+1);
    const has=items.length>0;
    $('#n').textContent=items.length;
    ['#bar','#panel','#hint','#dock'].forEach(s=>$(s).classList.toggle('show',has));
    scheduleEst();
  }

  /* ---------- sorting ---------- */
  function setSort(m){
    sortMode=m;
    document.querySelectorAll('#sort button').forEach(b=>b.classList.toggle('on',b.dataset.s===m));
    if(m!=='custom')applySort();
  }
  function applySort(){
    const d=sortMode==='az'?1:-1,nm=c=>get(c.dataset.id).file.name;
    [...grid.children].sort((a,b)=>d*nm(a).localeCompare(nm(b),undefined,{numeric:true,sensitivity:'base'})).forEach(c=>grid.appendChild(c));
    sync();
  }
  $('#sort').addEventListener('click',e=>{if(e.target.dataset.s)setSort(e.target.dataset.s)});

  /* ---------- upload ---------- */
  drop.addEventListener('click',()=>input.click());
  drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}});
  input.addEventListener('change',()=>{addFiles(input.files);input.value=''});
  ['dragenter','dragover'].forEach(t=>window.addEventListener(t,e=>{
    if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){e.preventDefault();drop.classList.add('over')}
  }));
  ['dragleave','drop'].forEach(t=>window.addEventListener(t,e=>{if(t==='drop'||e.relatedTarget===null)drop.classList.remove('over')}));
  window.addEventListener('drop',e=>{
    if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){e.preventDefault();addFiles(e.dataTransfer.files)}
  });

  /* ---------- settings ---------- */
  $('#mode').addEventListener('click',e=>{
    const m=e.target.dataset.m;if(!m)return;mode=m;
    document.querySelectorAll('#mode button').forEach(b=>b.classList.toggle('on',b===e.target));
    $('#bgRow').classList.toggle('show',m==='a4');
    scheduleEst();
  });
  $('#bg').addEventListener('input',()=>{$('#bgv').textContent=bg().toUpperCase();scheduleEst()});
  const rotAll=d=>{items.forEach(it=>{it.rot+=d;grid.querySelector('[data-id="'+it.id+'"] .img').style.transform='rotate('+it.rot+'deg)'});scheduleEst()};
  $('#rotL').addEventListener('click',()=>rotAll(-90));
  $('#rotR').addEventListener('click',()=>rotAll(90));
  $('#clear').addEventListener('click',()=>{items.forEach(i=>URL.revokeObjectURL(i.url));items=[];cache.clear();grid.innerHTML='';sync()});
  $('#reset').addEventListener('click',function(){
    if(items.length&&!this.classList.contains('sure')){
      this.classList.add('sure');this.textContent='Click again to start over';
      setTimeout(()=>{this.classList.remove('sure');this.textContent='↻ New project'},3000);return;
    }
    location.reload();
  });

  /* ---------- image encoding (cached) ---------- */
  function loadImg(url){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('decode'));im.src=url})}
  const key=it=>it.id+'|'+rotOf(it)+'|'+(mode==='a4'?bg():'w');
  function dropCache(id,keep){for(const k of [...cache.keys()])if(k.startsWith(id+'|')&&k!==keep)cache.delete(k)}
  async function enc(it){
    const k=key(it);if(cache.has(k))return cache.get(k);
    const im=await loadImg(it.url),r=rotOf(it),sw=r%180!==0;
    const iw=im.naturalWidth,ih=im.naturalHeight,w=sw?ih:iw,h=sw?iw:ih;
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    const g=cv.getContext('2d');
    g.fillStyle=mode==='a4'?bg():'#ffffff';g.fillRect(0,0,w,h);
    g.translate(w/2,h/2);g.rotate(r*Math.PI/180);g.drawImage(im,-iw/2,-ih/2);
    const blob=await new Promise(res=>cv.toBlob(res,'image/jpeg',0.92));
    const v={w,h,data:new Uint8Array(await blob.arrayBuffer())};
    dropCache(it.id,k);cache.set(k,v);return v;
  }

  /* ---------- size estimate ---------- */
  function scheduleEst(){
    clearTimeout(estTimer);const t=++estTok;
    if(!items.length)return;
    $('#est').textContent='Estimating size…';
    estTimer=setTimeout(async()=>{
      let sum=1000;
      try{for(const it of items){const v=await enc(it);if(t!==estTok)return;sum+=v.data.length+600}}
      catch(e){if(t===estTok)$('#est').textContent='Size unavailable';return}
      if(t===estTok)$('#est').textContent='Estimated size ≈ '+fmt(sum);
    },350);
  }

  /* ---------- MD5 + RC4 (for password) ---------- */
  function md5(data){
    const K=new Uint32Array(64),S=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];
    for(let i=0;i<64;i++)K[i]=Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0;
    const n=data.length,pl=((n+8>>6)+1)<<6,m=new Uint8Array(pl);
    m.set(data);m[n]=0x80;
    const dv=new DataView(m.buffer);dv.setUint32(pl-8,(n*8)>>>0,true);dv.setUint32(pl-4,Math.floor(n/536870912),true);
    let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
    for(let o=0;o<pl;o+=64){
      let A=a0,B=b0,C=c0,D=d0;
      for(let i=0;i<64;i++){
        let F,g;
        if(i<16){F=(B&C)|(~B&D);g=i}else if(i<32){F=(D&B)|(~D&C);g=(5*i+1)&15}
        else if(i<48){F=B^C^D;g=(3*i+5)&15}else{F=C^(B|~D);g=(7*i)&15}
        F=(F+A+K[i]+dv.getUint32(o+g*4,true))>>>0;
        A=D;D=C;C=B;
        const s=S[(i>>4)*4+(i&3)];
        B=(B+((F<<s)|(F>>>(32-s))))>>>0;
      }
      a0=(a0+A)>>>0;b0=(b0+B)>>>0;c0=(c0+C)>>>0;d0=(d0+D)>>>0;
    }
    const out=new Uint8Array(16),ov=new DataView(out.buffer);
    ov.setUint32(0,a0,true);ov.setUint32(4,b0,true);ov.setUint32(8,c0,true);ov.setUint32(12,d0,true);
    return out;
  }
  function rc4(k,d){
    const s=new Uint8Array(256);for(let i=0;i<256;i++)s[i]=i;
    let j=0;for(let i=0;i<256;i++){j=(j+s[i]+k[i%k.length])&255;[s[i],s[j]]=[s[j],s[i]]}
    const o=new Uint8Array(d.length);let a=0,b=0;
    for(let n=0;n<d.length;n++){a=(a+1)&255;b=(b+s[a])&255;[s[a],s[b]]=[s[b],s[a]];o[n]=d[n]^s[(s[a]+s[b])&255]}
    return o;
  }
  const PAD=Uint8Array.from([0x28,0xBF,0x4E,0x5E,0x4E,0x75,0x8A,0x41,0x64,0x00,0x4E,0x56,0xFF,0xFA,0x01,0x08,0x2E,0x2E,0x00,0xB6,0xD0,0x68,0x3E,0x80,0x2F,0x0C,0xA9,0xFE,0x64,0x53,0x69,0x7A]);
  const TE=new TextEncoder();
  const cat=(...a)=>{const o=new Uint8Array(a.reduce((s,x)=>s+x.length,0));let p=0;a.forEach(x=>{o.set(x,p);p+=x.length});return o};
  const pad32=b=>cat(b.slice(0,32),PAD).slice(0,32);
  const hex=u=>Array.from(u,b=>b.toString(16).padStart(2,'0')).join('');
  const xorK=(k,i)=>k.map(b=>b^i);
  function setupEnc(pw){   // standard security handler, 128-bit RC4 (V2/R3)
    const up=pad32(TE.encode(pw)),ow=pad32(crypto.getRandomValues(new Uint8Array(16)));
    let h=md5(ow);for(let i=0;i<50;i++)h=md5(h);
    const ok=h.slice(0,16);let O=rc4(ok,up);
    for(let i=1;i<=19;i++)O=rc4(xorK(ok,i),O);
    const id=crypto.getRandomValues(new Uint8Array(16));
    let k=md5(cat(up,O,Uint8Array.from([0xFC,0xFF,0xFF,0xFF]),id));
    for(let i=0;i<50;i++)k=md5(k.slice(0,16));
    k=k.slice(0,16);
    let U=rc4(k,md5(cat(PAD,id)));
    for(let i=1;i<=19;i++)U=rc4(xorK(k,i),U);
    return{k,O,U:cat(U,new Uint8Array(16)),id};
  }

  /* ---------- PDF writer ---------- */
  function buildPdf(pages,meta,pw){
    const E=pw?setupEnc(pw):null,parts=[],off=[];let len=0;
    const push=x=>{const u=typeof x==='string'?TE.encode(x):x;parts.push(u);len+=u.length};
    const f=n=>(+n.toFixed(2)).toString(),f3=n=>(+n.toFixed(3)).toString();
    const okey=n=>md5(cat(E.k,Uint8Array.from([n&255,(n>>8)&255,(n>>16)&255,0,0]))).slice(0,16);
    const sdata=(n,d)=>E?rc4(okey(n),d):d;
    const total=2+pages.length*3,metaKeys=Object.keys(meta);
    let nxt=total+1;const infoN=metaKeys.length?nxt++:0,encN=E?nxt++:0;
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    off[1]=len;push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    off[2]=len;push('2 0 obj\n<< /Type /Pages /Count '+pages.length+' /Kids ['+pages.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] >>\nendobj\n');
    pages.forEach((p,i)=>{
      const pn=3+i*3,cn=pn+1,im=pn+2;
      off[pn]=len;push(pn+' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+f(p.pw)+' '+f(p.ph)+'] /Resources << /XObject << /Im0 '+im+' 0 R >> >> /Contents '+cn+' 0 R >>\nendobj\n');
      const cs=TE.encode((p.bg?p.bg.map(f3).join(' ')+' rg 0 0 '+f(p.pw)+' '+f(p.ph)+' re f ':'')+'q '+f(p.dw)+' 0 0 '+f(p.dh)+' '+f(p.dx)+' '+f(p.dy)+' cm /Im0 Do Q');
      off[cn]=len;push(cn+' 0 obj\n<< /Length '+cs.length+' >>\nstream\n');push(sdata(cn,cs));push('\nendstream\nendobj\n');
      off[im]=len;push(im+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+p.w+' /Height '+p.h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+p.data.length+' >>\nstream\n');
      push(sdata(im,p.data));push('\nendstream\nendobj\n');
    });
    if(infoN){
      const str=s=>{const u=new Uint8Array(2+s.length*2);u[0]=0xFE;u[1]=0xFF;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);u[2+i*2]=c>>8;u[3+i*2]=c&255}return '<'+hex(sdata(infoN,u))+'>'};
      off[infoN]=len;push(infoN+' 0 obj\n<< '+metaKeys.map(k=>'/'+k+' '+str(meta[k])).join(' ')+' >>\nendobj\n');
    }
    if(encN){off[encN]=len;push(encN+' 0 obj\n<< /Filter /Standard /V 2 /R 3 /Length 128 /P -4 /O <'+hex(E.O)+'> /U <'+hex(E.U)+'> >>\nendobj\n')}
    const xr=len;let x='xref\n0 '+nxt+'\n0000000000 65535 f \n';
    for(let n=1;n<nxt;n++)x+=String(off[n]).padStart(10,'0')+' 00000 n \n';
    push(x+'trailer\n<< /Size '+nxt+' /Root 1 0 R'+(infoN?' /Info '+infoN+' 0 R':'')+(E?' /Encrypt '+encN+' 0 R /ID [<'+hex(E.id)+'> <'+hex(E.id)+'>]':'')+' >>\nstartxref\n'+xr+'\n%%EOF');
    return new Blob(parts,{type:'application/pdf'});
  }

  function layout(p){
    if(mode==='a4'){
      const pw=595.28,ph=841.89,m=28,s=Math.min((pw-2*m)/p.w,(ph-2*m)/p.h),c=bg();
      p.pw=pw;p.ph=ph;p.dw=p.w*s;p.dh=p.h*s;p.dx=(pw-p.dw)/2;p.dy=(ph-p.dh)/2;
      p.bg=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);
    }else{
      const s=Math.min(1,842/Math.max(p.w,p.h));
      p.pw=p.dw=p.w*s;p.ph=p.dh=p.h*s;p.dx=p.dy=0;
    }
    return p;
  }

  /* ---------- export ---------- */
  $('#go').addEventListener('click',async()=>{
    const btn=$('#go'),lab=$('#gol');
    if(!items.length)return;
    btn.disabled=true;
    try{
      const pages=[];
      for(let i=0;i<items.length;i++){
        lab.textContent='Processing '+(i+1)+' / '+items.length+'…';
        pages.push(layout({...await enc(items[i])}));
        await new Promise(r=>setTimeout(r,0));
      }
      lab.textContent='Building PDF…';
      const meta={};
      ['Title','Author','Subject','Keywords'].forEach(k=>{const v=$('#m-'+k).value.trim();if(v)meta[k]=v});
      const pw=$('#pw').value;
      const blob=buildPdf(pages,meta,pw);
      let name=$('#fname').value.replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'').trim()||'images';
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=name+'.pdf';document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      toast('Your PDF is ready'+(pw?' (password protected)':''),'ok');
    }catch(err){toast('Could not convert one of the images','bad')}
    lab.textContent='Convert to PDF';btn.disabled=false;
  });
})();
