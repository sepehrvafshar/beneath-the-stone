// Hosting-only logic. The game itself remains a self-contained static file.
const CANONICAL_HOST = 'bts.sepafshar.com';
// Any workers.dev address (the account subdomain has changed before) is a legacy
// alias of the custom domain.
const isLegacyHost = (hostname) => hostname.endsWith('.workers.dev');
// Text responses worth compressing. _headers sets Cache-Control no-transform so
// Cloudflare never rewrites the page; that also stops its edge compression, so
// the Worker compresses these responses itself.
const COMPRESSIBLE = /^(text\/|application\/(xml|json|javascript))/;

const NOT_FOUND_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Page not found | Beneath the Stone</title>
<style>
html{color-scheme:dark;background:#0b0a09;color:#e9dcc4;font:1.05rem/1.6 Georgia,serif}
body{min-height:100vh;margin:0;display:grid;place-items:center;padding:1.5rem;text-align:center}
h1{font-weight:400;letter-spacing:.08em;color:#d8a15e}
a{color:#edbd78}
a:focus-visible{outline:2px solid #edbd78;outline-offset:3px}
</style></head>
<body><main><h1>This passage does not exist</h1><p>The page you asked for is not part of the cave.</p>
<p><a href="/">Return to Beneath the Stone</a></p></main></body></html>`;

function withSecurityHeaders(headers) {
  // Matches _headers so the 404 page carries the same policy as static assets.
  headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; img-src data:; media-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  return headers;
}

function maybeCompress(request, response) {
  const type = response.headers.get('Content-Type') || '';
  const accepts = request.headers.get('Accept-Encoding') || '';
  if (request.method === 'HEAD' || !response.body || response.headers.has('Content-Encoding') ||
      !COMPRESSIBLE.test(type) || !/\bgzip\b/.test(accepts)) return response;
  const headers = new Headers(response.headers);
  headers.set('Content-Encoding', 'gzip');
  headers.delete('Content-Length');
  headers.append('Vary', 'Accept-Encoding');
  // encodeBody "manual" sends the already gzipped bytes as they are.
  return new Response(response.body.pipeThrough(new CompressionStream('gzip')), {
    status: response.status, statusText: response.statusText, headers, encodeBody: 'manual',
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const legacy = isLegacyHost(url.hostname);
    if (legacy || url.protocol === 'http:') {
      url.protocol = 'https:';
      if (legacy) url.hostname = CANONICAL_HOST;
      url.port = '';
      if (url.pathname === '/index.html') url.pathname = '/';
      return Response.redirect(url.href, 301);
    }
    let response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      response = new Response(request.method === 'HEAD' ? null : NOT_FOUND_PAGE, {
        status: 404,
        headers: withSecurityHeaders(new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600, no-transform' })),
      });
    }
    return maybeCompress(request, response);
  },
};
