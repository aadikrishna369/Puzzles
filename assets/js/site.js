// Shared behaviour: header/footer injection, active nav, scroll reveal, card glow.
(function () {
  const root = document.currentScript.dataset.root || '';
  window.PZ = { root };
  const PIECE = 'M6 6h7.5a3.5 3.5 0 1 1 7 0H28v7.5a3.5 3.5 0 1 0 0 7V28H6z';
  window.PZ.piece = PIECE;
  const path = location.pathname.toLowerCase();
  const cur = /\/tools(\/|$)/.test(path) ? 'tools' : path.includes('about') ? 'about' : path.includes('contact') ? 'contact' : path.endsWith('404.html') ? '' : 'home';
  const nav = [['home', 'Home', 'index.html'], ['tools', 'Tools', 'tools/index.html'], ['about', 'About', 'about.html'], ['contact', 'Contact', 'contact.html']];

  document.body.insertAdjacentHTML('afterbegin', '<div class="bgfx"><i></i><i></i></div>');

  const logo = `<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B7CFF"/><stop offset="1" stop-color="#45D6E8"/></linearGradient></defs><path fill="url(#lg)" d="${PIECE}"/></svg>`;
  const header = `<header class="nav"><div class="wrap nav-in">
    <a class="logo" href="${root}index.html">${logo}Puzzles</a>
    <nav class="menu">${nav.map(n => `<a href="${root}${n[2]}"${n[0] === cur ? ' class="on"' : ''}>${n[1]}</a>`).join('')}</nav>
    <a class="btn sm" href="${root}tools/index.html">Explore tools</a>
    <button class="burger" aria-label="Menu">☰</button></div></header>`;
  const footer = `<footer class="foot"><div class="wrap"><div class="foot-g">
    <div><a class="logo" href="${root}index.html">${logo}Puzzles</a><p>Small, sharp tools for everyday tasks. Find the missing piece and get on with your day.</p></div>
    <div><h4>Explore</h4><ul><li><a href="${root}index.html">Home</a></li><li><a href="${root}tools/index.html">All tools</a></li><li><a href="${root}about.html">About</a></li></ul></div>
    <div><h4>Support</h4><ul><li><a href="${root}contact.html">Contact</a></li><li><a href="${root}contact.html#faq">FAQ</a></li><li><a href="${root}contact.html">Suggest a tool</a></li></ul></div>
    </div><div class="copy">© ${new Date().getFullYear()} Puzzles. All rights reserved.</div></div></footer>`;

  const h = document.getElementById('site-header'), f = document.getElementById('site-footer');
  h ? h.outerHTML = header : document.body.insertAdjacentHTML('afterbegin', header);
  f ? f.outerHTML = footer : document.body.insertAdjacentHTML('beforeend', footer);

  const navEl = document.querySelector('.nav');
  document.querySelector('.burger').addEventListener('click', () => navEl.classList.toggle('open'));
  document.querySelectorAll('.menu a').forEach(a => a.addEventListener('click', () => navEl.classList.remove('open')));
  const onScroll = () => navEl.classList.toggle('stuck', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' }) : null;
  window.PZ.reveal = (scope = document) => scope.querySelectorAll('.reveal:not(.in)').forEach(el => io ? io.observe(el) : el.classList.add('in'));
  window.PZ.reveal();

  document.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.card');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
})();
