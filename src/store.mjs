import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class AtomicStore {
  constructor(filePath) { this.filePath = filePath; }
  async load() {
    try {
      const snapshot = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (!Array.isArray(snapshot.records) || !Array.isArray(snapshot.requestIds)) throw new Error('Invalid persistence structure.');
      return snapshot;
    } catch (error) {
      if (error.code === 'ENOENT') return { records: [], requestIds: [] };
      throw error;
    }
  }
  async save(snapshot) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await rename(temporary, this.filePath);
  }
}
