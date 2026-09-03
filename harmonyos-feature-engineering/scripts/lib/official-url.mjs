const PAGE_HOST = "developer.huawei.com"

export class OfficialUrlError extends Error {
  constructor(message) {
    super(message)
    this.name = "OfficialUrlError"
  }
}

function parseSecureUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new OfficialUrlError("URL 无效")
  }
  if (parsed.protocol.toLowerCase() !== "https:") throw new OfficialUrlError("只允许 HTTPS URL")
  if (parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) {
    throw new OfficialUrlError("URL 不得包含凭据或非标准端口")
  }
  return parsed
}

export function isOfficialHuaweiHost(hostname) {
  const host = String(hostname).toLowerCase()
  return host === PAGE_HOST || host.endsWith(`.${PAGE_HOST}`)
}

export function validateOfficialPageUrl(value) {
  const parsed = parseSecureUrl(value)
  if (parsed.hostname.toLowerCase() !== PAGE_HOST) {
    throw new OfficialUrlError("只允许 https://developer.huawei.com 官方页面 URL")
  }
  parsed.hash = ""
  return parsed.toString()
}

export function validateOfficialFinalUrl(value) {
  const parsed = parseSecureUrl(value)
  if (!isOfficialHuaweiHost(parsed.hostname)) throw new OfficialUrlError("重定向离开了官方域名")
  parsed.hash = ""
  return parsed.toString()
}
