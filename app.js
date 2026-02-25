const WORKER_BASE = "https://gentle-darkness-f7c5.theo-4e3.workers.dev";

function qs() {
  return new URLSearchParams(location.search);
}

function setQueryParams(params) {
  const url = new URL(location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  });
  history.replaceState({}, "", url.toString());
}

async function fetchResults({ gameId, teamId }) {
  const url = new URL(`${WORKER_BASE}/api/loquiz`);
  url.searchParams.set("gameId", gameId);
  if (teamId) url.searchParams.set("teamId", teamId);
  url.searchParams.set("includeAnswers", "true");

  const resp = await fetch(url.toString(), { method: "GET" });
  const text = await resp.text();

  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Non-JSON response (${resp.status}): ${text.slice(0, 200)}`); }

  if (!resp.ok) {
    throw new Error(`API error (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

function renderTeam(team) {
  const answers = team.answers || [];
  return `
    <div class="card">
      <h2>${team.name ?? "Team"}</h2>
      <p class="muted">
        Total score: <b>${team.totalScore ?? "-"}</b>
        ${team.correctAnswers != null ? ` • Correct: <b>${team.correctAnswers}</b>` : ""}
        ${team.incorrectAnswers != null ? ` • Incorrect: <b>${team.incorrectAnswers}</b>` : ""}
      </p>
    </div>

    <div class="card">
      <h3>Answer breakdown</h3>
      ${answers.length ? `
        <table>
          <thead><tr><th>Task</th><th>Answer</th><th>Correct</th><th>Score</th></tr></thead>
          <tbody>
            ${answers.map(a => `
              <tr>
                <td>${a.taskId ?? ""}</td>
                <td>${(a.answer ?? "").toString()}</td>
                <td>${a.correct ? "✅" : "❌"}</td>
                <td>${a.score ?? ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<p class="muted">No answers returned. Check that includeAnswers is supported for this game.</p>`}
    </div>
  `;
}

async function run() {
  const app = document.getElementById("app");

  const params = qs();
  const gameId = params.get("gameId");
  const teamId = params.get("teamId");

  const loadBtn = document.getElementById("loadBtn");

  if (!loadBtn.dataset.bound) {
    loadBtn.dataset.bound = "1";
    loadBtn.addEventListener("click", async () => {
      const g = document.getElementById("gameIdInput").value.trim();
      const t = document.getElementById("teamIdInput").value.trim();
      if (!g) return alert("gameId is required");
      setQueryParams({ gameId: g, teamId: t || "" });
      await run();
    });
  }

  if (!gameId) {
    app.textContent = "Enter a gameId above or open this page with ?gameId=...";
    return;
  }

  app.textContent = "Loading…";
  const data = await fetchResults({ gameId, teamId });

  if (data.team) {
    if (!data.team) {
      app.textContent = "No team found for that game/team.";
      return;
    }
    app.innerHTML = renderTeam(data.team);
    return;
  }

  const teams = data.items || [];
  if (!teams.length) {
    app.textContent = "No teams found for that game.";
    return;
  }

  teams.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
  app.innerHTML = teams.map(renderTeam).join("");
}

run().catch(err => {
  document.getElementById("app").textContent = `Error: ${err.message}`;
});