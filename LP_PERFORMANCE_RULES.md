# Landing Page Performance Rules — DRSAMI Shopify Theme

> Applies to all landing pages, product LPs, and conversion pages.  
> Last updated: 2026-08-28

---

## GOALS

| Metric | Target |
|--------|--------|
| LCP (mobile) | < 2.5 s |
| CLS | < 0.1 |
| TBT | < 200 ms |
| FCP | < 1.8 s |

---

## RULE 1 — Hero / LCP Image

The first visible image (hero/bottle/banner) is the LCP element. It must be treated differently from all other images.

### Required attributes
```html
loading="eager"
fetchpriority="high"
decoding="sync"
width="[exact natural width]"
height="[exact natural height]"
```

### Required: separate mobile & desktop files
- Mobile version: ≤ 600px wide, AVIF or WebP
- Desktop version: ≤ 900px wide, AVIF or WebP
- Naming convention: `[name]-mobile.avif` / `[name]-desktop.avif`

### Required: `<picture>` element
```liquid
<picture>
  <source
    media="(max-width: 749px)"
    srcset="{{ '[name]-mobile.avif' | asset_url }}"
    type="image/avif"
  >
  <img
    src="{{ '[name].avif' | asset_url }}"
    alt="{{ product.title | escape }}"
    width="520"
    height="520"
    loading="eager"
    fetchpriority="high"
    decoding="sync"
    class="hero-image"
  >
</picture>
```

### Required: preload in `<head>`
Add this to `layout/theme.liquid` inside `<head>` for each LP template suffix:
```liquid
{%- if is_product_landing_template -%}
  <link rel="preload" as="image" href="{{ '[name]-mobile.avif' | asset_url }}" type="image/avif" media="(max-width: 749px)">
  <link rel="preload" as="image" href="{{ '[name].avif' | asset_url }}" type="image/avif" media="(min-width: 750px)">
{%- endif -%}
```

> ⚠️ `asset_url` does NOT support `width:` parameters for static theme assets.  
> DO NOT use `{{ 'image.avif' | asset_url: width: 500 }}` — it does nothing.  
> Always pre-resize images locally before uploading.

---

## RULE 2 — Below-the-Fold Images

All images not visible in the first viewport must use:

```html
loading="lazy"
decoding="async"
width="[natural width]"
height="[natural height]"
```

Use `<picture>` + WebP source + JPG/PNG fallback for photos:
```liquid
<picture>
  <source srcset="{{ '[name].webp' | asset_url }}" type="image/webp">
  <img
    src="{{ '[name].jpg' | asset_url }}"
    alt="..."
    width="400"
    height="568"
    loading="lazy"
    decoding="async"
  >
</picture>
```

---

## RULE 3 — Image Format & Size Guidelines

| Image type | Format | Max width | Quality |
|-----------|--------|-----------|---------|
| Hero/LCP (mobile) | AVIF | 600px | 38 CRF |
| Hero/LCP (desktop) | AVIF | 900px | 35 CRF |
| Lifestyle/before-after | WebP | 400–600px | 82 |
| Video poster | WebP | match video width | 80 |
| Avatar | JPG/WebP | 100px max | original |
| Background decorative | WebP | 1200px | 70–78 |

Compress images locally before upload:
```bash
# AVIF mobile (fast, using SVT-AV1):
ffmpeg -i input.avif -vf scale=520:-1 -c:v libsvtav1 -crf 38 -b:v 0 output-mobile.avif

# WebP (using Python Pillow):
python3 -c "
from PIL import Image
img = Image.open('input.jpg')
img = img.resize((400, int(400*img.height/img.width)))
img.save('output-400.webp', 'WEBP', quality=82, method=6)
"
```

---

## RULE 4 — No Broken `srcset` with `asset_url`

Theme static assets (files in `assets/`) do NOT support server-side resizing via `asset_url`. Do NOT use:
```liquid
{# WRONG — width parameter is ignored for theme assets #}
srcset="{{ 'image.avif' | asset_url: width: 300 }} 300w, ..."
```

The only valid approach for responsive theme images:
1. Pre-generate multiple sizes locally
2. Upload each size as a separate file (`image.avif`, `image-mobile.avif`)
3. Use `<picture>` element with `<source media="...">` tags

---

## RULE 5 — Video Posters

Video `poster=""` attribute supports WebP. Use WebP for all video poster images:
```liquid
{%- capture poster_webp -%}lp-review-{{ forloop.index }}-poster.webp{%- endcapture -%}
<video poster="{{ poster_webp | asset_url }}" preload="none" ...>
```

---

## RULE 6 — Width & Height Attributes

Always provide **exact natural dimensions** on every `<img>`. This prevents CLS.

```html
<!-- ✅ Correct: natural 1:1 square image -->
<img src="..." width="520" height="520" ...>

<!-- ❌ Wrong: guessed dimensions that don't match actual image -->
<img src="..." width="520" height="760" ...>
```

To check real dimensions:
```bash
sips -g pixelWidth -g pixelHeight assets/image.avif
```

---

## RULE 7 — No Hidden Double Downloads

Never include both desktop and mobile images in HTML where CSS hides one:
```html
<!-- ❌ Both images download even if one is hidden -->
<img class="desktop-only" src="big.jpg">
<img class="mobile-only" src="small.jpg">
```

Use `<picture>` with `media` attribute instead. Only one file downloads.

---

## RULE 8 — Tracking & Forms Safety

Never modify or remove:
- TikTok Pixel (`analytics.tiktok.com`)
- Meta Pixel
- Google tags / GA4
- Microsoft Clarity
- EasySell/COD form (`#lp-order`)
- CTA anchor links (`href="#lp-order"`)
- WhatsApp button
- Thank You page logic
- Upsell section logic
- Purchase/order events

---

## REUSABLE SNIPPET

Use `snippets/optimized-image.liquid` for all new LPs:

```liquid
{%- render 'optimized-image',
  src: 'lp-bottle.avif',
  mobile_src: 'lp-bottle-mobile.avif',
  alt: product.title,
  width: 520,
  height: 520,
  class: 'bm-hero__image',
  loading: 'eager',
  fetchpriority: 'high'
-%}
```

---

## NEW LP PERFORMANCE CHECKLIST

Before launching any new landing page:

- [ ] Hero image created in AVIF or WebP
- [ ] Mobile hero image ≤ 600px wide
- [ ] Desktop hero image ≤ 900px wide
- [ ] Hero image uploaded as separate mobile/desktop files
- [ ] `<picture>` element used for hero (not plain `<img>` with srcset)
- [ ] Hero `loading="eager"` ✅
- [ ] Hero `fetchpriority="high"` ✅
- [ ] Hero `decoding="sync"` ✅
- [ ] Hero `width` and `height` match real image dimensions ✅
- [ ] Preload links added in `theme.liquid` `<head>` for new template suffix
- [ ] `is_product_landing_template` variable updated if new suffix used
- [ ] All below-fold images use `loading="lazy"` ✅
- [ ] All below-fold images use `decoding="async"` ✅
- [ ] All images have explicit `width` and `height` attributes ✅
- [ ] No hidden desktop/mobile double download ✅
- [ ] No `asset_url: width:` used (does nothing) ✅
- [ ] Video posters converted to WebP ✅
- [ ] CTA anchor `#lp-order` tested and working ✅
- [ ] EasySell/COD form renders and submits ✅
- [ ] Thank You page accessible at `/pages/thank-you-cod` ✅
- [ ] Tracking pixels NOT removed ✅
- [ ] Mobile preview checked (375px, 390px, 430px) ✅
- [ ] PageSpeed Insights mobile run (target LCP < 2.5s) ✅

---

## IDENTIFIED LCP ELEMENTS PER PAGE

| Template | Section | LCP Element | File |
|----------|---------|-------------|------|
| `product.bayel-moss-lp` | `product-landing-story.liquid` | `.bm-hero__image` | `lp-bottle.avif` / `lp-bottle-mobile.avif` |
| `product.landing` | `product-landing-story.liquid` | `.bm-hero__image` | `lp-bottle.avif` / `lp-bottle-mobile.avif` |
| `page.thank-you-cod` | `thank-you-cod.liquid` | SVG checkmark (no images) | — |

---

## FILE INVENTORY (LP assets, as of 2026-08-28)

| File | Size | Usage |
|------|------|-------|
| `lp-bottle.avif` | 45KB | Hero desktop |
| `lp-bottle-mobile.avif` | 17KB | Hero mobile ≤749px |
| `lp-problem-before.jpg` | 61KB | Before image (fallback) |
| `lp-problem-before-400.webp` | 19KB | Before image (WebP) |
| `lp-problem-before-400.jpg` | 25KB | Before image (JPG resized) |
| `lp-review-1-poster.jpg` | 33KB | Video poster JPG fallback |
| `lp-review-1-poster.webp` | 14KB | Video poster WebP |
| `lp-review-2-poster.jpg` | 38KB | Video poster JPG fallback |
| `lp-review-2-poster.webp` | 17KB | Video poster WebP |
| `lp-review-3-poster.jpg` | 22KB | Video poster JPG fallback |
| `lp-review-3-poster.webp` | 7KB | Video poster WebP |
| `lp-review-4-poster.jpg` | 32KB | Video poster JPG fallback |
| `lp-review-4-poster.webp` | 13KB | Video poster WebP |
| `lp-avatar-1.jpg` | 3.6KB | Review avatar |
| `lp-avatar-2.jpg` | 2.3KB | Review avatar |
| `lp-avatar-3.jpg` | 4.2KB | Review avatar |
