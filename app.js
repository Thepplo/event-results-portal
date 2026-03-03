const WORKER_BASE = "https://gentle-darkness-f7c5.theo-4e3.workers.dev";

const DONUT_TASK_IDS = [
  "Tj4VO5V_f",
  "teu-Hoocx",
  "hynVN5lkv",
  "dbO09epte",
];

const MIXED_TASK_ID = "c7CRRaGrZ";


const INCLUDED_TASK_IDS = new Set([
  "Tj4VO5V_f",
  "teu-Hoocx",
  "hynVN5lkv",
  "dbO09epte",
]);

const TASK_OPTION_LABELS = {
  "Tj4VO5V_f": {
    0: "Was there a brief?",
    1: "Gather all Superfoods",
    2: "I don't know",
    3: "Gather all my allotted Superfoods",
  },

  "teu-Hoocx": {
    0: "I didn't have a specific strategy",
    1: "Just going and getting the job done",
    2: "We had clear roles & procedures",
    3: "We agreed on policies and how to attack the problem",
    4: "We did an analysis on the main probem we needed to crack",
  },

  "hynVN5lkv": {
    0: "We had a clear set of actions",
    1: "We agreed on clear roles",
    2: "We consistently executed what we decided",
    3: "We started in one direction but lost it quickly",
    4: "We nailed it",
  },

  "dbO09epte": {
    0: "1",
    1: "2",
    2: "3",
    3: "4",
    4: "5",
  },
};
const TASK_LABELS = { 
  "Tj4VO5V_f": "1. What was your goal based on the brief?",
  "teu-Hoocx": "2. What was your strategy?",
  "hynVN5lkv": "3. How well did you execute the strategy?",
  "dbO09epte": "4. How would you score your team's communication during the mission (1-5)?",
  "c7CRRaGrZ": "5. How satisfied are you with the overall outcome of your team (1-5)?"

 };

const CHART_COLORS = [
  "#3e95eb",
  "#f4c430",
  "#e53846",
  "#770136",
  "#2d52b5",
];

const TASK_LABEL_TO_INDEX = (() => {
  const out = {};
  for (const [taskId, idxToLabel] of Object.entries(TASK_OPTION_LABELS)) {
    out[taskId] = {};
    for (const [k, label] of Object.entries(idxToLabel)) {
      out[taskId][label] = Number(k);
    }
  }
  return out;
})();

function computeDonutSeries(taskId, optionMap, maxSlices = 25) {
  const labels = getOrderedLabelsForTask(taskId, optionMap);
  const values = labels.map(l => optionMap.get(l) || 0);

  if (labels.length <= maxSlices) return { labels, values };

  const keptLabels = labels.slice(0, maxSlices - 1);
  const keptSet = new Set(keptLabels);

  const otherSum = labels
    .filter(l => !keptSet.has(l))
    .reduce((s, l) => s + (optionMap.get(l) || 0), 0);

  return {
    labels: keptLabels.concat(["Other"]),
    values: keptLabels.map(l => optionMap.get(l) || 0).concat([otherSum]),
  };
}


function decodeOption(taskId, raw) {
  const map = TASK_OPTION_LABELS[taskId];
  if (!map) return String(raw);

  const key = String(raw).trim();

  if (map[key] != null) return map[key];
  if (map[Number(key)] != null) return map[Number(key)];

  return key;
}

function normalizeAnswerToOptions(taskId, answer) {
  if (answer === null || answer === undefined) return [];

  if (Array.isArray(answer)) return answer.map(v => decodeOption(taskId, v));

  const s = String(answer).trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(v => decodeOption(taskId, v));
    } catch {}
  }

  return [decodeOption(taskId, s)];
}


function createBarGradient(ctx, color) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, lighten(color, 0.6));
  gradient.addColorStop(1, color);
  return gradient;
}

function lighten(hex, amount) {
  const num = parseInt(hex.replace("#",""), 16);
  let r = (num >> 16) + Math.round(255 * amount);
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * amount);
  let b = (num & 0x0000FF) + Math.round(255 * amount);
  r = Math.min(255, r);
  g = Math.min(255, g);
  b = Math.min(255, b);
  return `rgb(${r},${g},${b})`;
}


function aggregateOptionsByTask(teams, taskIdsSet) {
  const agg = new Map();

  for (const team of teams) {
    for (const a of (team.answers || [])) {
      if (!a.taskId) continue;
      if (taskIdsSet && taskIdsSet.size && !taskIdsSet.has(a.taskId)) continue;

      const opts = normalizeAnswerToOptions(a.taskId, a.answer);

      if (!agg.has(a.taskId)) agg.set(a.taskId, new Map());
      const map = agg.get(a.taskId);

      for (const optLabel of opts) {
        map.set(optLabel, (map.get(optLabel) || 0) + 1);
      }
    }
  }
  return agg;
}

function getOrderedLabelsForTask(taskId, optionMap) {
  const dict = TASK_OPTION_LABELS[taskId];
  let ordered = [];

  if (dict) {
    ordered = Object.keys(dict)
      .map(Number)
      .sort((a, b) => a - b)
      .map(k => dict[k]);
  }

  const extras = Array.from(optionMap.keys()).filter(l => !ordered.includes(l));
  return ordered.concat(extras);
}

function colorForLabel(taskId, label) {
  if (label === "Other") return "#666666";
  const idx = TASK_LABEL_TO_INDEX?.[taskId]?.[label];

  const safeIdx = (idx ?? 0);

  return CHART_COLORS[safeIdx % CHART_COLORS.length];
}

function buildBarRowsFromAnswersScore(teams) {
  return teams
    .map(t => ({
      teamId: t.id,
      teamName: t.name || t.members?.[0] || "Team",
      score: Number(t.answersScore) || 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}


function parseRatingAndWordFromString(answer) {
  const s = String(answer ?? "").trim();
  if (!s) return { rating: null, word: "" };

  let m = s.match(/^(\d+)\s*(.*)$/);
  if (m) {
    const rating = parseInt(m[1], 10);
    const word = (m[2] || "").trim();
    return { rating: Number.isFinite(rating) ? rating : null, word };
  }

  m = s.match(/^(.*?)\s*(\d+)\s*[^\p{L}\p{N}]*$/u);
  if (m) {
    const rating = parseInt(m[2], 10);
    const word = (m[1] || "").trim();
    return { rating: Number.isFinite(rating) ? rating : null, word };
  }

  return { rating: null, word: s };
}

function aggregateMixedTask(teams) {
  const ratingCounts = new Map([[1,0],[2,0],[3,0],[4,0],[5,0]]);
  const wordCounts = new Map();

  for (const t of teams) {
    const a = (t.answers || []).find(x => x.taskId === MIXED_TASK_ID);
    if (!a) continue;

    const { rating, word } = parseRatingAndWordFromString(a.answer);

    if (ratingCounts.has(rating)) {
      ratingCounts.set(rating, ratingCounts.get(rating) + 1);
    }

    const cleaned = (word || "")
      .toLowerCase()
      .trim()
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

    if (cleaned) wordCounts.set(cleaned, (wordCounts.get(cleaned) || 0) + 1);
  }

  return { ratingCounts, wordCounts };
}
function drawAnswersScoreBarChart(teams) {
  const el = document.getElementById("barCorrect");
  if (!el) return;

  const rows = buildBarRowsFromAnswersScore(teams).sort((a,b) => b.score - a.score);
  const ctx = el.getContext("2d");
  new Chart(el, {
    type: "bar",
    data: {
      labels: rows.map(r => r.teamName),
      datasets: [{
        label: "Score (scored tasks)",
        data: rows.map(r => r.score),
        backgroundColor: rows.map((r, i) =>
          i === 0 ? "#f4c430" : "#2d52b5"
        ),
        borderColor: "#4A4046",
        borderWidth: 1,
        borderRadius: {
          topLeft: 8,
          topRight: 8,
          bottomLeft: 0,
          bottomRight: 0
        },
        borderSkipped: false
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        },
        x: {
          ticks: {
            color: "#F3EDEE",
            font: { size: 13, weight: "600", family: "Montserrat, sans-serif" },
          }
        }
      },

      plugins: {
        legend: { display: false },

        datalabels: {
          anchor: "end",
          align: "end",
          offset: 4,

          color: "#ffffff",
          textShadowColor: "rgba(0,0,0,0.4)",
          textShadowBlur: 4,

          font: {
            weight: "600",
            size: 14
          },

          formatter: (value) => value
        }
      }
    },
    plugins: [ChartDataLabels]
    
  });
}
function drawSatisfactionChart(ratingCounts) {
  const el = document.getElementById("satChart");
  if (!el) return;

  const labels = [1,2,3,4,5].map(String);
  const values = [1,2,3,4,5].map(k => ratingCounts.get(k) || 0);

  new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Satisfaction (1–5)",
        data: values,
        backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderColor: "#4A4046",
        borderWidth: 1,
        borderRadius: {
          topLeft: 8,
          topRight: 8,
          bottomLeft: 0,
          bottomRight: 0
        },
        borderSkipped: false
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: {
          ticks: {
            color: "#F3EDEE",
            font: { size: 13, weight: "600", family: "Montserrat, sans-serif" },
          }
      }
    }
  }
  });
}
function drawWordCloud(wordCounts, topN = 30) {
  const el = document.getElementById("wordCloudCanvas");
  if (!el) return;


  const pairs = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  const labels = pairs.map(p => p[0]);
  const data = pairs.map(p => p[1]);
  const maxCount = Math.max(...data);
  const scaledData = data.map(c => (c / maxCount) * 50 + 20);

  new Chart(el.getContext("2d"), {
    type: "wordCloud",
    data: {
      labels,
      datasets: [{
        label: "Experience words",
        data: scaledData,
        color: "#ffffff",
        minRotation: 0,
        maxRotation: 0,
        rotationSteps: 1,
        padding: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      layout: { padding: 8 },
    },
  });

}
function renderDonutCharts(teams) {
  const donutAgg = aggregateOptionsByTask(teams, new Set(DONUT_TASK_IDS));

  if (!donutAgg.size) {
    return `<div class="card"><h3>Survey Charts</h3><p class="muted">No answers found for selected tasks.</p></div>`;
  }

  const blocks = [];
  for (const [taskId, optionMap] of donutAgg.entries()) {
    const safeId = taskId.replace(/[^a-zA-Z0-9_]/g, "_");
    const canvasId = `chart_${safeId}`;

    const { labels: finalLabels, values: finalValues } =
      computeDonutSeries(taskId, optionMap, 25);

    const total = finalValues.reduce((a, b) => a + b, 0);
    const maxIndex = finalValues.indexOf(Math.max(...finalValues));
    

    blocks.push(`
      <div class="card" data-chart="donut" data-task-id="${taskId}">
        <div class="card-header">
          <h2>${TASK_LABELS[taskId] || taskId}</h2>
          <div class="card-meta muted">Based on ${finalValues.reduce((a, b) => a + b, 0)} responses</div>
        </div>
        <div class="donut-layout">
          <div class="donut-chart">
            <canvas id="${canvasId}"></canvas>
          </div>
          <div class="donut-legend">
            ${finalLabels.map((label, i) => {
              const value = finalValues[i];
              const percent = total ? Math.round((value / total) * 100) : 0;
              const topClass = i === maxIndex ? " legend-row--top" : "";

              return `
                <div data-index="${i}" class="legend-row${topClass}">
                  <span 
                    class="legend-color"
                    style="--legend-color:${colorForLabel(taskId, label)}">
                  </span>

                  <span class="legend-label">
                    ${escapeHtml(label)}
                  </span>

                  <span class="legend-value">
                    ${percent}% <span class="legend-count">(${value})</span>
                  </span>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `);
  }

  return blocks.join("");
}

/* function drawDonutCharts(teams, taskIds) {
  const taskAgg = aggregateOptionsByTask(teams, taskIds);
  

  for (const [taskId, optionMap] of taskAgg.entries()) {
    const canvasId = `chart_${taskId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const el = document.getElementById(canvasId);
    if (!el) continue;

    const { labels: finalLabels, values: finalValues } =
      computeDonutSeries(taskId, optionMap, 10);

    new Chart(el, {
      type: "doughnut",
      data: {
        labels: finalLabels,
        datasets: [{
          data: finalValues,
          backgroundColor: finalLabels.map(label => colorForLabel(taskId, label)),
          borderColor: "#3a3237",
          borderWidth: 2,
          hoverOffset: 2
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: {
            color: "#ffffff",
            textShadowColor: "rgba(0,0,0,0.4)",
            textShadowBlur: 4,
            font: { weight: "600", size: 14 },
            formatter: (value, context) => {
              const data = context.chart.data.datasets[0].data;
              const total = data.reduce((a, b) => a + b, 0);
              const percentage = total ? (value / total) * 100 : 0;
              return percentage > 5 ? percentage.toFixed(0) + "%" : "";
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const v = ctx.parsed;
                const pct = total ? Math.round((v / total) * 100) : 0;
                return `${ctx.label}: ${v} (${pct}%)`;
              }
            }
          }
        }
      },
      plugins: [ChartDataLabels]
    });
  }
} */
function withAlpha(color, alpha) {
  if (!color) return color;

  if (color[0] === "#") {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(",").map(s => s.trim());
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}

function focusSlice(chart, baseColors, activeIndex) {
  const dimmed = baseColors.map((c, i) => (i === activeIndex ? c : withAlpha(c, 0.35)));
  chart.data.datasets[0].backgroundColor = dimmed;
  chart.update();
}


function clearFocus(chart, baseColors) {
  chart.data.datasets[0].backgroundColor = baseColors.slice();
  chart.update();
}

function drawDonutChart(taskId, optionMap) {
  const canvasId = `chart_${taskId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  const el = document.getElementById(canvasId);
  if (!el) return;

  if (el.dataset.drawn === "1") return;
  el.dataset.drawn = "1";

  if (el.__chart) {
    el.__chart.destroy();
    el.__chart = null;
  }

  const { labels: finalLabels, values: finalValues } =
    computeDonutSeries(taskId, optionMap, 10);

  const baseColors = finalLabels.map(l => colorForLabel(taskId, l));

  el.__chart = new Chart(el, {
    type: "doughnut",
    data: {
      labels: finalLabels,
      datasets: [{
        data: finalValues,
        backgroundColor: finalLabels.map(label => colorForLabel(taskId, label)),
        borderColor: "#4A4046",
        borderWidth: 1,
        hoverOffset: 8
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 600,
        easing: "easeOutQuad",
      },
      hover: {
          animationDuration: 150
        },
      plugins: {
        legend: { display: false },
        datalabels: {
          color: "#ffffff",
          textShadowColor: "rgba(0,0,0,0.4)",
          textShadowBlur: 4,
          font: { weight: "600", size: 14 },
          formatter: (value, context) => {
            const data = context.chart.data.datasets[0].data;
            const total = data.reduce((a, b) => a + b, 0);
            const percentage = total ? (value / total) * 100 : 0;
            return percentage > 5 ? percentage.toFixed(0) + "%" : "";
          }
        },
        tooltip: { enabled: false },

        /* tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const v = ctx.parsed;
              const pct = total ? Math.round((v / total) * 100) : 0;
              return `${ctx.label}: ${v} (${pct}%)`;
            }
          }
        } */
      }
    },
    plugins: [ChartDataLabels]
    
  });


  const chart = el.__chart;
  const card = el.closest(".card");
  const legend = card.querySelector(".donut-legend");
  if (!legend) return;

  legend.addEventListener("mouseover", (e) => {
    const row = e.target.closest(".legend-row");
    if (!row) return;
    const i = Number(row.dataset.index);

    chart.setActiveElements([{ datasetIndex: 0, index: i }]);
    //chart.tooltip.setActiveElements([{ datasetIndex: 0, index: i }], { x: 0, y: 0 });
    focusSlice(chart, baseColors, i);
    chart.update();
    
  });

  legend.addEventListener("mouseout", (e) => {
    if (e.relatedTarget && legend.contains(e.relatedTarget)) return;
    chart.setActiveElements([]);
    //chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    clearFocus(chart, baseColors);
    chart.update();
  });
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

function setupLazyChartDrawing({ teams, ratingCounts, wordCounts, donutTaskIds }) {
  const drawers = new Map([
    ["barCorrect", () => drawAnswersScoreBarChart(teams)],
    ["satChart", () => drawSatisfactionChart(ratingCounts)],
    ["wordCloud", () => drawWordCloud(wordCounts)],
  ]);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const el = entry.target;
        const key = el.getAttribute("data-chart");
        const draw = drawers.get(key);

        if (draw && !el.dataset.drawn) {
          el.dataset.drawn = "1";
          draw();
        }

        observer.unobserve(el);
      }
    },
    {
      root: null,
      rootMargin: "-100px 0px",
      threshold: 0.4,
    }
  );

  document.querySelectorAll("[data-chart]").forEach((el) => observer.observe(el));
}

function setupLazyDonuts(teams, taskIds) {
  const taskAgg = aggregateOptionsByTask(teams, taskIds);

  const cards = document.querySelectorAll('.card[data-chart="donut"]');
  if (!cards.length) return;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;

      const card = e.target;
      const taskId = card.getAttribute("data-task-id");
      const optionMap = taskAgg.get(taskId);

      if (taskId && optionMap) drawDonutChart(taskId, optionMap);

      io.unobserve(card);
    }
  }, {rootMargin: "0px", threshold: 0.4});

  cards.forEach(c => io.observe(c));
}

async function run() {
  const app = document.getElementById("app");

  const params = qs();
  const gameId = params.get("gameId");
  const teamId = params.get("teamId");
  const loginCard = document.getElementById("login-card");
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
    loginCard.style.display = "flex";
    return;
  }

  const data = await fetchResults({ gameId, teamId });

  if (data.team) {
    if (!data.team) {
      app.textContent = "No team found for that game/team.";
      return;
    }
    loginCard.style.display = "none";
    app.innerHTML = renderTeam(data.team);

    return;
  }

  const teams = data.items || [];
  if (!teams.length) {
    app.textContent = "No teams found for that game.";

    return;
  }
  loginCard.style.display = "none"; 

  const { ratingCounts, wordCounts } = aggregateMixedTask(teams);

  app.innerHTML = `

    ${renderDonutCharts(teams, DONUT_TASK_IDS)} 

    <div class="card" data-chart="barCorrect">
      <div class="card-header">
        <h2>Points per person</h2>
        <div class="card-meta muted">Top 5</div>
        </div>
      <div class="chart-box">
        <canvas id="barCorrect"></canvas>
      </div>
    </div>

    <div class="card" data-chart="satChart">
      <div class="card-header">
        <h2>How satisfied are you with the overall outcome of your team?</h2>
        <div class="card-meta muted">(1-5)</div>
        </div>
      <div class="chart-box">
        <canvas id="satChart"></canvas>
      </div>
    </div>

    <div class="card" data-chart="wordCloud">
      <h2>One-word experience</h2>
      <canvas id="wordCloudCanvas" style="height: 500px; max-height: 500px; width: 100%;"></canvas>
    </div>
  `;

  setupLazyChartDrawing({
    teams,
    ratingCounts,
    wordCounts,
  });

  setupLazyDonuts(teams, DONUT_TASK_IDS)
}

run().catch(err => {
  document.getElementById("app").textContent = `Error: ${err.message}`;
});