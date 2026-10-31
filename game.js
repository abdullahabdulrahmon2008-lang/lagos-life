const SIZE = 8;
const TILE_TYPES = [
  { name: "Olumo gem", symbol: "💎", className: "gem-blue" },
  { name: "Golden bead", symbol: "🟡", className: "gem-gold" },
  { name: "Green leaf", symbol: "🍃", className: "gem-green" },
  { name: "Coral bead", symbol: "🪸", className: "gem-coral" },
  { name: "Star stone", symbol: "⭐", className: "gem-star" },
  { name: "Cocoa pod", symbol: "🥥", className: "gem-cocoa" },
];
const STAGES = [
  { title: "Drive back the Shadow Beast", score: 600, moves: 14, collectType: 2, collectName: "Green Leaves", collect: 9 },
  { title: "Find the Olumo charms", score: 800, moves: 11, collectType: 0, collectName: "Olumo Gems", collect: 12 },
  { title: "Rescue Ayo", score: 1000, moves: 9, collectType: 4, collectName: "Star Stones", collect: 15 },
];
const boardElement = document.querySelector("#game-board");
const scoreElement = document.querySelector("#score-value");
const movesElement = document.querySelector("#moves-value");
const statusElement = document.querySelector("#status-message");
const puzzleStatus = document.querySelector("#puzzle-status");
const goalLabel = document.querySelector("#goal-label");
const goalFill = document.querySelector("#goal-fill");
const progressBar = document.querySelector(".mission-track");
const collectionValue = document.querySelector("#collection-value");
const collectionIcon = document.querySelector("#collection-icon");
const collectCardIcon = document.querySelector("#collect-card-icon");
const collectCardValue = document.querySelector("#collect-card-value");
const scoreCardElement = scoreElement.closest(".score-card");
const comboEffect = document.querySelector("#combo-effect");
const rescueCard = document.querySelector("#rescue-card");
const rescueButton = document.querySelector("#rescue-button");
const rescueStatus = document.querySelector("#rescue-status");
const rescueTitle = document.querySelector("#rescue-title");
const rescueDescription = document.querySelector("#rescue-description");
const openPuzzleButton = document.querySelector("#open-puzzle");
const puzzleModal = document.querySelector("#puzzle-modal");
let board = [];
let specials = new Map();
let score = 0;
let stageIndex = 0;
let collected = 0;
let moves = STAGES[0].moves;
let selectedIndex = null;
let resolving = false;
let gameOver = false;
let stageComplete = false;
let ayoRescued = false;
let gameRound = 0;
let hintedIndices = new Set();
let hintTimer = null;
let clearingIndices = new Set();
let scoreEffectTimer = null;
let comboEffectTimer = null;
let audioContext = null;

function currentStage() {
  return STAGES[stageIndex];
}

function setStatus(message, puzzleMessage = message) {
  statusElement.textContent = message;
  puzzleStatus.textContent = puzzleMessage;
}

function playScoreEffect() {
  window.clearTimeout(scoreEffectTimer);
  scoreCardElement.classList.remove("is-scoring");
  void scoreCardElement.offsetWidth;
  scoreCardElement.classList.add("is-scoring");
  scoreEffectTimer = window.setTimeout(() => scoreCardElement.classList.remove("is-scoring"), 520);
}

function playMatchPop(chain, tileCount) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    const now = audioContext.currentTime;
    const pitch = 420 + Math.min(chain - 1, 4) * 90 + Math.min(tileCount, 10) * 8;
    const oscillator = audioContext.createOscillator();
    const toneGain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(pitch, now);
    oscillator.frequency.exponentialRampToValueAtTime(125, now + 0.13);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.13, now + 0.008);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    oscillator.connect(toneGain);
    toneGain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.16);

    const thump = audioContext.createOscillator();
    const thumpGain = audioContext.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(175, now);
    thump.frequency.exponentialRampToValueAtTime(65, now + 0.09);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.09, now + 0.004);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    thump.connect(thumpGain);
    thumpGain.connect(audioContext.destination);
    thump.start(now);
    thump.stop(now + 0.11);

    const noiseLength = Math.floor(audioContext.sampleRate * 0.045);
    const noiseBuffer = audioContext.createBuffer(1, noiseLength, audioContext.sampleRate);
    const noiseSamples = noiseBuffer.getChannelData(0);
    for (let index = 0; index < noiseLength; index += 1) {
      noiseSamples[index] = (Math.random() * 2 - 1) * (1 - index / noiseLength);
    }
    const noise = audioContext.createBufferSource();
    const noiseFilter = audioContext.createBiquadFilter();
    const noiseGain = audioContext.createGain();
    noise.buffer = noiseBuffer;
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(2100, now);
    noiseGain.gain.setValueAtTime(0.055, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    noise.start(now);
    noise.stop(now + 0.04);
  } catch {
    audioContext = null;
  }
}

function playComboEffect(chain) {
  window.clearTimeout(comboEffectTimer);
  comboEffect.textContent = `COMBO ×${chain}!`;
  comboEffect.classList.remove("is-visible");
  void comboEffect.offsetWidth;
  comboEffect.classList.add("is-visible");
  comboEffectTimer = window.setTimeout(() => comboEffect.classList.remove("is-visible"), 1000);
}

function resetPlayEffects() {
  clearingIndices.clear();
  window.clearTimeout(scoreEffectTimer);
  window.clearTimeout(comboEffectTimer);
  scoreCardElement.classList.remove("is-scoring");
  comboEffect.classList.remove("is-visible");
}

function tileAt(row, column) {
  if (row < 0 || column < 0 || row >= SIZE || column >= SIZE) return null;
  return board[row * SIZE + column];
}

function hasMatchAt(row, column, type) {
  return (
    (tileAt(row, column - 1) === type && tileAt(row, column - 2) === type) ||
    (tileAt(row - 1, column) === type && tileAt(row - 2, column) === type)
  );
}

function createBoard() {
  specials.clear();
  do {
    board = [];
    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        let type;
        do {
          type = Math.floor(Math.random() * TILE_TYPES.length);
        } while (hasMatchAt(row, column, type));
        board.push(type);
      }
    }
  } while (!hasAvailableMove());
}

function findMatchGroups() {
  const groups = [];

  for (let row = 0; row < SIZE; row += 1) {
    let start = 0;
    for (let column = 1; column <= SIZE; column += 1) {
      const current = column < SIZE ? tileAt(row, column) : null;
      if (current !== tileAt(row, start)) {
        if (column - start >= 3) {
          groups.push({
            direction: "row",
            indices: Array.from({ length: column - start }, (_, offset) => row * SIZE + start + offset),
          });
        }
        start = column;
      }
    }
  }

  for (let column = 0; column < SIZE; column += 1) {
    let start = 0;
    for (let row = 1; row <= SIZE; row += 1) {
      const current = row < SIZE ? tileAt(row, column) : null;
      if (current !== tileAt(start, column)) {
        if (row - start >= 3) {
          groups.push({
            direction: "column",
            indices: Array.from({ length: row - start }, (_, offset) => (start + offset) * SIZE + column),
          });
        }
        start = row;
      }
    }
  }
  return groups;
}

function findMatches() {
  const matches = new Set();
  findMatchGroups().forEach((group) => group.indices.forEach((index) => matches.add(index)));
  return matches;
}

function swapTilesAt(first, second) {
  [board[first], board[second]] = [board[second], board[first]];
  const firstPower = specials.get(first);
  const secondPower = specials.get(second);
  specials.delete(first);
  specials.delete(second);
  if (firstPower) specials.set(second, firstPower);
  if (secondPower) specials.set(first, secondPower);
}

function hasAvailableMove() {
  for (let index = 0; index < board.length; index += 1) {
    const row = Math.floor(index / SIZE);
    const column = index % SIZE;
    for (const neighbor of [column < SIZE - 1 ? index + 1 : -1, row < SIZE - 1 ? index + SIZE : -1]) {
      if (neighbor < 0) continue;
      const activatesPower = specials.has(index) || specials.has(neighbor);
      [board[index], board[neighbor]] = [board[neighbor], board[index]];
      const createsMatch = findMatches().size > 0;
      [board[index], board[neighbor]] = [board[neighbor], board[index]];
      if (createsMatch || activatesPower) return true;
    }
  }
  return false;
}

function findHintMove() {
  let bestMove = null;
  let bestValue = -1;

  for (let index = 0; index < board.length; index += 1) {
    const row = Math.floor(index / SIZE);
    const column = index % SIZE;
    for (const neighbor of [column < SIZE - 1 ? index + 1 : -1, row < SIZE - 1 ? index + SIZE : -1]) {
      if (neighbor < 0) continue;
      const activatesPower = specials.has(index) || specials.has(neighbor);
      swapTilesAt(index, neighbor);
      const matches = findMatches();
      swapTilesAt(index, neighbor);
      if (matches.size === 0 && !activatesPower) continue;

      const targetMatches = [...matches].filter((matchIndex) => board[matchIndex] === currentStage().collectType).length;
      const value = (activatesPower ? 1000 : 0) + targetMatches * 10 + matches.size;
      if (value > bestValue) {
        bestMove = [index, neighbor];
        bestValue = value;
      }
    }
  }
  return bestMove;
}

function renderBoard() {
  boardElement.replaceChildren();
  board.forEach((type, index) => {
    if (type === null) {
      const emptySpace = document.createElement("span");
      emptySpace.className = "tile tile-empty";
      emptySpace.setAttribute("aria-hidden", "true");
      boardElement.append(emptySpace);
      return;
    }

    const tile = TILE_TYPES[type];
    const button = document.createElement("button");
    button.type = "button";
    const power = specials.get(index);
    button.className = `tile ${tile.className}${selectedIndex === index ? " is-selected" : ""}${hintedIndices.has(index) ? " is-hinted" : ""}${clearingIndices.has(index) ? " is-clearing" : ""}${power ? ` has-power power-${power}` : ""}`;
    button.textContent = tile.symbol;
    button.setAttribute("aria-label", `${power ? `${power === "burst" ? "Burst" : "Line blast"} ${tile.name}` : tile.name}, row ${Math.floor(index / SIZE) + 1}, column ${(index % SIZE) + 1}`);
    if (clearingIndices.has(index)) {
      const sparkle = document.createElement("span");
      sparkle.className = "clear-sparkle";
      sparkle.textContent = "✦";
      sparkle.setAttribute("aria-hidden", "true");
      button.append(sparkle);
    }
    if (power) {
      const indicator = document.createElement("span");
      indicator.className = "power-indicator";
      indicator.textContent = power === "burst" ? "✹" : "↔";
      indicator.setAttribute("aria-hidden", "true");
      button.append(indicator);
    }
    button.setAttribute("aria-pressed", String(selectedIndex === index));
    button.disabled = resolving || gameOver;
    button.addEventListener("click", () => selectTile(index));
    boardElement.append(button);
  });
}

function updateDisplay() {
  const stage = currentStage();
  const targetGem = TILE_TYPES[stage.collectType];
  scoreElement.textContent = score.toLocaleString();
  movesElement.textContent = moves;
  const progress = Math.min(score, stage.score);
  goalLabel.textContent = `${progress.toLocaleString()} / ${stage.score.toLocaleString()}`;
  goalFill.style.width = `${(progress / stage.score) * 100}%`;
  progressBar.setAttribute("aria-valuenow", progress);
  progressBar.setAttribute("aria-valuemax", stage.score);
  collectionValue.textContent = `${Math.min(collected, stage.collect)} / ${stage.collect}`;
  collectCardValue.textContent = `${Math.min(collected, stage.collect)} / ${stage.collect}`;
  document.querySelector(".collection-goal").classList.toggle("is-complete", collected >= stage.collect);
  document.querySelector(".collect-card").classList.toggle("is-complete", collected >= stage.collect);
  collectionIcon.textContent = targetGem.symbol;
  collectCardIcon.textContent = targetGem.symbol;
  document.querySelector("#stage-label").textContent = `STAGE ${stageIndex + 1} OF ${STAGES.length} · VERY HARD`;
  document.querySelector("#mission-title").textContent = stage.title;
  document.querySelector("#mission-description").textContent =
    `Score ${stage.score} points and collect ${stage.collectName} in ${stage.moves} moves.`;
  document.querySelector("#modal-stage-label").textContent = `STAGE ${stageIndex + 1} OF ${STAGES.length} · VERY HARD`;
  document.querySelector("#modal-puzzle-title").textContent = stage.title;
  const threatProgress = (stageIndex + (stage.moves - moves) / stage.moves) / STAGES.length;
  document.querySelector(".scene-monster").style.left = `${7 + threatProgress * 43}%`;
}

function openPuzzle() {
  if (gameOver) return;
  puzzleModal.hidden = false;
  const firstTile = boardElement.querySelector(".tile:not(.tile-empty)");
  if (firstTile) firstTile.focus();
}

function closePuzzle() {
  puzzleModal.hidden = true;
  if (!openPuzzleButton.hidden) {
    openPuzzleButton.focus();
  } else if (!rescueButton.hidden) {
    rescueButton.focus();
  } else {
    document.querySelector("#restart").focus();
  }
}

function selectTile(index) {
  if (resolving || gameOver) return;
  if (hintedIndices.size > 0) {
    window.clearTimeout(hintTimer);
    hintTimer = null;
    hintedIndices.clear();
  }
  if (selectedIndex === null) {
    selectedIndex = index;
    renderBoard();
    return;
  }
  if (selectedIndex === index) {
    selectedIndex = null;
    renderBoard();
    return;
  }

  const firstRow = Math.floor(selectedIndex / SIZE);
  const firstColumn = selectedIndex % SIZE;
  const secondRow = Math.floor(index / SIZE);
  const secondColumn = index % SIZE;
  const adjacent = Math.abs(firstRow - secondRow) + Math.abs(firstColumn - secondColumn) === 1;

  if (!adjacent) {
    selectedIndex = index;
    renderBoard();
    return;
  }

  const previousSelection = selectedIndex;
  selectedIndex = null;
  swapTiles(previousSelection, index);
}

function swapTiles(first, second) {
  swapTilesAt(first, second);
  let matches = findMatches();
  const activatedPower = specials.has(first) || specials.has(second);
  if (matches.size === 0 && activatedPower) {
    matches = new Set([first, second]);
  }
  if (matches.size === 0) {
    swapTilesAt(first, second);
    setStatus("That swap did not make a match. Try another pair of neighboring treasures.");
    renderBoard();
    return;
  }

  moves -= 1;
  resolving = true;
  setStatus("Nice match! The treasures are tumbling...");
  renderBoard();
  updateDisplay();
  resolveMatches(matches, activatedPower ? null : createPowerup(matches, first, second));
}

function showHint() {
  if (resolving || gameOver) return;
  const move = findHintMove();
  if (!move) {
    setStatus("No moves are available, so the treasures will be reshuffled.");
    createBoard();
    renderBoard();
    return;
  }

  window.clearTimeout(hintTimer);
  hintedIndices = new Set(move);
  renderBoard();
  const [first, second] = move;
  setStatus(`Try swapping row ${Math.floor(first / SIZE) + 1}, column ${(first % SIZE) + 1} with row ${Math.floor(second / SIZE) + 1}, column ${(second % SIZE) + 1}.`);
  hintTimer = window.setTimeout(() => {
    hintedIndices.clear();
    hintTimer = null;
    renderBoard();
  }, 1800);
}

function createPowerup(matches, first, second) {
  const group = findMatchGroups()
    .filter((matchGroup) => matchGroup.indices.length >= 4)
    .sort((a, b) => b.indices.length - a.indices.length)[0];
  if (!group) return null;

  const anchor = group.indices.includes(second)
    ? second
    : group.indices.includes(first)
      ? first
      : group.indices[Math.floor(group.indices.length / 2)];
  if (specials.has(anchor)) return null;

  return {
    index: anchor,
    type: group.indices.length >= 5 ? "burst" : group.direction,
  };
}

function expandSpecialMatches(matches) {
  const expanded = new Set(matches);
  const pending = [...matches];

  while (pending.length > 0) {
    const index = pending.pop();
    const power = specials.get(index);
    if (!power) continue;
    specials.delete(index);

    const row = Math.floor(index / SIZE);
    const column = index % SIZE;
    const affected = [];
    if (power === "row") {
      for (let affectedColumn = 0; affectedColumn < SIZE; affectedColumn += 1) {
        affected.push(row * SIZE + affectedColumn);
      }
    } else if (power === "column") {
      for (let affectedRow = 0; affectedRow < SIZE; affectedRow += 1) {
        affected.push(affectedRow * SIZE + column);
      }
    } else {
      for (let affectedRow = Math.max(0, row - 1); affectedRow <= Math.min(SIZE - 1, row + 1); affectedRow += 1) {
        for (let affectedColumn = Math.max(0, column - 1); affectedColumn <= Math.min(SIZE - 1, column + 1); affectedColumn += 1) {
          affected.push(affectedRow * SIZE + affectedColumn);
        }
      }
    }

    affected.forEach((affectedIndex) => {
      if (board[affectedIndex] !== null && !expanded.has(affectedIndex)) {
        expanded.add(affectedIndex);
        pending.push(affectedIndex);
      }
    });
  }
  return expanded;
}

function dropTiles() {
  const previousSpecials = new Map(specials);
  specials.clear();
  for (let column = 0; column < SIZE; column += 1) {
    const remaining = [];
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      const index = row * SIZE + column;
      const tile = tileAt(row, column);
      if (tile !== null) remaining.push({ type: tile, power: previousSpecials.get(index) });
    }
    while (remaining.length < SIZE) {
      remaining.push({ type: Math.floor(Math.random() * TILE_TYPES.length), power: null });
    }
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      const index = row * SIZE + column;
      const tile = remaining[SIZE - 1 - row];
      board[index] = tile.type;
      if (tile.power) specials.set(index, tile.power);
    }
  }
}

async function resolveMatches(initialMatches, powerup) {
  const activeRound = gameRound;
  let chain = 0;
  let matches = initialMatches;
  let comboMessage = "";

  while (matches.size > 0) {
    chain += 1;
    if (powerup && matches.has(powerup.index)) {
      matches.delete(powerup.index);
      specials.set(powerup.index, powerup.type);
      comboMessage = powerup.type === "burst" ? "A burst gem is ready! Match it to trigger a 3×3 blast." : "A line gem is ready! Match it to sweep a full row or column.";
      powerup = null;
    }
    const cleared = expandSpecialMatches(matches);
    score += cleared.size * 10 * chain;
    collected += [...cleared].filter((index) => board[index] === currentStage().collectType).length;
    playMatchPop(chain, cleared.size);
    clearingIndices = cleared;
    updateDisplay();
    renderBoard();
    playScoreEffect();
    if (chain > 1) playComboEffect(chain);
    await new Promise((resolve) => window.setTimeout(resolve, 240));
    if (activeRound !== gameRound) return;
    cleared.forEach((index) => {
      board[index] = null;
      specials.delete(index);
    });
    clearingIndices.clear();
    renderBoard();
    await new Promise((resolve) => window.setTimeout(resolve, 70));
    if (activeRound !== gameRound) return;
    dropTiles();
    renderBoard();
    matches = findMatches();
    if (matches.size > 0) comboMessage = `Combo ×${chain + 1}! Cascades earn bonus points.`;
  }

  resolving = false;
  if (score >= currentStage().score && collected >= currentStage().collect) {
    gameOver = true;
    stageComplete = true;
    rescueButton.disabled = false;
    openPuzzleButton.hidden = true;
    rescueButton.hidden = false;
    rescueCard.classList.add("is-ready");
    rescueCard.classList.remove("is-danger");
    if (stageIndex === STAGES.length - 1) {
      document.querySelector(".scene-monster").style.left = "7%";
      rescueStatus.textContent = "THE BEAST HAS BEEN DEFEATED";
      rescueTitle.textContent = "Ayo is safe at last!";
      rescueDescription.textContent = "You cleared every stage and collected all the charms. Rescue Ayo and celebrate your victory!";
      rescueButton.innerHTML = 'RESCUE AYO <span aria-hidden="true">→</span>';
      setStatus(`Final stage complete! You scored ${score.toLocaleString()} points and collected every charm. Rescue Ayo!`);
    } else {
      rescueStatus.textContent = `STAGE ${stageIndex + 1} COMPLETE`;
      rescueTitle.textContent = "The chase continues!";
      rescueDescription.textContent = "You pushed the Shadow Beast back. Ayo found another trail of charms—keep going!";
      rescueButton.innerHTML = 'NEXT STAGE <span aria-hidden="true">→</span>';
      setStatus(`Stage ${stageIndex + 1} complete! You scored ${score.toLocaleString()} and collected ${collected} gems. Continue the chase!`);
    }
    closePuzzle();
  } else if (moves === 0) {
    gameOver = true;
    stageComplete = false;
    openPuzzleButton.hidden = true;
    rescueCard.classList.add("is-danger");
    rescueStatus.textContent = "THE BEAST CAUGHT UP";
    rescueTitle.textContent = "The rescue was too late!";
    rescueDescription.textContent = `You scored ${score} points and collected ${collected} gems. Start a new game and try the stage again.`;
    setStatus("The Shadow Beast reached Ayo! Start a new game to try to stop it sooner.");
    closePuzzle();
  } else {
    if (!hasAvailableMove()) {
      createBoard();
      setStatus("No more matches were possible, so the treasures have been mixed up. Keep going!");
    } else if (score >= currentStage().score) {
      const remainingGems = currentStage().collect - collected;
      setStatus(`Score goal reached! Collect ${remainingGems} more ${currentStage().collectName} to complete the stage.`);
    } else if (collected >= currentStage().collect) {
      const remainingPoints = currentStage().score - score;
      setStatus(`Gem goal complete! Score ${remainingPoints} more points to finish the stage.`);
    } else {
      setStatus(comboMessage || (chain > 1
        ? `Wonderful! You made a chain of ${chain} matches. Keep it going!`
        : "Great match! Find another row of three."));
    }
  }
  renderBoard();
}

function startNewGame() {
  gameRound += 1;
  resetPlayEffects();
  window.clearTimeout(hintTimer);
  hintTimer = null;
  hintedIndices.clear();
  stageIndex = 0;
  score = 0;
  collected = 0;
  moves = currentStage().moves;
  selectedIndex = null;
  resolving = false;
  gameOver = false;
  stageComplete = false;
  ayoRescued = false;
  specials.clear();
  openPuzzleButton.hidden = false;
  rescueButton.hidden = true;
  rescueButton.disabled = true;
  rescueCard.classList.remove("is-ready", "is-rescued", "is-danger");
  rescueStatus.textContent = "DANGER · THE BEAST IS CHASING AYO";
  rescueTitle.textContent = "Ayo needs your help!";
  rescueDescription.textContent = `The Shadow Beast is chasing Ayo! Complete ${STAGES.length} puzzle stages to stop it before it catches them.`;
  rescueButton.innerHTML = 'RESCUE AYO <span aria-hidden="true">→</span>';
  createBoard();
  updateDisplay();
  renderBoard();
  setStatus("Ayo is in danger! Open the puzzle to stop the Shadow Beast.", "Make a match to push the Shadow Beast back!");
}

function advanceStage() {
  if (!stageComplete || stageIndex >= STAGES.length - 1) return;
  gameRound += 1;
  resetPlayEffects();
  window.clearTimeout(hintTimer);
  hintTimer = null;
  hintedIndices.clear();
  stageIndex += 1;
  score = 0;
  collected = 0;
  moves = currentStage().moves;
  selectedIndex = null;
  resolving = false;
  gameOver = false;
  stageComplete = false;
  rescueButton.hidden = true;
  rescueButton.disabled = true;
  openPuzzleButton.hidden = false;
  rescueCard.classList.remove("is-ready", "is-danger");
  rescueStatus.textContent = `DANGER · STAGE ${stageIndex + 1}`;
  rescueTitle.textContent = currentStage().title;
  rescueDescription.textContent = `Match gems and score ${currentStage().score} points before the Shadow Beast catches up.`;
  createBoard();
  updateDisplay();
  renderBoard();
  setStatus(`Stage ${stageIndex + 1} begins! Collect ${currentStage().collect} ${currentStage().collectName}.`);
  openPuzzle();
}

document.querySelector("#restart").addEventListener("click", startNewGame);
document.querySelector("#hint-button").addEventListener("click", showHint);
openPuzzleButton.addEventListener("click", openPuzzle);
document.querySelector("#close-puzzle").addEventListener("click", closePuzzle);
puzzleModal.addEventListener("click", (event) => {
  if (event.target === puzzleModal) closePuzzle();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !puzzleModal.hidden) closePuzzle();
});
rescueButton.addEventListener("click", () => {
  if (stageIndex < STAGES.length - 1) {
    advanceStage();
    return;
  }
  if (!gameOver || !stageComplete || ayoRescued) return;
  ayoRescued = true;
  rescueCard.classList.remove("is-ready");
  rescueCard.classList.add("is-rescued");
  document.querySelector(".scene-monster").style.left = "7%";
  rescueStatus.textContent = "MISSION COMPLETE";
  rescueTitle.textContent = "Ayo is safe!";
  rescueDescription.textContent = "You cleared all three stages and helped Ayo get home safely. Thanks for being a Puzzle Master!";
  rescueButton.disabled = true;
  rescueButton.innerHTML = 'AYO IS SAFE <span aria-hidden="true">✓</span>';
  setStatus("Ayo is safe and sound. You solved the puzzle and completed the rescue!");
});
startNewGame();
