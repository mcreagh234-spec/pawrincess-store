(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const money=n=>'$'+n.toFixed(2);
  const PROD_IMG='images/life-night.jpg', PROD_NAME='The Pawrincess Seat';
  const CART_KEY='pw_cart_v1';

  /* ---------- gallery ---------- */
  const track=$('#gTrack'), dotsBox=$('#gDots');
  const slides=$$('.g-slide',track);
  slides.forEach((_,i)=>{const d=document.createElement('button');d.className='g-dot'+(i===0?' on':'');d.onclick=()=>track.scrollTo({left:track.clientWidth*i,behavior:'smooth'});dotsBox.appendChild(d);});
  const dots=$$('.g-dot',dotsBox);
  let gi=0;
  track.addEventListener('scroll',()=>{const i=Math.round(track.scrollLeft/track.clientWidth);if(i!==gi){gi=i;dots.forEach((d,k)=>d.classList.toggle('on',k===i));}});
  $('#gPrev').onclick=()=>track.scrollTo({left:track.clientWidth*Math.max(0,gi-1),behavior:'smooth'});
  $('#gNext').onclick=()=>track.scrollTo({left:track.clientWidth*Math.min(slides.length-1,gi+1),behavior:'smooth'});

  /* ---------- variant dropdowns (one per bundle) ---------- */
  const VLABELS={bolster:'Royal Bolster',crown:'Princess Crown'};
  const VIMG={bolster:'images/variant-bolster.jpg',crown:'images/variant-crown.jpg'};
  const heroImg=slides[0].querySelector('img');
  function curVariant(){const s=selTier().querySelector('.vSelect');const id=s?s.value:'bolster';return {id,label:VLABELS[id]||id};}
  function syncHero(){const v=curVariant();heroImg.src=VIMG[v.id];heroImg.alt=v.label;}
  $$('.vSelect').forEach(s=>{
    ['click','mousedown','pointerdown'].forEach(ev=>s.addEventListener(ev,e=>e.stopPropagation()));
    s.addEventListener('change',e=>{e.stopPropagation();if(s.closest('.tier').classList.contains('sel')){syncHero();track.scrollTo({left:0,behavior:'smooth'});}});
  });

  /* ---------- bundle + add-ons ---------- */
  const tiers=$$('#tiers .tier'), priority=$('#priority');
  function selTier(){return $('#tiers .tier.sel');}
  function orderTotal(){
    const t=selTier(); let sum=parseFloat(t.dataset.price);
    $$('.addon',t).forEach(a=>{if(a.classList.contains('on'))sum+=parseFloat(a.dataset.addon);});
    if(priority.classList.contains('on'))sum+=parseFloat(priority.dataset.addon);
    return sum;
  }
  function render(){
    const t=selTier();
    $('#atcMain').textContent='ADD TO CART · '+money(orderTotal());
    $('#stickyPrice').textContent=money(parseFloat(t.dataset.price));
    $('.sticky .cc').textContent=money(parseFloat(t.dataset.compare));
  }
  tiers.forEach(t=>t.querySelector('.tier-main').onclick=()=>{tiers.forEach(x=>x.classList.remove('sel'));t.classList.add('sel');render();syncHero();});
  function bindAddon(el){el.onclick=e=>{e.preventDefault();el.classList.toggle('on');render();};}
  $$('.tier .addon').forEach(bindAddon); bindAddon(priority);

  /* ---------- accordions ---------- */
  $$('.acc-q').forEach(q=>q.onclick=()=>{
    const it=q.parentElement, a=q.nextElementSibling, open=it.classList.contains('open');
    it.classList.toggle('open');a.style.maxHeight=open?null:a.scrollHeight+'px';
  });

  /* ---------- cart ---------- */
  const read=()=>{try{return JSON.parse(localStorage.getItem(CART_KEY))||[];}catch(e){return [];}};
  const write=c=>{try{localStorage.setItem(CART_KEY,JSON.stringify(c));}catch(e){}};
  function bubble(){const c=read();const n=c.reduce((s,l)=>s+l.qty,0);const b=$('#cartBubble');if(n>0){b.hidden=false;b.textContent=n;}else b.hidden=true;}
  function cartTotal(){return read().reduce((s,l)=>s+l.price*l.qty,0);}
  function renderCart(){
    const body=$('#cartBody'), c=read();
    if(!c.length){body.innerHTML='<div class="cart-empty">Your cart is empty.<br>Give your little royal her throne 👑</div>';}
    else body.innerHTML=c.map((l,i)=>`
      <div class="cart-line">
        <img src="${l.img}" alt="">
        <div style="flex:1;min-width:0">
          <div class="cl-name">${l.name}</div>
          <div class="cl-sub">${l.sub}</div>
          <div class="qty"><button data-dec="${i}">–</button><span>${l.qty}</span><button data-inc="${i}">+</button></div>
          <button class="cl-remove" data-rm="${i}">Remove</button>
        </div>
        <div class="cl-price">${money(l.price*l.qty)}</div>
      </div>`).join('');
    $('#cartTotal').textContent=money(cartTotal());
    bubble();
    $$('[data-inc]',body).forEach(b=>b.onclick=()=>{const c=read();c[b.dataset.inc].qty++;write(c);renderCart();});
    $$('[data-dec]',body).forEach(b=>b.onclick=()=>{const c=read();if(--c[b.dataset.dec].qty<=0)c.splice(b.dataset.dec,1);write(c);renderCart();});
    $$('[data-rm]',body).forEach(b=>b.onclick=()=>{const c=read();c.splice(b.dataset.rm,1);write(c);renderCart();});
  }
  function openCart(){renderCart();$('#drawer').classList.add('open');$('#scrim').classList.add('open');document.body.style.overflow='hidden';}
  function closeCart(){$('#drawer').classList.remove('open');$('#scrim').classList.remove('open');document.body.style.overflow='';}
  function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);}

  function addToCart(){
    const t=selTier();
    const addons=[]; $$('.addon.on',t).forEach(a=>{if(a.dataset.aid)addons.push(a.dataset.aid);});
    if(priority.classList.contains('on'))addons.push('priority');
    const c=read();
    const v=curVariant();
    const extraTxt=addons.length?(' · +'+addons.length+' extra'+(addons.length>1?'s':'')):'';
    c.push({handle:'pawrincess-seat', tier:t.dataset.tier, qty:1, addons,
      variant:v.id, variantLabel:v.label,
      name:t.dataset.name, sub: v.label+extraTxt,
      price:orderTotal(), img: v.id==='crown'?'images/variant-crown.jpg':PROD_IMG});
    write(c); openCart(); toast('Added to cart 👑');
  }
  $('#atcMain').onclick=addToCart;
  $('#atcSticky').onclick=addToCart;
  $('#cartBtn').onclick=openCart;
  $('#cartClose').onclick=closeCart;
  $('#keepShopping').onclick=closeCart;
  $('#scrim').onclick=closeCart;
  $('#checkoutBtn').onclick=()=>{if(read().length)location.href='checkout.html';else toast('Your cart is empty');};

  /* ---------- misc ---------- */
  $('#toTop').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
  window.addEventListener('scroll',()=>{$('#toTop').style.display=window.scrollY>600?'flex':'none';});
  $('#toTop').style.display='none';

  render(); bubble();
})();
