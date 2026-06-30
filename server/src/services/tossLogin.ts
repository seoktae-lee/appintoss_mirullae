import https from "node:https";

function createMtlsAgent(): https.Agent | null {
  const certB64 = process.env.MTLS_CERT_B64;
  const keyB64 = process.env.MTLS_KEY_B64;
  if (!certB64 || !keyB64) return null;
  try {
    return new https.Agent({
      cert: Buffer.from(certB64, "base64"),
      key: Buffer.from(keyB64, "base64"),
    });
  } catch {
    return null;
  }
}

const mtlsAgent = createMtlsAgent();

function request<T>(
  method: "GET" | "POST",
  path: string,
  headers: Record<string, string>,
  body?: object
): Promise<T> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        hostname: "apps-in-toss-api.toss.im",
        path,
        method,
        agent: mtlsAgent ?? undefined,
        headers: {
          "Content-Type": "application/json",
          ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`JSON parse 실패: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

interface TokenResponse {
  resultType: string;
  success?: { accessToken: string; refreshToken: string };
  error?: { errorCode: string; reason: string };
}

interface LoginMeResponse {
  resultType: string;
  success?: { userKey: number };
  error?: unknown;
}

export async function getTossUserKey(
  authorizationCode: string,
  referrer: string
): Promise<number | null> {
  try {
    const tokenRes = await request<TokenResponse>(
      "POST",
      "/api-partner/v1/apps-in-toss/user/oauth2/generate-token",
      {},
      { authorizationCode, referrer }
    );

    if (tokenRes.resultType !== "SUCCESS" || !tokenRes.success?.accessToken) {
      console.error("[토스로그인] 토큰 발급 실패", tokenRes.error);
      return null;
    }

    const meRes = await request<LoginMeResponse>(
      "GET",
      "/api-partner/v1/apps-in-toss/user/oauth2/login-me",
      { Authorization: `Bearer ${tokenRes.success.accessToken}` }
    );

    if (meRes.resultType !== "SUCCESS" || !meRes.success?.userKey) {
      console.error("[토스로그인] 유저키 조회 실패", meRes.error);
      return null;
    }

    return meRes.success.userKey;
  } catch (e) {
    console.error("[토스로그인] 오류", e);
    return null;
  }
}
