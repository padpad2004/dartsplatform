const STORAGE_KEY = "darts-elo-data";
const DEFAULT_RATING = 1000;
const K_FACTOR = 32;

const form = document.getElementById("match-form");
const leaderboard = document.getElementById("leaderboard");
const message = document.getElementById("form-message");
const resetButton = document.getElementById("reset-data");

const state = loadState();
renderLeaderboard();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const playerName = normalizeName(formData.get("playerName"));
  const opponentName = normalizeName(formData.get("opponentName"));
  const playerScore = Number(formData.get("playerScore"));
  const opponentScore = Number(formData.get("opponentScore"));

  if (!playerName || !opponentName) {
    setMessage("Both player names are required.");
    return;
  }

  if (playerName.key === opponentName.key) {
    setMessage("Please enter two different player names.");
    return;
  }

  if (Number.isNaN(playerScore) || Number.isNaN(opponentScore)) {
    setMessage("Scores must be valid numbers.");
    return;
  }

  const result = playerScore === opponentScore ? 0.5 : playerScore > opponentScore ? 1 : 0;
  const opponentResult = 1 - result;

  const player = getPlayer(playerName);
  const opponent = getPlayer(opponentName);

  const expectedPlayer = expectedScore(player.rating, opponent.rating);
  const expectedOpponent = expectedScore(opponent.rating, player.rating);

  player.rating = updateRating(player.rating, result, expectedPlayer);
  opponent.rating = updateRating(opponent.rating, opponentResult, expectedOpponent);

  updateStats(player, playerScore);
  updateStats(opponent, opponentScore);

  saveState();
  renderLeaderboard();
  form.reset();
  setMessage(
    `${player.displayName} (${playerScore}) vs ${opponent.displayName} (${opponentScore}) recorded.`
  );
});

resetButton.addEventListener("click", () => {
  if (!confirm("Reset all data? This cannot be undone.")) {
    return;
  }
  state.players = {};
  saveState();
  renderLeaderboard();
  setMessage("All data cleared.");
});

function normalizeName(rawName) {
  const name = String(rawName || "").trim();
  return {
    key: name.toLowerCase(),
    displayName: name,
  };
}

function getPlayer(nameInfo) {
  if (!state.players[nameInfo.key]) {
    state.players[nameInfo.key] = {
      displayName: nameInfo.displayName,
      rating: DEFAULT_RATING,
      games: 0,
      totalScore: 0,
    };
  } else if (nameInfo.displayName) {
    state.players[nameInfo.key].displayName = nameInfo.displayName;
  }
  return state.players[nameInfo.key];
}

function expectedScore(rating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

function updateRating(rating, result, expected) {
  return Math.round(rating + K_FACTOR * (result - expected));
}

function updateStats(player, score) {
  player.games += 1;
  player.totalScore += score;
}

function renderLeaderboard() {
  const players = Object.values(state.players);
  leaderboard.innerHTML = `
    <div class="row header">
      <span>Rank</span>
      <span>Player</span>
      <span>Elo</span>
      <span>Games</span>
      <span>Avg Score</span>
    </div>
  `;

  if (players.length === 0) {
    const emptyRow = document.createElement("div");
    emptyRow.className = "row empty";
    emptyRow.textContent = "No matches yet. Add the first one above.";
    leaderboard.appendChild(emptyRow);
    return;
  }

  players
    .sort((a, b) => b.rating - a.rating)
    .forEach((player, index) => {
      const row = document.createElement("div");
      row.className = "row";
      const average = player.games ? (player.totalScore / player.games).toFixed(1) : "0.0";
      row.innerHTML = `
        <span>${index + 1}</span>
        <span>${player.displayName}</span>
        <span>${player.rating}</span>
        <span>${player.games}</span>
        <span>${average}</span>
      `;
      leaderboard.appendChild(row);
    });
}

function setMessage(text) {
  message.textContent = text;
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { players: {} };
  }
  try {
    const parsed = JSON.parse(stored);
    return {
      players: parsed.players || {},
    };
  } catch (error) {
    return { players: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
