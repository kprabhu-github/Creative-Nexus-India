<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1vqxHvRyslvL4om98iuxzpK2rYksDB-Eu

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Video Calling Module Planning

A Zoom-like in-dashboard module plan and implementation notes are available in:

- `docs/video-module-prd.md`
- `docs/jitsi-implementation-guide.md`
- `services/video/meetingModuleConfig.ts`
- `services/video/jitsiService.ts`
- `components/JitsiMeetingModule.tsx`

Current starter implementation includes:

- embedded Jitsi meeting launcher in dashboard UI
- host/participant/guest link generation
- copy-ready invitation message flow
- baseline config targeting 30 users and recording-first requirements
