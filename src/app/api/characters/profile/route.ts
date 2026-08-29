import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/config/backend.config';
import { getClientIP } from '@/lib/utils';
import { getMuClassName } from '@/lib/mu-classes';
import { securityMiddleware, validateAccountIdWithLogging } from '@/lib/security-middleware';
import { validateCharacterName } from '@/lib/security';

type BackendCharacter = {
  Name?: string;
  cLevel?: number;
  Class?: number;
  Strength?: number;
  Dexterity?: number;
  Vitality?: number;
  Energy?: number;
  Leadership?: number;
  ResetCount?: number;
  LevelUpPoint?: number;
};

export async function GET(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);

    const securityCheck = await securityMiddleware(request, '/api/characters/profile');
    if (securityCheck && !securityCheck.allowed) {
      return NextResponse.json(
        { success: false, message: securityCheck.error || 'Request không hợp lệ' },
        { status: securityCheck.statusCode || 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId')?.trim() ?? '';
    const characterName = searchParams.get('name')?.trim() ?? '';

    if (!accountId || !characterName) {
      return NextResponse.json(
        { success: false, message: 'Thiếu accountId hoặc tên nhân vật' },
        { status: 400 }
      );
    }

    const accountIdValidation = validateAccountIdWithLogging(accountId, '/api/characters/profile', clientIP);
    if (!accountIdValidation.valid) {
      return NextResponse.json(
        { success: false, message: accountIdValidation.error || 'Account ID không hợp lệ' },
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

    const backendResponse = await fetch(
      getBackendUrl(`/api/characters?accountId=${encodeURIComponent(accountId)}`),
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!backendResponse.ok) {
      return NextResponse.json(
        { success: false, message: `Không lấy được thông tin nhân vật (HTTP ${backendResponse.status})` },
        { status: backendResponse.status }
      );
    }

    const backendData = await backendResponse.json();
    if (!backendData.success || !Array.isArray(backendData.data)) {
      return NextResponse.json(
        { success: false, message: backendData.message || 'Dữ liệu nhân vật không hợp lệ' },
        { status: 502 }
      );
    }

    const match = (backendData.data as BackendCharacter[]).find(
      (char) => String(char.Name ?? '').toLowerCase() === characterName.toLowerCase()
    );

    if (!match) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy nhân vật' },
        { status: 404 }
      );
    }

    const classId = Number(match.Class ?? 0);

    return NextResponse.json({
      success: true,
      data: {
        name: String(match.Name ?? characterName),
        class: classId,
        className: getMuClassName(classId),
        level: Number(match.cLevel ?? 0),
        reset: Number(match.ResetCount ?? 0),
        points: match.LevelUpPoint != null ? Number(match.LevelUpPoint) : null,
        str: Number(match.Strength ?? 0),
        agi: Number(match.Dexterity ?? 0),
        vit: Number(match.Vitality ?? 0),
        ene: Number(match.Energy ?? 0),
        cmd: Number(match.Leadership ?? 0),
      },
    });
  } catch (error) {
    console.error('[api/characters/profile]', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi kết nối đến server. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
}
