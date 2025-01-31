import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { IndexedBook } from './indexed-books.entity';
import { Book } from './books.entity';
import { JaccardNeighbor } from './jaccard-neighbors.entity';
import { AhoUllmanRegex } from './AhoUllmanRegex';

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

  private ahoUllmanRegexSearch(
    regex: string,
    wordOccurrenceMap: Map<string, number>
  ): number {
    const engine = new AhoUllmanRegex(regex.toLowerCase());

    let totalOccurrences = 0;
    for (const [word, occurrences] of wordOccurrenceMap.entries()) {
      if (engine.test(word.toLowerCase())) {
        totalOccurrences += occurrences;
      }
    }
    return totalOccurrences;
  }

  async advancedSearchSortedByOccurrence(query: string): Promise<Book[]> {
    const indexedBooks = await this.indexedBookRepository.find({
      relations: ['book'],
    });
  
    if (indexedBooks.length === 0) return [];
  
    const occurrencesList: [number, number][] = indexedBooks
      .map((indexedBook) => {
        const wordOccurrenceMap = indexedBook.word_occurrence_map;
        const totalOccurrences = this.ahoUllmanRegexSearch(query, wordOccurrenceMap);
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
        const totalOccurrences = this.ahoUllmanRegexSearch(query, wordOccurrenceMap);
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
      .where(
        'JSON_CONTAINS_PATH(indexedBook.word_occurrence_map, "one", :query)',
        {
          query: '$."' + query + '"',
        },
      )
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
      .where(
        'JSON_CONTAINS_PATH(indexedBook.word_occurrence_map, "one", :query)',
        {
          query: '$."' + query + '"',
        },
      )
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
