// Interview Stage State Machine
export enum InterviewStage {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  CONNECTING = 'CONNECTING',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

// Error reasons - only for genuine errors (not user-manipulated)
export enum ErrorReason {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  MICROPHONE_ERROR = 'MICROPHONE_ERROR',
  TAB_CLOSED = 'TAB_CLOSED',
  CONCURRENT_LIMIT_EXCEEDED = 'CONCURRENT_LIMIT_EXCEEDED',
  SERVER_ERROR = 'SERVER_ERROR',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

// Disconnect reasons - only for genuine disconnects
export type DisconnectReason = 
  | 'completed'
  | 'error'
  | 'tab_closed'
  | 'timeout'
  | null;

// Loading states
export interface LoadingState {
  isInitializing: boolean;
  isConnecting: boolean;
  isSaving: boolean;
  isCheckingCapacity: boolean;
}

// Error state
export interface ErrorState {
  hasError: boolean;
  reason: ErrorReason | null;
  message: string;
  recoverable: boolean;
}

// Timestamps for tracking
export interface TimestampState {
  startedAt: number | null;
  endedAt: number | null;
  connectedAt: number | null;
}

// Complete interview state
export interface InterviewState {
  stage: InterviewStage;
  sessionId: string | null;
  accessToken: string | null;
  configId: string | null;
  totalQuestions: number;
  loading: LoadingState;
  error: ErrorState;
  disconnectReason: DisconnectReason;
  timestamps: TimestampState;
}

// Interview record for saving
export interface InterviewRecord {
  chatGroupId: string;
  transcript: unknown[];
  status: 'COMPLETED' | 'ERROR';
  disconnectReason: DisconnectReason;
  totalQuestions: number;
  durationMs: number;
  errorReason?: ErrorReason;
}

// Session capacity response
export interface SessionCapacity {
  allowed: boolean;
  activeCount: number;
  limit: number;
  message?: string;
}

// Initial state factory
export const createInitialInterviewState = (): InterviewState => ({
  stage: InterviewStage.IDLE,
  sessionId: null,
  accessToken: null,
  configId: null,
  totalQuestions: 0,
  loading: {
    isInitializing: false,
    isConnecting: false,
    isSaving: false,
    isCheckingCapacity: false,
  },
  error: {
    hasError: false,
    reason: null,
    message: '',
    recoverable: true,
  },
  disconnectReason: null,
  timestamps: {
    startedAt: null,
    endedAt: null,
    connectedAt: null,
  },
});
