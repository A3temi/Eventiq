#!/opt/anaconda3/bin/python
"""Drive the real Eventiq chat UI in Chrome as the authenticated test user."""
import json, os, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
COOKIE = open(os.path.join(HERE, "cookie.txt")).read().strip()
BASE = "http://localhost:3000"
COMPOSER = 'input[placeholder="Describe your event or ask me anything..."]'

def log(*a): print("[ui]", *a, flush=True)

results = []
console_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=False)
    ctx = browser.new_context(viewport={"width": 1280, "height": 860})
    ctx.add_cookies([{
        "name": "next-auth.session-token", "value": COOKIE,
        "domain": "localhost", "path": "/", "httpOnly": True, "sameSite": "Lax", "secure": False,
    }])
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append("PAGEERROR: " + str(e)))

    page.goto(BASE, wait_until="networkidle")
    try:
        page.wait_for_selector(COMPOSER, timeout=15000)
        log("AUTH OK - composer unlocked (signed-in placeholder present)")
        authed = True
    except Exception:
        log("AUTH FAIL - still signed-out composer")
        authed = False
    page.screenshot(path=os.path.join(HERE, "shot-1-authed.png"))

    def send(text, idx):
        log(f"sending #{idx}: {text}")
        page.fill(COMPOSER, text)
        t0 = time.time()
        status, body = "NO-RESPONSE", {}
        try:
            with page.expect_response(
                lambda r: "/api/chat" in r.url and r.request.method == "POST",
                timeout=90000,
            ) as ri:
                page.click('button[aria-label="Send message"]')
            resp = ri.value
            status = resp.status
            try: body = resp.json()
            except Exception: body = {}
        except Exception as e:
            status = "TIMEOUT:" + str(e)[:40]
        ms = int((time.time() - t0) * 1000)
        meta = (body or {}).get("metadata", {}) or {}
        tools = meta.get("toolsUsed", [])
        reply = str((body or {}).get("content", ""))[:110].replace("\n", " ")
        log(f"  -> /api/chat status={status} in {ms}ms tools={tools} reply=\"{reply}...\"")
        page.wait_for_timeout(1800)
        page.screenshot(path=os.path.join(HERE, f"shot-{idx+1}.png"), full_page=True)
        results.append({"idx": idx, "status": status, "ms": ms, "tools": tools, "reply_len": len(str((body or {}).get("content", "")))})

    if authed:
        send("Hi! I want to plan a 40-person tech meetup in Singapore. Give me a quick checklist of what to organize.", 1)
        send("Find me a few real venues for 40 people near Tanjong Pagar.", 2)

    log("RESULTS " + json.dumps(results))
    log("CONSOLE_ERRORS " + json.dumps(console_errors[:10]))
    page.wait_for_timeout(600)
    browser.close()
    log("done")
