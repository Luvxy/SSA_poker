const FIREBASE_SDK_VERSION = "11.10.0";
const NUMBER_JOKER = "숫자 조커";
const OPERATOR_JOKER = "사칙 조커";
const OPERATORS = ["+", "-", "×", "÷"];
const ROOM_CODE_LENGTH = 6;
const STARTING_COINS = 50;
const MAX_ROUNDS = 10;
const MARKET_PRICE = 1;

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
const roundNumberEl = document.querySelector("#roundNumber");
const targetNumberEl = document.querySelector("#targetNumber");
const phaseNameEl = document.querySelector("#phaseName");
const potAmountEl = document.querySelector("#potAmount");
const playersEl = document.querySelector("#players");
const roomPanelEl = document.querySelector("#roomPanel");
const activeRoomCodeEl = document.querySelector("#activeRoomCode");
const copyActiveRoomCodeEl = document.querySelector("#copyActiveRoomCode");
const turnTitleEl = document.querySelector("#turnTitle");
const turnMessageEl = document.querySelector("#turnMessage");
const marketPanelEl = document.querySelector("#marketPanel");
const marketCardsEl = document.querySelector("#marketCards");
const betControlsEl = document.querySelector("#betControls");
const betAmountEl = document.querySelector("#betAmount");
const betValueEl = document.querySelector("#betValue");
const confirmBetEl = document.querySelector("#confirmBet");
const foldPlayerEl = document.querySelector("#foldPlayer");
const expressionControlsEl = document.querySelector("#expressionControls");
const expressionInputsEl = document.querySelector("#expressionInputs");
const expressionPreviewEl = document.querySelector("#expressionPreview");
const submitExpressionEl = document.querySelector("#submitExpression");
const ruleControlsEl = document.querySelector("#ruleControls");
const nextRuleTypeEl = document.querySelector("#nextRuleType");
const confirmRuleEl = document.querySelector("#confirmRule");
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
    pot: 0,
    phase: "setup",
    roundNumber: 0,
    currentRule: { type: "max", target: null },
    nextRule: { type: "max", target: null },
    actorIndex: 0,
    expressionIndex: 0,
    chooserIds: [],
    market: [],
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
  for (let number = 1; number <= 9; number += 1) {
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
    chips: STARTING_COINS,
    hand: [],
    folded: false,
    inRound: false,
    bets: 0,
    expression: null,
    marketCards: [],
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
  if (next.roundNumber >= MAX_ROUNDS) {
    finishGame(next);
    commitGame(next);
    return;
  }

  next.roundNumber += 1;
  next.deck = createDeck();
  next.pot = 0;
  next.phase = "number";
  next.status = "playing";
  next.actorIndex = 0;
  next.expressionIndex = 0;
  next.chooserIds = [];
  next.market = [];
  next.resultHtml = "";
  next.currentRule = next.roundNumber === 1 ? { type: "max", target: null } : materializeRule(next.nextRule);

  for (const player of next.players) {
    player.hand = [];
    player.folded = false;
    player.inRound = player.chips > 0;
    player.bets = 0;
    player.expression = null;
    player.marketCards = [];

    if (player.inRound) {
      player.hand.push(drawCard(next, "number"), drawCard(next, "number"));
    } else {
      player.marketCards.push(drawCard(next, "number"), drawCard(next, "number"));
      player.marketCards.forEach((card, cardIndex) => {
        next.market.push({
          id: `${player.id}-${next.roundNumber}-${cardIndex}`,
          sellerId: player.id,
          card,
          price: MARKET_PRICE,
          sold: false,
          buyerId: null,
        });
      });
    }
  }

  const firstActor = findNextPlayerIndex(next, 0);
  if (firstActor === -1) {
    finishGame(next);
  } else if (activePlayers(next).length === 1) {
    finishByFold(next);
  } else {
    next.actorIndex = firstActor;
  }
  commitGame(next);
}

function materializeRule(rule) {
  if (rule.type === "target") return { type: "target", target: randomInt(1, 50) };
  return { type: rule.type, target: null };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getPhaseLabel() {
  if (state.phase === "number") return "1페이즈 숫자";
  if (state.phase === "operator") return "2페이즈 사칙";
  if (state.phase === "expression") return "3페이즈 식 공개";
  if (state.phase === "ruleSelect") return "다음 룰 선택";
  if (state.phase === "gameOver") return "최종 결과";
  if (state.phase === "lobby") return "대기실";
  return "결과";
}

function getRuleLabel(rule = state.currentRule) {
  if (rule.type === "target") return `${rule.target}에 가까운 수`;
  if (rule.type === "min") return "가장 작은 수";
  return "가장 큰 수";
}

function activePlayers(game = state) {
  return game.players.filter((player) => player.inRound && !player.folded);
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
  if (["number", "operator"].includes(state.phase)) return currentActor()?.id === client.id;
  if (state.phase === "expression") return currentExpressionPlayer()?.id === client.id;
  return false;
}

function canChooseRule() {
  return state.mode === "local" || state.chooserIds.includes(client.id);
}

function clampBet(value, player) {
  return Math.max(0, Math.min(Number(value), player.chips, 10));
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
  if (nextIndex === -1) {
    advancePhase(game);
    return;
  }
  game.actorIndex = nextIndex;
}

function findNextPlayerIndex(game, startIndex) {
  for (let index = startIndex; index < game.players.length; index += 1) {
    if (game.players[index].inRound && !game.players[index].folded) return index;
  }
  return -1;
}

function advancePhase(game) {
  if (game.phase === "number") {
    game.phase = "operator";
    dealToActive(game, "operator");
    game.actorIndex = findNextPlayerIndex(game, 0);
  } else if (game.phase === "operator") {
    game.phase = "expression";
    game.expressionIndex = findNextExpressionIndex(game, 0);
  }
}

function dealToActive(game, kind) {
  for (const player of game.players) {
    if (player.inRound && !player.folded) player.hand.push(drawCard(game, kind));
  }
}

function findNextExpressionIndex(game, startIndex) {
  for (let index = startIndex; index < game.players.length; index += 1) {
    if (game.players[index].inRound && !game.players[index].folded && !game.players[index].expression) return index;
  }
  return -1;
}

function buyMarketCard(cardId) {
  const buyer = state.players.find((player) => player.id === client.id);
  if (state.mode === "online" && (!buyer || !buyer.inRound || buyer.chips < MARKET_PRICE)) return;
  const next = cloneGame(state);
  const item = next.market.find((marketCard) => marketCard.id === cardId);
  const nextBuyer = next.players.find((player) => player.id === (state.mode === "local" ? currentActor()?.id : client.id));
  const seller = next.players.find((player) => player.id === item?.sellerId);
  if (!item || item.sold || !nextBuyer || !seller || nextBuyer.chips < item.price || nextBuyer.id === seller.id) return;
  nextBuyer.chips -= item.price;
  seller.chips += item.price;
  nextBuyer.hand.push(item.card);
  item.sold = true;
  item.buyerId = nextBuyer.id;
  commitGame(next);
}

function submitExpression() {
  if (!isMyTurn()) return;
  const next = cloneGame(state);
  const player = currentExpressionPlayer(next);
  const expression = {
    a: Number(document.querySelector("#exprA").value),
    op: document.querySelector("#exprOp").value,
    b: Number(document.querySelector("#exprB").value),
  };

  if (!canUseNumberPair(player, expression.a, expression.b)) {
    turnMessageEl.textContent = "보유한 숫자 카드 또는 숫자 조커로 만들 수 있는 숫자 두 개를 선택하세요.";
    return;
  }
  if (!getOperatorValue(player).includes(expression.op)) {
    turnMessageEl.textContent = "보유한 사칙 카드 또는 사칙 조커로 만들 수 있는 연산자만 사용할 수 있어요.";
    return;
  }
  if (expression.op === "÷" && expression.b === 0) {
    turnMessageEl.textContent = "0으로 나누는 식은 사용할 수 없습니다.";
    return;
  }

  expression.result = evaluateExpression(expression);
  expression.score = scoreExpression(expression.result, next.currentRule);
  player.expression = expression;

  const nextIndex = findNextExpressionIndex(next, next.expressionIndex + 1);
  if (nextIndex === -1) {
    finishRound(next);
  } else {
    next.expressionIndex = nextIndex;
  }
  commitGame(next);
}

function scoreExpression(result, rule) {
  if (rule.type === "target") return Math.abs(result - rule.target);
  if (rule.type === "min") return result;
  return result;
}

function getNumberValues(player) {
  const hasJoker = player.hand.some((card) => card.kind === "number-joker");
  const values = player.hand.filter((card) => card.kind === "number").map((card) => card.value);
  if (hasJoker) {
    for (let value = 1; value <= 9; value += 1) values.push(value);
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
  return numberCards.some((firstCard, firstIndex) =>
    cardCanBe(firstCard, a) && numberCards.some((secondCard, secondIndex) =>
      firstIndex !== secondIndex && cardCanBe(secondCard, b)
    )
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
  game.chooserIds = [winner.id];
  game.resultHtml = `<h2>${winner.name} 라운드 승리</h2><p>다른 플레이어가 모두 다이해서 팟 ${game.pot}코인을 가져갑니다.</p>`;
  moveAfterRound(game);
}

function finishRound(game) {
  const contestants = activePlayers(game);
  const comparator = game.currentRule.type === "max"
    ? Math.max
    : Math.min;
  const bestScore = comparator(...contestants.map((player) => player.expression.score));
  const winners = contestants.filter((player) => player.expression.score === bestScore);
  const prize = Math.floor(game.pot / winners.length);
  for (const winner of winners) winner.chips += prize;
  game.chooserIds = winners.map((winner) => winner.id);

  const title = winners.length > 1 ? "라운드 무승부" : `${winners[0].name} 라운드 승리`;
  const scoreRows = contestants
    .map((player) => {
      const { a, op, b, result } = player.expression;
      const metric = game.currentRule.type === "target" ? `차이 ${Math.abs(result - game.currentRule.target)}` : `결과 ${result}`;
      return `<div class="score-row"><span>${player.name}: ${a} ${op} ${b} = ${result}</span><span>${metric}</span></div>`;
    })
    .join("");
  game.resultHtml = `<h2>${title}</h2><p>${getRuleLabel(game.currentRule)} 룰로 판정했습니다.</p><div class="score-list">${scoreRows}</div>`;
  moveAfterRound(game);
}

function moveAfterRound(game) {
  if (game.roundNumber >= MAX_ROUNDS) {
    finishGame(game);
  } else {
    game.phase = "ruleSelect";
    game.status = "ruleSelect";
  }
}

function finishGame(game) {
  game.phase = "gameOver";
  game.status = "gameOver";
  const richest = Math.max(...game.players.map((player) => player.chips));
  const winners = game.players.filter((player) => player.chips === richest);
  const rows = game.players
    .slice()
    .sort((a, b) => b.chips - a.chips)
    .map((player) => `<div class="score-row"><span>${player.name}</span><span>${player.chips}코인</span></div>`)
    .join("");
  game.resultHtml = `<h2>${winners.length > 1 ? "최종 무승부" : `${winners[0].name} 최종 승리`}</h2><p>10라운드 종료 후 가장 많은 코인을 가진 플레이어가 최종 승자입니다.</p><div class="score-list">${rows}</div>`;
}

function chooseRuleAndStartRound() {
  if (!canChooseRule()) return;
  const next = cloneGame(state);
  next.nextRule = { type: nextRuleTypeEl.value, target: null };
  startRoundFrom(next);
}

function startRoundFrom(game) {
  state = game;
  startRound();
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
  const code = createRoomCode();
  const roomRef = client.firebase.doc(client.firebase.db, "ssaPokerRooms", code);
  const game = createEmptyState();
  game.mode = "online";
  game.status = "lobby";
  game.phase = "lobby";
  game.hostId = client.id;
  game.maxPlayers = Number(onlinePlayerCountEl.value);
  game.players = [createPlayer(client.id, getPlayerName(), 0)];
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

function startOnlineGame() {
  if (state.players.length < 2) return;
  startRound();
}

function leaveRoom() {
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
  roundNumberEl.textContent = Math.max(1, state.roundNumber);
  targetNumberEl.textContent = getRuleLabel();
  phaseNameEl.textContent = getPhaseLabel();
  potAmountEl.textContent = state.pot;
  roomPanelEl.classList.toggle("hidden", state.mode !== "online");
  activeRoomCodeEl.textContent = client.roomCode || "------";
  renderPlayers();
  renderMarket();
  renderPanel();
}

function renderPlayers() {
  playersEl.innerHTML = state.players
    .map((player, index) => {
      const activeIndex = state.phase === "expression" ? state.expressionIndex : state.actorIndex;
      const isActive = index === activeIndex && ["number", "operator", "expression"].includes(state.phase);
      const reveal = shouldRevealHand(player, isActive);
      const hand = player.hand.map((card) => renderCard(card, reveal)).join("");
      const status = getPlayerStatus(player);
      return `
        <article class="player-seat ${isActive ? "active" : ""} ${!player.inRound ? "folded" : ""}">
          <div class="seat-header">
            <h3>${player.name}</h3>
            <span class="chip-count">${player.chips}코인</span>
          </div>
          <div class="hand">${hand || "<span class=\"empty-hand\">카드 없음</span>"}</div>
          <div class="seat-footer">
            <span>${status}</span>
            <span>${player.bets}코인 베팅</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function getPlayerStatus(player) {
  if (state.phase === "gameOver") return "게임 종료";
  if (!player.inRound) return player.chips === 0 ? "판매자" : "이번 라운드 휴식";
  if (player.folded) return "다이";
  if (player.expression) return "식 확정";
  return "참가 중";
}

function shouldRevealHand(player, isActive) {
  if (["ruleSelect", "gameOver"].includes(state.phase)) return true;
  if (state.mode === "local") return isActive;
  return player.id === client.id;
}

function renderCard(card, revealed) {
  if (!revealed) return `<div class="card back">?</div>`;
  const className = card.kind.includes("joker") ? "joker" : card.kind;
  const label = card.kind === "number-joker" ? "N?" : card.kind === "operator-joker" ? "O?" : card.value;
  return `<div class="card ${className}">${label}</div>`;
}

function renderMarket() {
  const visibleMarket = state.market.filter((item) => !item.sold);
  marketPanelEl.classList.toggle("hidden", visibleMarket.length === 0 || state.phase !== "number");
  marketCardsEl.innerHTML = visibleMarket
    .map((item) => {
      const seller = state.players.find((player) => player.id === item.sellerId);
      return `
        <div class="market-item">
          ${renderCard(item.card, true)}
          <div>
            <strong>${seller?.name || "판매자"}</strong>
            <span>${item.price}코인</span>
          </div>
          <button type="button" class="small-button" data-buy-card="${item.id}">구매</button>
        </div>
      `;
    })
    .join("");
  marketCardsEl.querySelectorAll("[data-buy-card]").forEach((button) => {
    button.addEventListener("click", () => buyMarketCard(button.dataset.buyCard));
  });
}

function renderPanel() {
  const bettingPhase = ["number", "operator"].includes(state.phase);
  betControlsEl.classList.toggle("hidden", !bettingPhase);
  expressionControlsEl.classList.toggle("hidden", state.phase !== "expression");
  ruleControlsEl.classList.toggle("hidden", state.phase !== "ruleSelect");
  resultPanelEl.classList.toggle("hidden", !["ruleSelect", "gameOver"].includes(state.phase));

  if (bettingPhase) {
    const player = currentActor();
    const maxBet = Math.min(10, player.chips);
    betAmountEl.max = String(maxBet);
    betAmountEl.value = String(Math.min(Number(betAmountEl.value), maxBet));
    betValueEl.value = betAmountEl.value;
    confirmBetEl.disabled = maxBet === 0 || !isMyTurn();
    foldPlayerEl.disabled = !isMyTurn();
    turnTitleEl.textContent = `${player.name} 차례`;
    turnMessageEl.textContent = isMyTurn()
      ? state.phase === "number" ? "숫자 카드 2장을 확인하고 베팅하거나 다이하세요." : "사칙 카드를 확인하고 베팅하거나 다이하세요."
      : "다른 플레이어의 차례입니다. 잠시 기다려 주세요.";
  } else if (state.phase === "expression") {
    const player = currentExpressionPlayer();
    turnTitleEl.textContent = `${player.name} 식 만들기`;
    turnMessageEl.textContent = isMyTurn()
      ? "숫자 카드 2장과 사칙 카드 1장으로 식을 완성하세요."
      : "다른 플레이어가 식을 확정하는 중입니다.";
    if (isMyTurn()) renderExpressionInputs(player);
    submitExpressionEl.disabled = !isMyTurn();
  } else if (state.phase === "ruleSelect") {
    const chooserNames = state.players.filter((player) => state.chooserIds.includes(player.id)).map((player) => player.name).join(", ");
    turnTitleEl.textContent = "다음 라운드 룰 선택";
    turnMessageEl.textContent = `${chooserNames} 승자가 다음 승리룰을 고릅니다.`;
    confirmRuleEl.disabled = !canChooseRule();
    resultPanelEl.innerHTML = state.resultHtml;
  } else if (state.phase === "gameOver") {
    turnTitleEl.textContent = "게임 종료";
    turnMessageEl.textContent = "10라운드가 모두 끝났습니다.";
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
  return numberCards.slice(0, 2).map((card, index) => {
    if (card.kind === "number") return card.value;
    const fallback = index === 0 ? 1 : 2;
    return fallback;
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

async function initAds() {
  let adsConfig;
  try {
    const module = await import(`./ads-config.js?cache=${Date.now()}`);
    adsConfig = module.adsConfig;
  } catch (error) {
    return;
  }
  if (!adsConfig?.enabled || !adsConfig.publisherId) return;

  const adTargets = [...document.querySelectorAll("[data-ad-placement]")];
  const activeTargets = adTargets.filter((target) => adsConfig.slots?.[target.dataset.adPlacement]);

  await loadAdsenseScript(adsConfig.publisherId);

  if (activeTargets.length === 0 || adsConfig.autoOnly) return;

  for (const target of activeTargets) {
    const slot = adsConfig.slots[target.dataset.adPlacement];
    target.classList.remove("hidden");
    target.innerHTML = `
      <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="${adsConfig.publisherId}"
        data-ad-slot="${slot}"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
    `;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      target.classList.add("hidden");
    }
  }
}

function loadAdsenseScript(publisherId) {
  const existing = document.querySelector(`script[src*="adsbygoogle.js?client=${publisherId}"], script[data-adsense-loader]`);
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.adsenseLoader = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
    script.onload = resolve;
    script.onerror = () => reject(new Error("AdSense 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
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
confirmBetEl.addEventListener("click", placeBet);
foldPlayerEl.addEventListener("click", foldPlayer);
submitExpressionEl.addEventListener("click", submitExpression);
confirmRuleEl.addEventListener("click", chooseRuleAndStartRound);

applyRoomLink();
initAds();
initFirebase();
