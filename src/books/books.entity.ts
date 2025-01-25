import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  gutenberg_id: number;

  @Column()
  title: string;

  @Column()
  author: string;

  @Column()
  word_count: number;

  @Column('longtext')
  content: string;

  @Column('text')
  summary: string;

  @Column('float', { nullable: true })
  c_rank: number;
}
