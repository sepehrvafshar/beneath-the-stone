// Hosting-only redirect. The game itself remains a self-contained static file.
export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'beneath-the-stone.sepehr-vaezafshar.workers.dev') {
      url.protocol = 'https:';
      url.hostname = 'bts.sepafshar.com';
      url.port = '';
      if (url.pathname === '/index.html') url.pathname = '/';
      return Response.redirect(url.href, 301);
    }
    return env.ASSETS.fetch(request);
  },
};
