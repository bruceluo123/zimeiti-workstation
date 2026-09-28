#!/usr/bin/env python3
"""
fetch-x-list.py — 从 X List 抓取今日推文，写入 workstation/data/x-feed.json

用法：
  python scripts/fetch-x-list.py
  python scripts/fetch-x-list.py --list 1234567890  # 临时指定 List ID

输出格式与 parse-xfeed.mjs 兼容，InspirePage 直接读取。
"""

import sys
import os
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta

# ---- 路径配置 ----
SCRIPT_DIR = Path(__file__).parent
FETCHER_DIR = SCRIPT_DIR / "x-tweet-fetcher" / "scripts"
DATA_FILE = SCRIPT_DIR.parent / "data" / "x-feed.json"

# ---- 你的 X List ID ----
# 优先从同目录 .env 的 X_LIST_ID 读取（由 sync-following-to-list.py 自动写入）；
# 也可用 --list 参数临时覆盖。
ENV_PATH = Path(__file__).parent / ".env"


def _list_id_from_env() -> str:
    if not ENV_PATH.exists():
        return ""
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("X_LIST_ID="):
            return line.split("=", 1)[1].strip()
    return ""


DEFAULT_LIST_ID = _list_id_from_env() or "YOUR_LIST_ID_HERE"

# ---- 每次最多抓取条数 ----
LIMIT = 30

# ---- 几小时内算"今日"（默认 24h）----
TODAY_HOURS = 24

# ------------------------------------------------------------------


def is_today(ts_str: str) -> bool:
    """判断时间戳字符串是否在今日范围内（UTC，宽松 24h）"""
    if not ts_str:
        return False
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        cutoff = datetime.now(timezone.utc) - timedelta(hours=TODAY_HOURS)
        return dt >= cutoff
    except Exception:
        return True  # 解析失败则保留


def tweet_to_feed_item(tweet: dict, idx: int) -> dict:
    """把 x-tweet-fetcher 的 tweet dict 转为 x-feed.json 条目格式"""
    handle = tweet.get("author", tweet.get("screen_name", ""))
    if handle and not handle.startswith("@"):
        handle = "@" + handle
    text = tweet.get("text", "").strip()
    title = f"{handle}: {text}"[:120]
    url = tweet.get("url") or tweet.get("tweet_url") or ""
    published = tweet.get("time") or tweet.get("timestamp") or datetime.now(timezone.utc).isoformat()

    return {
        "id": f"x-{int(datetime.now().timestamp())}-{idx}",
        "source": "x",
        "title": title,
        "summary": text[:300],
        "url": url,
        "sourceName": handle,
        "category": "x",
        "publishedAt": published,
        "score": None,
    }


def main():
    parser = argparse.ArgumentParser(description="Fetch X List tweets → x-feed.json")
    parser.add_argument("--list", dest="list_id", default=DEFAULT_LIST_ID,
                        help="X List ID 或完整 URL")
    parser.add_argument("--limit", type=int, default=LIMIT)
    parser.add_argument("--hours", type=int, default=TODAY_HOURS,
                        help="保留几小时内的推文（默认 24）")
    args = parser.parse_args()

    list_id = args.list_id
    if not list_id or list_id == "YOUR_LIST_ID_HERE":
        print("[fetch-x-list] ❌ 没有 List ID。先跑 sync-following-to-list.py 生成，或用 --list 传入", file=sys.stderr)
        sys.exit(1)

    # 从 URL 提取纯 ID
    import re
    m = re.search(r"/i/lists/(\d+)", list_id)
    if m:
        list_id = m.group(1)

    # 把 fetcher 目录加入 Python 路径
    sys.path.insert(0, str(FETCHER_DIR))

    try:
        from fetch_tweet import fetch_list_tweets, extract_list_id
    except ImportError as e:
        print(f"[fetch-x-list] ❌ 无法导入 x-tweet-fetcher: {e}", file=sys.stderr)
        print(f"  确认路径: {FETCHER_DIR}", file=sys.stderr)
        sys.exit(1)

    print(f"[fetch-x-list] 正在抓取 X List {list_id}（最多 {args.limit} 条）...")
    result = fetch_list_tweets(list_id, limit=args.limit)

    tweets = result.get("tweets", [])
    print(f"[fetch-x-list] 抓到 {len(tweets)} 条推文")

    # 过滤今日
    recent = [t for t in tweets if is_today(t.get("time") or t.get("timestamp", ""))]
    print(f"[fetch-x-list] 过滤后保留 {len(recent)} 条（{args.hours}h 内）")

    # 转换格式
    items = [tweet_to_feed_item(t, i) for i, t in enumerate(recent)]

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[fetch-x-list] ✅ 写入 {len(items)} 条 → {DATA_FILE}")


if __name__ == "__main__":
    main()
