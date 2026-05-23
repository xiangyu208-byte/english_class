#!/usr/bin/env python3
"""
CET-4 / CET-6 词汇抓取脚本
从 GitHub (mahavivo/english-wordlists) 拉取四六级单词列表，
解析后写入 data/dictionary.csv（自动去重、合并）。

用法：
    python fetch_vocabulary.py              # 抓取 CET-4 + CET-6
    python fetch_vocabulary.py --cet4       # 仅 CET-4
    python fetch_vocabulary.py --cet6       # 仅 CET-6
    python fetch_vocabulary.py --with-examples  # 同时抓取例句（很慢）
"""

import os
import re
import csv
import sys
import argparse
import urllib.request
from pathlib import Path

# ── 数据源 ──────────────────────────────────────────────
CET4_URL = "https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET4_edited.txt"
CET6_URL = "https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET6_edited.txt"

DICT_FILE = Path(__file__).resolve().parent / "data" / "dictionary.csv"
DICT_FILE_ALT = Path(__file__).resolve().parent.parent / "backend" / "data" / "dictionary.csv"


def find_dict_file():
    """自动查找 dictionary.csv，优先当前目录的 data/"""
    for p in [DICT_FILE, DICT_FILE_ALT]:
        if p.parent.exists():
            p.parent.mkdir(parents=True, exist_ok=True)
            return p
    return DICT_FILE


def load_existing_words(path):
    """读取已有的词典，返回 (单词 set, CSV 原始行列表)"""
    words = set()
    rows = []
    if path.exists():
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            header = None
            for row in reader:
                if len(row) < 3:
                    continue
                if row[0].lower().strip() == "word" and row[1].lower().strip() == "meaning":
                    header = row
                    rows.append(row)
                    continue
                w = row[0].strip().lower()
                if w:
                    words.add(w)
                rows.append(row)
    return words, rows


def fetch_text(url):
    """下载文本内容"""
    print(f"  下载: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def parse_line(line, source):
    """
    解析一行：abandon [əˈbændən] vt. 丢弃；放弃，抛弃
    返回 (word, meaning) 或 None
    """
    line = line.strip()
    if not line or line.startswith("#") or line.startswith("//"):
        return None

    # 匹配：单词 [可选音标] 词性/释义
    # 格式1: word [phonetic] pos. meaning
    # 格式2: word  pos. meaning (无音标)
    # 格式3: word meaning (无词性)
    m = re.match(r"^([a-zA-Z\-]+(?:\s+[a-zA-Z\-]+)?)\s+(.*)$", line)
    if not m:
        return None

    word = m.group(1).strip().lower()
    rest = m.group(2).strip()

    # 去掉音标 [xxx]
    rest = re.sub(r"\[.*?\]", "", rest).strip()

    # 去掉行首的 v./n./adj./vt./vi./adv. 等词性标记
    meaning = rest.strip()
    # 提取第一个可读的释义部分，去掉过长的多义项展开
    meaning = re.sub(r"^\w{1,5}\.\s*", "", meaning).strip()
    # 多义项用编号 "1. xxx 2. xxx" -> 只取第一个义项
    meaning = re.split(r"\s+\d+\.", meaning)[0].strip()
    # 截取合理长度
    if len(meaning) > 80:
        meaning = meaning[:80] + "..."

    if not word or not meaning or len(word) < 2:
        return None
    if any(ch in word for ch in " '’\"()[]{}<>"):
        return None

    return word, meaning


def assign_frequency(word):
    """根据单词长度粗略估计使用频率"""
    if len(word) <= 4:
        return "high"
    elif len(word) <= 7:
        return "medium"
    return "low"


def fetch_example(word):
    """从免费词典 API 获取例句"""
    try:
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            import json
            data = json.loads(resp.read())
            if data and len(data) > 0:
                for meaning in data[0].get("meanings", []):
                    for defn in meaning.get("definitions", []):
                        example = defn.get("example")
                        if example:
                            # 清理例句中的转义
                            example = example.replace('"', '').replace('\\', '')
                            return example[:200]
    except Exception:
        pass
    return ""


def main():
    parser = argparse.ArgumentParser(description="下载 CET-4/6 词汇到 dictionary.csv")
    parser.add_argument("--cet4", action="store_true", help="仅抓取 CET-4")
    parser.add_argument("--cet6", action="store_true", help="仅抓取 CET-6")
    parser.add_argument("--with-examples", action="store_true", help="同时抓取例句（需要网络，很慢）")
    parser.add_argument("--sample", type=int, default=0, help="只抓取前 N 个词（测试用）")
    args = parser.parse_args()

    do_both = not args.cet4 and not args.cet6

    dict_path = find_dict_file()
    print(f"词典文件: {dict_path}")

    existing_words, existing_rows = load_existing_words(dict_path)
    print(f"已有词条: {len(existing_words)} 个")

    sources = []
    if args.cet4 or do_both:
        sources.append(("cet4", CET4_URL))
    if args.cet6 or do_both:
        sources.append(("cet6", CET6_URL))

    new_words = []
    for source, url in sources:
        print(f"\n{'='*50}")
        print(f"处理 {source.upper()} 词库...")
        text = fetch_text(url)
        lines = text.split("\n")
        print(f"  共 {len(lines)} 行")

        count = 0
        for line in lines:
            result = parse_line(line, source)
            if result is None:
                continue
            word, meaning = result

            if word in existing_words:
                continue  # 去重

            freq = assign_frequency(word)
            example = ""
            new_words.append((word, meaning, source, example, freq))
            existing_words.add(word)
            count += 1

            if args.sample and count >= args.sample:
                print(f"  已采样 {count} 个词，停止")
                break

        print(f"  新增: {count} 个词条")

    if args.with_examples and new_words:
        print(f"\n{'='*50}")
        print(f"正在抓取例句（共 {len(new_words)} 个词）...")
        for i, (word, meaning, source, example, freq) in enumerate(new_words):
            if i % 100 == 0:
                print(f"  进度: {i}/{len(new_words)}")
            if not example:
                ex = fetch_example(word)
                if ex:
                    new_words[i] = (word, meaning, source, ex, freq)

    if not new_words:
        print("\n没有新词条需要添加。")
        return

    # 写入 CSV
    print(f"\n写入 {len(new_words)} 个新词条...")
    with open(dict_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        # 确保有表头
        if not existing_rows or existing_rows[0][0].lower().strip() != "word":
            writer.writerow(["word", "meaning", "source", "example", "frequency"])

        # 写入已有行（跳过旧表头）
        for row in existing_rows:
            if row and row[0].lower().strip() == "word" and row[1].lower().strip() == "meaning":
                continue
            writer.writerow(row)

        # 写入新词条
        for word, meaning, source, example, freq in new_words:
            writer.writerow([word, meaning, source, example, freq])

    print(f"\n完成！总计 {len(existing_words)+len(new_words)} 个词条")
    print(f"  新增: {len(new_words)} 个")
    print(f"  文件: {dict_path}")


if __name__ == "__main__":
    main()
