import { useEffect, useState } from 'react';
import { api } from '../api/client';

const asset = (path: string) => `/assets/${path}`;

export function NicknamePage({ onDone }: { onDone: (nickname: string) => void }) {
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 80);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit() {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('별명을 입력해줘!');
      return;
    }
    if (trimmed.length > 10) {
      setError('10자 이내로 입력해줘!');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.patch('/api/auth/me', { nickname: trimmed });
      onDone(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="app login-screen">
        <div className="login-blob login-blob-a" />
        <div className="login-blob login-blob-b" />

        <img className={`login-logo ${ready ? 'in' : ''}`} src={asset('characters/happy_1.png')} alt="" />
        <h1 className={ready ? 'in' : ''}>뭐라고 불러줄까?</h1>
        <p className={`login-copy ${ready ? 'in' : ''}`}>미룰래가 부를 별명을 알려줘</p>
        <div className={`login-cta ${ready ? 'in' : ''}`}>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value.slice(0, 10))}
            placeholder="별명 입력 (최대 10자)"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSubmit();
            }}
          />
          <p className="login-error">{error || `${nickname.length}/10`}</p>
          <button className="button primary wide" onClick={handleSubmit} disabled={isLoading || !nickname.trim()}>
            {isLoading ? '저장 중...' : '시작하기'}
          </button>
        </div>
      </section>
    </main>
  );
}
