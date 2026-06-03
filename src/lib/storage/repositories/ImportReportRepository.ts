import { desc } from 'drizzle-orm';
import type { CompatReport } from '$lib/compat/sillytavern/report';
import { getDatabase } from '../db';
import { importReports } from '../schema';

export type StoredImportReport = {
  id: string;
  kind: string;
  report: CompatReport;
  createdAt: number;
};

export class ImportReportRepository {
  constructor(private readonly db = getDatabase()) {}

  list(): StoredImportReport[] {
    return this.db
      .select()
      .from(importReports)
      .orderBy(desc(importReports.createdAt))
      .all()
      .map((row) => ({ id: row.id, kind: row.kind, report: row.data, createdAt: row.createdAt }));
  }

  save(report: CompatReport): StoredImportReport {
    const stored = { id: crypto.randomUUID(), kind: report.kind, report, createdAt: Date.now() };
    this.db.insert(importReports).values({ id: stored.id, kind: stored.kind, data: report, createdAt: stored.createdAt }).run();
    return stored;
  }
}
