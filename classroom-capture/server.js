import http from "node:http";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.CAPTURE_WORKER_TOKEN;
const sessions = new Map();
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};
const readBody = req => new Promise((resolve, reject) => {
  let data = "";
  req.on("data", chunk => { data += chunk; if (data.length > 65536) reject(new Error("Request too large")); });
  req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error("Invalid JSON")); } });
});
const authorized = req => TOKEN && req.headers.authorization === `Bearer ${TOKEN}`;
const validUrl = value => {
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
};
const server = http.createServer(async (req, res) => {
  if (req.url === "/health" && req.method === "GET") return json(res, 200, { ok: true, service: "geao-classroom-capture" });
  if (!authorized(req)) return json(res, 401, { error: "Unauthorized" });
  try {
    const url = new URL(req.url, "http://localhost");
    const match = url.pathname.match(/^\/sessions\/([A-Za-z0-9_-]{3,100})(?:\/(start|frame|input|stop))?$/);
    if (!match) return json(res, 404, { error: "Not found" });
    const [, room, action] = match;
    if (action === "start" && req.method === "POST") {
      const body = await readBody(req);
      if (!validUrl(body.materialUrl)) return json(res, 400, { error: "A valid assigned material URL is required" });
      const previous = sessions.get(room);
      if (previous) { sessions.delete(room); await previous.browser.close().catch(() => {}); }
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(60000);
      await page.goto(body.materialUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
      sessions.set(room, { browser, context, page, lastUsed: Date.now() });
      return json(res, 200, { ok: true, width: 1280, height: 720, title: await page.title().catch(() => "") });
    }
    const session = sessions.get(room);
    if (!session) return json(res, 404, { error: "Capture session is not running" });
    session.lastUsed = Date.now();
    if (action === "frame" && req.method === "GET") {
      const image = await session.page.screenshot({ type: "jpeg", quality: 72, timeout: 10000 });
      res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "no-store", "content-length": image.length });
      return res.end(image);
    }
    if (action === "input" && req.method === "POST") {
      const body = await readBody(req);
      const x = Math.max(0, Math.min(1280, Number(body.x) || 0));
      const y = Math.max(0, Math.min(720, Number(body.y) || 0));
      if (body.type === "click") await session.page.mouse.click(x, y, { button: body.button === "right" ? "right" : "left" });
      else if (body.type === "move") await session.page.mouse.move(x, y);
      else if (body.type === "down") await session.page.mouse.down();
      else if (body.type === "up") await session.page.mouse.up();
      else if (body.type === "wheel") await session.page.mouse.wheel(Number(body.deltaX) || 0, Number(body.deltaY) || 0);
      else if (body.type === "key" && typeof body.key === "string") await session.page.keyboard.press(body.key.slice(0, 40));
      else if (body.type === "text" && typeof body.text === "string") await session.page.keyboard.insertText(body.text.slice(0, 500));
      else return json(res, 400, { error: "Unsupported input event" });
      return json(res, 200, { ok: true });
    }
    if (action === "stop" && req.method === "POST") {
      sessions.delete(room);
      await session.browser.close().catch(() => {});
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : "Capture worker error" });
  }
});
const cleanup = setInterval(async () => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [room, session] of sessions) if (session.lastUsed < cutoff) {
    sessions.delete(room);
    await session.browser.close().catch(() => {});
  }
}, 60000);
server.listen(PORT, "0.0.0.0", () => console.log(`GEAO capture worker listening on ${PORT}`));
process.on("SIGTERM", async () => {
  clearInterval(cleanup);
  await Promise.all([...sessions.values()].map(s => s.browser.close().catch(() => {})));
  server.close(() => process.exit(0));
});
