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

function currentStage() {
  return STAGES[stageIndex];
}

function setStatus(message, puzzleMessage = message) {
  statusElement.textContent = message;
  puzzleStatus.textContent = puzzleMessage;
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
      [board[index], board[neighbor]] = [board[neighbor], board[index]];
      const createsMatch = findMatches().size > 0;
      [board[index], board[neighbor]] = [board[neighbor], board[index]];
      if (createsMatch) return true;
    }
  }
  return false;
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
    button.className = `tile ${tile.className}${selectedIndex === index ? " is-selected" : ""}${power ? ` has-power power-${power}` : ""}`;
    button.textContent = tile.symbol;
    button.setAttribute("aria-label", `${power ? `${power === "burst" ? "Burst" : "Line blast"} ${tile.name}` : tile.name}, row ${Math.floor(index / SIZE) + 1}, column ${(index % SIZE) + 1}`);
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
    cleared.forEach((index) => {
      board[index] = null;
      specials.delete(index);
    });
    updateDisplay();
    renderBoard();
    await new Promise((resolve) => window.setTimeout(resolve, 180));
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
