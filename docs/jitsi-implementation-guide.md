# How to Build Jitsi In-Dashboard Calling (Code Guide)

This repository now includes a working starter module you can extend.

## What was added

- `components/JitsiMeetingModule.tsx`
  - UI to create room names
  - Generates host/participant/guest links
  - Copies invitation text for participants
  - Launches embedded Jitsi meeting inside dashboard
- `services/video/jitsiService.ts`
  - room/link helper functions
  - invite message helper
  - dynamic loader for Jitsi `external_api.js`
- `jitsi.d.ts`
  - TypeScript type declarations for `window.JitsiMeetExternalAPI`

## How to use in your flow

The module is mounted in `components/Success.tsx` as a starter. You can move it to your dashboard route later.

## Production checklist

1. Replace public `meet.jit.si` with your own Jitsi domain.
2. Add backend API for:
   - authenticated room creation
   - signed guest tokens
   - invite email + calendar .ics dispatch
   - attendance and recording event logging
3. Turn on recording infrastructure (Jibri) and persist recording metadata.
4. Add role checks so only host/co-host can mute/remove/record.
5. Add fallback button that opens a backup Zoom link when embed fails.

## Suggested API routes (next step)

- `POST /api/video/sessions`
- `POST /api/video/sessions/:id/invites`
- `POST /api/video/sessions/:id/recording/start`
- `POST /api/video/sessions/:id/recording/stop`
- `POST /api/video/webhooks/jitsi`

