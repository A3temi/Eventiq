#!/opt/anaconda3/bin/python
"""Verify the human-approval gate: agent cannot send autonomously; only an
authenticated owner can release a held action via /api/events/approve."""
import json, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "http://localhost:3000"
OWNER = open(os.path.join(HERE, "cookie.txt")).read().strip()
OTHER = open(os.path.join(HERE, "other_cookie.txt")).read().strip()

def call(path, body, cookie=None):
    data = json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if cookie:
        req.add_header("Cookie", "next-auth.session-token=" + cookie)
    try:
        r = urllib.request.urlopen(req, timeout=90)
        return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode() or "{}")
        except Exception: return e.code, {}

def chat_send(recipient):
    """Ask the agent to email someone; return the held approvalRequest (or None)."""
    msg = (f'Please send an email to {recipient} with subject "Eventiq Test" and '
           f'body "Approval gate verification." Send it now — this is authorized.')
    st, d = call("/api/chat", {"message": msg}, OWNER)
    meta = (d or {}).get("metadata", {}) or {}
    return st, meta.get("approvalRequest"), meta.get("toolsUsed", []), (d or {}).get("content", "")

print("=" * 70)
print("TEST 1 — agent must NOT send autonomously; it HOLDS for approval")
print("=" * 70)
st, ar_a, tools, content = chat_send("gatetest@example.invalid")
print(f"chat status      : {st}")
print(f"approvalRequest? : {'YES' if ar_a else 'NO'}  (id={ar_a.get('id') if ar_a else None})")
print(f"toolsUsed        : {tools}   <- send_email must be ABSENT (held, not executed)")
print(f"reply            : {content[:120]!r}")
assert ar_a, "FAIL: no approval surfaced — agent may have sent or did not call the tool"
assert "send_email" not in tools, "FAIL: send_email executed autonomously!"
print("PASS: action was intercepted and held, not sent.\n")

# second held action for the approve-execute test
_, ar_b, _, _ = chat_send("gatetest2@example.invalid")
print(f"(prepared a 2nd held action id={ar_b.get('id') if ar_b else None} for the approve test)\n")

idA = ar_a["id"]
print("=" * 70)
print("TEST 2 — /api/events/approve access control + lifecycle")
print("=" * 70)
st, d = call("/api/events/approve", {"approvalId": idA, "decision": "approve"}, None)
print(f"2a no-auth approve         -> {st} {d}   (expect 401)")
st, d = call("/api/events/approve", {"approvalId": idA, "decision": "approve"}, OTHER)
print(f"2b wrong-user approve      -> {st} {d}   (expect 403)")
st, d = call("/api/events/approve", {"approvalId": "does-not-exist", "decision": "approve"}, OWNER)
print(f"2c unknown approvalId      -> {st} {d}   (expect 404)")
st, d = call("/api/events/approve", {"approvalId": idA, "decision": "banana"}, OWNER)
print(f"2d invalid decision        -> {st} {d}   (expect 400)")
st, d = call("/api/events/approve", {"approvalId": idA, "decision": "reject"}, OWNER)
print(f"2e owner REJECT            -> {st} {d}   (expect status=rejected, nothing sent)")
st, d = call("/api/events/approve", {"approvalId": idA, "decision": "approve"}, OWNER)
print(f"2f approve after reject    -> {st} {d}   (expect 409 already rejected)")

print()
print("=" * 70)
print("TEST 3 — owner APPROVE actually executes the send (to .invalid = no real inbox)")
print("=" * 70)
if ar_b:
    idB = ar_b["id"]
    st, d = call("/api/events/approve", {"approvalId": idB, "decision": "approve"}, OWNER)
    print(f"3a owner APPROVE           -> {st} status={d.get('status')} executed={d.get('executed')} result={d.get('result')}")
    st, d = call("/api/events/approve", {"approvalId": idB, "decision": "approve"}, OWNER)
    print(f"3b approve again (idemp.)  -> {st} {d}   (expect 409 already approved)")
else:
    print("(no 2nd held action captured — skipping)")
print("\nDONE.")
