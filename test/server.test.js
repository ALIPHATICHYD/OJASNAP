process.env.DEMO = "1";
const test = require("node:test");
const assert = require("node:assert");
const { extractJson, server } = require("../server");

test("extractJson handles fenced and chatty output", () => {
  assert.deepStrictEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(extractJson('Here you go: {"a":{"b":2}} hope it helps'), { a: { b: 2 } });
  assert.throws(() => extractJson("no json here"));
});

test("demo endpoints respond", async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try {
    const h = await (await fetch(`${base}/api/health`)).json();
    assert.strictEqual(h.demo, true);
    const bad = await fetch(`${base}/api/listing`, { method: "POST", body: "{}" });
    assert.strictEqual(bad.status, 400);
    const l = await (await fetch(`${base}/api/listing`, { method: "POST", body: JSON.stringify({ image: "abc" }) })).json();
    assert.ok(l.listing.whatsapp_status);
    const r = await (await fetch(`${base}/api/reply`, { method: "POST", body: JSON.stringify({ message: "how much last price?" }) })).json();
    assert.ok(r.reply.length > 0);
    const page = await fetch(`${base}/`);
    assert.strictEqual(page.status, 200);
    const trav = await fetch(`${base}/..%2fserver.js`);
    assert.notStrictEqual(trav.status, 200);
  } finally { server.close(); }
});

test("catalogText formats and caps the catalog", () => {
  const { catalogText } = require("../server");
  assert.strictEqual(catalogText([]), "(empty)");
  assert.strictEqual(catalogText(null), "(empty)");
  const out = catalogText([{ product_name: "Sneakers", price: "₦25,000", condition: "New" }]);
  assert.match(out, /Sneakers \| ₦25,000 \| New/);
  assert.strictEqual(catalogText(Array(80).fill({ product_name: "x" })).split("\n").length, 50);
});
