import sql from 'mssql';
import { connectToDatabase } from '@/lib/database';

export type CharacterSearchRow = {
  account: string;
  character: string;
  class: number;
  resets: number;
  level: number;
  pkcount: number;
  isOnline: number;
};

export function isDatabaseConfigured(): boolean {
  const server = process.env.DB_SERVER?.trim();
  const name = process.env.DB_NAME?.trim();
  return (
    !!server &&
    server !== 'your-server-ip' &&
    !!name &&
    name !== 'your-database-name'
  );
}

/** Tìm nhân vật theo tên trên toàn server (không giới hạn top 100). */
export async function searchCharactersInDatabase(name: string): Promise<CharacterSearchRow[]> {
  const trimmed = name.trim();
  const pool = await connectToDatabase();

  try {
    const result = await pool
      .request()
      .input('characterName', sql.NVarChar(50), `%${trimmed}%`)
      .query(`
        SELECT TOP 20
          RTRIM(c.AccountID) AS account,
          RTRIM(c.Name) AS character,
          c.Class AS class,
          c.ResetCount AS resets,
          c.cLevel AS level,
          c.PkCount AS pkcount,
          CASE WHEN ms.ConnectStat = 1 THEN 1 ELSE 0 END AS isOnline
        FROM Character c
        LEFT JOIN MEMB_STAT ms ON RTRIM(c.AccountID) = RTRIM(ms.memb___id)
        WHERE RTRIM(c.Name) LIKE @characterName
        ORDER BY c.ResetCount DESC, c.cLevel DESC
      `);

    return result.recordset.map((row: Record<string, unknown>) => ({
      account: String(row.account ?? ''),
      character: String(row.character ?? ''),
      class: Number(row.class ?? 0),
      resets: Number(row.resets ?? 0),
      level: Number(row.level ?? 0),
      pkcount: Number(row.pkcount ?? 0),
      isOnline: Number(row.isOnline ?? 0),
    }));
  } finally {
    await pool.close();
  }
}
