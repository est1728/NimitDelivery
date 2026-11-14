/* Nimit home background: layered hero shared by shops page and developer editor.
   settings/homeBg = {on, linkType, linkUrl, page, layers:[...], imgUrl(legacy)}
   layer image: {t:'img',url,ar,x,y,w,rot,op,vis,linkType,linkUrl,page}
   layer text : {t:'txt',text,color,size,weight,x,y,rot,op,vis}
   x,y = centre in % of the 2:1 frame; w = width in % of frame; size = % of frame width. */
(function(w){
  const num=(v,d,a,b)=>{v=Number(v);if(!isFinite(v))v=d;return Math.min(b,Math.max(a,v))};
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
        out.push({...b,t:'txt',text,color:/^#[0-9a-fA-F]{3,8}$/.test(l.color||'')?l.color:'#ffffff',size:num(l.size,8,2,40),weight:l.weight>=700?800:500});
      }else if(okUrl(l.url)){
        out.push({...b,t:'img',url:l.url,ar:num(l.ar,2,.1,10),w:num(l.w,100,5,400),linkType:l.linkType||'none',linkUrl:l.linkUrl||'',page:l.page||''});
      }
    });
    return {on:c.on!==false,layers:out,linkType:c.linkType||'none',linkUrl:c.linkUrl||'',page:c.page||''};
  }
  function opt(u,wd){
    if(typeof u!=='string')return u;
    const m=u.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.+)$/);
    return m?m[1]+'f_auto,q_auto,w_'+(wd||1200)+'/'+m[2]:u;
  }
  function el(l,i,edit){
    const d=document.createElement(l.t==='txt'?'div':'img');
    d.className='hbl';d.dataset.i=i;
    const s=d.style;
    s.left=l.x+'%';s.top=l.y+'%';s.opacity=l.op/100;
    s.transform='translate(-50%,-50%) rotate('+l.rot+'deg)';
    if(!l.vis)s.display='none';
    if(l.t==='txt'){
      d.textContent=l.text;s.color=l.color;s.fontSize=l.size+'cqw';s.fontWeight=l.weight;
      s.textShadow='0 1px 6px rgba(7,27,61,.35)';
    }else{
      d.alt='';d.draggable=false;d.src=edit?l.url:opt(l.url,Math.min(1600,Math.round(l.w*12)));
      s.width=l.w+'%';
      if(!edit&&target(l)){d.dataset.go=target(l);d.style.cursor='pointer'}
    }
    return d;
  }
  /* render(container, config, {edit}) -> returns normalised config */
  function render(box,c,o){
    const n=norm(c);box.textContent='';
    n.layers.forEach((l,i)=>box.appendChild(el(l,i,o&&o.edit)));
    return n;
  }
  w.NimitHomeBg={norm,render,target,opt,okUrl};
})(window);
