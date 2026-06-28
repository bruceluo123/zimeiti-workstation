#!/usr/bin/env python3
"""
fetch-x-home.py — 用你的 X 登录态 cookie 拉「关注流」，写入 data/x-feed.json

原理：Playwright 启动 Chromium，注入 auth_token + ct0 cookie，打开 x.com/home，
拦截浏览器自己发出的 HomeTimeline / HomeLatestTimeline GraphQL 响应（原始 JSON），
解析成与 fetch-x-list.py 一致的 x-feed.json 格式。InspirePage 直接读取。

为什么用这个而不是 X API：Free 套餐不让读 following 列表（401）。cookie 直读
关注流不依赖 API 套餐、不依赖 Nitter/Camofox，且新关注的人自动出现在流里，零维护。

用法（PowerShell，cd 到本目录）：
    python fetch-x-home.py                 # 默认 headless 抓取
    python fetch-x-home.py --headed        # 显示浏览器窗口（首次调试看发生了啥）
    python fetch-x-home.py --scroll 5      # 多滚动几屏拿更多推文（默认 3）
    python fetch-x-home.py --hours 24      # 只保留 24h 内的（默认不过滤）

Cookie 来源：~/.claude/private/x_cookies.json（{auth_token, ct0}），
或环境变量 X_AUTH_TOKEN / X_CT0 覆盖。
"""

import sys
import os
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

# Windows 控制台默认编码不支持 emoji，强制 utf-8 输出
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SCRIPT_DIR = Path(__file__).parent
DATA_FILE = SCRIPT_DIR.parent / "data" / "x-feed.json"
COOKIE_FILE = Path.home() / ".claude" / "private" / "x_cookies.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)
HOME_URL = "https://x.com/home"
# 拦截这些 GraphQL operation 的响应
TIMELINE_OPS = ("HomeLatestTimeline", "HomeTimeline")


def load_cookies() -> dict:
    """优先环境变量，其次 cookie 文件。返回 {auth_token, ct0}。"""
    auth = os.environ.get("X_AUTH_TOKEN", "").strip()
    ct0 = os.environ.get("X_CT0", "").strip()
    if auth and ct0:
        return {"auth_token": auth, "ct0": ct0}

    if not COOKIE_FILE.exists():
        print(f"[fetch-x-home] ❌ 找不到 cookie 文件：{COOKIE_FILE}", file=sys.stderr)
        print("  或设置环境变量 X_AUTH_TOKEN / X_CT0", file=sys.stderr)
        sys.exit(1)

    data = json.loads(COOKIE_FILE.read_text(encoding="utf-8"))
    auth = (data.get("auth_token") or "").strip()
    ct0 = (data.get("ct0") or "").strip()
    if not auth or not ct0:
        print("[fetch-x-home] ❌ cookie 文件缺少 auth_token 或 ct0", file=sys.stderr)
        sys.exit(1)
    return {"auth_token": auth, "ct0": ct0}


def _iso_from_x_time(created_at: str) -> str:
    """X 的 'Wed Oct 10 20:19:24 +0000 2018' → ISO8601。"""
    if not created_at:
        return datetime.now(timezone.utc).isoformat()
    try:
        return parsedate_to_datetime(created_at).astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def _unwrap_tweet(result: dict) -> dict | None:
    """从 tweet_results.result 里取到真正的 tweet 节点（处理可见性包装）。"""
    if not isinstance(result, dict):
        return None
    typename = result.get("__typename")
    if typename == "TweetWithVisibilityResults":
        result = result.get("tweet", {})
    if result.get("__typename") == "TweetTombstone":
        return None
    return result if result.get("legacy") or result.get("core") else None


def _parse_tweet(result: dict) -> dict | None:
    tweet = _unwrap_tweet(result)
    if not tweet:
        return None
    legacy = tweet.get("legacy", {})

    # 作者
    user = (
        tweet.get("core", {})
        .get("user_results", {})
        .get("result", {})
    )
    user_legacy = user.get("legacy", {})
    # 新结构把 screen_name/name 挪到了 core，旧结构在 legacy
    core_info = user.get("core", {})
    handle = core_info.get("screen_name") or user_legacy.get("screen_name") or ""
    name = core_info.get("name") or user_legacy.get("name") or handle

    # 正文：优先 note_tweet（长推），否则 legacy.full_text
    note = (
        tweet.get("note_tweet", {})
        .get("note_tweet_results", {})
        .get("result", {})
        .get("text")
    )
    text = (note or legacy.get("full_text") or "").strip()
    if not text or not handle:
        return None

    tweet_id = tweet.get("rest_id") or legacy.get("id_str") or ""
    url = f"https://x.com/{handle}/status/{tweet_id}" if tweet_id else ""
    published = _iso_from_x_time(legacy.get("created_at", ""))
    is_retweet = "retweeted_status_result" in legacy

    return {
        "handle": "@" + handle,
        "name": name,
        "text": text,
        "url": url,
        "published": published,
        "is_retweet": is_retweet,
        "tweet_id": tweet_id,
    }


def extract_tweets(payload: dict) -> list[dict]:
    """从一个 HomeTimeline GraphQL 响应里抽出所有推文。"""
    out = []
    try:
        instructions = (
            payload["data"]["home"]["home_timeline_urt"]["instructions"]
        )
    except (KeyError, TypeError):
        return out

    for ins in instructions:
        if ins.get("type") != "TimelineAddEntries":
            continue
        for entry in ins.get("entries", []):
            content = entry.get("content", {})
            etype = content.get("entryType") or content.get("__typename")
            # 单条推文
            if etype == "TimelineTimelineItem":
                res = (
                    content.get("itemContent", {})
                    .get("tweet_results", {})
                    .get("result", {})
                )
                parsed = _parse_tweet(res)
                if parsed:
                    out.append(parsed)
            # 对话模块（一组推文）
            elif etype == "TimelineTimelineModule":
                for item in content.get("items", []):
                    res = (
                        item.get("item", {})
                        .get("itemContent", {})
                        .get("tweet_results", {})
                        .get("result", {})
                    )
                    parsed = _parse_tweet(res)
                    if parsed:
                        out.append(parsed)
    return out


def to_feed_item(t: dict, idx: int) -> dict:
    handle = t["handle"]
    prefix = "🔁 " if t["is_retweet"] else ""
    title = f"{prefix}{handle}: {t['text']}"[:120]
    return {
        "id": f"x-{t['tweet_id'] or int(datetime.now().timestamp())}-{idx}",
        "source": "x",
        "title": title,
        "summary": t["text"][:300],
        "url": t["url"],
        "sourceName": handle,
        "category": "x",
        "publishedAt": t["published"],
        "score": None,
    }


def is_within(ts_iso: str, hours: int) -> bool:
    if hours <= 0:
        return True
    try:
        dt = datetime.fromisoformat(ts_iso)
        return dt >= datetime.now(timezone.utc) - timedelta(hours=hours)
    except Exception:
        return True


def _switch_to_following(page) -> bool:
    """切到「正在关注」标签页（触发 HomeLatestTimeline）。成功返回 True。

    X 的首页顶部是两个 tab：「为你推荐 / For You」和「正在关注 / Following」。
    DOM 经常变（有时是 role=tab，有时是 a[href='/home'] 里的 span），所以
    按多种选择器依次尝试，点中任意一个即认为成功。
    """
    # 等顶部 tab 栏渲染出来（最多 10s）
    try:
        page.wait_for_selector('[role="tab"], a[role="tab"]', timeout=10000)
    except Exception:
        pass

    candidates = [
        lambda: page.get_by_role("tab", name="Following", exact=True),
        lambda: page.get_by_role("tab", name="正在关注", exact=True),
        lambda: page.get_by_role("tab", name="关注", exact=False),
        lambda: page.locator('[role="tab"]:has-text("Following")'),
        lambda: page.locator('[role="tab"]:has-text("正在关注")'),
        lambda: page.locator('a[href="/home"] span:has-text("Following")'),
        lambda: page.locator('a[href="/home"] span:has-text("正在关注")'),
    ]

    for build in candidates:
        try:
            loc = build()
            if loc.count() == 0:
                continue
            loc.first.click(timeout=4000)
            print("[fetch-x-home] 已点击「正在关注」标签")
            return True
        except Exception:
            continue

    print("[fetch-x-home] ⚠️ 未点中「正在关注」标签，将留在「为你推荐」流", file=sys.stderr)
    return False


def fetch(headed: bool, scroll: int) -> list[dict]:
    from playwright.sync_api import sync_playwright

    creds = load_cookies()
    # 每条推文带上来源 op，便于最后只保留「正在关注」流
    captured: list[dict] = []
    seen_ops = set()

    def on_response(resp):
        url = resp.url
        op = next((o for o in TIMELINE_OPS if o in url), None)
        if not op:
            return
        try:
            payload = resp.json()
        except Exception:
            return
        tweets = extract_tweets(payload)
        if tweets:
            seen_ops.add(op)
            for t in tweets:
                t["_op"] = op
            captured.extend(tweets)
            print(f"[fetch-x-home] 拦截 {op}：+{len(tweets)} 条")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed)
        context = browser.new_context(user_agent=USER_AGENT, locale="zh-CN")
        context.add_cookies([
            {"name": "auth_token", "value": creds["auth_token"],
             "domain": ".x.com", "path": "/"},
            {"name": "ct0", "value": creds["ct0"],
             "domain": ".x.com", "path": "/"},
        ])
        page = context.new_page()
        page.on("response", on_response)

        print("[fetch-x-home] 打开 x.com/home …")
        page.goto(HOME_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(2000)

        switched = _switch_to_following(page)
        # 切 tab 后等 HomeLatestTimeline 的首批响应回来
        page.wait_for_timeout(3500)

        for i in range(scroll):
            page.mouse.wheel(0, 4000)
            page.wait_for_timeout(2500)

        browser.close()

    # 若成功抓到关注流，丢掉切 tab 前混进来的「为你推荐」推文，只留纯 Following
    if "HomeLatestTimeline" in seen_ops:
        following = [t for t in captured if t.get("_op") == "HomeLatestTimeline"]
        dropped = len(captured) - len(following)
        captured = following
        tag = "✅ 已确认" if switched else "ℹ️"
        print(f"[fetch-x-home] {tag} 抓到纯「正在关注」流（HomeLatestTimeline），"
              f"已剔除 {dropped} 条「为你推荐」")
    else:
        print("[fetch-x-home] ⚠️ 只抓到 HomeTimeline（为你推荐流），"
              "Following tab 未生效，保留推荐流内容", file=sys.stderr)

    return captured


def main():
    parser = argparse.ArgumentParser(description="用 cookie 拉 X 关注流 → x-feed.json")
    parser.add_argument("--headed", action="store_true", help="显示浏览器窗口")
    parser.add_argument("--scroll", type=int, default=3, help="向下滚动屏数（默认 3）")
    parser.add_argument("--hours", type=int, default=0,
                        help="只保留几小时内的推文（默认 0=不过滤）")
    args = parser.parse_args()

    tweets = fetch(headed=args.headed, scroll=args.scroll)

    # 去重（按 tweet_id）
    seen = set()
    unique = []
    for t in tweets:
        key = t["tweet_id"] or (t["handle"], t["text"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(t)

    # 时间过滤
    recent = [t for t in unique if is_within(t["published"], args.hours)]
    print(f"[fetch-x-home] 去重后 {len(unique)} 条，时间过滤后 {len(recent)} 条")

    items = [to_feed_item(t, i) for i, t in enumerate(recent)]

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"[fetch-x-home] ✅ 写入 {len(items)} 条 → {DATA_FILE}")
    if not items:
        print("[fetch-x-home] ⚠️ 没抓到推文。可能 cookie 过期，或被风控。"
              "试试 --headed 看浏览器里发生了什么。", file=sys.stderr)


if __name__ == "__main__":
    main()
