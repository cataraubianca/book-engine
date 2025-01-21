import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksModule } from './books/books.module';
import { Book } from './books/books.entity';
import { IndexedBook } from './books/indexed-books.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'root',
      database: 'books',
      entities: [Book, IndexedBook],
      synchronize: true,
    }),
    BooksModule,
  ],
})
export class AppModule {}
