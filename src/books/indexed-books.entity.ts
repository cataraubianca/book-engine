import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Book } from './books.entity';

@Entity('indexed_books')
export class IndexedBook {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Book, (book) => book.id)
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column()
  title: string;

  @Column({
    type: 'json',
    transformer: {
      to: (value: Map<string, number>) => Object.fromEntries(value),
      from: (value: any) => new Map(Object.entries(value)),
    },
  })
  word_occurrence_map: Map<string, number>;
}
