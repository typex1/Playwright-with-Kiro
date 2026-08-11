// Fake-mouse visualization demo.
// Injects an animated cursor dot + click ripple overlay, then moves it around
// the Task Manager board performing (harmless, no-op) ripple clicks so you can
// watch it move "like a real mouse".
async page => {
  // 1. Inject the fake cursor element and animation styles.
  await page.evaluate(() => {
    document.getElementById('__fakeCursorStyle')?.remove();
    document.getElementById('__fakeCursor')?.remove();

    const style = document.createElement('style');
    style.id = '__fakeCursorStyle';
    style.textContent = `
      #__fakeCursor {
        position: fixed; top: 0; left: 0; width: 24px; height: 24px;
        margin-left: -12px; margin-top: -12px; border-radius: 50%;
        background: rgba(0,122,255,0.30);
        border: 2px solid rgba(0,122,255,0.95);
        box-shadow: 0 1px 6px rgba(0,0,0,0.35);
        z-index: 2147483647; pointer-events: none;
        transition: left .45s cubic-bezier(.4,0,.2,1), top .45s cubic-bezier(.4,0,.2,1);
      }
      #__fakeCursor.__down { background: rgba(0,122,255,0.65); transform: scale(.8); }
      .__ripple {
        position: fixed; width: 10px; height: 10px; margin-left:-5px; margin-top:-5px;
        border-radius: 50%; border: 2px solid rgba(0,122,255,0.9);
        z-index: 2147483646; pointer-events: none;
        animation: __rippleAnim .6s ease-out forwards;
      }
      @keyframes __rippleAnim {
        from { transform: scale(1); opacity: .9; }
        to   { transform: scale(8); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    const c = document.createElement('div');
    c.id = '__fakeCursor';
    c.style.left = '60px';
    c.style.top = '60px';
    document.body.appendChild(c);
  });

  const moveTo = async (x, y) => {
    await page.evaluate(([x, y]) => {
      const c = document.getElementById('__fakeCursor');
      c.style.left = x + 'px';
      c.style.top = y + 'px';
    }, [x, y]);
    await page.mouse.move(x, y);      // move the real (synthetic) pointer too
    await page.waitForTimeout(550);   // let the CSS glide finish
  };

  const clickAt = async (x, y) => {
    await page.evaluate(([x, y]) => {
      document.getElementById('__fakeCursor')?.classList.add('__down');
      const r = document.createElement('div');
      r.className = '__ripple';
      r.style.left = x + 'px';
      r.style.top = y + 'px';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 650);
    }, [x, y]);
    await page.waitForTimeout(120);
    await page.mouse.click(x, y);     // the real click
    await page.evaluate(() => document.getElementById('__fakeCursor')?.classList.remove('__down'));
    await page.waitForTimeout(500);
  };

  // 2. Build a tour of headings (clicking them is a no-op, so nothing changes).
  const targets = [
    page.getByRole('heading', { name: 'Task Board' }),
    page.getByRole('heading', { name: /To Do/ }),
    page.getByRole('heading', { name: /In Progress/ }),
    page.getByRole('heading', { name: /Completed/ }),
  ];

  for (const t of targets) {
    const box = await t.boundingBox();
    if (!box) continue;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await moveTo(cx, cy);
    await clickAt(cx, cy);
  }

  // 3. Park the cursor back near the top-left.
  await moveTo(80, 80);
  await page.waitForTimeout(500);
}
