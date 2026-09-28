#!/usr/bin/env python3
"""
⚠️ 已废弃（2026-06-28）：X Free API 套餐不允许读 following 列表（get_users_following
返回 401），本方案第一步即走不通。改用 fetch-x-home.py（cookie 直读关注流，无需 API）。
此文件保留仅供将来升级到 Basic/Pro 套餐时参考。

把你的 X「正在关注」列表，自动同步成一个私有 X List（关注镜像）。

为什么需要它：x-tweet-fetcher 的 --list 模式走 Nitter、免登录免 API，读 List 永久免费。
但 Home Timeline（关注 feed）需要登录态、抓不了。于是用 X API 把 following → List 灌一次，
之后 fetch-x-list.py 直接读这个 List。你新增关注后，重跑本脚本即可增量补齐。

用法（在 PowerShell 里，cd 到本目录）：
    pip install tweepy            # 首次
    python sync-following-to-list.py            # 同步
    python sync-following-to-list.py --dry-run  # 只看差异，不实际加人

依赖凭据：同目录 .env（X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET）
首次成功后会把生成的 X_LIST_ID 写回 .env，fetch-x-list.py 可直接读用。
"""

import sys
import time
from pathlib import Path

# Windows 控制台默认编码不支持 emoji，强制 utf-8 输出
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    import tweepy
except ImportError:
    print("❌ 缺少 tweepy。先在 PowerShell 跑：pip install tweepy")
    sys.exit(1)

HERE = Path(__file__).parent
ENV_PATH = HERE / ".env"
LIST_NAME = "我的关注镜像"
DRY_RUN = "--dry-run" in sys.argv


def load_env() -> dict:
    """极简 .env 解析，不引入 python-dotenv。"""
    env = {}
    if not ENV_PATH.exists():
        print(f"❌ 找不到 {ENV_PATH}")
        sys.exit(1)
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def write_back_list_id(list_id: str) -> None:
    """把 X_LIST_ID 写回 .env，方便 fetch-x-list.py 复用。"""
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    out, found = [], False
    for line in lines:
        if line.strip().startswith("X_LIST_ID="):
            out.append(f"X_LIST_ID={list_id}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"X_LIST_ID={list_id}")
    ENV_PATH.write_text("\n".join(out) + "\n", encoding="utf-8")


def make_client(env: dict) -> tweepy.Client:
    required = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"]
    missing = [k for k in required if not env.get(k)]
    if missing:
        print(f"❌ .env 缺少：{', '.join(missing)}")
        sys.exit(1)
    return tweepy.Client(
        consumer_key=env["X_API_KEY"],
        consumer_secret=env["X_API_SECRET"],
        access_token=env["X_ACCESS_TOKEN"],
        access_token_secret=env["X_ACCESS_SECRET"],
        wait_on_rate_limit=True,
    )


def get_following(client: tweepy.Client, me_id: str) -> dict:
    """返回 {user_id: username}，自动翻页。"""
    following = {}
    try:
        for page in tweepy.Paginator(
            client.get_users_following, id=me_id, max_results=1000
        ):
            for u in page.data or []:
                following[str(u.id)] = u.username
    except tweepy.errors.Forbidden as e:
        print("❌ 403：当前 X API 套餐不允许读取 following 列表。")
        print("   Free 套餐通常限制此接口，需要 Basic（$100/月）。")
        print(f"   详情：{e}")
        sys.exit(2)
    return following


def find_or_create_list(client: tweepy.Client, me_id: str) -> str:
    """找已有的同名 List，没有就建一个私有的。"""
    existing = client.get_owned_lists(id=me_id, max_results=100)
    for lst in existing.data or []:
        if lst.name == LIST_NAME:
            print(f"📋 复用已有 List：{LIST_NAME}（{lst.id}）")
            return str(lst.id)
    if DRY_RUN:
        print(f"📋 [dry-run] 将创建私有 List：{LIST_NAME}")
        return ""
    created = client.create_list(name=LIST_NAME, private=True)
    list_id = str(created.data["id"])
    print(f"📋 已创建私有 List：{LIST_NAME}（{list_id}）")
    return list_id


def get_list_members(client: tweepy.Client, list_id: str) -> set:
    members = set()
    for page in tweepy.Paginator(
        client.get_list_members, id=list_id, max_results=100
    ):
        for u in page.data or []:
            members.add(str(u.id))
    return members


def main():
    env = load_env()
    client = make_client(env)

    me = client.get_me()
    me_id = str(me.data.id)
    print(f"👤 当前账号：@{me.data.username}（{me_id}）")

    print("📥 拉取 following 列表…")
    following = get_following(client, me_id)
    print(f"   共关注 {len(following)} 个账号")
    if not following:
        print("⚠️ following 为空，结束。")
        return

    list_id = env.get("X_LIST_ID") or find_or_create_list(client, me_id)
    if not list_id:  # dry-run 且 List 尚不存在
        print(f"\n[dry-run] 将新建 List 并加入全部 {len(following)} 人。")
        for uid, name in list(following.items())[:10]:
            print(f"    + @{name}")
        if len(following) > 10:
            print(f"    … 等共 {len(following)} 人")
        return

    current = get_list_members(client, list_id)
    to_add = {uid: name for uid, name in following.items() if uid not in current}
    print(f"📊 List 现有 {len(current)} 人，需新增 {len(to_add)} 人")

    if DRY_RUN:
        for uid, name in list(to_add.items())[:20]:
            print(f"    + @{name}")
        if len(to_add) > 20:
            print(f"    … 等共 {len(to_add)} 人")
        print("\n（dry-run，未实际写入）")
        return

    added, failed = 0, 0
    for uid, name in to_add.items():
        try:
            client.add_list_member(id=list_id, user_id=uid)
            added += 1
            if added % 25 == 0:
                print(f"   已加入 {added}/{len(to_add)}…")
        except tweepy.errors.TooManyRequests:
            print("   触发限流，等 60 秒…")
            time.sleep(60)
        except Exception as e:
            failed += 1
            print(f"   ⚠️ @{name} 加入失败：{e}")

    write_back_list_id(list_id)
    print(f"\n✅ 完成：新增 {added}，失败 {failed}。List ID 已写回 .env。")
    print(f"   现在可跑：python fetch-x-list.py（会自动读 X_LIST_ID）")


if __name__ == "__main__":
    main()
