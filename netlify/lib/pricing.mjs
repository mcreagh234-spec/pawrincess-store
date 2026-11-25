// Server-side pricing for Pawrincess. Prices always come from data/catalog.json — never from the browser.
export async function loadCatalog(origin) {
  const r = await fetch(`${origin}/data/catalog.json`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!r.ok) throw new Error('catalog');
  return r.json();
}

// Returns { lineItems, subtotal, shippingFee, shippingLabel, total, currency } or throws Error(userMessage)
export function priceCart(catalog, rawItems, shippingId) {
  const items = Array.isArray(rawItems) ? rawItems.slice(0, 50) : [];
  if (!items.length) throw new Error('Your cart is empty.');
  const currency = catalog.store.currency || 'USD';
  const lineItems = [];
  let subtotal = 0;

  for (const it of items) {
    const p = catalog.products.find((x) => x.handle === it?.handle);
    if (!p) throw new Error('An item in your cart is no longer available.');
    const qty = Math.floor(Number(it.qty));
    if (!(qty >= 1 && qty <= 10)) throw new Error('Invalid quantity.');

    const b = p.bundles;
    const tier = b ? b.tiers.find((t) => t.id === String(it.tier)) : null;
    if (b && !tier) throw new Error('Please choose a bundle.');
    const price = tier ? tier.price_cents : p.price_cents;
    subtotal += price * qty;
    const variant = (p.variants || []).find((v) => v.id === String(it.variant));
    lineItems.push({
      name: `${p.title}${tier ? ` – ${tier.title}` : ''}`.slice(0, 255),
      quantity: String(qty),
      base_price_money: { amount: price, currency },
      note: variant ? `Style: ${variant.label}`.slice(0, 500) : undefined,
    });

    for (const id of new Set(it.addons || [])) {
      const a = b?.addons?.find((x) => x.id === id);
      if (!a) continue;
      subtotal += a.price_cents; // flat, once per line
      lineItems.push({ name: a.title.replace(/^\+\s*/, ''), quantity: '1', base_price_money: { amount: a.price_cents, currency } });
    }
  }

  const opts = catalog.store.shipping_options;
  let shippingFee = 0, shippingLabel = 'Free Shipping';
  if (Array.isArray(opts) && opts.length) {
    const opt = opts.find((o) => o.id === shippingId) || opts[0];
    shippingFee = opt.price_cents || 0;
    shippingLabel = opt.label || 'Shipping';
  }

  return { lineItems, subtotal, shippingFee, shippingLabel, total: subtotal + shippingFee, currency };
}
