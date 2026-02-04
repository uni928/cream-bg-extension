(() => {
  // ===== 設定 =====
  const CREAM = "rgb(255, 243, 214)"; // #FFF3D6
  const LIGHT_LUMA_THRESHOLD = 235;   // 0-255: 大きいほど“白に近い”判定が厳しい（=より白だけが対象）
  const ALPHA_MIN = 0.15;             // 透明すぎる背景は無視
  const MAX_NODES_PER_TICK = 600;     // 1回の処理上限（負荷対策）
  const OBSERVE_MUTATIONS = true;

  function isNearWhiteBackground(colorStr) {
    if (!colorStr) return false;
    const s = colorStr.trim().toLowerCase();
    if (s === "transparent") return false;

    // rgb/rgba のみ対象
    const m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/);
    if (!m) return false;

    const r = Math.max(0, Math.min(255, Number(m[1])));
    const g = Math.max(0, Math.min(255, Number(m[2])));
    const b = Math.max(0, Math.min(255, Number(m[3])));
    const a = m[4] == null ? 1 : Math.max(0, Math.min(1, Number(m[4])));

    if (a < ALPHA_MIN) return false;

    // 簡易輝度（Rec.601）
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    return luma >= LIGHT_LUMA_THRESHOLD;
  }

  const touched = new WeakSet();

  function shouldSkipElement(el) {
    if (!(el instanceof Element)) return true;
    const tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return true;
    if (tag === "SVG" || tag === "PATH" || tag === "G") return true;
    if (touched.has(el)) return true;
    return false;
  }

  function paintIfLight(el) {
    if (shouldSkipElement(el)) return;

    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;

    if (!isNearWhiteBackground(bg)) return;

    // 小さすぎる要素まで塗ると崩れやすいので保険
    const rect = el.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24) return;

    // 置換：白っぽい背景をクリームへ
    el.style.backgroundColor = CREAM;

    // 白背景前提で “薄いグレー文字” が見づらくなる場合があるので軽く濃くする（任意）
    const color = cs.color?.trim()?.toLowerCase() || "";
    const cm = color.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/);
    if (cm) {
      const r = Number(cm[1]), g = Number(cm[2]), b = Number(cm[3]);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      // かなり薄い文字だけを対象に少し濃くする
      if (luma > 140 && luma < 210) {
        el.style.color = "rgb(45, 45, 45)";
      }
    }

    touched.add(el);
  }

  function scan(root = document.documentElement) {
    const all = root.querySelectorAll("*");
    let i = 0;

    function tick() {
      const end = Math.min(all.length, i + MAX_NODES_PER_TICK);
      for (; i < end; i++) paintIfLight(all[i]);
      if (i < all.length) requestAnimationFrame(tick);
    }
    tick();
  }

  // 初回実行
  scan();

  // SPAなどで後から増える要素にも追随
  if (OBSERVE_MUTATIONS) {
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (n instanceof Element) {
            paintIfLight(n);

            const children = n.querySelectorAll?.("*");
            if (!children) continue;

            let count = 0;
            for (const c of children) {
              paintIfLight(c);
              if (++count > 250) break;
            }
          }
        }
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
