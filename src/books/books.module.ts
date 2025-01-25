import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { Book } from './books.entity';
import { IndexedBook } from './indexed-books.entity';
import { JaccardNeighbor } from './jaccard-neighbors.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Book, IndexedBook, JaccardNeighbor])],
  controllers: [BooksController],
  providers: [BooksService],
})
export class BooksModule {}