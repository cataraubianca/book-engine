import mysql.connector
import json
import re
from stop_words import safe_get_stop_words

db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': 'root',
    'database': 'books',
    'ssl_disabled': True,
    'connection_timeout': 300,
    'autocommit': True,
}

def get_word_occurrence(text, lang):
    stop_words = safe_get_stop_words(lang)
    
    txt = text.lower()
    
    words = re.findall(r'\b\w+\'?\w*\b', txt)
    
    word_map = {}
    
    for word in words:
        if len(word) > 2 and word not in stop_words:
            if word in word_map:
                word_map[word] += 1
            else:
                word_map[word] = 1
                
    return word_map

try:
    connection = mysql.connector.connect(**db_config)
    cursor = connection.cursor(dictionary=True)

    cursor.execute("DROP TABLE IF EXISTS indexed_books")

    create_table_query = """
    CREATE TABLE indexed_books (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        title VARCHAR(255),
        word_occurrence_map JSON,
        FOREIGN KEY (book_id) REFERENCES books(id)
    )
    """
    cursor.execute(create_table_query)

    cursor.execute("SELECT id, title, content FROM books")
    books = cursor.fetchall()

    for book in books:
        book_id = book['id']
        title = book['title']
        content = book['content'] or ""
        lang = 'en'

        word_occurrence_map = get_word_occurrence(content, lang)
        word_occurrence_json = json.dumps(word_occurrence_map)

        insert_query = """
        INSERT INTO indexed_books (book_id, title, word_occurrence_map)
        VALUES (%s, %s, %s)
        """
        cursor.execute(insert_query, (book_id, title, word_occurrence_json))

    connection.commit()
    print("Indexed books table populated successfully with correct word counts!")

except mysql.connector.Error as err:
    print(f"Error: {err}")
finally:
    if connection.is_connected():
        cursor.close()
        connection.close()