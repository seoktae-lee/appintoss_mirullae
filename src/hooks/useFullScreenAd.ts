import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AIT === 'true';

export async function playInterstitialAd(adGroupId: string): Promise<void> {
  if (DEV_BYPASS) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return;
  }

  if (!loadFullScreenAd.isSupported() || !showFullScreenAd.isSupported()) return;

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    loadFullScreenAd({
      options: { adGroupId },
      onEvent: () => {
        showFullScreenAd({
          options: { adGroupId },
          onEvent: (event) => {
            if (event.type === 'dismissed' || event.type === 'failedToShow') finish();
          },
          onError: finish,
        });
      },
      onError: finish,
    });
  });
}
