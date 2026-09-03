import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Supabase에서 설정 값 가져오기
 */
export async function getConfigValue(key: string, defaultValue: string = '') {
  try {
    const { data, error } = await supabase
      .from('trading_config')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      console.log(`⚠️ 설정값 없음: ${key}, 기본값 사용`);
      return defaultValue;
    }

    return data?.value || defaultValue;
  } catch (error) {
    console.error('Supabase 조회 실패:', error);
    return defaultValue;
  }
}

/**
 * Supabase에 설정 값 저장
 */
export async function setConfigValue(key: string, value: string) {
  try {
    const { error } = await supabase
      .from('trading_config')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('설정 저장 실패:', error);
      return false;
    }

    console.log(`✅ 설정 저장됨: ${key}`);
    return true;
  } catch (error) {
    console.error('Supabase 저장 실패:', error);
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
