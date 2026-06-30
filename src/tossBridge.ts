export type SharePayload = {
  title: string;
  text: string;
  url?: string;
};

type TossWindow = Window & {
  AppsInToss?: {
    getTossShareLink?: (payload: SharePayload) => Promise<string> | string;
  };
};

export async function shareMirullae(payload: SharePayload) {
  const toss = (window as TossWindow).AppsInToss;

  if (toss?.getTossShareLink) {
    const link = await toss.getTossShareLink(payload);
    await navigator.clipboard?.writeText(String(link));
    return { type: 'toss-link' as const, link: String(link) };
  }

  if (navigator.share) {
    await navigator.share(payload);
    return { type: 'native-share' as const };
  }

  await navigator.clipboard?.writeText(`${payload.title}\n${payload.text}`);
  return { type: 'clipboard' as const };
}
