import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Link2,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  Play,
  ShieldCheck,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import {
  buildMeetingLinks,
  createInviteMessage,
  createJitsiRoomName,
  loadJitsiExternalApiScript,
} from '../services/video/jitsiService';

const JITSI_DOMAIN = 'meet.jit.si';

type JoinState = 'idle' | 'loading' | 'joined' | 'failed';

type Participant = {
  name: string;
  role: 'host' | 'participant' | 'guest';
  status: 'invited' | 'joined' | 'waiting';
};

const seedParticipants: Participant[] = [
  { name: 'Ragini Rao', role: 'host', status: 'joined' },
  { name: 'Sridhar Rao', role: 'participant', status: 'invited' },
  { name: 'Aditi Mehta', role: 'participant', status: 'waiting' },
  { name: 'Karan Shah', role: 'guest', status: 'invited' },
];

const JitsiMeetingModule: React.FC = () => {
  const [programName, setProgramName] = useState('Leadership Growth Program');
  const [hostName, setHostName] = useState('Host User');
  const [email, setEmail] = useState('host@infinumgrowth.com');
  const [scheduleAt, setScheduleAt] = useState('Tomorrow, 6:00 PM IST');
  const [roomName, setRoomName] = useState(() => createJitsiRoomName('Leadership Growth Program'));
  const [joinState, setJoinState] = useState<JoinState>('idle');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [copiedRole, setCopiedRole] = useState<'host' | 'participant' | 'guest' | null>(null);
  const [errorText, setErrorText] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenShareRequested, setScreenShareRequested] = useState(false);

  const apiRef = useRef<JitsiMeetExternalAPI | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const links = useMemo(() => buildMeetingLinks(roomName, JITSI_DOMAIN), [roomName]);
  const participantLink = links.find(link => link.role === 'participant')?.url ?? '';

  useEffect(() => {
    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, []);

  const handleGenerate = () => {
    setRoomName(createJitsiRoomName(programName));
    setJoinState('idle');
    setErrorText('');
    apiRef.current?.dispose();
    apiRef.current = null;
  };

  const handleCopyInvite = async () => {
    try {
      const inviteMessage = createInviteMessage(programName, scheduleAt, participantLink);
      await navigator.clipboard.writeText(inviteMessage);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1400);
    } catch {
      setErrorText('Unable to copy invite on this browser.');
    }
  };

  const handleCopyRoleLink = async (role: 'host' | 'participant' | 'guest') => {
    const url = links.find(item => item.role === role)?.url;
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedRole(role);
      setTimeout(() => setCopiedRole(null), 1200);
    } catch {
      setErrorText('Unable to copy link on this browser.');
    }
  };

  const handleJoinEmbedded = async () => {
    if (!containerRef.current) return;

    setErrorText('');
    setJoinState('loading');
    apiRef.current?.dispose();

    try {
      await loadJitsiExternalApiScript(JITSI_DOMAIN);

      if (!window.JitsiMeetExternalAPI) {
        throw new Error('Jitsi API unavailable');
      }

      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName,
        parentNode: containerRef.current,
        width: '100%',
        height: 560,
        userInfo: { displayName: hostName, email },
        configOverwrite: {
          startWithAudioMuted: !micEnabled,
          startWithVideoMuted: !cameraEnabled,
          prejoinPageEnabled: true,
          enableNoisyMicDetection: true,
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false,
        },
      });

      api.addListener('videoConferenceJoined', () => setJoinState('joined'));
      api.addListener('readyToClose', () => setJoinState('idle'));

      apiRef.current = api;
      setJoinState('joined');
    } catch (error) {
      setJoinState('failed');
      setErrorText(error instanceof Error ? error.message : 'Failed to load embedded meeting');
    }
  };

  const handleEndCall = () => {
    apiRef.current?.dispose();
    apiRef.current = null;
    setJoinState('idle');
    setScreenShareRequested(false);
  };

  return (
    <section className="mt-10 text-left bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <Video className="w-4 h-4 text-[#d90b2d]" />
            In-Dashboard Video Call Studio
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Zoom-like meeting room for program participants with shareable links and embedded call experience.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          {joinState === 'joined' ? 'Session Live' : joinState === 'loading' ? 'Connecting...' : 'Session Ready'}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
          <h4 className="text-sm font-semibold text-slate-900">Session Setup</h4>

          <div className="space-y-2">
            <label className="text-xs text-slate-500 font-medium">Program Name</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder="Program Name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-2">
            <div className="space-y-2">
              <label className="text-xs text-slate-500 font-medium">Session Time</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                placeholder="Session time"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 font-medium">Host Name</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Host display name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-500 font-medium">Host Email</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Host email"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMicEnabled(prev => !prev)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100"
            >
              {micEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              {micEnabled ? 'Mic On' : 'Mic Off'}
            </button>

            <button
              type="button"
              onClick={() => setCameraEnabled(prev => !prev)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100"
            >
              {cameraEnabled ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
              {cameraEnabled ? 'Camera On' : 'Camera Off'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100"
            >
              <Link2 className="w-3 h-3" /> Generate New Room
            </button>
            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100"
            >
              <Copy className="w-3 h-3" /> {copyState === 'copied' ? 'Invite Copied' : 'Copy Invite'}
            </button>
          </div>
        </div>

        <div className="xl:col-span-8 space-y-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-2 bg-slate-800/90 text-[11px] text-slate-300 font-mono flex flex-wrap gap-2 justify-between">
              <span>ROOM: {roomName}</span>
              <span>Provider: Jitsi</span>
            </div>
            <div ref={containerRef} className="min-h-[180px] bg-slate-950" />

            <div className="px-4 py-3 border-t border-slate-700 bg-slate-900 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleJoinEmbedded}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#d90b2d] text-white hover:bg-[#111113] text-xs"
              >
                <Play className="w-3 h-3" /> {joinState === 'loading' ? 'Launching...' : 'Launch Embedded Call'}
              </button>

              <button
                type="button"
                onClick={() => setScreenShareRequested(prev => !prev)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 text-xs"
              >
                <MonitorUp className="w-3 h-3" />
                {screenShareRequested ? 'Screen Share Requested' : 'Request Screen Share'}
              </button>

              <button
                type="button"
                onClick={handleEndCall}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500 text-red-300 hover:bg-red-950/50 text-xs"
              >
                <Phone className="w-3 h-3" /> End Session
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <h5 className="text-sm font-semibold text-slate-900">Participant Join Links</h5>
              {links.map((link) => (
                <div key={link.role} className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="uppercase font-semibold text-slate-500">{link.role}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyRoleLink(link.role)}
                      className="inline-flex items-center gap-1 text-[#d90b2d] hover:text-[#111113]"
                    >
                      <Copy className="w-3 h-3" /> {copiedRole === link.role ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-slate-600 break-all hover:text-slate-900">
                    {link.url}
                  </a>
                </div>
              ))}

              <a
                href={participantLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-[#d90b2d] hover:text-[#111113]"
              >
                <ExternalLink className="w-3 h-3" /> Open participant link in new tab
              </a>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <h5 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4" /> Session Roster
              </h5>
              <div className="space-y-2">
                {seedParticipants.map((person) => (
                  <div key={person.name} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
                    <div>
                      <p className="font-medium text-slate-800">{person.name}</p>
                      <p className="text-slate-500 uppercase">{person.role}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                        person.status === 'joined'
                          ? 'bg-emerald-100 text-emerald-700'
                          : person.status === 'waiting'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {person.status}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Tip: Send host link only to facilitators. Participants should receive participant/guest link.
              </p>
            </div>
          </div>

          {errorText && <p className="text-xs text-red-600">Error: {errorText}</p>}
        </div>
      </div>
    </section>
  );
};

export default JitsiMeetingModule;
