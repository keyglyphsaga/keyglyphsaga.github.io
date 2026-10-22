"""Validate generated pages without additional test dependencies."""
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.links = []
        self.images = []
        self.headings = []
        self.in_heading = False
        self.meta = {}
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            self.links.append(attrs)
        if tag == "img":
            self.images.append(attrs)
        if tag == "h1":
            self.in_heading = True
        if tag == "meta":
            self.meta[attrs.get("property", attrs.get("name"))] = attrs.get("content")

    def handle_endtag(self, tag):
        if tag == "h1":
            self.in_heading = False

    def handle_data(self, data):
        if self.in_heading:
            self.headings.append(data.strip())


for route, current, title, amazon in [
    ("index.html", "/", "Shadow", "https://a.co/d/06qTgDN8"),
    ("self/index.html", "/self", "Self", "https://a.co/d/0fZYjfvo"),
    ("about/index.html", "/about", None, None),
]:
    page = Page(Path("dist") / route)
    tabs = [link for link in page.links if "tab" in link.get("class", "").split()]
    assert [link["href"] for link in tabs] == ["/", "/self", "/about"], route
    assert [link["href"] for link in tabs if link.get("aria-current") == "page"] == [current], route
    assert [link["href"] for link in tabs if "active" in link.get("class", "").split()] == [current], route
    if title:
        assert page.headings == [title], (route, page.headings)
        glyphs = [image for image in page.images if "keyglyph-top-img" in image.get("class", "").split()]
        expected_glyph = "/self-keyglyph.png" if title == "Self" else "/shadow-keyglyph-new.svg"
        assert len(glyphs) == 1 and glyphs[0]["src"] == expected_glyph, route
        assert glyphs[0]["alt"] == f"{title} Keyglyph", route
        assert (Path("dist") / expected_glyph.lstrip("/")).is_file(), route
        assert page.meta["og:title"] == f"Keyglyph Saga — {title}", route
        ctas = [link for link in page.links if "cta-button" in link.get("class", "").split()]
        assert len(ctas) == 1 and ctas[0]["href"] == amazon, route
        assert ctas[0]["target"] == "_blank" and "noopener" in ctas[0]["rel"].split(), route
    print(f"PASS: {route} navigation, active state, and book details")

sitemap = ET.parse("dist/sitemap.xml")
locations = [node.text for node in sitemap.findall(".//{*}loc")]
assert "https://keyglyphsaga.github.io/self" in locations
print("PASS: Self is included in the sitemap")
