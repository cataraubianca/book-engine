import { Controller, Get, Param } from '@nestjs/common';
import { BooksService } from './books.service';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get('search/:query')
  async searchBooks(@Param('query') query: string) {
    return this.booksService.searchBooks(query);
  }

  @Get('advanced-search/:query')
  async advancedSearch(@Param('query') query: string) {
    return this.booksService.advancedSearch(query);
  }
}
