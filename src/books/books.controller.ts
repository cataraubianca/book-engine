import { Controller, Get, Param } from '@nestjs/common';
import { BooksService } from './books.service';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get('search/sorted-by-c-rank/:query')
  async searchBooksSortedByCRank(@Param('query') query: string) {
    return this.booksService.searchBooksSortedByCRank(query);
  }

  @Get('search/sorted-by-occurrence/:query')
  async searchBooksSortedByOccurrence(@Param('query') query: string) {
    return this.booksService.searchBooksSortedByOccurrence(query);
  }

  @Get('advanced-search/sorted-by-c-rank/:query')
  async advancedSearchSortedByCRank(@Param('query') query: string) {
    return this.booksService.advancedSearchSortedByCRank(query);
  }

  @Get('advanced-search/sorted-by-occurrence/:query')
  async advancedSearchSortedByOccurrence(@Param('query') query: string) {
    return this.booksService.advancedSearchSortedByOccurrence(query);
  }

  @Get('recommendations/:bookId')
  async getRecommendations(@Param('bookId') bookId: number) {
    return this.booksService.getRecommendations(bookId);
  }

}
