/* Display-only privacy helpers. Backend responses remain unchanged. */
(function (root) {
  'use strict';
  const hidden = '[Attachment hidden]';
  function cleanMessageText(input) {
    if (input == null) return '';
    let s = String(input).replace(/\r\n?/g, '\n');
    // Decode in an inert textarea; never attach source markup to the document.
    if (typeof document !== 'undefined') {
      const decoder = document.createElement('textarea');
      for (let i = 0; i < 2; i++) {
        decoder.innerHTML = s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        s = decoder.value;
      }
    }
    s = s.replace(/<a\b[^>]*>\s*<\/a\s*>/gi, hidden)
      .replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, hidden)
      .replace(/<(?:img|video|audio|source|embed)\b[^>]*>/gi, hidden)
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/?(?:p|div|li|ul|ol|blockquote|h[1-6]|tr|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/data:[^\s,]*[;,](?:base64,)?[A-Za-z0-9+/=]+/gi, hidden)
      .replace(/(?:https?:\/\/|www\.|blob:|\/\/)[^\s<>"'|]+/gi, hidden)
      .replace(/(?:\.?\.?\/)?[^\s<>"'|]*\.(?:png|jpe?g|gif|webp|pdf|heic|svg|zip)(?:\?[^\s<>"'|]*)?/gi, hidden)
      .replace(/[A-Za-z0-9+/]{120,}={0,2}/g, hidden);
    return s.replace(/[\t \u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function maskMiddle(value, start = 1, end = 1) {
    const s = String(value || '');
    if (!s || /[*•●]/.test(s)) return s;
    const chars = Array.from(s);
    if (chars.length === 1) return '*';
    if (chars.length <= start + end) return chars[0] + '*'.repeat(chars.length - 1);
    return chars.slice(0, start).join('') + '*'.repeat(chars.length - start - end) + (end ? chars.slice(-end).join('') : '');
  }
  function maskEmail(s) {
    const at = s.lastIndexOf('@');
    return at < 0 ? maskMiddle(s) : maskMiddle(s.slice(0, at)) + s.slice(at);
  }
  function maskPhone(s) {
    return /[*•●]/.test(s) ? s : maskMiddle(s.replace(/[^0-9০-৯]/g, '') || s, 2, 2);
  }
  function maskSensitiveText(input) {
    let s = cleanMessageText(input);
    s = s.replace(/((?:reg(?:istered)?\s*)?(?:phone|mobile)(?:\s*(?:no\.?|number))?[ \t]*[:：=#][ \t]*)(\+?[0-9০-৯][0-9০-৯ ()-]*[0-9০-৯])(?=$|[^0-9০-৯*•●])/gi,
      (all, label, value) => label + maskPhone(value));
    const label = '(?:(?:player|affiliate|aff|generic)\\s*)?user\\s*name|(?:aff(?:iliate)?\\s*)?e-?mail|(?:reg(?:istered)?\\s*)?(?:phone|mobile)(?:\\s*(?:no\\.?|number))?|(?:account|cashout|reference|ref|transaction|request|player|customer|user)(?:\\s*(?:no\\.?|number|id))?(?:\\s*delete)?';
    const fields = new RegExp('(^|[\\s|;,])(' + label + ')([ \\t]*(?::|：|=|#| -)[ \\t]*|[ \\t]+)([^\\s|;,]+)', 'gi');
    s = s.replace(fields, (all, before, key, separator, value) => {
      if (value === '[Attachment') return all;
      if (/^\s+$/.test(separator) && /^(?:account|cashout|reference|ref|transaction|request|player|customer|user)$/i.test(key)) return all;
      const masked = /mail/i.test(key) ? maskEmail(value) : /phone|mobile/i.test(key) ? maskPhone(value) : maskMiddle(value, /reference|ref|transaction|cashout|account|request/i.test(key) ? 2 : 1, /reference|ref|transaction|cashout|account|request/i.test(key) ? 2 : 1);
      return before + key + separator + masked;
    });
    s = s.replace(/[A-Z0-9._%+*•●-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, maskEmail);
    s = s.replace(/(^|[^\p{L}\p{N}*•●])([+০-৯0-9][০-৯0-9 ()-]{5,}[০-৯0-9])(?=$|[^\p{L}\p{N}*•●])/gu, (all, prefix, value) => {
      const count = value.replace(/[^0-9০-৯]/g, '').length;
      return count >= 7 ? prefix + maskPhone(value) : all;
    });
    return s;
  }
  const api = { cleanMessageText, maskSensitiveText, maskMiddle, maskEmail, maskPhone };
  if (typeof module !== 'undefined') module.exports = api;
  Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
