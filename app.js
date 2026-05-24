const NUMBER_JOKER = "숫자 조커";
const OPERATOR_JOKER = "사칙 조커";
const OPERATORS = ["+", "-", "×", "÷"];

const setupEl = document.querySelector("#setup");
const tableEl = document.querySelector("#table");
const playerCountEl = document.querySelector("#playerCount");
const startGameEl = document.querySelector("#startGame");
const newRoundEl = document.querySelector("#newRound");
const targetNumberEl = document.querySelector("#targetNumber");
const phaseNameEl = document.querySelector("#phaseName");
const potAmountEl = document.querySelector("#potAmount");
const playersEl = document.querySelector("#players");
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

const state = {
  players: [],
  deck: [],
  target: 0,
  pot: 0,
  phase: "setup",
  actorIndex: 0,
  expressionIndex: 0,
};

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

function drawCard(kind) {
  const cardIndex = state.deck.findIndex((card) => card.kind === kind || card.kind === `${kind}-joker`);
  return state.deck.splice(cardIndex, 1)[0];
}

function startGame() {
  const count = Number(playerCountEl.value);
  state.players = Array.from({ length: count }, (_, index) => ({
    name: `플레이어 ${index + 1}`,
    chips: 20,
    hand: [],
    folded: false,
    bets: 0,
    expression: null,
  }));
  setupEl.classList.add("hidden");
  tableEl.classList.remove("hidden");
  startRound();
}

function startRound() {
  state.deck = createDeck();
  state.target = randomInt(0, 20);
  state.pot = 0;
  state.phase = "number1";
  state.actorIndex = 0;
  state.expressionIndex = 0;
  for (const player of state.players) {
    player.hand = [drawCard("number")];
    player.folded = false;
    player.bets = 0;
    player.expression = null;
  }
  render();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getPhaseLabel() {
  if (state.phase === "number1") return "1턴 숫자 카드";
  if (state.phase === "operator") return "2턴 사칙연산 카드";
  if (state.phase === "number2") return "3턴 숫자 카드";
  if (state.phase === "expression") return "4턴 식 완성";
  return "결과";
}

function activePlayers() {
  return state.players.filter((player) => !player.folded);
}

function currentActor() {
  return state.players[state.actorIndex];
}

function clampBet(value, player) {
  return Math.max(0, Math.min(Number(value), player.chips, 5));
}

function placeBet() {
  const player = currentActor();
  const amount = clampBet(betAmountEl.value, player);
  player.chips -= amount;
  player.bets += amount;
  state.pot += amount;
  advanceBetTurn();
}

function foldPlayer() {
  const player = currentActor();
  player.folded = true;
  if (activePlayers().length <= 1) {
    finishByFold();
    return;
  }
  advanceBetTurn();
}

function advanceBetTurn() {
  const nextIndex = findNextPlayerIndex(state.actorIndex + 1);
  if (nextIndex === -1 || nextIndex <= state.actorIndex) {
    advancePhase();
    return;
  }
  state.actorIndex = nextIndex;
  render();
}

function findNextPlayerIndex(startIndex) {
  for (let index = startIndex; index < state.players.length; index += 1) {
    if (!state.players[index].folded) return index;
  }
  return -1;
}

function advancePhase() {
  if (state.phase === "number1") {
    state.phase = "operator";
    dealToActive("operator");
    state.actorIndex = findNextPlayerIndex(0);
  } else if (state.phase === "operator") {
    state.phase = "number2";
    dealToActive("number");
    state.actorIndex = findNextPlayerIndex(0);
  } else if (state.phase === "number2") {
    state.phase = "expression";
    state.expressionIndex = findNextExpressionIndex(0);
  }
  render();
}

function dealToActive(kind) {
  for (const player of state.players) {
    if (!player.folded) player.hand.push(drawCard(kind));
  }
}

function findNextExpressionIndex(startIndex) {
  for (let index = startIndex; index < state.players.length; index += 1) {
    if (!state.players[index].folded && !state.players[index].expression) return index;
  }
  return -1;
}

function submitExpression() {
  const player = state.players[state.expressionIndex];
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
  expression.distance = Math.abs(expression.result - state.target);
  player.expression = expression;

  const nextIndex = findNextExpressionIndex(state.expressionIndex + 1);
  if (nextIndex === -1) {
    finishRound();
    return;
  }
  state.expressionIndex = nextIndex;
  render();
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
  return card.kind === "number-joker" || card.value === value;
}

function evaluateExpression({ a, op, b }) {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  return Number((a / b).toFixed(2));
}

function finishByFold() {
  const winner = activePlayers()[0];
  winner.chips += state.pot;
  state.phase = "result";
  resultPanelEl.innerHTML = `<h2>${winner.name} 승리</h2><p>다른 플레이어가 모두 폴드해서 팟 ${state.pot}칩을 가져갑니다.</p>`;
  render();
}

function finishRound() {
  const contestants = activePlayers();
  const bestDistance = Math.min(...contestants.map((player) => player.expression.distance));
  const winners = contestants.filter((player) => player.expression.distance === bestDistance);
  const prize = Math.floor(state.pot / winners.length);
  for (const winner of winners) winner.chips += prize;
  state.phase = "result";

  const title = winners.length > 1 ? "무승부" : `${winners[0].name} 승리`;
  const scoreRows = contestants
    .map((player) => {
      const { a, op, b, result, distance } = player.expression;
      return `<div class="score-row"><span>${player.name}: ${a} ${op} ${b} = ${result}</span><span>차이 ${distance}</span></div>`;
    })
    .join("");
  resultPanelEl.innerHTML = `<h2>${title}</h2><p>목표 숫자 ${state.target}에 가장 가까운 식이 이겼습니다.</p><div class="score-list">${scoreRows}</div>`;
  render();
}

function render() {
  targetNumberEl.textContent = state.target;
  phaseNameEl.textContent = getPhaseLabel();
  potAmountEl.textContent = state.pot;
  renderPlayers();
  renderPanel();
}

function renderPlayers() {
  const activeIndex = state.phase === "expression" ? state.expressionIndex : state.actorIndex;
  playersEl.innerHTML = state.players
    .map((player, index) => {
      const isActive = index === activeIndex && state.phase !== "result";
      const hand = player.hand.map((card) => renderCard(card, state.phase === "result" || isActive)).join("");
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

function renderCard(card, revealed) {
  if (!revealed) return `<div class="card back">?</div>`;
  const className = card.kind.includes("joker") ? "joker" : card.kind;
  const label = card.kind === "number-joker" ? "N?" : card.kind === "operator-joker" ? "O?" : card.value;
  return `<div class="card ${className}">${label}</div>`;
}

function renderPanel() {
  betControlsEl.classList.toggle("hidden", !["number1", "operator", "number2"].includes(state.phase));
  expressionControlsEl.classList.toggle("hidden", state.phase !== "expression");
  resultPanelEl.classList.toggle("hidden", state.phase !== "result");

  if (["number1", "operator", "number2"].includes(state.phase)) {
    const player = currentActor();
    const maxBet = Math.min(5, player.chips);
    betAmountEl.max = String(maxBet);
    betAmountEl.value = String(Math.min(Number(betAmountEl.value), maxBet));
    betValueEl.value = betAmountEl.value;
    confirmBetEl.disabled = maxBet === 0;
    turnTitleEl.textContent = `${player.name} 차례`;
    turnMessageEl.textContent = "현재 플레이어의 카드만 공개됩니다. 카드를 확인한 뒤 베팅하거나 폴드하세요.";
  } else if (state.phase === "expression") {
    const player = state.players[state.expressionIndex];
    turnTitleEl.textContent = `${player.name} 식 만들기`;
    turnMessageEl.textContent = "보유한 두 숫자 카드와 사칙연산 카드로 목표에 가까운 식을 완성하세요.";
    renderExpressionInputs(player);
  } else if (state.phase === "result") {
    turnTitleEl.textContent = "라운드 종료";
    turnMessageEl.textContent = "새 라운드를 눌러 같은 플레이어로 다시 시작할 수 있습니다.";
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

betAmountEl.addEventListener("input", () => {
  betValueEl.value = betAmountEl.value;
});
startGameEl.addEventListener("click", startGame);
newRoundEl.addEventListener("click", startRound);
confirmBetEl.addEventListener("click", placeBet);
foldPlayerEl.addEventListener("click", foldPlayer);
submitExpressionEl.addEventListener("click", submitExpression);
