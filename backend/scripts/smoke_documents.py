import json
import uuid
import urllib.request


def http_post_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_post_multipart(url: str, fields: dict[str, str]) -> dict:
    boundary = "----boundary" + uuid.uuid4().hex
    lines: list[str] = []
    for name, value in fields.items():
        lines.append("--" + boundary)
        lines.append(f'Content-Disposition: form-data; name="{name}"')
        lines.append("")
        lines.append(value)
    lines.append("--" + boundary + "--")
    body = "\r\n".join(lines).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    base = "http://localhost:8000"
    session = http_post_json(
        base + "/api/sessions",
        {"target_role": "Backend Developer", "level": "junior", "language": "ko"},
    )
    sid = session["id"]
    doc = http_post_multipart(
        base + "/api/documents",
        {
            "session_id": sid,
            "doc_type": "resume",
            "text": "Skills: Python, FastAPI, PostgreSQL, Docker\nProject: improved latency by 40%",
        },
    )
    print("uploaded:", json.dumps(doc, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

