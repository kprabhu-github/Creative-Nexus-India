export interface JitsiMeetingInput {
  roomName: string;
  displayName: string;
  email?: string;
  subject?: string;
  domain?: string;
}

export interface JitsiInviteLink {
  role: 'host' | 'participant' | 'guest';
  url: string;
}

const DEFAULT_DOMAIN = 'meet.jit.si';

const sanitizeRoomName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export function createJitsiRoomName(programName: string): string {
  const base = sanitizeRoomName(programName || 'infinumgrowth-session');
  const timestamp = Date.now().toString(36);
  return `${base}-${timestamp}`;
}

export function buildMeetingLinks(roomName: string, domain = DEFAULT_DOMAIN): JitsiInviteLink[] {
  const safeRoom = sanitizeRoomName(roomName);
  const baseUrl = `https://${domain}/${safeRoom}`;

  return [
    { role: 'host', url: `${baseUrl}#config.startWithAudioMuted=false` },
    { role: 'participant', url: baseUrl },
    { role: 'guest', url: `${baseUrl}#config.prejoinPageEnabled=true` },
  ];
}

export function createInviteMessage(programName: string, scheduledAt: string, participantUrl: string): string {
  return [
    `You are invited to ${programName}.`,
    `Schedule: ${scheduledAt}`,
    `Join Link: ${participantUrl}`,
    '',
    'Please join 5 minutes early and test your audio/video.',
  ].join('\n');
}

export function loadJitsiExternalApiScript(domain = DEFAULT_DOMAIN): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));

  if ((window as Window & { JitsiMeetExternalAPI?: unknown }).JitsiMeetExternalAPI) {
    return Promise.resolve();
  }

  const existingScript = document.querySelector<HTMLScriptElement>('script[data-jitsi-external-api="true"]');
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed loading Jitsi script')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.dataset.jitsiExternalApi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed loading Jitsi script'));
    document.body.appendChild(script);
  });
}
