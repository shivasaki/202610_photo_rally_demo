(function () {
  const W = 1080, H = 1440; // 出力画像サイズ（3:4 縦）
  const BOARD = { x: 40, y: 640, w: 1000, h: 640 };
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
      <canvas id="board"></canvas>
      <canvas id="ink"></canvas>
      <div class="msg" id="msg"><p>カメラを起動しています…</p></div>
    </div>
    <div class="tools" id="tools">
      <span id="swatches" class="row"></span>
      <button class="chip" id="eraser" aria-pressed="false" type="button">黒板消し</button>
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
  const video = $("video"), bgimg = $("bgimg"), board = $("board"), ink = $("ink");
  const bctx = board.getContext("2d"), ictx = ink.getContext("2d");
  board.width = ink.width = W; board.height = ink.height = H;

  let stream = null, facing = "environment", color = COLORS[0][1], erasing = false;

  /* ---------- 黒板オーバーレイ ---------- */
  function today() { const d = new Date(); return `${d.getMonth() + 1}.${d.getDate()}`; }
  function drawBoard() {
    const c = bctx, b = BOARD;
    c.clearRect(0, 0, W, H);
    // 駅名板
    c.fillStyle = "rgba(246,246,242,.95)"; c.fillRect(32, 32, 330, 78);
    c.fillStyle = st.color; c.fillRect(32, 32, 18, 78);
    c.fillStyle = "#1d2621"; c.font = "bold 40px 'Zen Kaku Gothic New'"; c.textAlign = "left";
    c.fillText(st.name, 70, 86);
    // 木枠と黒板
    c.fillStyle = "#6b4a2b"; c.fillRect(b.x, b.y, b.w, b.h);
    c.fillStyle = "#2f5a43"; c.fillRect(b.x + 22, b.y + 22, b.w - 44, b.h - 44);
    let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 2200; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.05})`; c.fillRect(b.x + 22 + r() * (b.w - 44), b.y + 22 + r() * (b.h - 44), r() * 3 + 1, r() * 2 + 1); }
    // 罫線
    const gx0 = b.x + 110, gx1 = b.x + b.w - 120, gy0 = b.y + 110, gy1 = b.y + b.h - 50;
    c.strokeStyle = "rgba(235,245,235,.5)"; c.lineWidth = 2;
    c.strokeRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    for (let x = gx0 + 56; x < gx1; x += 56) { c.beginPath(); c.moveTo(x, gy0); c.lineTo(x, gy1); c.stroke(); }
    c.fillStyle = "rgba(240,245,238,.9)"; c.font = "46px 'Yusei Magic'"; c.textAlign = "center";
    c.fillText("伝　言　板", (gx0 + gx1) / 2, b.y + 88);
    // 左の注意書き（縦書き）
    c.font = "19px 'Zen Kaku Gothic New'"; c.fillStyle = "rgba(240,245,238,.7)";
    [..."六時間を過ぎたものは消します。"].forEach((ch, i) => c.fillText(ch, b.x + 66, gy0 + 24 + i * 26));
    // 右の日付欄
    c.font = "22px 'Zen Kaku Gothic New'"; c.fillText("日付", b.x + b.w - 66, gy0 + 26);
    c.font = "30px 'Yusei Magic'"; c.fillStyle = "#f3d36b";
    [...today()].forEach((ch, i) => c.fillText(ch, b.x + b.w - 66, gy0 + 72 + i * 34));
    // 作品モチーフの差し替え枠
    slot((gx0 + gx1) / 2 - 260, gy0 + 150, 360, 180, "モチーフ素材");
    // 素材差し替え枠
    slot(760, 300, 260, 400, st.chara);
    slot(60, 1300, 240, 110, "小道具素材");
    c.fillStyle = "rgba(255,255,255,.85)"; c.font = "22px 'Zen Kaku Gothic New'"; c.textAlign = "right";
    c.fillText("〇〇展　会期 〇/〇〜〇/〇　会場 〇〇", W - 40, H - 30);
  }
  function slot(x, y, w, h, label) {
    const c = bctx; c.save();
    c.fillStyle = "rgba(243,211,107,.18)"; c.fillRect(x, y, w, h);
    c.setLineDash([12, 9]); c.strokeStyle = "#f3d36b"; c.lineWidth = 4; c.strokeRect(x, y, w, h); c.setLineDash([]);
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
    o.drawImage(board, 0, 0); o.drawImage(ink, 0, 0);
    const url = out.toDataURL("image/jpeg", .88);
    $("result-img").src = url; $("download").href = url;
    out.toBlob(b => {
      blob = b;
      const file = new File([b], `dengonban-${st.id}.jpg`, { type: "image/jpeg" });
      $("share").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    }, "image/jpeg", .88);
    // スタンプ帳用の縮小版
    const sm = document.createElement("canvas"); sm.width = 360; sm.height = 480;
    sm.getContext("2d").drawImage(out, 0, 0, 360, 480);
    const s = rallyLoad(); s.imgs[st.id] = sm.toDataURL("image/jpeg", .7); rallyStore(s);
    ["stage", "tools", "shutter-row"].forEach(id => $(id).hidden = true);
    $("result").hidden = false; window.scrollTo(0, 0);
  });
  $("share").onclick = async () => {
    try { await navigator.share({ files: [new File([blob], `dengonban-${st.id}.jpg`, { type: "image/jpeg" })], title: `${st.name}の伝言板` }); } catch (e) {}
  };
  $("retake").onclick = () => { ["stage", "tools", "shutter-row"].forEach(id => $(id).hidden = false); $("result").hidden = true; };

  // フォント読み込み後に黒板を描画してからカメラ起動
  (async () => {
    try { await Promise.all([document.fonts.load("46px 'Yusei Magic'"), document.fonts.load("bold 40px 'Zen Kaku Gothic New'")]); } catch (e) {}
    drawBoard(); startCamera();
  })();
})();
