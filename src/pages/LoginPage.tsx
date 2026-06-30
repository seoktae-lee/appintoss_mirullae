import { useEffect, useState } from 'react';
import { appLogin, getAnonymousKey } from '@apps-in-toss/web-framework';
import { api, saveAuth } from '../api/client';
import type { LoginResponse } from '../api/types';

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AIT === 'true';
const asset = (path: string) => `/assets/${path}`;

export function LoginPage({ onLogin }: { onLogin: (user: LoginResponse['user']) => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleLogin() {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      let anonymousKey: string;

      if (DEV_BYPASS) {
        anonymousKey = 'dev-bypass-key';
      } else {
        const keyResult = await getAnonymousKey();
        if (!keyResult || keyResult === 'ERROR') {
          throw new Error('유저 식별키를 가져올 수 없어요.');
        }
        anonymousKey = typeof keyResult === 'object' && 'hash' in keyResult ? keyResult.hash : String(keyResult);
      }

      const response = await api.post<LoginResponse>('/api/auth/login', { anonymousKey });
      saveAuth(response.token);

      if (!DEV_BYPASS) {
        try {
          const loginResult = await appLogin();
          if (loginResult && typeof loginResult === 'object' && 'authorizationCode' in loginResult) {
            await api.post('/api/auth/refresh-toss-key', {
              authorizationCode: loginResult.authorizationCode,
              referrer: loginResult.referrer,
            });
          }
        } catch {}
      }

      onLogin(response.user);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="app login-screen">
        <div className="login-blob login-blob-a" />
        <div className="login-blob login-blob-b" />

        <img className={`login-logo ${ready ? 'in' : ''}`} src={asset('brand/logo.png')} alt="" />
        <img className={`login-wordmark ${ready ? 'in' : ''}`} src={asset('brand/wordmark.png')} alt="미룰래" />
        <p className={`login-copy ${ready ? 'in' : ''}`}>
          시험일과 목표 분량만 입력하면
          <br />
          미룬 대가의 잔인함을 숫자로 알려줄게
        </p>
        {errorMsg && <p className="login-error">{errorMsg}</p>}
        <div className={`login-cta ${ready ? 'in' : ''}`}>
          <button className="button primary wide" onClick={handleLogin} disabled={isLoading}>
            {isLoading ? '로그인 중...' : '토스로 시작하기'}
          </button>
          <p className="login-terms">
            시작하면{' '}
            <span onClick={() => window.open('https://seoktae-lee.github.io/appintoss_mirullae_terms/', '_blank')}>
              이용약관
            </span>
            에 동의합니다
          </p>
        </div>
      </section>
    </main>
  );
}
