# InfinumGrowth Video Calling Module Plan (Zoom-like, In-dashboard)

## Confirmed Product Decisions

- Architecture strategy: **not LiveKit-first**.
- Session capacity target: **~30 concurrent users per session**.
- Recording requirement: **required from Day 1**.
- Access model: **signed-in users + guest join link support**.

## Clarification of Open Points

### India-first deployment (what this means)
India-first means deploying the media and signaling stack in (or near) India regions first to reduce latency for Indian users and simplify regulatory alignment. For your case:

- Prefer Mumbai / India region for core backend or nearest low-latency region.
- Keep data residency options documented for future compliance needs.
- Test round-trip latency and packet loss with Indian ISPs.

### Zoom fallback (what this means)
Fallback means if your in-app calling session cannot be established due to browser/network/firewall issues, the system automatically provides a backup Zoom meeting URL so sessions still happen on time.

- Default path: join in-app room.
- Failure path: one-click "Join backup Zoom room".
- Benefit: protects business continuity during rollout.

## Recommended Technical Direction (No LiveKit-first)

To avoid long-term platform lock-in while still shipping quickly, implement a provider-agnostic meeting layer:

1. **Primary in-app provider**: self-hosted Jitsi (fastest non-vendor-lock option for 30 users).
2. **Backup provider**: Zoom link fallback only when in-app join fails.
3. **Google Meet**: optional manual fallback in admin settings if required.

> Why Jitsi here: lower complexity than mediasoup, good feature baseline for 30-user sessions, recording support via Jibri.

## MVP Features (Zoom-like baseline)

### Host controls
- Start/end meeting
- Mute participant / mute all
- Remove participant
- Lock room
- Screen share
- Chat panel
- Raise-hand queue

### Participant experience
- Join via signed-in dashboard or secure guest link
- Audio/video controls
- Screen share (optional by role)
- Chat and reactions
- Reconnect handling on network drop

### Recording (Day 1)
- Host-controlled recording start/stop
- Persist recording metadata in database
- Expose recording URL in session detail page
- Mark processing state and failure reason if any

## Data Model Additions

Add the following entities to your existing schema:

- `meeting_rooms`
- `meeting_sessions`
- `meeting_participants`
- `meeting_invites`
- `meeting_recordings`
- `meeting_events`

Key fields to include:

- `provider` (`jitsi`, `zoom_backup`, `google_meet`)
- `external_room_id`
- `host_join_url`, `participant_join_url`, `guest_join_url`
- `scheduled_start_at`, `scheduled_end_at`
- `session_status` (`scheduled`, `live`, `ended`, `cancelled`)
- `recording_status` (`pending`, `recording`, `processing`, `ready`, `failed`)
- `attendance_duration_sec`
- `backup_meeting_url`

## API Contract (suggested)

- `POST /api/meetings` → create scheduled meeting + invite payload
- `POST /api/meetings/:id/join-token` → issue host/participant/guest join token
- `POST /api/meetings/:id/start` → host starts session
- `POST /api/meetings/:id/end` → host ends session
- `POST /api/meetings/:id/recording/start`
- `POST /api/meetings/:id/recording/stop`
- `POST /api/meetings/:id/fallback` → fetch fallback URL
- `POST /api/webhooks/jitsi` and `POST /api/webhooks/zoom` for event sync

## Invitation & Reminder Flow

When user is signed in for a program:

1. Auto-create `meeting_session` for each workshop/coaching slot.
2. Generate participant and optional guest links.
3. Send:
   - confirmation email
   - calendar invite (.ics)
   - in-app notification
4. Reminder schedule:
   - 24h before
   - 1h before
   - 10 min before
5. If join failure detected, surface fallback Zoom button.

## Security Controls

- Short-lived signed join tokens for guest links.
- Waiting room enabled by default for guests.
- Host-only recording permissions.
- Audit log for moderation actions (mute/remove/lock/record).
- Do not expose direct room credentials to frontend.

## Release Plan

### Phase 1 (Core, 2 weeks)
- Meeting scheduling + invite links
- Embedded in-dashboard Jitsi room
- Basic host/participant controls
- Attendance logging

### Phase 2 (Reliability, 1-2 weeks)
- Recording lifecycle + playback links
- Reminder automation
- Zoom fallback path

### Phase 3 (Insights, 1 week)
- Session analytics (join rate, avg duration)
- Host quality report
- Failure reason dashboard

## Success Metrics

- Join success rate >= 97%
- Median join time < 12 seconds
- Session drop-off due to tech issues < 3%
- Recording success rate >= 95%

