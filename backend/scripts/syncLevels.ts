/**
 * Upload bài Level 0-5 từ CSV lên lesson_outputs.
 * - Xuất báo cáo trùng/mới do script Python tạo.
 * - Hỏi xác nhận lần cuối trước khi upload.
 *
 * Chạy:
 *   npx ts-node scripts/syncLevels.ts --level 0          # preview
 *   npx ts-node scripts/syncLevels.ts --level 0 --all   # hỏi xác nhận rồi upload
 *   npx ts-node scripts/syncLevels.ts --level 1 --all
 *   ... level 2, 3, 4, 5
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DATA_DIR = path.join(__dirname, '../../backup/data');

function getCsvPath(level: number): string {
  return path.join(DATA_DIR, `level${level}_to_upload.csv`);
}

function generateId(): string {
  return `LO${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

async function parseCsv(csvPath: string): Promise<Record<string, string>[]> {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] || '';
    });
    rows.push(row);
  }
  return rows;
}

function askConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y|yes|Y|YES|1$/i.test(answer.trim()));
    });
  });
}

async function uploadOne(row: Record<string, string>, level: number): Promise<boolean> {
  const link = row.link?.trim();
  if (!link) {
    console.warn('Bỏ qua - không có link:', row.lesson_name);
    return false;
  }

  const { data: existing } = await supabase
    .from('lesson_outputs')
    .select('id')
    .eq('link', link)
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log('Đã có trong DB, bỏ qua:', row.lesson_name);
    return false;
  }

  const payload = {
    id: generateId(),
    lesson_name: row.lesson_name || row.original_title || `Bài Level ${level}`,
    tag: row.tag || 'Ad-hoc',
    level: row.level || `Level ${level}`,
    original_title: row.original_title || row.lesson_name,
    original_link: row.link || null,
    link: row.link || null,
    cost: parseInt(row.cost || '0', 10),
    date:
      row.date && row.date.length >= 10 && row.date !== '0'
        ? row.date
        : new Date().toISOString().split('T')[0],
    status: row.status || 'paid',
    contest_uploaded: row.contest_uploaded || `Contest Level ${level}`,
  };

  const { data, error } = await supabase.from('lesson_outputs').insert(payload).select().single();

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  console.log('Upload thành công:', data?.lesson_name);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const levelIdx = args.indexOf('--level');
  const level = levelIdx >= 0 && args[levelIdx + 1] != null ? parseInt(args[levelIdx + 1], 10) : null;
  const modeAll = args.includes('--all');
  const reportOnly = args.includes('--report-only');

  if (level == null || Number.isNaN(level) || level < 0 || level > 5) {
    console.error('Cách dùng: npx ts-node scripts/syncLevels.ts --level <0|1|2|3|4|5> [--all] [--report-only]');
    console.error('  --all: hỏi xác nhận rồi upload toàn bộ bài trong levelN_to_upload.csv');
    console.error('  --report-only: chỉ in danh sách, không hỏi không upload');
    process.exit(1);
  }

  const csvPath = getCsvPath(level);
  if (!fs.existsSync(csvPath)) {
    console.error(`Chưa có file level${level}_to_upload.csv. Chạy trước: python backup/scripts/sync_levels_to_lesson_outputs.py ${level}`);
    process.exit(1);
  }

  const rows = await parseCsv(csvPath);
  console.log(`Level ${level}: đã load ${rows.length} bài từ level${level}_to_upload.csv.\n`);

  if (rows.length === 0) {
    console.log('Không có bài nào cần upload.');
    return;
  }

  if (reportOnly) {
    console.log('--- Danh sách sẽ upload ---');
    rows.slice(0, 20).forEach((r, i) => {
      console.log(`  [${i + 1}] ${r.lesson_name} | ${r.tag} | ${r.link?.substring(0, 55)}...`);
    });
    if (rows.length > 20) console.log(`  ... và ${rows.length - 20} bài khác.`);
    console.log('\nChạy với --all để hỏi xác nhận và upload.');
    return;
  }

  if (!modeAll) {
    console.log('Mẫu 3 bài đầu:');
    rows.slice(0, 3).forEach((r, i) => {
      console.log(`  [${i + 1}] ${r.lesson_name} | ${r.tag}`);
    });
    console.log(`\nChạy với --all để xác nhận và upload ${rows.length} bài Level ${level}.`);
    return;
  }

  const confirmed = await askConfirm(
    `\nXác nhận upload ${rows.length} bài Level ${level} (cost=0)? (y/n): `
  );
  if (!confirmed) {
    console.log('Đã hủy.');
    return;
  }

  let success = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    try {
      const ok = await uploadOne(rows[i], level);
      if (ok) success++;
      else skipped++;
      if ((i + 1) % 15 === 0) console.log(`  ... ${i + 1}/${rows.length}`);
    } catch (e) {
      console.error(`  [${i + 1}/${rows.length}] Lỗi:`, (e as Error).message);
    }
  }
  console.log(`\nHoàn thành Level ${level}: ${success} upload, ${skipped} đã có.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
