(function () {
  'use strict';

  function parseJSONScript(id) {
    var node = document.getElementById(id);
    if (!node) return null;
    try {
      return JSON.parse(node.textContent || '{}');
    } catch (e) {
      console.warn('[LP lead export] JSON parse failed for', id, e);
      return null;
    }
  }

  function toOrderRef() {
    var now = new Date();
    var y = now.getUTCFullYear();
    var m = String(now.getUTCMonth() + 1).padStart(2, '0');
    var d = String(now.getUTCDate()).padStart(2, '0');
    var suffix = Math.random().toString(16).slice(2, 10).toUpperCase();
    return 'Rawnaq' + y + m + d + suffix;
  }

  function toIdempotencyKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'idem-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10);
  }

  function normalizePhone(raw) {
    return String(raw || '')
      .replace(/\s+/g, '')
      .replace(/[^\d+]/g, '');
  }

  function inferCountry(phone, fallback) {
    var value = normalizePhone(phone);
    var digits = value.replace(/^\+/, '');
    if (digits.indexOf('966') === 0) return 'SA';
    if (digits.indexOf('971') === 0) return 'AE';
    if (digits.indexOf('965') === 0) return 'KW';
    if (digits.indexOf('968') === 0) return 'OM';
    if (digits.indexOf('974') === 0) return 'QA';
    if (digits.indexOf('973') === 0) return 'BH';
    if (digits.indexOf('212') === 0) return 'MA';
    return fallback || 'SA';
  }

  function currencyFromCountry(country, fallback) {
    var map = {
      SA: 'SAR',
      AE: 'AED',
      KW: 'KWD',
      OM: 'OMR',
      QA: 'QAR',
      BH: 'BHD',
      MA: 'MAD'
    };
    return map[country] || fallback || 'SAR';
  }

  function makeEndpoint(baseOrFull) {
    var raw = String(baseOrFull || '').trim();
    if (!raw) return '';
    if (raw.indexOf('/api/orders') !== -1) return raw;
    return raw.replace(/\/$/, '') + '/api/orders';
  }

  function readField(form, candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      var node = form.querySelector(candidates[i]);
      if (node && typeof node.value === 'string' && node.value.trim()) {
        return node.value.trim();
      }
    }
    return '';
  }

  function collectAttribution() {
    var url = new URL(window.location.href);
    return {
      utm_source: url.searchParams.get('utm_source') || 'direct',
      utm_medium: url.searchParams.get('utm_medium') || '-',
      utm_campaign: url.searchParams.get('utm_campaign') || '-',
      utm_term: url.searchParams.get('utm_term') || '-',
      utm_content: url.searchParams.get('utm_content') || '-',
      ad_id: url.searchParams.get('ad_id') || '',
      adset_id: url.searchParams.get('adset_id') || '',
      campaign_id: url.searchParams.get('campaign_id') || '',
      landing_url: url.href,
      landing_path: url.pathname,
      landing_query: url.search,
      page_url: window.location.href,
      referrer: document.referrer || '',
      user_agent: navigator.userAgent || ''
    };
  }

  function findVariantId(form) {
    var checked = form.querySelector('input[name="id"]:checked');
    if (checked && checked.value) return String(checked.value);

    var select = form.querySelector('select[name="id"]');
    if (select && select.value) return String(select.value);

    var hidden = form.querySelector('input[type="hidden"][name="id"]');
    if (hidden && hidden.value) return String(hidden.value);

    var input = form.querySelector('input[name="id"]');
    if (input && input.value) return String(input.value);

    return '';
  }

  function toOrderDate() {
    var now = new Date();
    var d = String(now.getDate()).padStart(2, '0');
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var y = now.getFullYear();
    return d + '/' + m + '/' + y;
  }

  function postJSON(url, payload) {
    if (!url) return;
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function (error) {
        console.warn('[LP lead export] request failed', error);
      });
    } catch (error) {
      console.warn('[LP lead export] request exception', error);
    }
  }

  function bindSection(section) {
    var sectionId = section.getAttribute('data-section-id');
    if (!sectionId) return;

    var config = parseJSONScript('lp-config-' + sectionId) || {};
    if (!config.enableLeadExport) return;

    var variants = parseJSONScript('lp-variants-' + sectionId) || {};
    var form =
      document.querySelector('#lp-product-form form[action*="/cart/add"]') ||
      document.querySelector('form[action*="/cart/add"]');

    if (!form || form.dataset.lpLeadBound === 'true') return;
    form.dataset.lpLeadBound = 'true';

    form.addEventListener('submit', function () {
      var customerName = readField(form, [
        '[name="properties[Customer name]"]',
        '[name="properties[name]"]',
        '[name*="properties"][name*="Name"]',
        '[name*="properties"][name*="name"]'
      ]);
      var customerPhone = readField(form, [
        '[name="properties[Customer phone]"]',
        '[name="properties[phone]"]',
        '[name*="properties"][name*="phone"]',
        '[name*="properties"][name*="Phone"]'
      ]);
      var customerCity = readField(form, [
        '[name="properties[Customer city]"]',
        '[name="properties[city]"]',
        '[name*="properties"][name*="city"]',
        '[name*="properties"][name*="City"]'
      ]);

      var orderRef = toOrderRef();
      var eventId = 'order_' + orderRef;
      var idempotencyKey = toIdempotencyKey();
      var variantId = findVariantId(form);
      var variant = variants[variantId] || {};
      var qtyNode = form.querySelector('input[name="quantity"]');
      var quantity = parseInt((qtyNode && qtyNode.value) || '1', 10);
      if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;

      var country = inferCountry(customerPhone, config.defaultCountry || 'SA');
      var shopCurrency = section.getAttribute('data-shop-currency') || '';
      var currency = currencyFromCountry(country, shopCurrency);
      var unitPrice = Number(variant.price || 0);
      var lineTotal = Number((unitPrice * quantity).toFixed(2));
      var sku = (variant.sku || section.getAttribute('data-product-handle') || '').toUpperCase();
      var attribution = collectAttribution();

      var backendPayload = {
        order_ref: orderRef,
        event_id: eventId,
        idempotency_key: idempotencyKey,
        name: customerName,
        phone: normalizePhone(customerPhone),
        country: country,
        currency: currency,
        city: customerCity,
        address: customerCity || country,
        items: [
          {
            slug: section.getAttribute('data-product-handle') || '',
            qty: quantity,
            sku: sku,
            offer_id: 'offer_' + quantity + '_pack' + (quantity > 1 ? 's' : ''),
            client_line_total: lineTotal
          }
        ],
        attribution: attribution,
        honeypot: ''
      };

      var sheetPayload = {
        OrderDate: toOrderDate(),
        orderid: orderRef,
        order_ref: orderRef,
        country: country,
        name: customerName,
        phone: normalizePhone(customerPhone),
        address: customerCity || country,
        city: customerCity,
        url: attribution.page_url,
        landing_url: attribution.landing_url,
        landing_path: attribution.landing_path,
        landing_query: attribution.landing_query,
        original_redirect_url: attribution.original_redirect_url || '',
        sku: sku,
        Product: section.getAttribute('data-product-title') || '',
        quantity: String(quantity),
        price: lineTotal,
        currency: currency,
        status: '',
        notes: 'COD',
        utm_source: attribution.utm_source,
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign,
        utm_term: attribution.utm_term,
        utm_content: attribution.utm_content,
        ad_id: attribution.ad_id,
        adset_id: attribution.adset_id,
        campaign_id: attribution.campaign_id,
        national_address: customerCity || country,
        items: [
          {
            slug: section.getAttribute('data-product-handle') || '',
            name_ar: section.getAttribute('data-product-title') || '',
            sku: sku,
            qty: quantity,
            line_total: lineTotal
          }
        ],
        items_total: lineTotal,
        order_total: lineTotal
      };

      var backendEndpoint = makeEndpoint(config.backendUrl);
      var sheetEndpoint = String(config.sheetWebhookUrl || '').trim();

      if (backendEndpoint) {
        postJSON(backendEndpoint, backendPayload);
      } else if (sheetEndpoint) {
        postJSON(sheetEndpoint, sheetPayload);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var sections = document.querySelectorAll('.lp-story[data-section-id], #bayel-moss-lp[data-section-id], .bm-lp[data-section-id]');
    sections.forEach(bindSection);
  });
})();
