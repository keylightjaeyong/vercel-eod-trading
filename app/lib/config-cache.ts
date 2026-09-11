// 공유 설정 캐시 (메모리 기반)
let cachedConfig: any = null;

export function getConfigCache() {
  return cachedConfig;
}

export function setConfigCache(config: any) {
  cachedConfig = config;
  console.log('💾 설정 캐시 업데이트:', { enabled: config?.global_settings?.enabled });
}

export function clearConfigCache() {
  cachedConfig = null;
}
