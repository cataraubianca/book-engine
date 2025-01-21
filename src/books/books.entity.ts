import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  gutenberg_id: number;

  @Column({ length: 255 })
  title: string;

  @Column({ length: 255 })
  author: string;

  @Column()
  word_count: number;

  @Column('longtext')
  content: string;

  @Column('text')
  summary: string;
}