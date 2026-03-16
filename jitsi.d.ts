declare class JitsiMeetExternalAPI {
  constructor(domain: string, options: {
    roomName: string;
    parentNode: HTMLElement;
    width?: string | number;
    height?: string | number;
    userInfo?: { displayName?: string; email?: string };
    configOverwrite?: Record<string, unknown>;
    interfaceConfigOverwrite?: Record<string, unknown>;
  });

  addListener(event: string, listener: (...args: unknown[]) => void): void;
  executeCommand(command: string, ...args: unknown[]): void;
  dispose(): void;
}

interface Window {
  JitsiMeetExternalAPI?: typeof JitsiMeetExternalAPI;
}
