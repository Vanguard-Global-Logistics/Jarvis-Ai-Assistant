import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '@jarvis/contracts/ipc/channels';
import type {
  AmplifierResult,
  AmplifyRequest,
  AppInfo,
  ChatReply,
  ChatRequest,
  DeleteSessionResult,
  MemoryDeleteResult,
  MemoryInspectionResult,
  SaveSessionRequest,
  SavedSession,
  SavedSessionSummary,
} from '@jarvis/contracts';

/**
 * Preload — the only bridge between the untrusted renderer and the trusted main
 * process. Named functions only; never add a generic invoke passthrough.
 */
const api = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(CHANNELS.appGetInfo) as Promise<AppInfo>,

  sendChat: (request: ChatRequest): Promise<ChatReply> =>
    ipcRenderer.invoke(CHANNELS.jarvisChat, request) as Promise<ChatReply>,

  amplify: (idea: string): Promise<AmplifierResult> =>
    ipcRenderer.invoke(CHANNELS.jarvisAmplify, {
      idea,
    } satisfies AmplifyRequest) as Promise<AmplifierResult>,

  saveSession: (request: SaveSessionRequest): Promise<SavedSession> =>
    ipcRenderer.invoke(CHANNELS.historySave, request) as Promise<SavedSession>,

  listSessions: (): Promise<SavedSessionSummary[]> =>
    ipcRenderer.invoke(CHANNELS.historyList) as Promise<SavedSessionSummary[]>,

  getSession: (id: string): Promise<SavedSession | null> =>
    ipcRenderer.invoke(CHANNELS.historyGet, { id }) as Promise<SavedSession | null>,

  deleteSession: (id: string): Promise<DeleteSessionResult> =>
    ipcRenderer.invoke(CHANNELS.historyDelete, { id }) as Promise<DeleteSessionResult>,

  /** Renderer cannot supply profile identity or read-policy flags. */
  inspectMemory: (): Promise<MemoryInspectionResult> =>
    ipcRenderer.invoke(CHANNELS.memoryInspect) as Promise<MemoryInspectionResult>,

  /** Renderer supplies only the opaque id of a memory already presented to it. */
  deleteMemory: (id: string): Promise<MemoryDeleteResult> =>
    ipcRenderer.invoke(CHANNELS.memoryDelete, { id }) as Promise<MemoryDeleteResult>,
} as const;

export type JarvisApi = typeof api;

contextBridge.exposeInMainWorld('jarvis', api);
