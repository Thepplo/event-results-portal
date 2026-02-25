const WORKER_BASE = "https://gentle-darkness-f7c5.theo-4e3.workers.dev";
const INCLUDED_TASK_IDS = new Set([
  "Tj4VO5V_f",
  "teu-Hoocx",
  "hynVN5lkv",
  "dbO09epte",
  "c7CRRaGrZ"
  
]);
const TASK_LABELS = { 
  "Tj4VO5V_f": "What was your goal based on the brief (Multiple Choice)?",
  "teu-Hoocx": "What was your strategy (Multiple Choice)?",
  "hynVN5lkv": "How well did you execute the strategy (1-5)?",
  "dbO09epte": "How would you score your team's communication during the mission (1-5)?",
  "c7CRRaGrZ": "How satisfied are you with the overall outcome of your team (1-5)?"

 };

const CHART_COLORS = [
  "#ffda33",
  "#2d52b5",
  "#3e95eb",
  "#770136",
  "#e53846",

];

function normalizeAnswerToOptions(answer) {
  if (answer === null || answer === undefined) return [];

  if (Array.isArray(answer)) {
    return answer.map(v => String(v).trim()).filter(Boolean);
  }

  if (typeof answer === "number" || typeof answer === "boolean") {
    return [String(answer)];
  }

  const s = String(answer).trim();
  if (!s) return [];

  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
    } catch {
    }
  }

  if (s.includes(",")) {
    const parts = s.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }

  return [s];
}
function aggregateOptionsByTask(teams, includedTaskIds) {
  const agg = new Map();

  for (const team of teams) {
    const answers = team.answers || [];
    for (const a of answers) {
      const taskId = a.taskId;
      if (!taskId) continue;
      if (includedTaskIds && includedTaskIds.size && !includedTaskIds.has(taskId)) continue;

      const options = normalizeAnswerToOptions(a.answer);

      if (!agg.has(taskId)) agg.set(taskId, new Map());
      const map = agg.get(taskId);

      for (const opt of options) {
        map.set(opt, (map.get(opt) || 0) + 1);
      }
    }
  }

  return agg;
}

function renderTaskCharts(teams) {
  const taskAgg = aggregateOptionsByTask(teams, (typeof INCLUDED_TASK_IDS !== "undefined" ? INCLUDED_TASK_IDS : null));

  if (!taskAgg.size) {
    return `<div class="card"><h3>Survey Charts</h3><p class="muted">No answers found for selected tasks.</p></div>`;
  }

  const blocks = [];
  for (const [taskId, optionMap] of taskAgg.entries()) {
    const canvasId = `chart_${taskId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    blocks.push(`
      <div class="card">
        <h3>Question: ${TASK_LABELS[taskId] || taskId}</h3>
        <div style="max-width:520px;">
          <canvas id="${canvasId}" height="260"></canvas>
        </div>
        <div class="muted" style="margin-top:8px;">
          ${Array.from(optionMap.entries())
            .sort((a,b)=>b[1]-a[1])
            .map(([opt,count]) => `<div><b>${count}</b> — ${escapeHtml(opt)}</div>`)
            .join("")}
        </div>
      </div>
    `);
  }


  return `<div class="card"><h2>Survey Results</h2><p class="muted">Distribution of selected options per task.</p></div>${blocks.join("")}`;
}

function drawTaskCharts(teams) {
  const taskAgg = aggregateOptionsByTask(teams, (typeof INCLUDED_TASK_IDS !== "undefined" ? INCLUDED_TASK_IDS : null));

  for (const [taskId, optionMap] of taskAgg.entries()) {
    const canvasId = `chart_${taskId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const el = document.getElementById(canvasId);
    if (!el) continue;

    const labels = Array.from(optionMap.keys());
    const values = labels.map(l => optionMap.get(l));

    const MAX_SLICES = 10;
    let finalLabels = labels;
    let finalValues = values;

    if (labels.length > MAX_SLICES) {
      const pairs = labels.map((l,i)=>({ label:l, value:values[i] }))
                          .sort((a,b)=>b.value-a.value);

      const top = pairs.slice(0, MAX_SLICES - 1);
      const rest = pairs.slice(MAX_SLICES - 1);
      const otherSum = rest.reduce((s,p)=>s+p.value,0);

      finalLabels = top.map(p=>p.label).concat(["Other"]);
      finalValues = top.map(p=>p.value).concat([otherSum]);
    }

    new Chart(el, {
      type: "doughnut",
      data: {
        labels: finalLabels,
        datasets: [{
          data: finalValues,

          backgroundColor: finalLabels.map((_, i) =>
            CHART_COLORS[i % CHART_COLORS.length]
          ),

          borderColor: "#4A4046",
          borderWidth: 1,

          hoverOffset: 8
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
                const v = ctx.parsed;
                const pct = total ? Math.round((v/total)*100) : 0;
                return `${ctx.label}: ${v} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
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
  const allAnswers = team.answers || [];
  const answers = INCLUDED_TASK_IDS.size
  ? allAnswers.filter(a => INCLUDED_TASK_IDS.has(a.taskId))
  : allAnswers;
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

  app.innerHTML = renderTaskCharts(teams) + teams.map(renderTeam).join("");

  drawTaskCharts(teams);
}

run().catch(err => {
  document.getElementById("app").textContent = `Error: ${err.message}`;
});