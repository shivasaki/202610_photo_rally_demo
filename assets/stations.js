// 駅名・キャラクターはすべて仮。本番の駅と素材に差し替える。
window.STATIONS = [
  { id: "a", name: "A駅", line: "1", color: "#c8962a", chara: "キャラクター1" },
  { id: "b", name: "B駅", line: "2", color: "#7a5aa6", chara: "キャラクター2" },
  { id: "c", name: "C駅", line: "3", color: "#3a88c4", chara: "キャラクター3" },
  { id: "d", name: "D駅", line: "4", color: "#cf6237", chara: "キャラクター4" },
  { id: "e", name: "E駅", line: "5", color: "#3f9a6b", chara: "キャラクター5" }
];
window.RALLY_KEY = "photo-rally-demo-v1";
window.rallyLoad = function () {
  try { return JSON.parse(localStorage.getItem(RALLY_KEY)) || { imgs: {}, handed: false }; }
  catch (e) { return { imgs: {}, handed: false }; }
};
window.rallyStore = function (s) {
  try { localStorage.setItem(RALLY_KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
};
