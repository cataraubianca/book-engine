import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndexedBook } from './indexed-books.entity';
import { Book } from './books.entity';
import { In } from 'typeorm';
class RadixTreeNode {
  children: Map<string, RadixTreeNode> = new Map();
  isEndOfWord: boolean = false;
}

class RadixTree {
  root: RadixTreeNode = new RadixTreeNode();

  insert(word: string): void {
    let currentNode = this.root;

    for (let i = 0; i < word.length; i++) {
      let char = word[i];
      if (!currentNode.children.has(char)) {
        currentNode.children.set(char, new RadixTreeNode());
      }
      currentNode = currentNode.children.get(char);
    }
    currentNode.isEndOfWord = true;
  }

  search(pattern: string): boolean {
    let currentNode = this.root;
    let i = 0;

    while (i < pattern.length && currentNode) {
      let char = pattern[i];
      if (currentNode.children.has(char)) {
        currentNode = currentNode.children.get(char);
        i++;
      } else {
        return false;
      }
    }

    return i === pattern.length;
  }
}

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(IndexedBook)
    private readonly indexedBookRepository: Repository<IndexedBook>,

    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,
  ) {}

  async searchBooks(query: string): Promise<Book[]> {
    const indexedBooks = await this.indexedBookRepository
      .createQueryBuilder('indexedBook')
      .leftJoinAndSelect('indexedBook.book', 'book')
      .where('JSON_CONTAINS_PATH(indexedBook.word_occurrence_json, "one", :query)', {
        query: '$."' + query + '"',
      })
      .getMany();

    if (indexedBooks.length === 0) {
      return [];
    }

    const bookIds = indexedBooks
      .filter((indexedBook) => indexedBook.book)
      .map((indexedBook) => indexedBook.book.id);

    return this.bookRepository.find({
      where: {
        id: In(bookIds),
      },
    });
  }

  private radixSearch(text: string, pattern: string): boolean {
    const radixTree = new RadixTree();

    text = text.toLowerCase();
    pattern = pattern.toLowerCase();

    const words = text.split(/\s+/);
    words.forEach((word) => radixTree.insert(word));

    return radixTree.search(pattern);
  }


  async advancedSearch(query: string): Promise<Book[]> {
    const matchingBookIds = new Set<number>();
    const batchSize = 100;
    let offset = 0;
    let batch;

    do {
      batch = await this.indexedBookRepository
        .createQueryBuilder('indexedBook')
        .leftJoinAndSelect('indexedBook.book', 'book')
        .take(batchSize)
        .skip(offset)
        .getMany();

      for (const indexedBook of batch) {
        const wordOccurrenceJson = indexedBook.word_occurrence_json;

        if (!wordOccurrenceJson || !indexedBook.book) continue;

        for (const word of Object.keys(wordOccurrenceJson)) {
          if (this.radixSearch(word, query)) {
            matchingBookIds.add(indexedBook.book.id);
            break;
          }
        }
      }

      offset += batchSize;
    } while (batch.length > 0);
    if (matchingBookIds.size === 0) {
      return [];
    }

    return this.bookRepository.find({
      where: { id: In([...matchingBookIds]) },
    });
  }
}
