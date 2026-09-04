import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;
let supabaseError: string | null = null;

function getSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      supabaseError = `Supabase 환경변수 누락: URL=${!!supabaseUrl}, Key=${!!supabaseAnonKey}`;
      console.error('❌', supabaseError);
      return null;
    }

    try {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
      console.log('✅ Supabase 클라이언트 초기화 성공');
    } catch (error) {
      supabaseError = `Supabase 초기화 실패: ${error}`;
      console.error('❌', supabaseError);
      return null;
    }
  }

  return supabaseClient;
}

export const supabase = new Proxy({} as any, {
  get(target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error(supabaseError || 'Supabase 클라이언트를 초기화할 수 없습니다');
    }
    return client[prop];
  },
});

/**
 * Supabase에서 설정 값 가져오기
 */
export async function getConfigValue(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const client = getSupabase();
    if (!client) {
      console.warn(`⚠️ Supabase 미연결: ${key}, 기본값 사용`);
      return defaultValue;
    }

    const { data, error } = await client
      .from('trading_config')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`⚠️ 설정값 없음: ${key}, 기본값 사용`);
      } else {
        console.error(`❌ Supabase 조회 에러 (${key}):`, error.message);
      }
      return defaultValue;
    }

    console.log(`✅ 설정값 로드: ${key} = ${data?.value}`);
    return data?.value || defaultValue;
  } catch (error) {
    console.error(`❌ Supabase 조회 실패 (${key}):`, error);
    return defaultValue;
  }
}

/**
 * Supabase에 설정 값 저장
 */
export async function setConfigValue(key: string, value: string) {
  try {
    const client = getSupabase();
    if (!client) {
      console.error(`❌ Supabase 미연결: ${key} 저장 불가`);
      return false;
    }

    const { error } = await client
      .from('trading_config')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      console.error(`❌ 설정 저장 실패 (${key}):`, error.message);
      return false;
    }

    console.log(`✅ 설정 저장됨: ${key} = ${value}`);
    return true;
  } catch (error) {
    console.error(`❌ Supabase 저장 실패 (${key}):`, error);
    return false;
  }
}

/**
 * Supabase에서 JSON 설정 가져오기
 */
export async function getConfigJSON(key: string, defaultValue: any = null) {
  try {
    const value = await getConfigValue(key, '');
    if (!value) return defaultValue;
    return JSON.parse(value);
  } catch (error) {
    console.error('JSON 파싱 실패:', error);
    return defaultValue;
  }
}

/**
 * Supabase에 JSON 설정 저장
 */
export async function setConfigJSON(key: string, value: any) {
  return setConfigValue(key, JSON.stringify(value));
}
