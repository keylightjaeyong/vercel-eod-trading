// Supabase는 Vercel Postgres로 이전됨 (이 파일은 더 이상 사용되지 않음)

export async function getConfigValue(key: string, defaultValue: string = ''): Promise<string> {
  console.warn(`⚠️ Supabase 비활성화됨: ${key}, 기본값 사용`);
  return defaultValue;
}

export async function setConfigValue(key: string, value: string) {
  console.warn(`⚠️ Supabase 비활성화됨: ${key} 저장 불가`);
  return false;
}

export async function getConfigJSON(key: string, defaultValue: any = null) {
  console.warn(`⚠️ Supabase 비활성화됨: ${key}, 기본값 사용`);
  return defaultValue;
}

export async function setConfigJSON(key: string, value: any) {
  console.warn(`⚠️ Supabase 비활성화됨: ${key} 저장 불가`);
  return false;
}

export const supabase = null;
