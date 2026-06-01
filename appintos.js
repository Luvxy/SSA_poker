const appintosConfig = {
  appName: "ssachik-poker",
  displayName: "싸칙 포커",
  version: "0.1.0-appintos",
};

window.SSA_POKER_APPINTOS = appintosConfig;
document.documentElement.dataset.platform = "appintos";

function removeAdSenseNodes() {
  for (const adNode of document.querySelectorAll(".adsbygoogle, .ad-shell, script[src*='googlesyndication'], script[data-adsense-loader]")) {
    adNode.remove();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  removeAdSenseNodes();
  document.body.classList.add("appintos-ready");
});

removeAdSenseNodes();
window.setTimeout(removeAdSenseNodes, 1000);
