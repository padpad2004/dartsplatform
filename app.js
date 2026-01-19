const STORAGE_KEY = "darts-elo-data";
const DEFAULT_RATING = 1000;
const K_FACTOR = 32;
const RESET_PASSWORD = "6969";

const form = document.getElementById("match-form");
const leaderboard = document.getElementById("leaderboard");
const message = document.getElementById("form-message");
const resetButton = document.getElementById("reset-data");
const recentMatches = document.getElementById("recent-matches");

const state = loadState();
renderLeaderboard();
renderMatches();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const playerName = normalizeName(formData.get("playerName"));
  const opponentName = normalizeName(formData.get("opponentName"));
  const winner = formData.get("winner");
  const winnerCheckout = Number(formData.get("winnerCheckout"));

  if (!playerName || !opponentName) {
    setMessage("Both player names are required.");
    return;
  }

  if (playerName.key === opponentName.key) {
    setMessage("Please enter two different player names.");
    return;
  }

  if (!winner || (winner !== "player" && winner !== "opponent")) {
    setMessage("Please select a winner.");
    return;
  }

  if (Number.isNaN(winnerCheckout) || winnerCheckout < 0) {
    setMessage("Winner checkout must be a valid number.");
    return;
  }

  const result = winner === "player" ? 1 : 0;
  const opponentResult = 1 - result;

  const player = getPlayer(playerName);
  const opponent = getPlayer(opponentName);

  const expectedPlayer = expectedScore(player.rating, opponent.rating);
  const expectedOpponent = expectedScore(opponent.rating, player.rating);

  player.rating = updateRating(player.rating, result, expectedPlayer);
  opponent.rating = updateRating(opponent.rating, opponentResult, expectedOpponent);

  updateStats(player);
  updateStats(opponent);
  updateHighestCheckout(result === 1 ? player : opponent, winnerCheckout);
  recordMatch({
    player: player.displayName,
    opponent: opponent.displayName,
    winner: result === 1 ? player.displayName : opponent.displayName,
    checkout: winnerCheckout,
    playedAt: new Date().toISOString(),
  });

  saveState();
  renderLeaderboard();
  renderMatches();
  form.reset();
  setMessage(
    `${winner === "player" ? player.displayName : opponent.displayName} defeated ${
      winner === "player" ? opponent.displayName : player.displayName
    } (checkout ${winnerCheckout}).`
  );
});

resetButton.addEventListener("click", () => {
  if (!confirm("Reset all data? This cannot be undone.")) {
    return;
  }
  const password = prompt("Enter the reset password to confirm.");
  if (password !== RESET_PASSWORD) {
    setMessage("Incorrect password. Data was not cleared.");
    return;
  }
  state.players = {};
  state.matches = [];
  state.previousRanks = {};
  saveState();
  renderLeaderboard();
  renderMatches();
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
      key: nameInfo.key,
      displayName: nameInfo.displayName,
      rating: DEFAULT_RATING,
      games: 0,
      highestCheckout: 0,
    };
  } else if (nameInfo.displayName) {
    state.players[nameInfo.key].displayName = nameInfo.displayName;
    state.players[nameInfo.key].highestCheckout =
      state.players[nameInfo.key].highestCheckout ?? 0;
    state.players[nameInfo.key].key = nameInfo.key;
  }
  return state.players[nameInfo.key];
}

function expectedScore(rating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

function updateRating(rating, result, expected) {
  return Math.round(rating + K_FACTOR * (result - expected));
}

function updateStats(player) {
  player.games += 1;
}

function updateHighestCheckout(player, checkout) {
  if (checkout > player.highestCheckout) {
    player.highestCheckout = checkout;
  }
}

function recordMatch(match) {
  state.matches.unshift(match);
  state.matches = state.matches.slice(0, 5);
}

function renderLeaderboard() {
  const players = Object.values(state.players);
  const previousRanks = state.previousRanks || {};
  leaderboard.innerHTML = `
    <div class="row header">
      <span>Rank</span>
      <span>Player</span>
      <span>Elo</span>
      <span>Games</span>
      <span>Highest Checkout</span>
    </div>
  `;

  if (players.length === 0) {
    const emptyRow = document.createElement("div");
    emptyRow.className = "row empty";
    emptyRow.textContent = "No matches yet. Add the first one above.";
    leaderboard.appendChild(emptyRow);
    return;
  }

  const sortedPlayers = players.sort((a, b) => b.rating - a.rating);
  const nextRanks = {};
  sortedPlayers.forEach((player, index) => {
    const rank = index + 1;
    const playerKey = player.key || player.displayName.toLowerCase();
    const previousRank = previousRanks[playerKey];
    const movement = previousRank ? previousRank - rank : 0;
    const movementLabel =
      movement > 0 ? `▲ ${movement}` : movement < 0 ? `▼ ${Math.abs(movement)}` : "—";
    const movementClass = movement > 0 ? "up" : movement < 0 ? "down" : "same";

    nextRanks[playerKey] = rank;

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
        <span class="rank-cell">
          <span>${rank}</span>
          <span class="rank-change ${movementClass}">${movementLabel}</span>
        </span>
        <span>${player.displayName}</span>
        <span>${player.rating}</span>
        <span>${player.games}</span>
        <span>${player.highestCheckout}</span>
      `;
    leaderboard.appendChild(row);
  });

  state.previousRanks = nextRanks;
  saveState();
}

function renderMatches() {
  recentMatches.innerHTML = "";
  if (!state.matches.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty";
    emptyItem.textContent = "No matches recorded yet.";
    recentMatches.appendChild(emptyItem);
    return;
  }

  state.matches.forEach((match) => {
    const item = document.createElement("li");
    const playedAt = new Date(match.playedAt);
    const playedLabel = Number.isNaN(playedAt.valueOf())
      ? "Unknown date"
      : playedAt.toLocaleString();
    item.innerHTML = `
      <div class="match-row">
        <span class="match-players">${match.player} vs ${match.opponent}</span>
        <span class="match-meta">Winner: ${match.winner}</span>
      </div>
      <div class="match-row">
        <span class="match-meta">Checkout ${match.checkout}</span>
        <span class="match-meta">${playedLabel}</span>
      </div>
    `;
    recentMatches.appendChild(item);
  });
}

function setMessage(text) {
  message.textContent = text;
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { players: {}, matches: [], previousRanks: {} };
  }
  try {
    const parsed = JSON.parse(stored);
    return {
      players: Object.fromEntries(
        Object.entries(parsed.players || {}).map(([key, value]) => [
          key,
          {
            highestCheckout: 0,
            key,
            ...value,
          },
        ])
      ),
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      previousRanks: parsed.previousRanks || {},
    };
  } catch (error) {
    return { players: {}, matches: [], previousRanks: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
