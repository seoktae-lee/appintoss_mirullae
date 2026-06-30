import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { api, clearAuth } from '../api/client';
import { BannerAd } from '../components/BannerAd';
import { AD_IDS } from '../data/adConfig';
import type { User } from '../api/types';

export function SettingsPage({
  user,
  onClose,
  onWithdraw,
  onUserUpdate,
}: {
  user: User;
  onClose: () => void;
  onWithdraw: () => void;
  onUserUpdate: (user: User) => void;
}) {
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function toggleNotification() {
    const next = !user.notificationAgreed;
    onUserUpdate({ ...user, notificationAgreed: next });
    try {
      await api.patch('/api/auth/me', { notificationAgreed: next });
    } catch {
      onUserUpdate({ ...user, notificationAgreed: !next });
    }
  }

  async function handleWithdraw() {
    setIsDeleting(true);
    try {
      await api.delete('/api/auth/me');
    } catch {}
    clearAuth();
    onWithdraw();
  }

  return (
    <div className="overlay settings-overlay" role="dialog" aria-modal="true">
      <section className="settings-page">
        <header className="settings-head">
          <button className="back-button settings-back" onClick={onClose} aria-label="닫기">
            <ChevronLeft size={22} />
          </button>
          <h2>설정</h2>
        </header>

        <div className="profile-card">
          <strong>{user.nickname ?? '미루는 사람'}</strong>
          <span>님, 오늘도 미루지 말자</span>
        </div>

        <div className="setting-list">
          <button className="setting-row" onClick={toggleNotification}>
            <span>매일 할당량 알림</span>
            <span className={`setting-switch ${user.notificationAgreed ? 'on' : ''}`} />
          </button>
          <button
            className="setting-row"
            onClick={() => window.open('https://seoktae-lee.github.io/appintoss_mirullae_terms/', '_blank')}
          >
            <span>이용약관</span>
          </button>
        </div>

        <BannerAd adGroupId={AD_IDS.BANNER_SETTINGS} />

        {confirmWithdraw ? (
          <div className="withdraw-box">
            <p className="withdraw-title">정말 탈퇴할래?</p>
            <p className="withdraw-copy">목표, 진행 기록이 전부 삭제되고 복구할 수 없어</p>
            <div className="withdraw-actions">
              <button className="button quiet" onClick={() => setConfirmWithdraw(false)}>
                취소
              </button>
              <button className="button danger" onClick={handleWithdraw} disabled={isDeleting}>
                {isDeleting ? '처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        ) : (
          <button className="withdraw-link" onClick={() => setConfirmWithdraw(true)}>
            서비스 탈퇴
          </button>
        )}
      </section>
    </div>
  );
}
