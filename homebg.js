/* Nimit home background: layered hero shared by shops page and developer editor.
   settings/homeBg = {on, linkType, linkUrl, page, layers:[...], imgUrl(legacy)}
   layer image: {t:'img',url,ar,x,y,w,rot,op,vis,linkType,linkUrl,page}
   layer text : {t:'txt',text,color,size,weight,x,y,rot,op,vis}
   x,y = centre in % of the 2:1 frame; w = width in % of frame; size = % of frame width. */
(function(w){
  const AR=1.7; // default hero frame width:height (settings/homeBg.heroH = height as % of width)
  const num=(v,d,a,b)=>{v=Number(v);if(!isFinite(v))v=d;return Math.min(b,Math.max(a,v))};
  const FONTS={'Prompt':[500,800],'Kanit':[500,800],'Sarabun':[500,800],'Mitr':[500,700],'Pridi':[500,700],'Chonburi':null,'Itim':null,'Bai Jamjuree':[500,700],'Sriracha':null,'K2D':[500,800],'Mali':[500,700],'Krub':[500,700],'Taviraj':[500,800],'Pattaya':null,'Athiti':[500,700],'Trirong':[500,800],'IBM Plex Sans Thai':[500,700]};
  const col=(v,d)=>/^#[0-9a-fA-F]{6}$/.test(v||'')?v:d;
  const okUrl=u=>typeof u==='string'&&/^(https:\/\/|data:image\/)/.test(u);
  function target(o){
    if(!o)return '';
    let u='';
    if(o.linkType==='url')u=String(o.linkUrl||'').trim();
    else if(o.linkType==='page')u=String(o.page||'').trim();
    if(/^https?:\/\//i.test(u))return u;
    if(/^[A-Za-z0-9_\-]+\.html([?#][A-Za-z0-9_\-.=&%#]*)?$/.test(u))return u;
    return '';
  }
  function norm(c){
    if(!c||typeof c!=='object')return {on:false,layers:[]};
    let ls=Array.isArray(c.layers)?c.layers:[];
    if(!ls.length&&okUrl(c.imgUrl))ls=[{t:'img',url:c.imgUrl,ar:2,x:50,y:50,w:100}];
    const out=[];
    ls.slice(0,20).forEach(l=>{
      if(!l||typeof l!=='object')return;
      const b={x:num(l.x,50,-50,150),y:num(l.y,50,-50,150),rot:num(l.rot,0,-180,180),op:num(l.op,100,0,100),vis:l.vis!==false};
      if(l.t==='txt'){
        const text=String(l.text||'').slice(0,80);if(!text)return;
        out.push({...b,t:'txt',text,color:col(l.color,'#ffffff'),size:num(l.size,8,2,40),weight:l.weight>=700?800:500,font:FONTS.hasOwnProperty(l.font)?l.font:'Prompt',sw:num(l.sw,0,0,3),sc:col(l.sc,'#0b2f86'),dp:num(l.dp,0,0,4),dc:col(l.dc,'#0b2f86'),sh:num(l.sh,40,0,100)});
      }else if(okUrl(l.url)){
        out.push({...b,t:'img',url:l.url,cover:!!l.cover,ar:num(l.ar,2,.1,10),w:num(l.w,100,5,400),sw:num(l.sw,0,0,2),sc:col(l.sc,'#ffffff'),sh:num(l.sh,0,0,100),linkType:l.linkType||'none',linkUrl:l.linkUrl||'',page:l.page||''});
      }
    });
    const hh=num(c.heroH,59,35,100);
    return {on:c.on!==false,ar:100/hh,bg:col(c.bg,''),bg2:col(c.bg2,''),layers:out,linkType:c.linkType||'none',linkUrl:c.linkUrl||'',page:c.page||''};
  }
  function opt(u,wd){
    if(typeof u!=='string')return u;
    const m=u.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.+)$/);
    return m?m[1]+'f_auto,q_auto,w_'+(wd||1200)+'/'+m[2]:u;
  }
  function textShadow(l){
    const a=[],r=l.sw;
    if(r>0)for(let i=0;i<16;i++){const t=i*Math.PI/8;a.push((Math.cos(t)*r).toFixed(3)+'cqw '+(Math.sin(t)*r).toFixed(3)+'cqw 0 '+l.sc)}
    if(l.dp>0){const n=Math.max(2,Math.round(l.dp*6));for(let i=1;i<=n;i++){const d=r*.7+l.dp*i/n;a.push(d.toFixed(3)+'cqw '+d.toFixed(3)+'cqw 0 '+l.dc)}}
    if(l.sh>0)a.push('0 '+(.3+l.dp*.5).toFixed(2)+'cqw '+(l.sh/25).toFixed(2)+'cqw rgba(7,27,61,'+(l.sh/130).toFixed(2)+')');
    return a.join(',');
  }
  function imgFilter(l){
    const a=[],r=l.sw;
    if(r>0)[[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>a.push('drop-shadow('+d[0]*r+'cqw '+d[1]*r+'cqw 0 '+l.sc+')'));
    if(l.sh>0)a.push('drop-shadow(0 '+(.4+l.sh/80).toFixed(2)+'cqw '+(l.sh/30).toFixed(2)+'cqw rgba(7,27,61,'+(l.sh/160).toFixed(2)+'))');
    return a.join(' ');
  }
  function fontCss(names){
    const q=[...new Set(names)].filter(n=>FONTS.hasOwnProperty(n)).map(n=>{const f=FONTS[n];return 'family='+n.replace(/ /g,'+')+(f?':wght@'+f.join(';'):'')});
    return q.length?'https://fonts.googleapis.com/css2?'+q.join('&')+'&display=swap':'';
  }
  function loadFonts(names){
    const h=fontCss(names);if(!h||document.querySelector('link[data-hbf="'+h+'"]'))return;
    const k=document.createElement('link');k.rel='stylesheet';k.href=h;k.dataset.hbf=h;document.head.appendChild(k);
  }
  function el(l,i,edit,AR){
    const d=document.createElement(l.t==='txt'?'div':'img');
    d.className='hbl';d.dataset.i=i;
    const s=d.style;
    s.left=l.x+'%';s.top=l.y+'%';s.opacity=l.op/100;
    s.transform='translate(-50%,-50%) rotate('+l.rot+'deg)';
    if(!l.vis)s.display='none';
    if(l.t==='txt'){
      d.textContent=l.text;s.color=l.color;s.fontSize=l.size+'cqw';
      const f=FONTS[l.font],bold=l.weight>=700;
      s.fontFamily='"'+l.font+'","IBM Plex Sans Thai",sans-serif';
      s.fontWeight=f?(bold?f[1]:f[0]):(bold?700:400);
      s.textShadow=textShadow(l);
    }else{
      d.alt='';d.draggable=false;d.src=edit?l.url:opt(l.url,Math.min(1600,Math.round(l.w*12)));
      s.width=(l.cover?Math.max(100,100*l.ar/AR):l.w)+'%';
      const fl=imgFilter(l);if(fl)s.filter=fl;
      if(!edit&&target(l)){d.dataset.go=target(l);d.style.cursor='pointer'}
    }
    return d;
  }
  /* render(container, config, {edit}) -> returns normalised config */
  function render(box,c,o){
    const n=norm(c);box.textContent='';
    box.style.background=n.bg?(n.bg2?'linear-gradient(135deg,'+n.bg+','+n.bg2+')':n.bg):'';
    loadFonts(n.layers.filter(l=>l.t==='txt').map(l=>l.font));
    n.layers.forEach((l,i)=>box.appendChild(el(l,i,o&&o.edit,n.ar)));
    return n;
  }
  w.NimitHomeBg={norm,render,target,opt,okUrl,FONTS,loadFonts,AR};
})(window);
