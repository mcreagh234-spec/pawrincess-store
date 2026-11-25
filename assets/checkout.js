/* Pawrincess on-site checkout — Square Web Payments SDK card form + address form. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CART_KEY = 'pw_cart_v1';
  const FORM_KEY = 'pw_checkout_contact';
  let CAT, CFG, payments, card, totalCents = 0, busy = false, shipId = 'standard';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (c) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);
  const readCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
  const product = (h) => CAT.products.find((p) => p.handle === h);
  const lines = () => readCart().filter((l) => product(l.handle));

  function tierOf(l) { const p = product(l.handle); return p.bundles.tiers.find((t) => t.id === String(l.tier)); }
  function linePrice(l) {
    const p = product(l.handle), t = tierOf(l);
    let c = (t ? t.price_cents : p.price_cents) * (l.qty || 1);
    for (const id of new Set(l.addons || [])) c += p.bundles.addons.find((a) => a.id === id)?.price_cents || 0;
    return c;
  }
  function addonTitles(l) {
    const p = product(l.handle);
    return [...new Set(l.addons || [])].map((id) => p.bundles.addons.find((a) => a.id === id)?.title).filter(Boolean);
  }

  const US_STATES = 'AL,AK,AZ,AR,CA,CO,CT,DE,DC,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VT,VA,WA,WV,WI,WY,PR'.split(',');
  function renderState() {
    const c = $('#country').value, w = $('#state-wrap'), prev = $('#state')?.value || '';
    if (c === 'US') w.innerHTML = `<select id="state" name="state" autocomplete="address-level1" required><option value="">State</option>${US_STATES.map((s) => `<option ${s === prev ? 'selected' : ''}>${s}</option>`).join('')}</select><label for="state">State</label>`;
    else w.innerHTML = `<input id="state" name="state" autocomplete="address-level1" placeholder=" " value="${esc(prev)}" ${c === 'CA' || c === 'AU' ? 'required' : ''}><label for="state">${c === 'GB' ? 'County (optional)' : 'State / Province'}</label>`;
    const zl = $('label[for="zip"]'); if (zl) zl.textContent = c === 'US' ? 'ZIP code' : 'Postal code';
  }

  function renderSummary() {
    const ls = lines();
    if (!ls.length) { $('.co-wrap').hidden = true; $('.co-sum-toggle').hidden = true; $('.co-empty').hidden = false; return false; }
    let sub = 0;
    $('.co-lines').innerHTML = ls.map((l) => {
      const p = product(l.handle), t = tierOf(l);
      const v = (p.variants || []).find((x) => x.id === l.variant);
      const price = linePrice(l); sub += price;
      const extras = addonTitles(l).map((x) => `<small>+ ${esc(x)}</small>`).join('');
      return `<div class="co-line"><div class="co-thumb"><img src="${esc(v?.image || p.image)}" alt=""><span>${l.qty || 1}</span></div>
        <div class="co-li"><b>${esc(p.title)}</b>${v ? `<small>Style: ${esc(v.label)}</small>` : ''}${t ? `<small>${esc(t.title)}</small>` : ''}${extras}</div><b>${money(price)}</b></div>`;
    }).join('');
    const opts = CAT.store.shipping_options?.length ? CAT.store.shipping_options : [{ id: 'standard', label: 'Free Shipping', eta: '4–9 business days', price_cents: 0 }];
    if (!opts.some((o) => o.id === shipId)) shipId = opts[0].id;
    const opt = opts.find((o) => o.id === shipId);
    const fee = opt.price_cents || 0;
    totalCents = sub + fee;
    $('.co-ships').innerHTML = opts.map((o) => `<label class="co-ship ${o.id === shipId ? 'on' : ''}"><input type="radio" name="ship" value="${esc(o.id)}" ${o.id === shipId ? 'checked' : ''}><span class="rdo"></span>
      <span class="co-ship-name"><b>${esc(o.label)}</b><small>${esc(o.eta)}</small></span><b class="co-ship-price">${o.price_cents ? money(o.price_cents) : 'FREE'}</b></label>`).join('');
    $$('.co-ships input').forEach((r) => (r.onchange = () => { shipId = r.value; renderSummary(); }));
    $('.co-sub-v').textContent = money(sub);
    $('.co-ship-v').textContent = fee ? money(fee) : 'FREE';
    $('.co-ship-lbl').textContent = fee ? `Shipping · ${opt.label}` : 'Shipping';
    $('.co-total').textContent = money(totalCents);
    $('.co-total-sm').textContent = money(totalCents);
    $('#pay-btn').textContent = `Pay now · ${money(totalCents)}`;
    return true;
  }

  const showError = (msg) => { const e = $('.co-error'); e.textContent = msg; e.hidden = !msg; if (msg) e.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  function customer() {
    const v = (id) => $('#' + id)?.value.trim() || '';
    return { email: v('email'), phone: v('phone'), firstName: v('firstName'), lastName: v('lastName'),
      address: { line1: v('line1'), line2: v('line2'), city: v('city'), state: v('state'), zip: v('zip'), country: v('country') } };
  }
  function validate() {
    for (const el of $$('input[required],select[required]', $('#co-form'))) {
      if (el.type === 'email') el.value = el.value.replace(/\s+/g, '');
      if (!el.value.trim() || (el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim()))) {
        el.closest('.f')?.classList.add('bad'); el.focus();
        showError(el.type === 'email' ? 'Enter a valid email address.' : 'Please fill in all required delivery details.');
        return false;
      }
    }
    return true;
  }
  const saveForm = () => { try { localStorage.setItem(FORM_KEY, JSON.stringify(customer())); } catch {} };
  function restoreForm() {
    try {
      const c = JSON.parse(localStorage.getItem(FORM_KEY)); if (!c) return;
      for (const k of ['email', 'phone', 'firstName', 'lastName']) if (c[k] && $('#' + k)) $('#' + k).value = c[k];
      if (c.address) { $('#country').value = c.address.country || 'US'; renderState(); for (const k of ['line1', 'line2', 'city', 'state', 'zip']) if (c.address[k] && $('#' + k)) $('#' + k).value = c.address[k]; }
    } catch {}
  }

  async function charge(sourceId) {
    const items = lines().map((l) => ({ handle: l.handle, tier: l.tier, qty: l.qty || 1, addons: l.addons || [], variant: l.variant }));
    const res = await fetch('/.netlify/functions/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, customer: customer(), sourceId, shippingId: shipId, expectedTotal: totalCents }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.error || 'Payment failed. Please try again.');
    try { localStorage.removeItem(CART_KEY); } catch {}
    location.href = `thank-you.html?order=${encodeURIComponent(j.orderNumber)}${j.receiptUrl ? `&receipt=${encodeURIComponent(j.receiptUrl)}` : ''}`;
  }

  async function run(tokenizer) {
    if (busy) return;
    showError('');
    if (!validate()) return;
    saveForm();
    busy = true; $('.co-overlay').hidden = false; $('#pay-btn').disabled = true;
    try {
      const c = customer();
      const result = await tokenizer({
        amount: (totalCents / 100).toFixed(2), currencyCode: 'USD', intent: 'CHARGE', customerInitiated: true, sellerKeyedIn: false,
        billingContact: { givenName: c.firstName, familyName: c.lastName, email: c.email, phone: c.phone || undefined,
          addressLines: [c.address.line1, c.address.line2].filter(Boolean), city: c.address.city, state: c.address.state, postalCode: c.address.zip, countryCode: c.address.country },
      });
      if (result?.status !== 'OK' || !result.token) throw new Error(result?.errors?.[0]?.message ? `Please check your card details: ${result.errors[0].message}` : 'Please check your card details.');
      await charge(result.token);
    } catch (e) {
      busy = false; $('.co-overlay').hidden = true; $('#pay-btn').disabled = false;
      showError(e.message || 'Payment failed. Please try again.');
    }
  }

  const loadScript = (src) => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.append(s); });

  async function initSquare() {
    try {
      const r = await fetch('/.netlify/functions/pay', { cache: 'no-store' });
      CFG = await r.json();
      if (!r.ok || !CFG.applicationId) throw new Error(CFG.error || 'config');
      await loadScript(CFG.env === 'production' ? 'https://web.squarecdn.com/v1/square.js' : 'https://sandbox.web.squarecdn.com/v1/square.js');
      payments = window.Square.payments(CFG.applicationId, CFG.locationId);
      card = await payments.card({ style: { '.input-container': { borderColor: '#f1d5e0', borderRadius: '10px' }, '.input-container.is-focus': { borderColor: '#C21E56' }, 'input': { fontSize: '16px' } } });
      $('#card-container').innerHTML = '';
      await card.attach('#card-container');
      $('#pay-btn').disabled = false;
    } catch (e) {
      console.error(e);
      $('#card-container').innerHTML = '<div class="co-card-ph"><span>Card number</span><span>MM / YY</span><span>CVV</span><span>ZIP</span></div><p class="co-loading">The secure card form loads here once Square is connected.</p>';
      return;
    }
    const req = () => payments.paymentRequest({ countryCode: 'US', currencyCode: 'USD', total: { amount: (totalCents / 100).toFixed(2), label: 'Pawrincess' } });
    let any = false;
    try { const gp = await payments.googlePay(req()); await gp.attach('#google-pay', { buttonColor: 'black', buttonSizeMode: 'fill', buttonType: 'plain' }); $('#google-pay').hidden = false; any = true; $('#google-pay').addEventListener('click', (e) => { e.preventDefault(); run(() => gp.tokenize()); }); } catch {}
    try { const ap = await payments.applePay(req()); const el = $('#apple-pay'); el.innerHTML = '<button type="button" class="apple-btn" aria-label="Pay with Apple Pay"></button>'; el.hidden = false; any = true; el.firstChild.addEventListener('click', () => run(() => ap.tokenize())); } catch {}
    if (any) $('.co-express').hidden = false;
  }

  async function boot() {
    try { CAT = await (await fetch('data/catalog.json', { cache: 'no-cache' })).json(); }
    catch { showError('Store data failed to load. Please refresh.'); return; }
    renderState();
    restoreForm();
    if (!renderSummary()) return;
    $('#country').addEventListener('change', renderState);
    $('#co-form').addEventListener('input', (e) => e.target.closest('.f')?.classList.remove('bad'));
    $('#co-form').addEventListener('submit', (e) => { e.preventDefault(); if (card) run((d) => card.tokenize(d)); });
    const t = $('.co-sum-toggle');
    t.addEventListener('click', () => { const open = document.body.classList.toggle('sum-open'); t.setAttribute('aria-expanded', open); });
    initSquare();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
