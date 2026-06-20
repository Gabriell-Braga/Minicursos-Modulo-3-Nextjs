(function () {
  var slides = document.querySelectorAll('.slides-deck .slide-container');
  var prevBtn = document.getElementById('prev-slide');
  var nextBtn = document.getElementById('next-slide');
  var counterEl = document.getElementById('slide-counter');
  var totalEl = document.getElementById('slide-total');
  var deck = document.querySelector('.slides-deck');
  var current = 0;
  var total = slides.length;

  if (!total || !prevBtn || !nextBtn || !counterEl || !totalEl) {
    return;
  }

  totalEl.textContent = String(total);

  function parseSlideFromUrl() {
    var hash = window.location.hash.replace(/^#/, '');
    var match = hash.match(/^slide-(\d+)$/i) || hash.match(/^(\d+)$/);
    if (match) {
      var n = parseInt(match[1], 10);
      if (n >= 1 && n <= total) {
        return n - 1;
      }
    }
    try {
      var params = new URLSearchParams(window.location.search);
      var qs = params.get('slide');
      if (qs !== null && qs !== '') {
        var n2 = parseInt(qs, 10);
        if (!isNaN(n2) && n2 >= 1 && n2 <= total) {
          return n2 - 1;
        }
      }
    } catch (e) { /* ignorar */ }
    return 0;
  }

  function syncUrl() {
    var h = '#slide-' + (current + 1);
    if (window.location.hash !== h) {
      history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search + h
      );
    }
  }

  function show(index) {
    if (index < 0) index = 0;
    if (index >= total) index = total - 1;
    current = index;
    for (var i = 0; i < total; i++) {
      slides[i].classList.toggle('is-active', i === current);
    }
    var curSpan = counterEl.querySelector('.current');
    if (curSpan) curSpan.textContent = String(current + 1);
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === total - 1;
    syncUrl();
  }

  prevBtn.addEventListener('click', function () { show(current - 1); });
  nextBtn.addEventListener('click', function () { show(current + 1); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      show(current - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      show(current + 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      show(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      show(total - 1);
    }
  });

  window.addEventListener('hashchange', function () {
    show(parseSlideFromUrl());
  });

  /* Deslizar no dedo em telas touch (apresentações) */
  if (deck && total > 1) {
    var touchStartX = 0;
    var touchStartY = 0;
    deck.addEventListener(
      'touchstart',
      function (e) {
        if (!e.changedTouches || !e.changedTouches.length) return;
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      },
      { passive: true }
    );
    deck.addEventListener(
      'touchend',
      function (e) {
        if (!e.changedTouches || !e.changedTouches.length) return;
        var dx = e.changedTouches[0].screenX - touchStartX;
        var dy = e.changedTouches[0].screenY - touchStartY;
        if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        if (dx < 0) show(current + 1);
        else show(current - 1);
      },
      { passive: true }
    );
  }

  show(parseSlideFromUrl());
})();
