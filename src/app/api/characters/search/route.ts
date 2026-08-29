import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/config/backend.config';
import { getClientIP } from '@/lib/utils';
import { detectSQLInjection, validateCharacterName } from '@/lib/security';
import { securityMiddleware } from '@/lib/security-middleware';
import {
  isDatabaseConfigured,
  searchCharactersInDatabase,
  type CharacterSearchRow,
} from '@/lib/character-search';

function transformSearchRow(char: Record<string, unknown>): CharacterSearchRow {
  return {
    account: String(char.account ?? char.AccountID ?? ''),
    character: String(char.character ?? char.Name ?? ''),
    class: Number(char.class ?? char.Class ?? 0),
    resets: Number(char.resets ?? char.ResetCount ?? char.score ?? char.Score ?? 0),
    level: Number(char.level ?? char.cLevel ?? 0),
    pkcount: Number(char.pkcount ?? char.PkCount ?? 0),
    isOnline: Number(char.isOnline ?? char.IsOnline ?? 0),
  };
}

async function searchViaBackend(name: string): Promise<CharacterSearchRow[] | null> {
  const backendUrl = new URL(getBackendUrl('/api/rankings/search'));
  backendUrl.searchParams.set('name', name);

  const backendResponse = await fetch(backendUrl.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });

  if (backendResponse.status === 404) {
    return null;
  }

  if (!backendResponse.ok) {
    throw new Error(`Backend search HTTP ${backendResponse.status}`);
  }

  const backendData = await backendResponse.json();
  if (!backendData.success || !Array.isArray(backendData.data)) {
    throw new Error(backendData.message || 'Backend search response invalid');
  }

  return backendData.data.map((char: Record<string, unknown>) => transformSearchRow(char));
}

export async function GET(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    const securityCheck = await securityMiddleware(request, '/api/characters/search');
    if (securityCheck && !securityCheck.allowed) {
      return NextResponse.json(
        { success: false, message: securityCheck.error || 'Request không hợp lệ' },
        { status: securityCheck.statusCode || 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const characterName = searchParams.get('name')?.trim() ?? '';

    if (!characterName) {
      return NextResponse.json(
        { success: false, message: 'Tên nhân vật không được để trống' },
        { status: 400 }
      );
    }

    if (characterName.length > 10) {
      return NextResponse.json(
        { success: false, message: 'Tên nhân vật quá dài' },
        { status: 400 }
      );
    }

    if (detectSQLInjection(characterName)) {
      return NextResponse.json(
        { success: false, message: 'Input không hợp lệ' },
        { status: 400 }
      );
    }

    const nameValidation = validateCharacterName(characterName);
    if (!nameValidation.valid) {
      return NextResponse.json(
        { success: false, message: nameValidation.error || 'Tên nhân vật không hợp lệ' },
        { status: 400 }
      );
    }

    let results: CharacterSearchRow[] | null = null;
    let source: 'backend' | 'database' = 'database';

    try {
      results = await searchViaBackend(characterName);
      if (results) {
        source = 'backend';
      }
    } catch (error) {
      console.warn('[api/characters/search] Backend search failed:', error);
    }

    if (!results) {
      if (!isDatabaseConfigured()) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Không tìm được nhân vật — backend chưa có API /api/rankings/search (cần cập nhật backend) hoặc chưa cấu hình DB trên server web.',
          },
          { status: 503 }
        );
      }

      results = await searchCharactersInDatabase(characterName);
      source = 'database';
    }

    return NextResponse.json({
      success: true,
      data: results,
      message:
        results.length > 0
          ? `Tìm thấy ${results.length} kết quả cho "${characterName}"`
          : `Không tìm thấy nhân vật "${characterName}" trên server`,
      isSearch: true,
      meta: { source, clientIP: clientIP.slice(0, 8) + '…' },
    });
  } catch (error) {
    console.error('[api/characters/search]', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi khi tìm kiếm nhân vật. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}
