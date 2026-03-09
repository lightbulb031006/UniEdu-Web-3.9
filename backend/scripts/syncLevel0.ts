/**
 * Script upload bài Level 0 từ CSV lên lesson_outputs.
 * Chạy: npx ts-node scripts/syncLevel0.ts [--test | --all]
 * - Không tham số: chỉ in ra bài cần upload
 * - --test: upload thử 1 bài
 * - --all: upload toàn bộ
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CSV_PATH = path.join(__dirname, '../../backup/data/level0_to_upload.csv');

function generateId(): string {
  return `LO${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

async function parseCsv(): Promise<Record<string, string>[]> {
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
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

async function uploadOne(row: Record<string, string>): Promise<boolean> {
  const link = row.link?.trim();
  if (!link) {
    console.warn('Bỏ qua - không có link:', row.lesson_name);
    return false;
  }

  // Kiểm tra đã tồn tại chưa (tránh duplicate)
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
    lesson_name: row.lesson_name || row.original_title || 'Bài Level 0',
    tag: row.tag || 'Nhập/Xuất',
    level: row.level || 'Level 0',
    original_title: row.original_title || row.lesson_name,
    original_link: row.link || null,
    link: row.link || null,
    cost: parseInt(row.cost || '0', 10),
    date: (row.date && row.date.length >= 10 && row.date !== '0') ? row.date : new Date().toISOString().split('T')[0],
    status: row.status || 'paid',
    contest_uploaded: row.contest_uploaded || 'Contest Level 0',
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
  const mode = args.includes('--all') ? 'all' : args.includes('--test') ? 'test' : 'preview';

  if (!fs.existsSync(CSV_PATH)) {
    console.error('Chưa có file level0_to_upload.csv. Chạy sync_level0_to_lesson_outputs.py trước.');
    process.exit(1);
  }

  const rows = await parseCsv();
  console.log(`Đã load ${rows.length} bài từ CSV.\n`);

  if (mode === 'preview') {
    console.log('Mẫu 3 bài đầu:');
    rows.slice(0, 3).forEach((r, i) => {
      console.log(`  [${i + 1}] ${r.lesson_name} | ${r.tag} | ${r.link?.substring(0, 50)}...`);
    });
    console.log('\nChạy với --test để upload 1 bài, --all để upload toàn bộ.');
    return;
  }

  if (mode === 'test') {
    const row = rows[0];
    console.log('Upload thử bài:', row.lesson_name);
    const ok = await uploadOne(row);
    console.log(ok ? 'Done.' : 'Bỏ qua (đã có).');
    return;
  }

  if (mode === 'all') {
    let success = 0;
    let skipped = 0;
    for (let i = 0; i < rows.length; i++) {
      try {
        const ok = await uploadOne(rows[i]);
        if (ok) success++;
        else skipped++;
        if ((i + 1) % 10 === 0) console.log(`  ... ${i + 1}/${rows.length}`);
      } catch (e) {
        console.error(`  [${i + 1}/${rows.length}] Lỗi:`, (e as Error).message);
      }
    }
    console.log(`\nHoàn thành: ${success} upload, ${skipped} đã có, ${rows.length - success - skipped} lỗi.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
