/* ── Neural Network Canvas Background ───────────────────────────────────── */

(function () {
  const canvas = document.getElementById('neural-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, nodes = [], mouse = { x: -9999, y: -9999 };
  const NODE_COUNT = 70;
  const MAX_DIST   = 160;
  const SPEED      = 0.4;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeNode() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - .5) * SPEED,
      vy: (Math.random() - .5) * SPEED,
      r: 1.5 + Math.random() * 2,
      pulse: Math.random() * Math.PI * 2
    };
  }

  function init() {
    resize();
    nodes = Array.from({ length: NODE_COUNT }, makeNode);
  }

  function drawNode(n, t) {
    const glow = .5 + .5 * Math.sin(n.pulse + t * .001);
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r * (1 + glow * .4), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,229,255,${.3 + glow * .4})`;
    ctx.fill();
  }

  function drawEdge(a, b, dist) {
    const alpha = (1 - dist / MAX_DIST) * .35;
    const mdx = mouse.x - (a.x + b.x) / 2;
    const mdy = mouse.y - (a.y + b.y) / 2;
    const md  = Math.sqrt(mdx * mdx + mdy * mdy);
    const boost = Math.max(0, 1 - md / 200) * .5;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0,   `rgba(0,229,255,${alpha + boost})`);
    g.addColorStop(.5,  `rgba(168,85,247,${alpha * .7 + boost})`);
    g.addColorStop(1,   `rgba(0,229,255,${alpha + boost})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = .7 + boost * 1.5;
    ctx.stroke();
  }

  let last = 0;
  function tick(t) {
    if (t - last < 16) { requestAnimationFrame(tick); return; }
    last = t;

    ctx.clearRect(0, 0, W, H);

    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
      n.pulse += .02;
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < MAX_DIST) drawEdge(nodes[i], nodes[j], d);
      }
    }
    nodes.forEach(n => drawNode(n, t));
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => { resize(); nodes.forEach(n => {
    n.x = Math.min(n.x, W); n.y = Math.min(n.y, H);
  }); });
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  init();
  requestAnimationFrame(tick);
})();


/* ── Shared upload + predict logic (called from each page) ─────────────────── */

window.NeuralApp = (function () {

  function initUpload({ inputId, zoneId, previewImgId, previewWrapId,
                        predictBtnId, resultPanelId, endpoint, onResult }) {
    const input      = document.getElementById(inputId);
    const zone       = document.getElementById(zoneId);
    const previewImg = document.getElementById(previewImgId);
    const previewWrap= document.getElementById(previewWrapId);
    const predictBtn = document.getElementById(predictBtnId);
    const resultPanel= document.getElementById(resultPanelId);

    if (!input || !zone) return;

    // Drag events
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    });

    input.addEventListener('change', () => {
      if (input.files[0]) loadFile(input.files[0]);
    });

    function loadFile(file) {
      if (!file.type.startsWith('image/')) return;
      zone.classList.add('has-file');
      const reader = new FileReader();
      reader.onload = ev => {
        previewImg.src = ev.target.result;
        previewWrap.style.display = 'block';
        resultPanel.classList.remove('show');
        resultPanel.style.display = 'none';
      };
      reader.readAsDataURL(file);
      input._file = file;
    }

    if (predictBtn) {
      predictBtn.addEventListener('click', async () => {
        const file = input._file || input.files[0];
        if (!file) return;

        predictBtn.disabled = true;
        predictBtn.textContent = 'PREDICTING…';

        // Show loading
        resultPanel.style.display = 'block';
        resultPanel.classList.remove('show');
        resultPanel.innerHTML = `<div class="spinner"></div>
          <p style="text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:.75rem;letter-spacing:.1em">RUNNING INFERENCE…</p>`;

        const form = new FormData();
        form.append('image', file);

        try {
          const res  = await fetch(endpoint, { method: 'POST', body: form });
          const data = await res.json();

          if (data.error) throw new Error(data.error);

          resultPanel.innerHTML = onResult(data);
          resultPanel.classList.add('show');

          // Animate bars after inject
          setTimeout(() => {
            document.querySelectorAll('.conf-bar').forEach(b => {
              b.style.width = b.dataset.target;
            });
            document.querySelectorAll('.digit-bar-vert').forEach(b => {
              b.style.height = b.dataset.target;
            });
          }, 50);

        } catch (err) {
          resultPanel.innerHTML = `<div class="error-msg">⚠ ${err.message}</div>`;
        }

        predictBtn.disabled = false;
        predictBtn.textContent = 'RUN PREDICTION';
      });
    }
  }

  return { initUpload };
})();


/* ── Arch layer tooltip pulse on hover ───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.arch-box').forEach(box => {
    box.addEventListener('mouseenter', () => {
      box.style.boxShadow = '0 0 18px rgba(0,229,255,.35)';
    });
    box.addEventListener('mouseleave', () => {
      box.style.boxShadow = '';
    });
  });
});
