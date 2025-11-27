#!/usr/bin/env python3
"""
Script to scrape documentation from usehatchapp.com/knowledge
and save pages as MDX files.
"""

import os
import re
import time
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import html2text
from pathlib import Path


class DocumentationScraper:
    def __init__(self, base_url, output_dir="docs"):
        self.base_url = base_url.rstrip('/')
        self.output_dir = Path(output_dir)
        self.visited_urls = set()
        self.urls_to_visit = {base_url}
        self.scraped_count = 0
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        
        # Create output directory
        self.output_dir.mkdir(exist_ok=True)
        
    def is_valid_url(self, url):
        """Check if URL should be scraped (starts with base_url)"""
        if not url:
            return False
        # Normalize URL
        url = url.rstrip('/')
        return url.startswith(self.base_url)
    
    def normalize_url(self, url):
        """Normalize URL by removing fragments and trailing slashes"""
        parsed = urlparse(url)
        normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip('/')
        if parsed.query:
            normalized += f"?{parsed.query}"
        return normalized
    
    def extract_links(self, soup, current_url):
        """Extract all links from a page that match our base URL"""
        links = set()
        for anchor in soup.find_all('a', href=True):
            href = anchor['href']
            # Convert relative URLs to absolute
            absolute_url = urljoin(current_url, href)
            normalized = self.normalize_url(absolute_url)
            
            if self.is_valid_url(normalized):
                links.add(normalized)
        return links
    
    def url_to_filename(self, url):
        """Convert URL to a valid filename"""
        # Remove base URL
        path = url.replace(self.base_url, '').strip('/')
        if not path:
            path = 'index'
        
        # Remove query parameters
        path = path.split('?')[0]
        
        # Replace slashes and special chars with underscores
        filename = re.sub(r'[^\w\-_\.]', '_', path)
        filename = re.sub(r'_+', '_', filename)  # Replace multiple underscores
        
        # Ensure it ends with .mdx
        if not filename.endswith('.mdx'):
            filename += '.mdx'
        
        return filename
    
    def extract_title(self, soup):
        """Extract page title"""
        # Try multiple selectors for title
        title = None
        
        # Try h1 first
        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)
        
        # Try title tag
        if not title:
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text(strip=True)
        
        # Try meta title
        if not title:
            meta_title = soup.find('meta', property='og:title')
            if meta_title:
                title = meta_title.get('content', '').strip()
        
        return title or 'Untitled'
    
    def extract_content(self, soup):
        """Extract main content from the page"""
        # Try to find main content area
        # Common selectors for documentation sites
        content_selectors = [
            'main',
            'article',
            '[role="main"]',
            '.content',
            '.main-content',
            '.documentation-content',
            '#content',
            '.post-content',
            '.entry-content'
        ]
        
        content = None
        for selector in content_selectors:
            content = soup.select_one(selector)
            if content:
                break
        
        # If no main content found, use body but remove nav, header, footer
        if not content:
            content = soup.find('body')
            if content:
                # Remove common non-content elements
                for tag in content.find_all(['nav', 'header', 'footer', 'script', 'style']):
                    tag.decompose()
        
        return content or soup
    
    def html_to_mdx(self, html_content, title, url):
        """Convert HTML content to MDX format"""
        # Convert HTML to markdown
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.body_width = 0
        markdown = h.handle(str(html_content))
        
        # Clean up the markdown
        markdown = markdown.strip()
        
        # Create MDX with frontmatter
        frontmatter = f"""---
title: "{title}"
url: "{url}"
---

"""
        return frontmatter + markdown
    
    def scrape_page(self, url):
        """Scrape a single page"""
        if url in self.visited_urls:
            return None
        
        print(f"Scraping: {url}")
        self.visited_urls.add(url)
        
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract title and content
            title = self.extract_title(soup)
            content = self.extract_content(soup)
            
            # Convert to MDX
            mdx_content = self.html_to_mdx(content, title, url)
            
            # Save to file
            filename = self.url_to_filename(url)
            filepath = self.output_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(mdx_content)
            
            print(f"  ✓ Saved: {filename}")
            self.scraped_count += 1
            
            # Extract links for further crawling
            links = self.extract_links(soup, url)
            new_links = links - self.visited_urls
            self.urls_to_visit.update(new_links)
            
            if new_links:
                print(f"  → Found {len(new_links)} new links to scrape")
            
            return {
                'url': url,
                'title': title,
                'filename': filename,
                'links_found': len(links)
            }
            
        except requests.RequestException as e:
            print(f"  ✗ Error scraping {url}: {e}")
            return None
        except Exception as e:
            print(f"  ✗ Unexpected error scraping {url}: {e}")
            return None
    
    def run(self):
        """Main scraping loop"""
        print(f"Starting documentation scrape from: {self.base_url}")
        print(f"Output directory: {self.output_dir}")
        print("-" * 60)
        
        results = []
        
        while self.urls_to_visit:
            url = self.urls_to_visit.pop()
            result = self.scrape_page(url)
            if result:
                results.append(result)
            
            # Be polite - add a small delay
            time.sleep(0.5)
        
        print("-" * 60)
        print(f"\nScraping complete!")
        print(f"Total pages scraped: {self.scraped_count}")
        print(f"Total pages analyzed: {len(self.visited_urls)}")
        print(f"Files saved to: {self.output_dir.absolute()}")
        
        # Save summary
        summary_path = self.output_dir / 'scraping_summary.txt'
        with open(summary_path, 'w', encoding='utf-8') as f:
            f.write(f"Documentation Scraping Summary\n")
            f.write(f"{'=' * 60}\n\n")
            f.write(f"Base URL: {self.base_url}\n")
            f.write(f"Total pages scraped: {self.scraped_count}\n")
            f.write(f"Total pages analyzed: {len(self.visited_urls)}\n\n")
            f.write(f"Pages:\n")
            for result in results:
                f.write(f"  - {result['title']}\n")
                f.write(f"    URL: {result['url']}\n")
                f.write(f"    File: {result['filename']}\n")
                f.write(f"    Links found: {result['links_found']}\n\n")
        
        print(f"Summary saved to: {summary_path}")
        
        return results


def main():
    base_url = "https://www.usehatchapp.com/knowledge"
    output_dir = "docs"
    
    scraper = DocumentationScraper(base_url, output_dir)
    scraper.run()


if __name__ == "__main__":
    main()

