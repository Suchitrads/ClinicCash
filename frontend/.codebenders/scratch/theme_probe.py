import base64, json, os, socket, struct, subprocess, tempfile, time, urllib.request

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9333
URL = "http://localhost:5174/dashboard/receivables"
PROBE = r"""
(() => {
  const props = (el, names) => { const s = getComputedStyle(el); const o = {}; names.forEach(n => o[n] = s.getPropertyValue(n)); return o; };
  const selNames = ['appearance','background-color','color','border-color','border-width','border-radius','background-image','height'];
  const selects = [...document.querySelectorAll('select')].map(el => ({
    id: el.id,
    select: props(el, selNames),
    firstOption: el.options[0] ? props(el.options[0], ['background-color','color']) : null
  }));
  const root = getComputedStyle(document.documentElement);
  return JSON.stringify({ htmlClass: document.documentElement.className, colorScheme: root.colorScheme,
    cardVar: root.getPropertyValue('--card'), borderVar: root.getPropertyValue('--border'), selectCount: selects.length, selects }, null, 1);
})()
"""

def ws_connect(url):
    hp, path = url[len("ws://"):].split("/", 1)
    host, port = hp.split(":")
    s = socket.create_connection((host, int(port)), timeout=20)
    key = base64.b64encode(os.urandom(16)).decode()
    req = ("GET /" + path + " HTTP/1.1\r\nHost: " + hp + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
           "Sec-WebSocket-Key: " + key + "\r\nSec-WebSocket-Version: 13\r\n\r\n")
    s.sendall(req.encode())
    resp = b""
    while b"\r\n\r\n" not in resp:
        c = s.recv(1)
        if not c:
            raise RuntimeError("handshake closed")
        resp += c
    if b" 101 " not in resp.split(b"\r\n")[0]:
        raise RuntimeError(resp.decode(errors="replace"))
    return s

def recv_exact(s, n):
    buf = b""
    while len(buf) < n:
        c = s.recv(n - len(buf))
        if not c:
            raise RuntimeError("socket closed")
        buf += c
    return buf

def ws_send(s, text):
    data = text.encode()
    n = len(data)
    head = bytearray([0x81])
    if n < 126:
        head.append(0x80 | n)
    elif n < 65536:
        head.append(0x80 | 126); head += struct.pack(">H", n)
    else:
        head.append(0x80 | 127); head += struct.pack(">Q", n)
    mask = os.urandom(4)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    s.sendall(bytes(head) + mask + masked)

def ws_recv(s):
    msg = b""
    while True:
        b1, b2 = recv_exact(s, 2)
        fin = b1 & 0x80
        op = b1 & 0x0F
        ln = b2 & 0x7F
        if ln == 126:
            ln = struct.unpack(">H", recv_exact(s, 2))[0]
        elif ln == 127:
            ln = struct.unpack(">Q", recv_exact(s, 8))[0]
        payload = recv_exact(s, ln)
        if op == 0x8:
            raise RuntimeError("websocket closed")
        if op in (0x9, 0xA):
            continue
        msg += payload
        if fin:
            return msg.decode()

_id = 0
def cdp(s, method, params=None):
    global _id
    _id += 1
    mine = _id
    ws_send(s, json.dumps({"id": mine, "method": method, "params": params or {}}))
    while True:
        m = json.loads(ws_recv(s))
        if m.get("id") == mine:
            if "error" in m:
                raise RuntimeError(str(m["error"]))
            return m["result"]

def evaluate(s, expr):
    r = cdp(s, "Runtime.evaluate", {"expression": expr, "returnByValue": True})
    return r["result"].get("value")

def page_ws_url():
    last = None
    for _ in range(60):
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/json" % PORT, timeout=2) as r:
                for t in json.loads(r.read()):
                    if t.get("type") == "page":
                        return t["webSocketDebuggerUrl"]
        except Exception as e:
            last = e
        time.sleep(0.5)
    raise RuntimeError("no devtools page target: %r" % last)

def summary(s):
    raw = evaluate(s, PROBE)
    d = json.loads(raw)
    print("htmlClass=%r colorScheme=%r --card=%r --border=%r selects=%d" % (d["htmlClass"], d["colorScheme"], d["cardVar"], d["borderVar"], d["selectCount"]))
    for x in d["selects"]:
        st = x["select"]; op = x["firstOption"]
        print("  %s appearance=%s bg=%s color=%s border=%s radius=%s bgimg=%s h=%s | option0 bg=%s color=%s" % (
            x["id"], st["appearance"], st["background-color"], st["color"], st["border-color"],
            st["border-radius"], st["background-image"], st["height"], op["background-color"], op["color"]))

profile = tempfile.mkdtemp(prefix="cc-probe-")
proc = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--remote-debugging-port=%d" % PORT,
                         "--user-data-dir=" + profile, "--window-size=1400,1000", "about:blank"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    s = ws_connect(page_ws_url())
    cdp(s, "Page.enable")
    for theme in ("light", "dark"):
        cdp(s, "Page.navigate", {"url": URL})
        time.sleep(1)
        evaluate(s, "localStorage.setItem('cliniccash-theme', '%s'); true" % theme)
        cdp(s, "Page.reload")
        time.sleep(5)
        print("=== theme set via localStorage = %s ===" % theme)
        summary(s)
finally:
    proc.kill()
