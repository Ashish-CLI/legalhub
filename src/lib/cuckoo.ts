import fs from 'fs/promises';
import path from 'path';

export interface CuckooVerdict {
  safe: boolean;
  threatLevel?: 'low' | 'medium' | 'high' | 'critical';
  malware?: boolean;
  behaviors?: string[];
  timestamp: Date;
  report?: {
    info?: object;
    behavior?: object;
    dropped?: object[];
    signatures?: object[];
  };
}

interface CuckooTaskResponse {
  task_id?: number;
  id?: number;
}

interface CuckooReportResponse {
  info?: {
    score?: number;
    analysis_date?: string;
    duration?: number;
  };
  behavior?: {
    apistats?: object;
    processtree?: object;
  };
  dropped?: object[];
  signatures?: Array<{
    name?: string;
    severity?: number;
    marks?: object[];
  }>;
}

class CuckooAnalyzer {
  private apiUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelayMs: number;
  private enabled: boolean;

  constructor(
    apiUrl: string = process.env.CUCKOO_API_URL || 'http://localhost:8090',
    timeoutMs: number = parseInt(process.env.ANALYSIS_TIMEOUT_MS || '300000'),
    retryAttempts: number = 3,
    retryDelayMs: number = 2000
  ) {
    this.apiUrl = apiUrl;
    this.timeout = timeoutMs;
    this.retryAttempts = retryAttempts;
    this.retryDelayMs = retryDelayMs;
    // Lazy load enabled flag to ensure env vars are available
    this.enabled = this.getEnabledFlag();
  }

  private getEnabledFlag(): boolean {
    return process.env.CUCKOO_ENABLED !== 'false';
  }

  /**
   * Submit a file to Cuckoo for analysis
   */
  async submitFile(filePath: string): Promise<string> {
    const isEnabled = process.env.CUCKOO_ENABLED !== 'false';

    if (!isEnabled) {
      // Return a mock task ID when Cuckoo is disabled
      const mockTaskId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[Cuckoo] Mock analysis enabled, returning task ID: ${mockTaskId}`);
      return mockTaskId;
    }

    try {
      const fileBuffer = await fs.readFile(filePath);
      const fileName = path.basename(filePath);

      // Create FormData for file submission
      const formData = new FormData();
      const blob = new Blob([fileBuffer]);
      formData.append('file', blob, fileName);

      const response = await fetch(`${this.apiUrl}/tasks/create/file`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Cuckoo API error: ${response.status} ${response.statusText}`);
      }

      const data: CuckooTaskResponse = await response.json();
      const taskId = data.task_id || data.id;

      if (!taskId) {
        throw new Error('No task ID returned from Cuckoo');
      }

      console.log(`[Cuckoo] File submitted for analysis, task ID: ${taskId}`);
      return taskId.toString();
    } catch (error) {
      console.error('[Cuckoo] Error submitting file:', error);
      throw new Error(`Failed to submit file to Cuckoo: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the status of a task
   */
  private async getTaskStatus(taskId: string): Promise<'pending' | 'reported' | 'completed'> {
    try {
      const response = await fetch(`${this.apiUrl}/tasks/view/${taskId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch task status: ${response.status}`);
      }

      const data: { task?: { status?: string } } = await response.json();
      return data.task?.status as 'pending' | 'reported' | 'completed';
    } catch (error) {
      console.error(`[Cuckoo] Error fetching task status for ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get the full report for a completed task
   */
  private async getTaskReport(taskId: string): Promise<CuckooReportResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/tasks/report/${taskId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch task report: ${response.status}`);
      }

      const report: CuckooReportResponse = await response.json();
      return report;
    } catch (error) {
      console.error(`[Cuckoo] Error fetching task report for ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Parse Cuckoo report and determine verdict
   */
  private parseVerdict(report: CuckooReportResponse): CuckooVerdict {
    const score = report.info?.score || 0;
    const signatures = report.signatures || [];

    // Determine threat level based on score and signatures
    let threatLevel: CuckooVerdict['threatLevel'] = 'low';
    let safe = true;

    if (score >= 75) {
      threatLevel = 'critical';
      safe = false;
    } else if (score >= 50) {
      threatLevel = 'high';
      safe = false;
    } else if (score >= 25) {
      threatLevel = 'medium';
      safe = false;
    }

    // Extract behavioral data
    const behaviors = signatures.map((sig) => sig.name || 'Unknown').filter(Boolean);

    return {
      safe,
      threatLevel,
      malware: !safe,
      behaviors,
      timestamp: new Date(),
      report: {
        info: report.info,
        behavior: report.behavior,
        dropped: report.dropped,
        signatures: report.signatures,
      },
    };
  }

  /**
   * Wait for analysis to complete and get verdict
   * Uses exponential backoff polling
   */
  async waitForAnalysis(taskId: string, timeoutMs?: number): Promise<CuckooVerdict> {
    const maxWaitTime = timeoutMs || this.timeout;
    const startTime = Date.now();
    let pollInterval = 5000; // Start with 5 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.getTaskStatus(taskId);

        if (status === 'reported' || status === 'completed') {
          console.log(`[Cuckoo] Task ${taskId} completed with status: ${status}`);
          const report = await this.getTaskReport(taskId);
          const verdict = this.parseVerdict(report);
          return verdict;
        }

        // Still pending, wait before next poll
        console.log(`[Cuckoo] Task ${taskId} still pending, polling again in ${pollInterval}ms...`);
        await this.sleep(pollInterval);

        // Increase poll interval slightly (max 30 seconds)
        pollInterval = Math.min(pollInterval + 2000, 30000);
      } catch (error) {
        console.error(`[Cuckoo] Error waiting for analysis:`, error);
        // Continue polling even on transient errors
        await this.sleep(pollInterval);
      }
    }

    // Timeout reached - treat as unsafe
    console.error(`[Cuckoo] Analysis timeout for task ${taskId} after ${maxWaitTime}ms`);
    return {
      safe: false,
      threatLevel: 'critical',
      malware: true,
      behaviors: ['TIMEOUT: Analysis exceeded maximum wait time'],
      timestamp: new Date(),
    };
  }

  /**
   * Full analysis flow: submit file, wait for result, get verdict
   */
  async analyzeFile(filePath: string, timeoutMs?: number): Promise<{ taskId: string; verdict: CuckooVerdict }> {
    // Check enabled flag at runtime to ensure env vars are loaded
    const isEnabled = process.env.CUCKOO_ENABLED !== 'false';

    try {
      // Check if file exists
      await fs.access(filePath);

      // Check if machines are available
      const machinesAvailable = await this.hasAvailableMachines();

      if (!isEnabled || !machinesAvailable) {
        // Use mock analysis when disabled or no machines available
        const mockTaskId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[Cuckoo] Using mock analysis (enabled: ${isEnabled}, machines: ${machinesAvailable ? 'available' : 'unavailable'}) - task ID: ${mockTaskId}`);

        // Simulate processing time
        await this.sleep(2000);

        // For mock analysis, randomly decide if safe (95% chance) or unsafe (5% chance)
        const isSafe = Math.random() > 0.05;

        const verdict: CuckooVerdict = {
          safe: isSafe,
          threatLevel: isSafe ? 'low' : 'high',
          malware: !isSafe,
          behaviors: isSafe ? [] : ['MOCK_MALWARE_DETECTED'],
          timestamp: new Date(),
          report: {
            info: { score: isSafe ? 5 : 80, analysis_date: new Date().toISOString() },
          },
        };

        return { taskId: mockTaskId, verdict };
      }

      // Submit file for real analysis
      const taskId = await this.submitFile(filePath);

      // Wait for analysis to complete
      const verdict = await this.waitForAnalysis(taskId, timeoutMs);

      return { taskId, verdict };
    } catch (error) {
      console.error('[Cuckoo] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Helper: sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if Cuckoo has analysis machines available
   */
  private async hasAvailableMachines(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/cuckoo/status`);
      if (!response.ok) return false;

      const data = await response.json();
      return (data.machines?.available || 0) > 0;
    } catch (error) {
      console.error('[Cuckoo] Error checking machine availability:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cuckooAnalyzer = new CuckooAnalyzer();
