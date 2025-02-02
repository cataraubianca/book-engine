import json
import mysql.connector
from datetime import datetime

THRESHOLD = 0.65

def ensure_schema(conn):
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COUNT(*) 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_schema = DATABASE() 
          AND table_name = 'books' 
          AND column_name = 'c_rank'
    """)
    (count_c_rank_exists,) = cursor.fetchone()

    if count_c_rank_exists == 0:
        try:
            cursor.execute("ALTER TABLE books ADD COLUMN c_rank DOUBLE")
            print("Added 'c_rank' column to 'books' table.")
        except mysql.connector.Error as e:
            print(f"Could not add 'c_rank' column: {e}")
    else:
        print("'c_rank' column already exists in 'books' table. Skipping ADD COLUMN.")

    create_neighbors_sql = """
    CREATE TABLE IF NOT EXISTS jaccard_neighbors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at DATETIME,
        updated_at DATETIME,
        neighbors_json TEXT,
        book_id INT,
        FOREIGN KEY (book_id) REFERENCES books(id)
    ) ENGINE=InnoDB
    """
    cursor.execute(create_neighbors_sql)
    print("Ensured 'jaccard_neighbors' table exists.")

    conn.commit()

def custom_jaccard_distance(dict_a, dict_b):
    """
    distance = sum_over_keys( difference_in_counts ) / sum_over_keys( max_of_counts )
    """
    difference_sum = 0
    max_sum = 0

    leftover_keys = set(dict_b.keys())
    for token, count_a in dict_a.items():
        if token in dict_b:
            count_b = dict_b[token]
            top_val = max(count_a, count_b)
            difference_sum += top_val - min(count_a, count_b)
            max_sum += top_val
            leftover_keys.remove(token)
        else:
            difference_sum += count_a
            max_sum += count_a

    for token in leftover_keys:
        difference_sum += dict_b[token]
        max_sum += dict_b[token]

    if max_sum == 0:
        return 1
    return difference_sum / max_sum

def compute_jaccard_and_closeness(conn):
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT book_id, word_occurrence_map FROM indexed_books")
    all_rows = cursor.fetchall()
    total_books = len(all_rows)

    for row1 in all_rows:
        b1_id = row1['book_id']
        dict1 = json.loads(row1['word_occurrence_map'])

        neighbors = []
        distance_accum = 1e-10

        for row2 in all_rows:
            b2_id = row2['book_id']
            if b2_id != b1_id:
                dict2 = json.loads(row2['word_occurrence_map'])
                dist = custom_jaccard_distance(dict1, dict2)

                if dist < THRESHOLD:
                    neighbors.append(b2_id)

                distance_accum += dist

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")
        neighbors_json = json.dumps(neighbors)

        try:
            insert_sql = """
                INSERT INTO jaccard_neighbors (created_at, updated_at, neighbors_json, book_id)
                VALUES (%s, %s, %s, %s)
            """
            cursor.execute(insert_sql, (now_str, now_str, neighbors_json, b1_id))

            c_rank = (total_books - 1) / distance_accum
            update_sql = """
                UPDATE books
                SET c_rank = %s
                WHERE id = %s
            """
            cursor.execute(update_sql, (c_rank, b1_id))

            print(f"Processed book_id={b1_id}, distance_accum={distance_accum:.4f}, c_rank={c_rank:.4f}")
        except mysql.connector.Error as err:
            print(f"Error for book_id {b1_id}: {err}")

    conn.commit()
    print("Jaccard distances and centrality ranks updated.")

def main():
    DB_CONFIG = {
        'host': 'localhost',
        'user': 'root',
        'password': 'root',
        'database': 'books',
        'ssl_disabled': True,
        'connection_timeout': 300,
        'autocommit': True,
    }

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        print("Database connected")

        ensure_schema(conn)
        compute_jaccard_and_closeness(conn)

    except Exception as ex:
        print(f"Error: {ex}")
    finally:
        if conn.is_connected():
            conn.close()
            print("Database connection closed")

if __name__ == "__main__":
    main()