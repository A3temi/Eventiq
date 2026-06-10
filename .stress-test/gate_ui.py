#!/opt/anaconda3/bin/python
"""Visually verify the approval gate in the real Chrome UI."""
import os, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
COOKIE = open(os.path.join(HERE, "cookie.txt")).read().strip()
BASE = "http://localhost:3000"
COMPOSER = 'input[placeholder="Describe your event or ask me anything..."]'

def log(*a): print("[gate-ui]", *a, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=False)
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    ctx.add_cookies([{"name": "next-auth.session-token", "value": COOKIE,
                      "domain": "localhost", "path": "/", "httpOnly": True, "sameSite": "Lax", "secure": False}])
    page = ctx.new_page()
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_selector(COMPOSER, timeout=15000)
    log("authenticated, composer ready")

    msg = ('Please send an email to gateui@example.invalid with subject "Eventiq Demo" '
           'and body "Testing the approval gate." Send it now, this is authorized.')
    page.fill(COMPOSER, msg)
    with page.expect_response(lambda r: "/api/chat" in r.url and r.request.method == "POST", timeout=90000):
        page.click('button[aria-label="Send message"]')
    page.wait_for_timeout(2000)
    has_card = page.get_by_text("Approval Required").count() > 0
    log(f"Approval card visible: {has_card}")
    page.screenshot(path=os.path.join(HERE, "gate-1-held.png"), full_page=True)

    # Click Approve and capture the result
    try:
        with page.expect_response(lambda r: "/api/events/approve" in r.url, timeout=30000):
            page.get_by_role("button", name="Approve").first.click()
        page.wait_for_timeout(2000)
        log("clicked Approve; approve endpoint responded")
    except Exception as e:
        log("approve click issue:", str(e)[:80])
    page.screenshot(path=os.path.join(HERE, "gate-2-approved.png"), full_page=True)

    page.wait_for_timeout(500)
    browser.close()
    log("done")
