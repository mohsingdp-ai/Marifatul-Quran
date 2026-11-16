// Unique-user counter: each phone sends its random id at most once a day; we store (day, id).
const ORIGIN = "https://mohsingdp-ai.github.io";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;

    if (req.method === "POST" && path === "/hit") {
      // shortcut: Origin is only checked, not proven; anyone with curl can add fake ids. Add rate limits if counts look odd.
      if (req.headers.get("Origin") !== ORIGIN) return new Response(null, { status: 403 });
      const id = (await req.text()).trim();
      if (!UUID.test(id)) return new Response(null, { status: 400 });
      const day = new Date().toISOString().slice(0, 10);
      await env.DB.prepare("INSERT OR IGNORE INTO seen (day, id) VALUES (?, ?)").bind(day, id).run();
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": ORIGIN } });
    }

    if (req.method === "GET" && path === "/stats") {
      const users = (since) => env.DB.prepare(
        "SELECT COUNT(DISTINCT id) AS n FROM seen WHERE day >= date('now', ?)").bind(since).first("n");
      const days = await env.DB.prepare(
        "SELECT day, COUNT(*) AS users FROM seen WHERE day >= date('now', '-29 days') GROUP BY day ORDER BY day DESC").all();
      const body = {
        today: await users("+0 days"),
        last7days: await users("-6 days"),
        last30days: await users("-29 days"),
        allTime: await users("-100 years"),
        byDay: days.results,
      };
      return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json" } });
    }

    return new Response("Not found", { status: 404 });
  },
};
