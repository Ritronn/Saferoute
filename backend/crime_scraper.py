"""
SafeRoute — Crime News Scraper
Scrapes real crime news from Google News RSS for a given area.
"""

import requests
import re
from xml.etree import ElementTree
from html import unescape

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"
UA = {"User-Agent": "SafeRoute-HackathonMVP/1.0"}


def clean_html(text):
    """Remove HTML tags from text."""
    clean = re.sub(r'<[^>]+>', '', text)
    return unescape(clean).strip()


def scrape_crime_news(area_name, limit=8):
    """
    Scrape recent crime/safety news for an area from Google News RSS.
    Returns list of {title, source, link, published}.
    """
    queries = [
        f"crime {area_name}",
        f"theft {area_name}",
        f"accident {area_name}",
        f"safety {area_name}",
    ]

    all_articles = []
    seen_titles = set()

    for query in queries:
        try:
            resp = requests.get(
                GOOGLE_NEWS_RSS,
                params={"q": query, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"},
                headers=UA,
                timeout=10,
            )
            resp.raise_for_status()

            root = ElementTree.fromstring(resp.content)
            channel = root.find("channel")
            if channel is None:
                continue

            for item in channel.findall("item"):
                title = clean_html(item.findtext("title", ""))
                # Deduplicate
                if title in seen_titles or not title:
                    continue
                seen_titles.add(title)

                # Extract source from title (Google News format: "Title - Source")
                source = ""
                if " - " in title:
                    parts = title.rsplit(" - ", 1)
                    title = parts[0]
                    source = parts[1] if len(parts) > 1 else ""

                link = item.findtext("link", "")
                pub_date = item.findtext("pubDate", "")

                # Simplify date — just show "2 hours ago" style or date
                if pub_date:
                    # Keep just the date portion
                    pub_date = pub_date[:16]  # "Thu, 19 Mar 2026"

                all_articles.append({
                    "title": title,
                    "source": source,
                    "link": link,
                    "published": pub_date,
                })

                if len(all_articles) >= limit:
                    break

        except Exception as e:
            print(f"[Scraper Error] {query}: {e}")
            continue

        if len(all_articles) >= limit:
            break

    return all_articles[:limit]
