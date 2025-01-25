import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { IndexedBook } from './indexed-books.entity';
import { Book } from './books.entity';
import { JaccardNeighbor } from './jaccard-neighbors.entity';

class RadixTreeNode {
  children: Map<string, RadixTreeNode> = new Map();
  isEndOfWord: boolean = false;
  occurrences: number = 0;
}

class RadixTree {
  root: RadixTreeNode = new RadixTreeNode();

  insert(word: string, occurrences: number): void {
    let currentNode = this.root;

    for (const char of word) {
      if (!currentNode.children.has(char)) {
        currentNode.children.set(char, new RadixTreeNode());
      }
      currentNode = currentNode.children.get(char)!;
    }
    currentNode.isEndOfWord = true;
    currentNode.occurrences += occurrences;
  }

  searchRegexWithOccurrences(regex: string): number {
    let totalOccurrences = 0;
    const regExp = new RegExp(`^${regex}`);
  
    const dfs = (node: RadixTreeNode, currentWord: string): void => {
      if (regExp.test(currentWord)) {
        if (node.isEndOfWord) {
          totalOccurrences += node.occurrences;
        }
  
        for (const [char, childNode] of node.children) {
          dfs(childNode, currentWord + char);
        }
      } else {
        for (const [char, childNode] of node.children) {
          dfs(childNode, currentWord + char);
        }
      }
    };
  
    dfs(this.root, '');
    return totalOccurrences;
  }
  
  
}



@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(IndexedBook)
    private readonly indexedBookRepository: Repository<IndexedBook>,

    @InjectRepository(Book)
    private readonly bookRepository: Repository<Book>,

    @InjectRepository(JaccardNeighbor)
    private readonly jaccardNeighborRepository: Repository<JaccardNeighbor>,
  ) {}

  private sortBooksByCRank(books: Book[]): Book[] {
    return books.sort((a, b) => (b.c_rank ?? 0) - (a.c_rank ?? 0));
  }

  private radixSearch(
    regex: string,
    wordOccurrenceMap: Map<string, number>
  ): number {
    const radixTree = new RadixTree();
  
    for (const [word, occurrences] of wordOccurrenceMap.entries()) {
      radixTree.insert(word, occurrences);
    }
  
    return radixTree.searchRegexWithOccurrences(regex.toLowerCase());
  }
  
  
  async advancedSearchSortedByOccurrence(query: string): Promise<Book[]> {
    const indexedBooks = await this.indexedBookRepository.find({
      relations: ['book'],
    });
  
    if (indexedBooks.length === 0) return [];
  
    const occurrencesList: [number, number][] = indexedBooks
      .map((indexedBook) => {
        const wordOccurrenceMap = indexedBook.word_occurrence_map;
  
        const totalOccurrences = this.radixSearch(query, wordOccurrenceMap);
  
        return [indexedBook.book.id, totalOccurrences] as [number, number];
      })
      .filter(([, totalOccurrences]) => totalOccurrences > 0);
  
    occurrencesList.sort((a, b) => b[1] - a[1]);
  
    const sortedBookIds = occurrencesList.map(([bookId]) => bookId);
    const books = await this.bookRepository.findByIds(sortedBookIds);
  
    return sortedBookIds
      .map((id) => books.find((book) => book.id === id))
      .filter((book): book is Book => book !== undefined);
  }

  async advancedSearchSortedByCRank(query: string): Promise<Book[]> {
    const indexedBooks = await this.indexedBookRepository.find({
      relations: ['book'],
    });
  
    if (indexedBooks.length === 0) return [];
  
    const occurrencesList: [number, number][] = indexedBooks
      .map((indexedBook) => {
        const wordOccurrenceMap = indexedBook.word_occurrence_map;
  
        const totalOccurrences = this.radixSearch(query, wordOccurrenceMap);
  
        return [indexedBook.book.id, totalOccurrences] as [number, number];
      })
      .filter(([, totalOccurrences]) => totalOccurrences > 0);
  
    occurrencesList.sort((a, b) => b[1] - a[1]);
  
    const sortedBookIds = occurrencesList.map(([bookId]) => bookId);
    const books = await this.bookRepository.findByIds(sortedBookIds);
  
    const sortedBooksByCRank = this.sortBooksByCRank(
      sortedBookIds
        .map((id) => books.find((book) => book.id === id))
        .filter((book): book is Book => book !== undefined)
    );
  
    return sortedBooksByCRank;
  }

  async searchBooksSortedByCRank(query: string): Promise<Book[]> {
    const indexedBooks = await this.indexedBookRepository
      .createQueryBuilder('indexedBook')
      .leftJoinAndSelect('indexedBook.book', 'book')
      .where('JSON_CONTAINS_PATH(indexedBook.word_occurrence_map, "one", :query)', {
        query: '$."' + query + '"',
      })
      .getMany();

    if (indexedBooks.length === 0) {
      return [];
    }

    const bookIds = indexedBooks
      .filter((indexedBook) => indexedBook.book)
      .map((indexedBook) => indexedBook.book.id);

    const books = await this.bookRepository.find({
      where: { id: In(bookIds) },
    });

    return this.sortBooksByCRank(books);
  }

  async searchBooksSortedByOccurrence(query: string): Promise<Book[]> {
    const indexedBooks = await this.indexedBookRepository
      .createQueryBuilder('indexedBook')
      .leftJoinAndSelect('indexedBook.book', 'book')
      .where('JSON_CONTAINS_PATH(indexedBook.word_occurrence_map, "one", :query)', {
        query: '$."' + query + '"',
      })
      .getMany();
  
    if (indexedBooks.length === 0) {
      return [];
    }
  
    const occurrencesList: [number, number][] = indexedBooks
    .filter((indexedBook) => indexedBook.book && indexedBook.book.id)
    .map((indexedBook) => {
      const occurrences = indexedBook.word_occurrence_map.get(query) || 0;
      return [indexedBook.book.id, occurrences] as [number, number];
    })
    .filter(([, occurrences]) => occurrences > 0);
  
    occurrencesList.sort((a, b) => b[1] - a[1]);
  
    const sortedBookIds = occurrencesList.map(([bookId]) => bookId);
  
    const books = await this.bookRepository.findByIds(sortedBookIds);
  
    return sortedBookIds
      .map((id) => books.find((book) => book.id === id))
      .filter((book): book is Book => book !== undefined);
  }
  
  async getRecommendations(bookId: number): Promise<Book[]> {
    const jaccardNeighbors = await this.jaccardNeighborRepository.findOne({
      where: { book_id: bookId },
    });

    if (!jaccardNeighbors) {
      return [];
    }

    const recommendedBookIds = jaccardNeighbors.neighbors_json;

    return this.bookRepository.find({
      where: { id: In(recommendedBookIds) },
    });
  }
  
}
