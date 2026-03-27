"""
SafeRoute — Crime News Scraper
Scrapes real crime news from Google News RSS for a given area.
Falls back to Bing News RSS if Google News is unavailable.
"""

import requests
import re
from xml.etree import ElementTree
from html import unescape
from typing import List, Dict

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"
BING_NEWS_RSS = "https://www.bing.com/news/search"

# Browser-like UA to avoid bot detection
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    )
}


def clean_html(text: str) -> str:
    """Remove HTML tags from text."""
    clean = re.sub(r'<[^>]+>', '', text)
    return unescape(clean).strip()


def _fetch_google_news(query: str, timeout: int = 5) -> List[Dict[str, str]]:
    """Fetch articles from Google News RSS for a single query."""
    articles: List[Dict[str, str]] = []
    try:
        resp = requests.get(
            GOOGLE_NEWS_RSS,
            params={"q": query, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"},
            headers=UA,
            timeout=timeout,
        )
        resp.raise_for_status()

        root = ElementTree.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return articles

        for item in channel.findall("item"):
            title = clean_html(item.findtext("title", ""))
            if not title:
                continue

            # Extract source from title (Google News format: "Title - Source")
            source = ""
            if " - " in title:
                parts = title.rsplit(" - ", 1)
                title = parts[0]
                source = parts[1] if len(parts) > 1 else ""

            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")

            # Simplify date — just show the date portion
            if pub_date:
                pub_date = pub_date[0:16]  # "Thu, 19 Mar 2026"

            articles.append({
                "title": title,
                "source": source,
                "link": link,
                "published": pub_date,
            })

    except Exception as e:
        print(f"[Google News Error] {query}: {e}")

    return articles


def _fetch_bing_news(query: str, timeout: int = 5) -> List[Dict[str, str]]:
    """Fallback: fetch articles from Bing News RSS."""
    articles: List[Dict[str, str]] = []
    try:
        resp = requests.get(
            BING_NEWS_RSS,
            params={"q": query, "format": "rss"},
            headers=UA,
            timeout=timeout,
        )
        resp.raise_for_status()

        root = ElementTree.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return articles

        for item in channel.findall("item"):
            title = clean_html(item.findtext("title", ""))
            if not title:
                continue

            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")
            source = item.findtext("source", "") or ""

            if pub_date:
                pub_date = pub_date[0:16]

            articles.append({
                "title": title,
                "source": source,
                "link": link,
                "published": pub_date,
            })

    except Exception as e:
        print(f"[Bing News Error] {query}: {e}")

    return articles


def scrape_crime_news(area_name: str, limit: int = 8) -> List[Dict[str, str]]:
    """
    Scrape recent crime/safety news for an area.
    Tries Google News RSS first, falls back to Bing News RSS.
    Returns list of {title, source, link, published}.
    """
    queries = [
        f"crime {area_name}",
        f"theft {area_name}",
        f"accident {area_name}",
        f"safety {area_name}",
    ]

    all_articles: List[Dict[str, str]] = []
    seen_titles: set[str] = set()

    # Try Google News first
    for query in queries:
        for article in _fetch_google_news(query, timeout=5):
            if article["title"] not in seen_titles:
                seen_titles.add(article["title"])
                all_articles.append(article)
            if len(all_articles) >= limit:
                break
        if len(all_articles) >= limit:
            break

    # Fallback to Bing News if Google returned nothing
    if not all_articles:
        print("[Scraper] Google News returned 0 results, trying Bing News fallback...")
        for query in queries:
            for article in _fetch_bing_news(query, timeout=5):
                if article["title"] not in seen_titles:
                    seen_titles.add(article["title"])
                    all_articles.append(article)
                if len(all_articles) >= limit:
                    break
            if len(all_articles) >= limit:
                break

    result = all_articles[0:limit]
    print(f"[Scraper] Returning {len(result)} articles for '{area_name}'")
    return result
