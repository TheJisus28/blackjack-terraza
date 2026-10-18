// End-to-end check of the game API against the Firebase emulators.
// Requires `npm run emulators` and `npm run dev:emu`. Usage: node scripts/e2e-api.mjs
const APP = process.env.APP_URL ?? "http://localhost:3000";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const DB = "http://127.0.0.1:9000";
const NS = "blackjack-terraza-default-rtdb";
const TABLE = "terraza-principiantes";

async function signUp() {
  const res = await fetch(`${AUTH}/accounts:signUp?key=fake-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const json = await res.json();
  return { uid: json.localId, token: json.idToken };
}

async function call(user, path, body) {
  const res = await fetch(`${APP}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${path} ${JSON.stringify(body)} -> ${res.status} ${json.error}`);
  return json;
}

const read = async (path) => (await fetch(`${DB}/${path}.json?ns=${NS}`, { headers: { Authorization: "Bearer owner" } })).json();
const writePresence = (tableId, user) =>
  fetch(`${DB}/presence/${tableId}/${user.uid}.json?ns=${NS}`, {
    method: "PUT",
    headers: { Authorization: "Bearer owner" },
    body: JSON.stringify({ conns: { c1: true }, lastSeen: Date.now() }),
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (cond, msg) => {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
  console.log(`  ok - ${msg}`);
};

async function playUntilPayout(users, label) {
  for (let i = 0; i < 80; i++) {
    const s = await read(`tables/${TABLE}/state`);
    if (s.phase === "payout") return s;
    if (s.phase === "insurance") {
      for (const u of users) await call(u, `/api/tables/${TABLE}`, { type: "insurance", take: false }).catch(() => {});
    } else if (s.phase === "playing" && s.turn) {
      const seat = s.seats[s.turn.seat];
      const me = users.find((u) => u.uid === seat.uid);
      if (me) {
        const hand = seat.hands[s.turn.hand];
        const total = hand.cards.reduce((t, c) => t + ("TJQK".includes(c.c[0]) ? 10 : c.c[0] === "A" ? 11 : Number(c.c[0])), 0);
        await call(me, `/api/tables/${TABLE}`, { type: total < 13 ? "hit" : "stand" });
        continue;
      }
    }
    if (s.phaseEndsAt && Date.now() > s.phaseEndsAt) await call(users[0], `/api/tables/${TABLE}`, { type: "tick" });
    else await sleep(300);
  }
  throw new Error(`${label}: never reached payout`);
}

async function main() {
  console.log("users");
  const ana = await signUp();
  const beto = await signUp();
  // Emulator only: start every run from an empty database.
  if (!DB.includes("127.0.0.1")) throw new Error("refusing to wipe a non-emulator database");
  await fetch(`${DB}/.json?ns=${NS}`, { method: "DELETE", headers: { Authorization: "Bearer owner" } });
  const pa = await call(ana, "/api/profile", { action: "init" });
  await call(beto, "/api/profile", { action: "init" });
  assert(pa.profile.chips === 5000, "new profile starts with 5000 chips");
  await call(ana, "/api/profile", { action: "update", name: "Ana QA", avatar: { id: "kate" } });
  const anaPublic = await read(`publicProfiles/${ana.uid}`);
  assert(anaPublic.name === "Ana QA" && anaPublic.avatar.id === "kate", "profile update reaches publicProfiles");

  console.log("lobby");
  await call(ana, "/api/tables", { action: "sweep" });
  const lobby = await read("lobby");
  assert(Object.keys(lobby).length >= 8, `official tables seeded (${Object.keys(lobby).length})`);

  console.log("sit");
  await writePresence(TABLE, ana);
  await writePresence(TABLE, beto);
  await call(ana, `/api/tables/${TABLE}`, { type: "sit", seat: 3, buyIn: 1000 });
  await call(beto, `/api/tables/${TABLE}`, { type: "sit", seat: 5, buyIn: 800 });
  let state = await read(`tables/${TABLE}/state`);
  assert(state.phase === "betting", "betting starts when someone sits");
  assert(state.seats[3].uid === ana.uid && state.seats[3].stack === 1000, "ana seated with 1000");
  const bots = Object.values(state.seats).filter((s) => s && s.bot);
  assert(bots.length > 0, `bots joined (${bots.length})`);
  const anaUser = await read(`users/${ana.uid}`);
  assert(anaUser.chips === 4000 && anaUser.table.id === TABLE, "buy-in moved from profile to table");

  const secret = await fetch(`${DB}/tables/${TABLE}/secret.json?ns=${NS}`).then((r) => r.status);
  console.log(`  (unauthenticated secret read -> HTTP ${secret})`);

  console.log("round 1");
  await call(ana, `/api/tables/${TABLE}`, { type: "bet", amount: 50 });
  await call(beto, `/api/tables/${TABLE}`, { type: "bet", amount: 20 });
  await call(ana, `/api/tables/${TABLE}`, { type: "ready" });
  await call(beto, `/api/tables/${TABLE}`, { type: "ready" });
  state = await read(`tables/${TABLE}/state`);
  assert(state.phase === "dealing", "everyone ready -> dealing");
  assert(state.dealer.cards[1].c === "XX", "hole card hidden in public state");
  state = await playUntilPayout([ana, beto], "round 1");
  const anaSeat = state.seats[3];
  assert(anaSeat.hands[0].result, `ana hand settled: ${anaSeat.hands[0].result} net ${anaSeat.net}`);
  assert(anaSeat.stack === 1000 - 50 + anaSeat.hands[0].payout, "stack matches payout");

  console.log("leave");
  await sleep(800);
  for (let i = 0; i < 30; i++) {
    const s = await read(`tables/${TABLE}/state`);
    if (s.phase === "betting") break;
    if (s.phaseEndsAt && Date.now() > s.phaseEndsAt) await call(ana, `/api/tables/${TABLE}`, { type: "tick" });
    await sleep(400);
  }
  const before = await read(`tables/${TABLE}/state/seats/3/stack`);
  await call(ana, `/api/tables/${TABLE}`, { type: "leave" });
  await sleep(1500);
  const after = await read(`users/${ana.uid}`);
  assert(!after.table, "seat released on the profile");
  assert(after.chips === 4000 + before, `chips cashed out (${after.chips})`);
  const stats = after.stats;
  assert(stats && stats.hands >= 1, `stats recorded (${JSON.stringify(stats)})`);

  console.log("daily bonus");
  const daily = await call(ana, "/api/profile", { action: "daily" });
  assert(daily.bonus === 1000, "daily bonus pays 1000");
  const again = await call(ana, "/api/profile", { action: "daily" }).catch((e) => e.message);
  assert(String(again).includes("Vuelve"), "daily bonus has a cooldown");

  console.log("cleanup");
  await call(beto, `/api/tables/${TABLE}`, { type: "leave" });
  console.log("\nALL GOOD");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});
