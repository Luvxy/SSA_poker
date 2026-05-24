const FIREBASE_SDK_VERSION = "11.10.0";
const NUMBER_JOKER = "숫자 조커";
const OPERATOR_JOKER = "사칙 조커";
const OPERATORS = ["+", "-", "×", "÷"];
const ROOM_CODE_LENGTH = 6;

const setupEl = document.querySelector("#setup");
const lobbyEl = document.querySelector("#lobby");
const tableEl = document.querySelector("#table");
const localTabEl = document.querySelector("#localTab");
const onlineTabEl = document.querySelector("#onlineTab");
const localSetupEl = document.querySelector("#localSetup");
const onlineSetupEl = document.querySelector("#onlineSetup");
const playerCountEl = document.querySelector("#playerCount");
const playerNameEl = document.querySelector("#playerName");
const roomCodeInputEl = document.querySelector("#roomCodeInput");
const firebaseStatusEl = document.querySelector("#firebaseStatus");
const createRoomEl = document.querySelector("#createRoom");
const joinRoomEl = document.querySelector("#joinRoom");
const startGameEl = document.querySelector("#startGame");
const roomCodeLabelEl = document.querySelector("#roomCodeLabel");
const copyRoomCodeEl = document.querySelector("#copyRoomCode");
const lobbyPlayersEl = document.querySelector("#lobbyPlayers");
const onlinePlayerCountEl = document.querySelector("#onlinePlayerCount");
const startOnlineGameEl = document.querySelector("#startOnlineGame");
const leaveRoomEl = document.querySelector("#leaveRoom");
const lobbyMessageEl = document.querySelector("#lobbyMessage");
const newRoundEl = document.querySelector("#newRound");
const targetNumberEl = document.querySelector("#targetNumber");
const phaseNameEl = document.querySelector("#phaseName");
const potAmountEl = document.querySelector("#potAmount");
const playersEl = document.querySelector("#players");
const roomPanelEl = document.querySelector("#roomPanel");
const activeRoomCodeEl = document.querySelector("#activeRoomCode");
const copyActiveRoomCodeEl = document.querySelector("#copyActiveRoomCode");
const turnTitleEl = document.querySelector("#turnTitle");
const turnMessageEl = document.querySelector("#turnMessage");
const betControlsEl = document.querySelector("#betControls");
const betAmountEl = document.querySelector("#betAmount");
const betValueEl = document.querySelector("#betValue");
const confirmBetEl = document.querySelector("#confirmBet");
const foldPlayerEl = document.querySelector("#foldPlayer");
const expressionControlsEl = document.querySelector("#expressionControls");
const expressionInputsEl = document.querySelector("#expressionInputs");
const expressionPreviewEl = document.querySelector("#expressionPreview");
const submitExpressionEl = document.querySelector("#submitExpression");
const resultPanelEl = document.querySelector("#resultPanel");

const client = {
  id: getClientId(),
  firebase: null,
  roomRef: null,
  unsubscribe: null,
  roomCode: null,
  onlineReady: false,
};

let state = createEmptyState();

function createEmptyState() {
  return {
    mode: "local",
    status: "setup",
    hostId: null,
    maxPlayers: 4,
    players: [],
    deck: [],
    target: 0,
    pot: 0,
    phase: "setup",
    actorIndex: 0,
    expressionIndex: 0,
    resultHtml: "",
  };
}

function getClientId() {
  const queryClientId = new URLSearchParams(window.location.search).get("client");
  if (queryClientId) return queryClientId;
  const saved = localStorage.getItem("ssaPokerClientId");
  if (saved) return saved;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  localStorage.setItem("ssaPokerClientId", id);
  return id;
}

async function initFirebase() {
  try {
    const firebaseConfig = await loadFirebaseConfig();
    const appModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`);
    const firestoreModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`);
    const app = appModule.initializeApp(firebaseConfig);
    client.firebase = {
      db: firestoreModule.getFirestore(app),
      doc: firestoreModule.doc,
      getDoc: firestoreModule.getDoc,
      setDoc: firestoreModule.setDoc,
      updateDoc: firestoreModule.updateDoc,
      onSnapshot: firestoreModule.onSnapshot,
      serverTimestamp: firestoreModule.serverTimestamp,
    };
    client.onlineReady = true;
    firebaseStatusEl.textContent = "온라인 방을 만들거나 참가할 수 있습니다.";
  } catch (error) {
    client.onlineReady = false;
    firebaseStatusEl.textContent = `Firebase 연결 실패: ${error.message}`;
    createRoomEl.disabled = true;
    joinRoomEl.disabled = true;
  }
}

async function loadFirebaseConfig() {
  try {
    const configModule = await import(`./firebase-config.js?cache=${Date.now()}`);
    if (configModule.firebaseConfig) return configModule.firebaseConfig;
  } catch (error) {
    // Firebase console snippets often contain bare SDK imports, so fall back to reading the config object.
  }

  const response = await fetch(`./firebase-config.js?cache=${Date.now()}`);
  if (!response.ok) throw new Error("firebase-config.js를 찾을 수 없습니다.");
  const source = await response.text();
  const match = source.match(/(?:const|let|var)\s+firebaseConfig\s*=\s*({[\s\S]*?});/);
  if (!match) throw new Error("firebaseConfig 객체를 찾을 수 없습니다.");
  return Function(`"use strict"; return (${match[1]});`)();
}

function createDeck() {
  const cards = [];
  for (let number = 0; number <= 9; number += 1) {
    cards.push({ kind: "number", value: number }, { kind: "number", value: number });
  }
  for (const operator of OPERATORS) {
    cards.push({ kind: "operator", value: operator }, { kind: "operator", value: operator });
  }
  cards.push({ kind: "number-joker", value: NUMBER_JOKER });
  cards.push({ kind: "operator-joker", value: OPERATOR_JOKER });
  return shuffle(cards);
}

function shuffle(cards) {
  const copied = [...cards];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function drawCard(game, kind) {
  const cardIndex = game.deck.findIndex((card) => card.kind === kind || card.kind === `${kind}-joker`);
  return game.deck.splice(cardIndex, 1)[0];
}

function createPlayer(id, name, index) {
  return {
    id,
    name: name || `플레이어 ${index + 1}`,
    chips: 20,
    hand: [],
    folded: false,
    bets: 0,
    expression: null,
  };
}

function startLocalGame() {
  const count = Number(playerCountEl.value);
  state = createEmptyState();
  state.mode = "local";
  state.status = "playing";
  state.players = Array.from({ length: count }, (_, index) => createPlayer(`local-${index}`, `플레이어 ${index + 1}`, index));
  showTable();
  startRound();
}

function startRound() {
  const next = cloneGame(state);
  next.deck = createDeck();
  next.target = randomInt(0, 20);
  next.pot = 0;
  next.phase = "number1";
  next.status = "playing";
  next.actorIndex = 0;
  next.expressionIndex = 0;
  next.resultHtml = "";
  for (const player of next.players) {
    player.hand = [drawCard(next, "number")];
    player.folded = false;
    player.bets = 0;
    player.expression = null;
  }
  commitGame(next);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getPhaseLabel() {
  if (state.phase === "number1") return "1턴 숫자 카드";
  if (state.phase === "operator") return "2턴 사칙연산 카드";
  if (state.phase === "number2") return "3턴 숫자 카드";
  if (state.phase === "expression") return "4턴 식 완성";
  if (state.phase === "lobby") return "대기실";
  return "결과";
}

function activePlayers(game = state) {
  return game.players.filter((player) => !player.folded);
}

function currentActor(game = state) {
  return game.players[game.actorIndex];
}

function currentExpressionPlayer(game = state) {
  return game.players[game.expressionIndex];
}

function isHost() {
  return state.mode === "local" || state.hostId === client.id;
}

function isMyTurn() {
  if (state.mode === "local") return true;
  if (["number1", "operator", "number2"].includes(state.phase)) return currentActor()?.id === client.id;
  if (state.phase === "expression") return currentExpressionPlayer()?.id === client.id;
  return false;
}

function clampBet(value, player) {
  return Math.max(0, Math.min(Number(value), player.chips, 5));
}

function placeBet() {
  if (!isMyTurn()) return;
  const next = cloneGame(state);
  const player = currentActor(next);
  const amount = clampBet(betAmountEl.value, player);
  player.chips -= amount;
  player.bets += amount;
  next.pot += amount;
  advanceBetTurn(next);
  commitGame(next);
}

function foldPlayer() {
  if (!isMyTurn()) return;
  const next = cloneGame(state);
  const player = currentActor(next);
  player.folded = true;
  if (activePlayers(next).length <= 1) {
    finishByFold(next);
  } else {
    advanceBetTurn(next);
  }
  commitGame(next);
}

function advanceBetTurn(game) {
  const nextIndex = findNextPlayerIndex(game, game.actorIndex + 1);
  if (nextIndex === -1 || nextIndex <= game.actorIndex) {
    advancePhase(game);
    return;
  }
  game.actorIndex = nextIndex;
}

function findNextPlayerIndex(game, startIndex) {
  for (let index = startIndex; index < game.players.length; index += 1) {
    if (!game.players[index].folded) return index;
  }
  return -1;
}

function advancePhase(game) {
  if (game.phase === "number1") {
    game.phase = "operator";
    dealToActive(game, "operator");
    game.actorIndex = findNextPlayerIndex(game, 0);
  } else if (game.phase === "operator") {
    game.phase = "number2";
    dealToActive(game, "number");
    game.actorIndex = findNextPlayerIndex(game, 0);
  } else if (game.phase === "number2") {
    game.phase = "expression";
    game.expressionIndex = findNextExpressionIndex(game, 0);
  }
}

function dealToActive(game, kind) {
  for (const player of game.players) {
    if (!player.folded) player.hand.push(drawCard(game, kind));
  }
}

function findNextExpressionIndex(game, startIndex) {
  for (let index = startIndex; index < game.players.length; index += 1) {
    if (!game.players[index].folded && !game.players[index].expression) return index;
  }
  return -1;
}

function submitExpression() {
  if (!isMyTurn()) return;
  const next = cloneGame(state);
  const player = currentExpressionPlayer(next);
  const numberValues = getNumberValues(player);
  const operatorValue = getOperatorValue(player);
  const expression = {
    a: Number(document.querySelector("#exprA").value),
    op: document.querySelector("#exprOp").value,
    b: Number(document.querySelector("#exprB").value),
  };

  if (!numberValues.includes(expression.a) || !numberValues.includes(expression.b)) {
    turnMessageEl.textContent = "보유한 숫자 카드 또는 숫자 조커로 만들 수 있는 값만 사용할 수 있어요.";
    return;
  }
  if (!canUseNumberPair(player, expression.a, expression.b)) {
    turnMessageEl.textContent = "두 숫자 카드에 실제로 배정할 수 있는 조합만 사용할 수 있습니다.";
    return;
  }
  if (!operatorValue.includes(expression.op)) {
    turnMessageEl.textContent = "보유한 사칙연산 카드 또는 사칙 조커로 만들 수 있는 연산자만 사용할 수 있어요.";
    return;
  }
  if (expression.op === "÷" && expression.b === 0) {
    turnMessageEl.textContent = "0으로 나누는 식은 사용할 수 없습니다.";
    return;
  }

  expression.result = evaluateExpression(expression);
  expression.distance = Math.abs(expression.result - next.target);
  player.expression = expression;

  const nextIndex = findNextExpressionIndex(next, next.expressionIndex + 1);
  if (nextIndex === -1) {
    finishRound(next);
  } else {
    next.expressionIndex = nextIndex;
  }
  commitGame(next);
}

function getNumberValues(player) {
  const hasJoker = player.hand.some((card) => card.kind === "number-joker");
  const values = player.hand.filter((card) => card.kind === "number").map((card) => card.value);
  if (hasJoker) {
    for (let value = 0; value <= 9; value += 1) values.push(value);
  }
  return values;
}

function getOperatorValue(player) {
  const hasJoker = player.hand.some((card) => card.kind === "operator-joker");
  const values = player.hand.filter((card) => card.kind === "operator").map((card) => card.value);
  return hasJoker ? OPERATORS : values;
}

function canUseNumberPair(player, a, b) {
  const numberCards = player.hand.filter((card) => card.kind === "number" || card.kind === "number-joker");
  return (
    cardCanBe(numberCards[0], a) && cardCanBe(numberCards[1], b)
  ) || (
    cardCanBe(numberCards[0], b) && cardCanBe(numberCards[1], a)
  );
}

function cardCanBe(card, value) {
  return card?.kind === "number-joker" || card?.value === value;
}

function evaluateExpression({ a, op, b }) {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  return Number((a / b).toFixed(2));
}

function finishByFold(game) {
  const winner = activePlayers(game)[0];
  winner.chips += game.pot;
  game.phase = "result";
  game.status = "result";
  game.resultHtml = `<h2>${winner.name} 승리</h2><p>다른 플레이어가 모두 폴드해서 팟 ${game.pot}칩을 가져갑니다.</p>`;
}

function finishRound(game) {
  const contestants = activePlayers(game);
  const bestDistance = Math.min(...contestants.map((player) => player.expression.distance));
  const winners = contestants.filter((player) => player.expression.distance === bestDistance);
  const prize = Math.floor(game.pot / winners.length);
  for (const winner of winners) winner.chips += prize;
  game.phase = "result";
  game.status = "result";

  const title = winners.length > 1 ? "무승부" : `${winners[0].name} 승리`;
  const scoreRows = contestants
    .map((player) => {
      const { a, op, b, result, distance } = player.expression;
      return `<div class="score-row"><span>${player.name}: ${a} ${op} ${b} = ${result}</span><span>차이 ${distance}</span></div>`;
    })
    .join("");
  game.resultHtml = `<h2>${title}</h2><p>목표 숫자 ${game.target}에 가장 가까운 식이 이겼습니다.</p><div class="score-list">${scoreRows}</div>`;
}

function cloneGame(game) {
  return JSON.parse(JSON.stringify(game));
}

async function commitGame(next) {
  state = next;
  render();
  if (state.mode === "online" && client.roomRef) {
    await client.firebase.setDoc(client.roomRef, {
      ...sanitizeForFirestore(state),
      updatedAt: client.firebase.serverTimestamp(),
    }, { merge: true });
  }
}

function sanitizeForFirestore(game) {
  const clean = JSON.parse(JSON.stringify(game));
  delete clean.updatedAt;
  return clean;
}

async function createRoom() {
  if (!client.onlineReady) return;
  const name = getPlayerName();
  const code = createRoomCode();
  const roomRef = client.firebase.doc(client.firebase.db, "ssaPokerRooms", code);
  const game = createEmptyState();
  game.mode = "online";
  game.status = "lobby";
  game.phase = "lobby";
  game.hostId = client.id;
  game.maxPlayers = Number(onlinePlayerCountEl.value);
  game.players = [createPlayer(client.id, name, 0)];
  await client.firebase.setDoc(roomRef, {
    ...game,
    roomCode: code,
    updatedAt: client.firebase.serverTimestamp(),
  });
  enterRoom(code, roomRef);
}

async function joinRoom() {
  if (!client.onlineReady) return;
  const code = normalizeRoomCode(roomCodeInputEl.value);
  if (!code) {
    firebaseStatusEl.textContent = "참가할 방 코드를 입력하세요.";
    return;
  }
  const roomRef = client.firebase.doc(client.firebase.db, "ssaPokerRooms", code);
  const snapshot = await client.firebase.getDoc(roomRef);
  if (!snapshot.exists()) {
    firebaseStatusEl.textContent = "해당 방을 찾을 수 없습니다.";
    return;
  }
  const game = snapshot.data();
  if (game.status !== "lobby") {
    firebaseStatusEl.textContent = "이미 게임이 시작된 방입니다.";
    return;
  }
  if (game.players.length >= game.maxPlayers) {
    firebaseStatusEl.textContent = "방이 가득 찼습니다.";
    return;
  }
  if (!game.players.some((player) => player.id === client.id)) {
    game.players.push(createPlayer(client.id, getPlayerName(), game.players.length));
    await client.firebase.setDoc(roomRef, {
      ...sanitizeForFirestore(game),
      updatedAt: client.firebase.serverTimestamp(),
    }, { merge: true });
  }
  enterRoom(code, roomRef);
}

function enterRoom(code, roomRef) {
  client.roomCode = code;
  client.roomRef = roomRef;
  if (client.unsubscribe) client.unsubscribe();
  client.unsubscribe = client.firebase.onSnapshot(roomRef, (snapshot) => {
    if (!snapshot.exists()) return;
    state = snapshot.data();
    state.mode = "online";
    client.roomCode = code;
    if (state.status === "lobby") {
      showLobby();
      renderLobby();
    } else {
      showTable();
      render();
    }
  }, (error) => {
    firebaseStatusEl.textContent = `방 동기화 오류: ${error.message}`;
  });
}

async function startOnlineGame() {
  if (state.players.length < 2) return;
  startRound();
}

async function leaveRoom() {
  if (client.unsubscribe) client.unsubscribe();
  client.unsubscribe = null;
  client.roomRef = null;
  client.roomCode = null;
  state = createEmptyState();
  showSetup();
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function normalizeRoomCode(code) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

function getPlayerName() {
  return playerNameEl.value.trim() || "플레이어";
}

function showSetup() {
  setupEl.classList.remove("hidden");
  lobbyEl.classList.add("hidden");
  tableEl.classList.add("hidden");
}

function showLobby() {
  setupEl.classList.add("hidden");
  lobbyEl.classList.remove("hidden");
  tableEl.classList.add("hidden");
}

function showTable() {
  setupEl.classList.add("hidden");
  lobbyEl.classList.add("hidden");
  tableEl.classList.remove("hidden");
}

function renderLobby() {
  roomCodeLabelEl.textContent = client.roomCode;
  onlinePlayerCountEl.value = String(state.maxPlayers);
  onlinePlayerCountEl.disabled = !isHost();
  startOnlineGameEl.disabled = state.players.length < 2;
  lobbyPlayersEl.innerHTML = state.players
    .map((player) => `<div class="lobby-player"><strong>${player.name}</strong><span>${player.id === state.hostId ? "방장" : "참가자"}</span></div>`)
    .join("");
  lobbyMessageEl.textContent = "2명 이상 모이면 게임을 시작할 수 있습니다.";
}

function render() {
  targetNumberEl.textContent = state.target;
  phaseNameEl.textContent = getPhaseLabel();
  potAmountEl.textContent = state.pot;
  roomPanelEl.classList.toggle("hidden", state.mode !== "online");
  activeRoomCodeEl.textContent = client.roomCode || "------";
  newRoundEl.disabled = false;
  renderPlayers();
  renderPanel();
}

function renderPlayers() {
  const activeIndex = state.phase === "expression" ? state.expressionIndex : state.actorIndex;
  playersEl.innerHTML = state.players
    .map((player, index) => {
      const isActive = index === activeIndex && state.phase !== "result";
      const reveal = shouldRevealHand(player, isActive);
      const hand = player.hand.map((card) => renderCard(card, reveal)).join("");
      const status = player.folded ? "폴드" : player.expression ? "식 확정" : `${player.bets}칩 베팅`;
      return `
        <article class="player-seat ${isActive ? "active" : ""} ${player.folded ? "folded" : ""}">
          <div class="seat-header">
            <h3>${player.name}</h3>
            <span class="chip-count">${player.chips}칩</span>
          </div>
          <div class="hand">${hand}</div>
          <div class="seat-footer">
            <span>${status}</span>
            <span>${player.hand.length}/3장</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function shouldRevealHand(player, isActive) {
  if (state.phase === "result") return true;
  if (state.mode === "local") return isActive;
  return player.id === client.id;
}

function renderCard(card, revealed) {
  if (!revealed) return `<div class="card back">?</div>`;
  const className = card.kind.includes("joker") ? "joker" : card.kind;
  const label = card.kind === "number-joker" ? "N?" : card.kind === "operator-joker" ? "O?" : card.value;
  return `<div class="card ${className}">${label}</div>`;
}

function renderPanel() {
  const bettingPhase = ["number1", "operator", "number2"].includes(state.phase);
  betControlsEl.classList.toggle("hidden", !bettingPhase);
  expressionControlsEl.classList.toggle("hidden", state.phase !== "expression");
  resultPanelEl.classList.toggle("hidden", state.phase !== "result");

  if (bettingPhase) {
    const player = currentActor();
    const maxBet = Math.min(5, player.chips);
    betAmountEl.max = String(maxBet);
    betAmountEl.value = String(Math.min(Number(betAmountEl.value), maxBet));
    betValueEl.value = betAmountEl.value;
    confirmBetEl.disabled = maxBet === 0 || !isMyTurn();
    foldPlayerEl.disabled = !isMyTurn();
    turnTitleEl.textContent = `${player.name} 차례`;
    turnMessageEl.textContent = isMyTurn()
      ? "내 카드가 공개되었습니다. 베팅하거나 폴드하세요."
      : "다른 플레이어의 차례입니다. 잠시 기다려 주세요.";
  } else if (state.phase === "expression") {
    const player = currentExpressionPlayer();
    turnTitleEl.textContent = `${player.name} 식 만들기`;
    turnMessageEl.textContent = isMyTurn()
      ? "보유한 두 숫자 카드와 사칙연산 카드로 목표에 가까운 식을 완성하세요."
      : "다른 플레이어가 식을 확정하는 중입니다.";
    if (isMyTurn()) renderExpressionInputs(player);
    submitExpressionEl.disabled = !isMyTurn();
  } else if (state.phase === "result") {
    turnTitleEl.textContent = "라운드 종료";
    turnMessageEl.textContent = state.mode === "online" && !isHost()
      ? "방장이 새 라운드를 시작할 수 있습니다."
      : "새 라운드를 눌러 같은 플레이어로 다시 시작할 수 있습니다.";
    resultPanelEl.innerHTML = state.resultHtml;
  }
}

function renderExpressionInputs(player) {
  const numberOptions = [...new Set(getNumberValues(player))].sort((a, b) => a - b);
  const operatorOptions = getOperatorValue(player);
  const defaults = getDefaultNumberPair(player);
  expressionInputsEl.innerHTML = `
    <label class="field">첫 숫자 ${renderSelect("exprA", numberOptions, defaults[0])}</label>
    <label class="field">연산자 ${renderSelect("exprOp", operatorOptions)}</label>
    <label class="field">둘째 숫자 ${renderSelect("exprB", numberOptions, defaults[1])}</label>
  `;
  for (const control of expressionInputsEl.querySelectorAll("select")) {
    control.addEventListener("change", updateExpressionPreview);
  }
  updateExpressionPreview();
}

function getDefaultNumberPair(player) {
  const numberCards = player.hand.filter((card) => card.kind === "number" || card.kind === "number-joker");
  return numberCards.map((card, index) => {
    if (card.kind === "number") return card.value;
    const otherCard = numberCards[1 - index];
    return otherCard?.value === 0 ? 1 : 0;
  });
}

function renderSelect(id, values, selectedValue = values[0]) {
  const options = values
    .map((value) => `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${value}</option>`)
    .join("");
  return `<select id="${id}">${options}</select>`;
}

function updateExpressionPreview() {
  const a = document.querySelector("#exprA")?.value ?? "?";
  const op = document.querySelector("#exprOp")?.value ?? "?";
  const b = document.querySelector("#exprB")?.value ?? "?";
  const result = op === "÷" && Number(b) === 0 ? "불가" : evaluateExpression({ a: Number(a), op, b: Number(b) });
  expressionPreviewEl.textContent = `${a} ${op} ${b} = ${result}`;
}

async function copyRoomCode() {
  const code = client.roomCode;
  if (!code) return;
  await navigator.clipboard.writeText(code);
  lobbyMessageEl.textContent = "방 코드를 복사했습니다.";
}

function switchSetupMode(mode) {
  const online = mode === "online";
  localTabEl.classList.toggle("active", !online);
  onlineTabEl.classList.toggle("active", online);
  localSetupEl.classList.toggle("hidden", online);
  onlineSetupEl.classList.toggle("hidden", !online);
}

function applyRoomLink() {
  const roomCode = normalizeRoomCode(new URLSearchParams(window.location.search).get("room") || "");
  if (!roomCode) return;
  roomCodeInputEl.value = roomCode;
  switchSetupMode("online");
}

betAmountEl.addEventListener("input", () => {
  betValueEl.value = betAmountEl.value;
});
roomCodeInputEl.addEventListener("input", () => {
  roomCodeInputEl.value = normalizeRoomCode(roomCodeInputEl.value);
});
onlinePlayerCountEl.addEventListener("change", async () => {
  if (!isHost() || state.status !== "lobby") return;
  state.maxPlayers = Number(onlinePlayerCountEl.value);
  await commitGame(state);
});
localTabEl.addEventListener("click", () => switchSetupMode("local"));
onlineTabEl.addEventListener("click", () => switchSetupMode("online"));
startGameEl.addEventListener("click", startLocalGame);
createRoomEl.addEventListener("click", createRoom);
joinRoomEl.addEventListener("click", joinRoom);
startOnlineGameEl.addEventListener("click", startOnlineGame);
leaveRoomEl.addEventListener("click", leaveRoom);
copyRoomCodeEl.addEventListener("click", copyRoomCode);
copyActiveRoomCodeEl.addEventListener("click", copyRoomCode);
newRoundEl.addEventListener("click", startRound);
confirmBetEl.addEventListener("click", placeBet);
foldPlayerEl.addEventListener("click", foldPlayer);
submitExpressionEl.addEventListener("click", submitExpression);

applyRoomLink();
initFirebase();
