import Dexie, { type Table } from 'dexie';
import type { Document } from '../../types/models';

/** Dexie Schema（Spec §6.2 锁定） */
export class SuperMarkdownDB extends Dexie {
  documents!: Table<Document, string>;

  constructor() {
    super('supermarkdown');
    this.version(1).stores({
      documents: 'id, title, updatedAt, createdAt',
    });
  }
}

export const db = new SuperMarkdownDB();
