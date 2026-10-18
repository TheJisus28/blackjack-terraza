// Non-destructive end-to-end check of side bets against the emulators (does not wipe data).
// Usage: node scripts/e2e-sidebets.mjs [tableId]
const APP = process.env.APP_URL ?? "http://localhost:3000";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const DB = "http://127.0.0.1:9000";
const NS = "blackjack-terraza-default-rtdb";
const TABLE = process.argv[2] ?? "mesa-zafiro";

const read = async (path) => (await fetch(`${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } })).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (cond, msg) => {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
  console.log(`  ok - ${msg}`);
};

async function main() {
  const su = await (
    await fetch(`${AUTH}/accounts:signUp?key=fake-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    })
  ).json();
  const user = { uid: su.localId, token: su.idToken };
  const call = async (path, body) => {
    const res = await fetch(`${APP}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(`${path} ${JSON.stringify(body)} -> ${json.error}`);
    return json;
  };
  const act = (body) => call(`/api/tables/${TABLE}`, body);

  await call("/api/profile", { action: "init" });
  await call("/api/tables", { action: "sweep" });
  await fetch(`${DB}/presence/${TABLE}/${user.uid}.json?ns=${NS}`, {
    method: "PUT",
    headers: { Authorization: "Bearer owner" },
    body: JSON.stringify({ conns: { c1: true }, lastSeen: Date.now() }),
  });

  const state0 = await read(`tables/${TABLE}/state`);
  const seats = state0.seats ?? {};
  const free = [0, 1, 2, 3, 4, 5, 6].find((i) => !seats[i] || seats[i].bot);
  assert(free !== undefined, `free seat found (${free})`);
  await act({ type: "sit", seat: free, buyIn: 2000 });

  for (let i = 0; i < 60; i++) {
    const s = await read(`tables/${TABLE}/state`);
    if (s.phase === "betting" && s.seats[free]?.uid === user.uid) break;
    if (s.phaseEndsAt && Date.now() > s.phaseEndsAt) await act({ type: "tick" });
    await sleep(400);
  }

  console.log("bets");
  await act({ type: "bet", amount: 50 });
  for (const bet of ["pp", "t21", "hot3", "bust"]) await act({ type: "side", bet, amount: 10 });
  let seat = (await read(`tables/${TABLE}/state/seats/${free}`));
  assert(seat.stack === 2000 - 90, `stakes taken from the stack (${seat.stack})`);
  assert(seat.side.pp === 10 && seat.side.bust === 10, "side stakes recorded");
  const tooMuch = await act({ type: "side", bet: "pp", amount: 100_000 }).catch((e) => e.message);
  assert(String(tooMuch).includes("lateral máxima"), "side bet cap enforced");

  await act({ type: "ready" });
  seat = await read(`tables/${TABLE}/state/seats/${free}`);
  const results = seat.sideResults ?? {};
  for (const id of ["pp", "t21", "hot3"]) assert(results[id] && typeof results[id].payout === "number", `${id} resolved at the deal: ${results[id]?.kind}`);
  assert(!results.bust, "bust waits for the dealer");
  const paid = ["pp", "t21", "hot3"].reduce((sum, id) => sum + results[id].payout, 0);
  assert(seat.stack === 2000 - 90 + paid, `deal-time payouts credited (${paid})`);

  console.log("play");
  for (let i = 0; i < 80; i++) {
    const s = await read(`tables/${TABLE}/state`);
    if (s.phase === "payout") break;
    if (s.phase === "insurance") await act({ type: "insurance", take: false }).catch(() => {});
    else if (s.phase === "playing" && s.turn?.seat === free) await act({ type: "stand" }).catch(() => {});
    else if (s.phaseEndsAt && Date.now() > s.phaseEndsAt) await act({ type: "tick" });
    else await sleep(300);
  }
  seat = await read(`tables/${TABLE}/state/seats/${free}`);
  assert(seat.sideResults?.bust, `bust settled with the dealer: ${seat.sideResults?.bust?.kind}`);
  const allSide = ["pp", "t21", "hot3", "bust"].reduce((sum, id) => sum + seat.sideResults[id].payout, 0);
  const main = seat.hands.reduce((sum, h) => sum + h.payout, 0) - seat.hands.reduce((sum, h) => sum + h.bet, 0);
  assert(seat.net === main + allSide - 40, `round net includes side bets (${seat.net})`);

  await act({ type: "leave" });
  console.log("\nSIDE BETS OK");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
