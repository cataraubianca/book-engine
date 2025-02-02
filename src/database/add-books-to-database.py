import requests
from bs4 import BeautifulSoup
import mysql.connector
import re
import time
from mysql.connector import Error

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'root',
    'database': 'books',
    'ssl_disabled': True,
    'connection_timeout': 300,
    'autocommit': True,
}

def insert_book(cursor, gutenberg_id, title, author, word_count, content, summary):
    try:
        query = """
        INSERT INTO books (gutenberg_id, title, author, word_count, content, summary)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (gutenberg_id, title, author, word_count, content, summary))
    except Error as e:
        print(f"Database insertion error for book ID {gutenberg_id}: {e}")

def fetch_metadata(book_id):
    metadata_url = f"https://www.gutenberg.org/ebooks/{book_id}"
    response = requests.get(metadata_url)

    if response.status_code == 200:
        soup = BeautifulSoup(response.content, "html.parser")
        table = soup.find("table", class_="bibrec")

        if table:
            rows = table.find_all("tr")
            metadata = {}
            for row in rows:
                label = row.find("th").get_text(strip=True) if row.find("th") else None
                value = row.find("td").get_text(strip=True) if row.find("td") else None
                if label and value:
                    metadata[label.lower()] = value

            title = metadata.get("title", f"Book {book_id}")
            author = metadata.get("author", "Unknown")
            summary = metadata.get("summary", "No summary available.")
            language = metadata.get("language", "Unknown").lower()

            return title, author, summary, language
        else:
            print(f"No metadata table found for book ID {book_id}.")
            return None, None, None, None
    else:
        print(f"Failed to fetch metadata for book ID {book_id}, status code: {response.status_code}.")
        return None, None, None, None

def download_book(book_url, gutenberg_id, cursor):
    try:
        response = requests.get(book_url)
        
        if response.status_code != 200:
            print(f"Failed to download book content for ID {gutenberg_id}, status code: {response.status_code}.")
            return

        content = response.text

        content = re.sub(r"\*\*\* START OF(.*?)\*\*\*", "", content, flags=re.DOTALL)
        content = re.sub(r"\*\*\* END OF(.*?)\*\*\*", "", content, flags=re.DOTALL)

        content = re.sub(r'\s+', ' ', content).strip()

        content = re.sub(r'[^\x00-\x7F]+', '', content)

        word_count = len(content.split())

        if word_count < 10000:
            print(f"Skipping book ID {gutenberg_id} due to insufficient word count ({word_count} words).")
            return

        title, author, summary, language = fetch_metadata(gutenberg_id)

        if language == 'english':
            insert_book(cursor, gutenberg_id, title, author, word_count, content, summary)
            print(f"Stored book ID {gutenberg_id} ({word_count} words, Language: {language})")
        else:
            print(f"Skipping book ID {gutenberg_id} due to language {language}.")

    except Exception as e:
        print(f"Error processing book ID {gutenberg_id}: {e}")


def keep_connection_alive(cursor):
    try:
        cursor.execute("SELECT 1")
    except Error as e:
        print(f"Error keeping connection alive: {e}")

def connect_to_database(retries=3, delay=5):
    for i in range(retries):
        try:
            connection = mysql.connector.connect(**DB_CONFIG)
            cursor = connection.cursor()
            return connection, cursor
        except Error as e:
            print(f"Connection failed (Attempt {i+1}/{retries}): {e}")
            time.sleep(delay)
    raise Exception("Failed to connect to the database after several attempts.")

def fetch_and_store_books(min_books=2200):
    base_url = "https://www.gutenberg.org/cache/epub/"
    connection, cursor = connect_to_database()
    stored_books = 0
    book_id = 1

    while stored_books < min_books:
        try:
            book_url = f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt"
            download_book(book_url, book_id, cursor)
            connection.commit()
            stored_books += 1
            book_id += 1

            if stored_books % 10 == 0:
                keep_connection_alive(cursor)

        except Exception as e:
            print(f"Failed to process book ID {book_id}: {e}")
            time.sleep(5)
            connection.close()
            connection, cursor = connect_to_database()

    print(f"\nStored {stored_books} books.")
    cursor.close()
    connection.close()

if __name__ == "__main__":
    fetch_and_store_books()