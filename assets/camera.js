(function () {
  // 端末の向きごとの出力サイズと配置。poster は位置合わせ枠で、ポスターの縦横比が決まったら合わせる
  const LAYOUTS = {
    portrait: { w: 1080, h: 1440, poster: { x: 40, y: 330, w: 1000, h: 600 }, chara: [790, 960, 250, 340], prop: [40, 1190, 240, 110] },
    landscape: { w: 1440, h: 1080, poster: { x: 170, y: 170, w: 1100, h: 660 }, chara: [1210, 700, 200, 290], prop: [40, 900, 220, 100] }
  };
  const landscapeMq = matchMedia("(orientation: landscape)");
  let L = null, W = 0, H = 0;
  const COLORS = [["白", "#f2f4ef"], ["黄", "#f3d36b"], ["桃", "#f2a0b6"], ["青", "#8fc8f0"]];
  const st = STATIONS.find(s => s.id === document.body.dataset.station) || STATIONS[0];
  document.title = `伝言板フォトラリー | ${st.name}`;

  const app = document.getElementById("app");
  app.innerHTML = `
  <div class="cam">
    <div class="topbar"><span>${st.name}（仮）・デモ</span><a href="../../goal/">スタンプ帳</a></div>
    <div class="stage" id="stage">
      <video id="video" playsinline muted autoplay></video>
      <img class="bgimg" id="bgimg" alt="" hidden>
      <canvas id="overlay"></canvas>
      <canvas id="guide"></canvas>
      <canvas id="ink"></canvas>
      <div class="msg" id="msg"><p>カメラを起動しています…</p></div>
    </div>
    <div class="tools" id="tools">
      <span id="swatches" class="row"></span>
      <button class="chip icon" id="eraser" aria-pressed="false" aria-label="消しゴム" title="消しゴム" type="button">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>
        </svg>
      </button>
      <button class="chip" id="clear" type="button">全部消す</button>
      <button class="chip" id="flip" type="button">カメラ切替</button>
    </div>
    <div class="shutter-row" id="shutter-row">
      <button class="shutter" id="shutter" type="button" aria-label="撮影" disabled></button>
    </div>
    <div class="result" id="result" hidden>
      <img id="result-img" alt="${st.name}の伝言板写真">
      <p>画像を長押しして保存するか、スクリーンショットを撮ってください。ゴールでこの画像を見せます。</p>
      <div class="row">
        <button class="btn primary" id="share" type="button" hidden>写真に保存・共有</button>
        <a class="btn" id="download" download="dengonban-${st.id}.jpg">画像をダウンロード</a>
        <button class="btn" id="retake" type="button">撮り直す</button>
      </div>
      <div class="row"><a class="btn" href="../../goal/">スタンプ帳を見る</a></div>
    </div>
    <input type="file" id="file" accept="image/*" capture="environment" hidden>
  </div>`;

  const $ = id => document.getElementById(id);
  const video = $("video"), bgimg = $("bgimg"), overlay = $("overlay"), guide = $("guide"), ink = $("ink");
  const octx = overlay.getContext("2d"), gctx = guide.getContext("2d"), ictx = ink.getContext("2d");

  // 向きが変わったら出力サイズを切り替える。書き込みは縦横比を保って新しいキャンバスに収める
  function applyLayout() {
    const next = landscapeMq.matches ? LAYOUTS.landscape : LAYOUTS.portrait;
    if (next === L) return;
    const prev = L && document.createElement("canvas");
    if (prev) { prev.width = W; prev.height = H; prev.getContext("2d").drawImage(ink, 0, 0); }
    L = next; W = L.w; H = L.h;
    overlay.width = guide.width = ink.width = W; overlay.height = guide.height = ink.height = H;
    $("stage").classList.toggle("landscape", W > H);
    if (prev) {
      const s = Math.min(W / prev.width, H / prev.height);
      ictx.drawImage(prev, (W - prev.width * s) / 2, (H - prev.height * s) / 2, prev.width * s, prev.height * s);
      drawOverlay(); drawGuide();
    }
  }
  applyLayout();

  let stream = null, facing = "environment", color = COLORS[0][1], erasing = false;

  /* ---------- オーバーレイ（ポスター自体が黒板なので、上に重ねるのは情報と素材枠だけ） ---------- */
  function today() { const d = new Date(); return `${d.getMonth() + 1}.${d.getDate()}`; }
  function plate(x, y, w, text, font, align) {
    const c = octx;
    c.fillStyle = "rgba(246,246,242,.95)"; c.fillRect(x, y, w, 78);
    c.fillStyle = "#1d2621"; c.font = font; c.textAlign = align;
    c.fillText(text, align === "left" ? x + 38 : x + w / 2, y + 54);
  }
  function drawOverlay() {
    const c = octx;
    c.clearRect(0, 0, W, H);
    plate(32, 32, 330, st.name, "bold 40px 'Zen Kaku Gothic New'", "left");
    c.fillStyle = st.color; c.fillRect(32, 32, 18, 78);
    plate(W - 32 - 200, 32, 200, today(), "40px 'Yusei Magic'", "center");
    // 素材差し替え枠
    slot(...L.chara, st.chara);
    slot(...L.prop, "小道具素材");
    c.save(); c.shadowColor = "rgba(0,0,0,.8)"; c.shadowBlur = 6;
    c.fillStyle = "rgba(255,255,255,.92)"; c.font = "22px 'Zen Kaku Gothic New'"; c.textAlign = "right";
    c.fillText("〇〇展　会期 〇/〇〜〇/〇　会場 〇〇", W - 40, H - 30); c.restore();
  }
  // 撮影前だけ見せる位置合わせ枠。保存画像には入れない
  function drawGuide() {
    const c = gctx, p = L.poster, k = 70;
    c.clearRect(0, 0, W, H);
    c.save(); c.shadowColor = "rgba(0,0,0,.7)"; c.shadowBlur = 6;
    c.strokeStyle = "rgba(255,255,255,.75)"; c.lineWidth = 3; c.setLineDash([16, 12]);
    c.strokeRect(p.x, p.y, p.w, p.h); c.setLineDash([]);
    c.lineWidth = 8; c.strokeStyle = "#fff"; c.beginPath();
    [[p.x, p.y, 1, 1], [p.x + p.w, p.y, -1, 1], [p.x, p.y + p.h, 1, -1], [p.x + p.w, p.y + p.h, -1, -1]].forEach(([x, y, dx, dy]) => {
      c.moveTo(x + dx * k, y); c.lineTo(x, y); c.lineTo(x, y + dy * k);
    });
    c.stroke();
    c.fillStyle = "#fff"; c.font = "bold 30px 'Zen Kaku Gothic New'"; c.textAlign = "center";
    c.fillText("ポスターの黒板をこの枠に合わせてください", W / 2, p.y - 24); c.restore();
  }
  function slot(x, y, w, h, label) {
    const c = octx; c.save();
    c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    c.fillStyle = "rgba(243,211,107,.18)"; c.fill();
    c.setLineDash([12, 9]); c.strokeStyle = "#f3d36b"; c.lineWidth = 4; c.stroke(); c.setLineDash([]);
    c.fillStyle = "#f3d36b"; c.textAlign = "center"; c.font = "bold 26px 'Zen Kaku Gothic New'";
    c.fillText(label, x + w / 2, y + h / 2); c.font = "18px 'Zen Kaku Gothic New'";
    c.fillText("素材差し替え", x + w / 2, y + h / 2 + 30); c.restore();
  }

  /* ---------- チョーク ---------- */
  function pos(e) { const r = ink.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  function stroke(a, b) {
    const c = ictx;
    if (erasing) { c.save(); c.globalCompositeOperation = "destination-out"; c.lineCap = "round"; c.lineWidth = 70; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.restore(); return; }
    c.strokeStyle = color; c.lineCap = "round"; c.globalAlpha = .88; c.lineWidth = 9;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    const n = Math.max(2, Math.hypot(b.x - a.x, b.y - a.y) / 2); c.fillStyle = color;
    for (let i = 0; i < n; i++) { const t = i / n; c.globalAlpha = Math.random() * .5; c.fillRect(a.x + (b.x - a.x) * t + (Math.random() - .5) * 14, a.y + (b.y - a.y) * t + (Math.random() - .5) * 14, 2, 2); }
    c.globalAlpha = 1;
  }
  let down = false, last = null;
  ink.addEventListener("pointerdown", e => { down = true; last = pos(e); ink.setPointerCapture(e.pointerId); stroke(last, { x: last.x + .1, y: last.y + .1 }); });
  ink.addEventListener("pointermove", e => { if (!down) return; const p = pos(e); stroke(last, p); last = p; });
  ["pointerup", "pointercancel"].forEach(t => ink.addEventListener(t, () => { down = false; }));

  $("swatches").innerHTML = COLORS.map(([n, c], i) => `<button class="swatch" type="button" style="background:${c}" aria-label="${n}" aria-pressed="${i === 0}" data-c="${c}"></button>`).join("");
  $("swatches").addEventListener("click", e => {
    const b = e.target.closest(".swatch"); if (!b) return;
    color = b.dataset.c; setErase(false);
    document.querySelectorAll(".swatch").forEach(s => s.setAttribute("aria-pressed", s === b));
  });
  function setErase(v) { erasing = v; $("eraser").setAttribute("aria-pressed", v); }
  $("eraser").onclick = () => setErase(!erasing);
  $("clear").onclick = () => ictx.clearRect(0, 0, W, H);

  /* ---------- カメラ ---------- */
  async function startCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    $("msg").hidden = false; $("msg").innerHTML = "<p>カメラを起動しています…</p>";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return cameraFailed("このブラウザではカメラを使えません。");
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
      video.srcObject = stream; video.hidden = false; bgimg.hidden = true;
      video.classList.toggle("mirror", facing === "user");
      await video.play();
      $("msg").hidden = true; $("shutter").disabled = false;
    } catch (err) {
      cameraFailed(err && err.name === "NotAllowedError" ? "カメラの使用が許可されませんでした。ブラウザの設定で許可するか、下のボタンで写真を撮ってください。" : "カメラを起動できませんでした。");
    }
  }
  function cameraFailed(text) {
    $("msg").hidden = false;
    $("msg").innerHTML = `<p>${text}</p><div class="row"><button class="btn primary" id="retry" type="button">もう一度試す</button><button class="btn" id="pick" type="button">写真を撮る・選ぶ</button></div>`;
    $("retry").onclick = startCamera; $("pick").onclick = () => $("file").click();
  }
  $("file").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    bgimg.src = URL.createObjectURL(f); bgimg.hidden = false; video.hidden = true;
    $("msg").hidden = true; $("shutter").disabled = false;
  });
  $("flip").onclick = () => { facing = facing === "environment" ? "user" : "environment"; startCamera(); };

  /* ---------- 撮影と保存 ---------- */
  function drawCover(c, src, sw, sh, mirror) {
    const s = Math.max(W / sw, H / sh), dw = sw * s, dh = sh * s;
    c.save(); if (mirror) { c.translate(W, 0); c.scale(-1, 1); }
    c.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh); c.restore();
  }
  let blob = null;
  $("shutter").addEventListener("click", () => {
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const o = out.getContext("2d");
    if (!video.hidden && video.videoWidth) drawCover(o, video, video.videoWidth, video.videoHeight, facing === "user");
    else if (!bgimg.hidden) drawCover(o, bgimg, bgimg.naturalWidth, bgimg.naturalHeight, false);
    o.drawImage(overlay, 0, 0); o.drawImage(ink, 0, 0);
    const url = out.toDataURL("image/jpeg", .88);
    $("result-img").src = url; $("download").href = url;
    out.toBlob(b => {
      blob = b;
      const file = new File([b], `dengonban-${st.id}.jpg`, { type: "image/jpeg" });
      $("share").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    }, "image/jpeg", .88);
    // スタンプ帳用の縮小版
    const sm = document.createElement("canvas"); sm.width = W / 3; sm.height = H / 3;
    sm.getContext("2d").drawImage(out, 0, 0, sm.width, sm.height);
    const s = rallyLoad(); s.imgs[st.id] = sm.toDataURL("image/jpeg", .7); rallyStore(s);
    ["stage", "tools", "shutter-row"].forEach(id => $(id).hidden = true);
    $("result").hidden = false; window.scrollTo(0, 0);
  });
  $("share").onclick = async () => {
    try { await navigator.share({ files: [new File([blob], `dengonban-${st.id}.jpg`, { type: "image/jpeg" })], title: `${st.name}の伝言板` }); } catch (e) {}
  };
  $("retake").onclick = () => { ["stage", "tools", "shutter-row"].forEach(id => $(id).hidden = false); $("result").hidden = true; };

  // フォント読み込み後にオーバーレイを描画してからカメラ起動
  (async () => {
    try { await Promise.all([document.fonts.load("46px 'Yusei Magic'"), document.fonts.load("bold 40px 'Zen Kaku Gothic New'")]); } catch (e) {}
    drawOverlay(); drawGuide(); startCamera();
    landscapeMq.addEventListener("change", applyLayout);
  })();
})();
