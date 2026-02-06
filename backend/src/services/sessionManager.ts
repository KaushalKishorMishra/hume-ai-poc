// Session Manager - Tracks active sessions and enforces concurrent limits

interface ActiveSession {
  sessionId: string;
  startedAt: number;
  lastHeartbeat: number;
  totalQuestions: number;
}

class SessionManager {
  private sessions: Map<string, ActiveSession> = new Map();
  private maxConcurrent: number;
  private staleTimeoutMs: number;

  constructor() {
    // Read from env or default to 5 concurrent sessions
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10);
    this.staleTimeoutMs = parseInt(process.env.SESSION_STALE_TIMEOUT_MS || '300000', 10); // 5 minutes

    // Cleanup stale sessions every minute
    setInterval(() => this.cleanupStale(), 60000);
  }

  getCapacity(): { allowed: boolean; activeCount: number; limit: number; message?: string } {
    this.cleanupStale();
    const activeCount = this.sessions.size;
    const allowed = activeCount < this.maxConcurrent;

    return {
      allowed,
      activeCount,
      limit: this.maxConcurrent,
      message: allowed
        ? undefined
        : `Maximum concurrent interviews (${this.maxConcurrent}) reached. Please try again later.`,
    };
  }

  startSession(sessionId: string, totalQuestions: number): boolean {
    this.cleanupStale();

    if (this.sessions.size >= this.maxConcurrent) {
      return false;
    }

    this.sessions.set(sessionId, {
      sessionId,
      startedAt: Date.now(),
      lastHeartbeat: Date.now(),
      totalQuestions,
    });

    console.log(
      `📊 Session started: ${sessionId}. Active sessions: ${this.sessions.size}/${this.maxConcurrent}`
    );
    return true;
  }



  heartbeat(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastHeartbeat = Date.now();
      return true;
    }
    return false;
  }

  endSession(sessionId: string): ActiveSession | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      console.log(
        `📊 Session ended: ${sessionId}. Active sessions: ${this.sessions.size}/${this.maxConcurrent}`
      );
      return session;
    }
    return null;
  }

  getSession(sessionId: string): ActiveSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getActiveSessions(): ActiveSession[] {
    return Array.from(this.sessions.values());
  }

  private cleanupStale(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastHeartbeat > this.staleTimeoutMs) {
        this.sessions.delete(sessionId);
        cleaned++;
        console.log(`🧹 Cleaned up stale session: ${sessionId}`);
      }
    }

    if (cleaned > 0) {
      console.log(
        `🧹 Cleaned ${cleaned} stale session(s). Active: ${this.sessions.size}/${this.maxConcurrent}`
      );
    }
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
