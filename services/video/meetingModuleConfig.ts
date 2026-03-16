export type MeetingProvider = 'jitsi' | 'zoom_backup' | 'google_meet';

export type MeetingRole = 'host' | 'co_host' | 'participant' | 'guest';

export interface MeetingModuleConfig {
  defaultProvider: MeetingProvider;
  allowedProviders: MeetingProvider[];
  maxParticipantsPerSession: number;
  recordingFromDayOne: boolean;
  allowGuestJoinLinks: boolean;
  remindersInMinutes: number[];
  enableZoomFallback: boolean;
  regionHint: 'india' | 'global';
}

export const meetingModuleConfig: MeetingModuleConfig = {
  defaultProvider: 'jitsi',
  allowedProviders: ['jitsi', 'zoom_backup'],
  maxParticipantsPerSession: 30,
  recordingFromDayOne: true,
  allowGuestJoinLinks: true,
  remindersInMinutes: [24 * 60, 60, 10],
  enableZoomFallback: true,
  regionHint: 'india',
};

export function shouldOfferFallback(joinErrorCount: number): boolean {
  return meetingModuleConfig.enableZoomFallback && joinErrorCount > 0;
}

export function isRoleAllowedToRecord(role: MeetingRole): boolean {
  return role === 'host' || role === 'co_host';
}
