import { useReducer, useMemo } from 'react';
import {
  InterviewState,
  InterviewStage,
  ErrorReason,
  DisconnectReason,
  createInitialInterviewState,
} from '../types/interview';

// Action types - simplified, no question tracking
type InterviewAction =
  | { type: 'START_INITIALIZING' }
  | { type: 'INITIALIZATION_SUCCESS'; payload: { accessToken: string; configId: string } }
  | { type: 'INITIALIZATION_FAILED'; payload: { reason: ErrorReason; message: string } }
  | { type: 'START_CONNECTING'; payload: { totalQuestions: number } }
  | { type: 'CONNECTION_SUCCESS'; payload: { sessionId: string } }
  | { type: 'CONNECTION_FAILED'; payload: { reason: ErrorReason; message: string } }
  | { type: 'INTERVIEW_STARTED' }
  | { type: 'INTERVIEW_COMPLETED' }
  | { type: 'DISCONNECT'; payload: { reason: DisconnectReason; errorReason?: ErrorReason; message?: string } }
  | { type: 'START_SAVING' }
  | { type: 'SAVE_COMPLETE' }
  | { type: 'SAVE_FAILED' }
  | { type: 'CAPACITY_CHECK_START' }
  | { type: 'CAPACITY_CHECK_FAILED'; payload: { message: string } }
  | { type: 'RESET' };

// Reducer function
function interviewReducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case 'START_INITIALIZING':
      return {
        ...state,
        stage: InterviewStage.INITIALIZING,
        loading: { ...state.loading, isInitializing: true },
        error: { hasError: false, reason: null, message: '', recoverable: true },
      };

    case 'INITIALIZATION_SUCCESS':
      return {
        ...state,
        stage: InterviewStage.IDLE,
        accessToken: action.payload.accessToken,
        configId: action.payload.configId,
        loading: { ...state.loading, isInitializing: false },
      };

    case 'INITIALIZATION_FAILED':
      return {
        ...state,
        stage: InterviewStage.ERROR,
        loading: { ...state.loading, isInitializing: false },
        error: {
          hasError: true,
          reason: action.payload.reason,
          message: action.payload.message,
          recoverable: action.payload.reason !== ErrorReason.AUTH_ERROR,
        },
      };

    case 'CAPACITY_CHECK_START':
      return {
        ...state,
        loading: { ...state.loading, isCheckingCapacity: true },
      };

    case 'CAPACITY_CHECK_FAILED':
      return {
        ...state,
        stage: InterviewStage.ERROR,
        loading: { ...state.loading, isCheckingCapacity: false },
        error: {
          hasError: true,
          reason: ErrorReason.CONCURRENT_LIMIT_EXCEEDED,
          message: action.payload.message,
          recoverable: true,
        },
      };

    case 'START_CONNECTING':
      return {
        ...state,
        stage: InterviewStage.CONNECTING,
        loading: { ...state.loading, isConnecting: true, isCheckingCapacity: false },
        totalQuestions: action.payload.totalQuestions,
        timestamps: { ...state.timestamps, startedAt: Date.now() },
      };

    case 'CONNECTION_SUCCESS':
      return {
        ...state,
        stage: InterviewStage.READY,
        sessionId: action.payload.sessionId,
        loading: { ...state.loading, isConnecting: false },
        timestamps: { ...state.timestamps, connectedAt: Date.now() },
      };

    case 'CONNECTION_FAILED':
      return {
        ...state,
        stage: InterviewStage.ERROR,
        loading: { ...state.loading, isConnecting: false },
        error: {
          hasError: true,
          reason: action.payload.reason,
          message: action.payload.message,
          recoverable: true,
        },
      };

    case 'INTERVIEW_STARTED':
      return {
        ...state,
        stage: InterviewStage.IN_PROGRESS,
      };

    case 'INTERVIEW_COMPLETED':
      return {
        ...state,
        stage: InterviewStage.COMPLETED,
        disconnectReason: 'completed',
        timestamps: { ...state.timestamps, endedAt: Date.now() },
      };

    case 'DISCONNECT': {
      return {
        ...state,
        stage: InterviewStage.ERROR,
        disconnectReason: action.payload.reason,
        loading: { ...state.loading, isConnecting: false },
        timestamps: { ...state.timestamps, endedAt: Date.now() },
        error: {
          hasError: true,
          reason: action.payload.errorReason || ErrorReason.UNKNOWN,
          message: action.payload.message || 'Connection lost',
          recoverable: true,
        },
      };
    }

    case 'START_SAVING':
      return {
        ...state,
        loading: { ...state.loading, isSaving: true },
      };

    case 'SAVE_COMPLETE':
    case 'SAVE_FAILED':
      return {
        ...state,
        loading: { ...state.loading, isSaving: false },
      };

    case 'RESET':
      return {
        ...createInitialInterviewState(),
        accessToken: state.accessToken,
        configId: state.configId,
      };

    default:
      return state;
  }
}

// Hook return type - simplified
export interface UseInterviewStateReturn {
  state: InterviewState;
  actions: {
    startInitializing: () => void;
    initializationSuccess: (accessToken: string, configId: string) => void;
    initializationFailed: (reason: ErrorReason, message: string) => void;
    capacityCheckStart: () => void;
    capacityCheckFailed: (message: string) => void;
    startConnecting: (totalQuestions: number) => void;
    connectionSuccess: (sessionId: string) => void;
    connectionFailed: (reason: ErrorReason, message: string) => void;
    interviewStarted: () => void;
    interviewCompleted: () => void;
    disconnect: (reason: DisconnectReason, errorReason?: ErrorReason, message?: string) => void;
    startSaving: () => void;
    saveComplete: () => void;
    saveFailed: () => void;
    reset: () => void;
  };
  computed: {
    isLoading: boolean;
    canStartInterview: boolean;
    duration: number | null;
  };
}

export function useInterviewState(): UseInterviewStateReturn {
  const [state, dispatch] = useReducer(interviewReducer, createInitialInterviewState());

  const actions = useMemo(
    () => ({
      startInitializing: () => dispatch({ type: 'START_INITIALIZING' }),
      initializationSuccess: (accessToken: string, configId: string) =>
        dispatch({ type: 'INITIALIZATION_SUCCESS', payload: { accessToken, configId } }),
      initializationFailed: (reason: ErrorReason, message: string) =>
        dispatch({ type: 'INITIALIZATION_FAILED', payload: { reason, message } }),
      capacityCheckStart: () => dispatch({ type: 'CAPACITY_CHECK_START' }),
      capacityCheckFailed: (message: string) =>
        dispatch({ type: 'CAPACITY_CHECK_FAILED', payload: { message } }),
      startConnecting: (totalQuestions: number) =>
        dispatch({ type: 'START_CONNECTING', payload: { totalQuestions } }),
      connectionSuccess: (sessionId: string) =>
        dispatch({ type: 'CONNECTION_SUCCESS', payload: { sessionId } }),
      connectionFailed: (reason: ErrorReason, message: string) =>
        dispatch({ type: 'CONNECTION_FAILED', payload: { reason, message } }),
      interviewStarted: () => dispatch({ type: 'INTERVIEW_STARTED' }),
      interviewCompleted: () => dispatch({ type: 'INTERVIEW_COMPLETED' }),
      disconnect: (reason: DisconnectReason, errorReason?: ErrorReason, message?: string) =>
        dispatch({ type: 'DISCONNECT', payload: { reason, errorReason, message } }),
      startSaving: () => dispatch({ type: 'START_SAVING' }),
      saveComplete: () => dispatch({ type: 'SAVE_COMPLETE' }),
      saveFailed: () => dispatch({ type: 'SAVE_FAILED' }),
      reset: () => dispatch({ type: 'RESET' }),
    }),
    []
  );

  const computed = useMemo(() => {
    const { loading, timestamps, stage, accessToken, configId } = state;
    const isLoading =
      loading.isInitializing ||
      loading.isConnecting ||
      loading.isSaving ||
      loading.isCheckingCapacity;

    const canStartInterview =
      stage === InterviewStage.IDLE && !!accessToken && !!configId && !isLoading;

    const duration =
      timestamps.startedAt && timestamps.endedAt
        ? timestamps.endedAt - timestamps.startedAt
        : timestamps.startedAt
          ? Date.now() - timestamps.startedAt
          : null;

    return {
      isLoading,
      canStartInterview,
      duration,
    };
  }, [state]);

  return { state, actions, computed };
}
