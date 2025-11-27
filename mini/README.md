# Documentation Scraper

This script scrapes documentation from `https://www.usehatchapp.com/knowledge` and saves each page as an MDX file.

## Features

- Only scrapes pages that start with the base URL (`https://www.usehatchapp.com/knowledge`)
- Analyzes and counts all pages before scraping
- Converts HTML content to MDX format with frontmatter
- Saves each page as a separate MDX file
- Generates a summary of all scraped pages

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Usage

Run the scraper:
```bash
python scrape_docs.py
```

The script will:
1. Start from `https://www.usehatchapp.com/knowledge`
2. Discover all pages under that base URL
3. Scrape each page and convert to MDX
4. Save files to the `docs/` directory
5. Generate a `scraping_summary.txt` file with details

## Output

- **MDX files**: Each documentation page is saved as an individual `.mdx` file in the `docs/` directory
- **Summary file**: `docs/scraping_summary.txt` contains a list of all scraped pages with their URLs and filenames

## Notes

- The script includes a small delay between requests to be respectful to the server
- Only pages starting with the base URL are scraped
- The script handles relative and absolute URLs automatically
- Filenames are generated from URLs and sanitized for filesystem compatibility

