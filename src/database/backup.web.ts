// P2.2 — Web stub: SQLite backup v8 stays Android-only (P2.5+/v9 later).

export async function exportBackup(): Promise<void> {
  throw new Error('Sao lưu JSON chưa hỗ trợ trên Web.');
}

export async function importBackup(): Promise<{ success: boolean; message: string }> {
  return { success: false, message: 'Khôi phục backup chưa hỗ trợ trên Web.' };
}
