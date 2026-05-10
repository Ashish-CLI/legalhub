import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { fileAnalysisQueue, AnalysisJob } from './fileAnalysis';
import { cuckooAnalyzer } from './cuckoo';
import FileAnalysis from '@/models/FileAnalysis';
import Case from '@/models/Case';
import cloudinary from './cloudinary';
import { connectDB } from '@/app/lib/db';
import User from '@/models/User';

interface CloudinaryUploadOptions {
  folder: string;
  resource_type?: 'image' | 'raw' | 'video' | 'auto';
  public_id?: string;
  secure?: boolean;
}

/**
 * Upload file to Cloudinary based on mime type and context
 */
async function uploadToCloudinary(
  filePath: string,
  originalName: string,
  mimeType: string,
  metadata?: AnalysisJob['metadata']
): Promise<{ url: string; publicId: string; resourceType: string }> {
  return new Promise((resolve, reject) => {
    // Determine resource type and folder based on mime type
    let resourceType: 'image' | 'raw' | 'video' | 'auto' = 'raw';
    let folder = 'legalhub/uploads';

    if (mimeType.startsWith('image/')) {
      resourceType = 'image';
      folder = 'legalhub/images';
    } else if (mimeType.startsWith('video/')) {
      resourceType = 'video';
      folder = 'legalhub/videos';
    } else if (mimeType === 'application/pdf') {
      resourceType = 'raw';
      folder = 'legalhub/documents';
    }

    // Context-specific folder assignments
    if (metadata?.chatId) {
      folder = 'legalhub/chat-media';
    } else if (metadata?.caseId) {
      folder = 'legalhub/case-files';
    } else if (metadata?.type === 'profile-image') {
      resourceType = 'image';
      folder = 'legalhub/profile-images';
    } else if (metadata?.type === 'id-document') {
      folder = 'legalhub/id-documents';
    } else if (metadata?.type === 'professional-document') {
      folder = 'legalhub/professional-documents';
    }

    const publicId = `${folder}/${uuidv4()}`;
    const uploadOptions: CloudinaryUploadOptions = {
      folder,
      resource_type: resourceType,
      public_id: publicId.replace(/\//g, '_'),
    };

    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        console.error('[CloudinaryUpload] Error uploading to Cloudinary:', error);
        reject(new Error(`Cloudinary upload failed: ${error.message}`));
      } else if (!result?.secure_url) {
        reject(new Error('Cloudinary upload completed but no URL returned'));
      } else {
        console.log(`[CloudinaryUpload] File uploaded successfully: ${result.secure_url}`);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type || 'raw',
        });
      }
    });

    // Read file and pipe to Cloudinary
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(uploadStream);
  });
}

/**
 * Finalize case creation after safe file analysis
 */
async function finalizeCaseAfterAnalysis(
  caseId: string,
  fileId: string,
  cloudinaryUrl: string
): Promise<void> {
  try {
    await connectDB();
    
    const updatedCase = await Case.findOneAndUpdate(
      { caseId, analysisFileId: fileId },
      {
        caseFile: cloudinaryUrl,
        status: 'pending', // Change from 'analyzing' to 'pending'
        analysisFileId: undefined, // Clear analysis file ID
      },
      { returnDocument: 'after' }
    );

    if (updatedCase) {
      console.log(`[AnalysisWorker] Case finalized successfully: ${caseId}`);
    } else {
      console.error(`[AnalysisWorker] Could not find case to finalize: ${caseId}`);
    }
  } catch (error) {
    console.error(`[AnalysisWorker] Error finalizing case ${caseId}:`, error);
    throw error;
  }
}

/**
 * Mark case as rejected due to unsafe file
 */
async function rejectCaseAfterAnalysis(
  caseId: string,
  fileId: string,
  reason: string
): Promise<void> {
  try {
    await connectDB();

    const updatedCase = await Case.findOneAndUpdate(
      { caseId, analysisFileId: fileId },
      {
        status: 'rejected',
        analysisFileId: undefined,
      },
      { returnDocument: 'after' }
    );

    if (updatedCase) {
      console.log(`[AnalysisWorker] Case rejected due to unsafe file: ${caseId}`);
    } else {
      console.error(`[AnalysisWorker] Could not find case to reject: ${caseId}`);
    }
  } catch (error) {
    console.error(`[AnalysisWorker] Error rejecting case ${caseId}:`, error);
    throw error;
  }
}

/**
 * Finalize user documents after safe analysis
 */
async function finalizeUserDocumentsAfterAnalysis(
  userId: string,
  fileId: string,
  cloudinaryUrl: string,
  documentType: 'id-document' | 'professional-document'
): Promise<void> {
  try {
    await connectDB();

    const updateField = documentType === 'id-document' ? 'idDocument' : 'professionalDocument';

    const updatedUser = await User.findOneAndUpdate(
      { userId, analysisFileIds: fileId },
      {
        [updateField]: cloudinaryUrl,
        verificationStatus: 'pending', // Move to pending for admin review
      },
      { returnDocument: 'after' }
    );

    if (updatedUser) {
      console.log(`[AnalysisWorker] User ${documentType} finalized: ${userId}`);
    } else {
      console.error(`[AnalysisWorker] Could not find user to finalize documents: ${userId}`);
    }
  } catch (error) {
    console.error(`[AnalysisWorker] Error finalizing user documents ${userId}:`, error);
    throw error;
  }
}

/**
 * Reject user due to unsafe documents
 */
async function rejectUserAfterAnalysis(
  userId: string,
  fileId: string,
  reason: string
): Promise<void> {
  try {
    await connectDB();

    const updatedUser = await User.findOneAndUpdate(
      { userId, analysisFileIds: fileId },
      {
        verificationStatus: 'rejected',
      },
      { returnDocument: 'after' }
    );

    if (updatedUser) {
      console.log(`[AnalysisWorker] User rejected due to unsafe document: ${userId}`);
    } else {
      console.error(`[AnalysisWorker] Could not find user to reject: ${userId}`);
    }
  } catch (error) {
    console.error(`[AnalysisWorker] Error rejecting user ${userId}:`, error);
    throw error;
  }
}

/**
 * Process a single analysis job
 */
async function processJob(job: AnalysisJob): Promise<void> {
  console.log(`[AnalysisWorker] Processing job ${job.jobId} for file ${job.fileId}`);

  try {
    fileAnalysisQueue.markProcessing(job.jobId);

    // Step 1: Submit to Cuckoo for analysis
    console.log(`[AnalysisWorker] Submitting file to Cuckoo: ${job.filePath}`);
    const { taskId, verdict } = await cuckooAnalyzer.analyzeFile(
      job.filePath,
      parseInt(process.env.ANALYSIS_TIMEOUT_MS || '300000')
    );

    console.log(`[AnalysisWorker] Cuckoo analysis complete. Task ${taskId}, Safe: ${verdict.safe}`);

    // Update job with Cuckoo task ID
    fileAnalysisQueue.updateStatus(job.jobId, verdict.safe ? 'safe' : 'unsafe', {
      cuckooTaskId: taskId,
      verdict,
    });

    // Step 2: If safe, upload to Cloudinary
    if (verdict.safe) {
      try {
        console.log(`[AnalysisWorker] File is safe. Uploading to Cloudinary...`);
        const { url, publicId } = await uploadToCloudinary(
          job.filePath,
          job.originalName,
          job.mimeType,
          job.metadata
        );

        // Update job with Cloudinary URL
        fileAnalysisQueue.updateStatus(job.jobId, 'safe', {
          cloudinaryUrl: url,
          verdict,
        });

        // Step 3: Save to MongoDB
        await connectDB();
        const fileAnalysisRecord = await FileAnalysis.findOneAndUpdate(
          { fileId: job.fileId },
          {
            status: 'safe',
            verdict,
            cloudinaryUrl: url,
            cuckooTaskId: taskId,
          },
          { returnDocument: 'after', upsert: false }
        );

        console.log(`[AnalysisWorker] File analysis record updated in DB: ${job.fileId}`);

        // Step 4: Finalize case if applicable
        if (job.metadata?.caseId) {
          await finalizeCaseAfterAnalysis(job.metadata.caseId, job.fileId, url);
        }

        // Step 4b: Finalize user documents if applicable
        if (job.metadata?.userId && job.metadata?.type === 'id-document') {
          await finalizeUserDocumentsAfterAnalysis(job.metadata.userId, job.fileId, url, 'id-document');
        } else if (job.metadata?.userId && job.metadata?.type === 'professional-document') {
          await finalizeUserDocumentsAfterAnalysis(job.metadata.userId, job.fileId, url, 'professional-document');
        }

        // Step 5: Clean up local file
        await fileAnalysisQueue.cleanupFile(job.filePath);
        console.log(`[AnalysisWorker] Local file cleaned up: ${job.filePath}`);
      } catch (uploadError) {
        console.error(`[AnalysisWorker] Error uploading safe file to Cloudinary:`, uploadError);
        throw uploadError;
      }
    } else {
      // Unsafe file: update status and clean up
      console.log(
        `[AnalysisWorker] File marked as unsafe (threat level: ${verdict.threatLevel}). Rejecting...`
      );

      await connectDB();
      await FileAnalysis.findOneAndUpdate(
        { fileId: job.fileId },
        {
          status: 'unsafe',
          verdict,
          cuckooTaskId: taskId,
          errorMessage: `File analysis detected threats (${verdict.threatLevel}). Upload rejected.`,
        },
        { returnDocument: 'after', upsert: false }
      );

      // Reject case if applicable
      if (job.metadata?.caseId) {
        await rejectCaseAfterAnalysis(
          job.metadata.caseId,
          job.fileId,
          `File analysis detected threats (${verdict.threatLevel})`
        );
      }

      // Reject user if applicable
      if (job.metadata?.userId) {
        await rejectUserAfterAnalysis(
          job.metadata.userId,
          job.fileId,
          `File analysis detected threats (${verdict.threatLevel})`
        );
      }

      // Clean up local file
      await fileAnalysisQueue.cleanupFile(job.filePath);
      console.log(`[AnalysisWorker] Unsafe file rejected and cleaned up: ${job.filePath}`);
    }
  } catch (error) {
    console.error(`[AnalysisWorker] Error processing job ${job.jobId}:`, error);

    // Mark as error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during analysis';
    fileAnalysisQueue.updateStatus(job.jobId, 'error', {
      errorMessage,
    });

    // Update MongoDB record
    try {
      await connectDB();
      await FileAnalysis.findOneAndUpdate(
        { fileId: job.fileId },
        {
          status: 'error',
          errorMessage,
        },
        { returnDocument: 'after', upsert: false }
      );

      // Reject case if applicable
      if (job.metadata?.caseId) {
        await rejectCaseAfterAnalysis(job.metadata.caseId, job.fileId, errorMessage);
      }

      // Reject user if applicable
      if (job.metadata?.userId) {
        await rejectUserAfterAnalysis(job.metadata.userId, job.fileId, errorMessage);
      }
    } catch (dbError) {
      console.error(`[AnalysisWorker] Failed to update error status in DB:`, dbError);
    }

    // Try to clean up file
    try {
      await fileAnalysisQueue.cleanupFile(job.filePath);
    } catch (cleanupError) {
      console.error(`[AnalysisWorker] Failed to clean up file after error:`, cleanupError);
    }
  }
}

/**
 * Main queue processor: continuously processes pending jobs
 */
async function processQueue(): Promise<void> {
  try {
    const job = fileAnalysisQueue.dequeue();

    if (job) {
      console.log(`[AnalysisWorker] Queue size:`, fileAnalysisQueue.size());
      await processJob(job);
    }
  } catch (error) {
    console.error('[AnalysisWorker] Fatal error in queue processing:', error);
  }
}

/**
 * Load pending jobs from database into the queue on startup
 */
async function loadPendingJobs(): Promise<void> {
  try {
    await connectDB();
    const pendingRecords = await FileAnalysis.find({ status: 'pending' });

    for (const record of pendingRecords) {
      // Check if file still exists
      try {
        await fs.access(record.localPath);
      } catch {
        console.warn(`[AnalysisWorker] Skipping job ${record.fileId}: file not found at ${record.localPath}`);
        continue;
      }

      // Reconstruct job from database record
      const job: AnalysisJob = {
        jobId: `restored-${record.fileId}-${Date.now()}`, // Generate new jobId
        fileId: record.fileId,
        filePath: record.localPath,
        originalName: record.originalName,
        mimeType: record.mimeType,
        size: record.size,
        uploaderId: record.uploaderId,
        status: 'pending',
        createdAt: record.createdAt,
        updatedAt: new Date(),
        metadata: record.metadata,
      };

      fileAnalysisQueue.enqueueExisting(job);
      console.log(`[AnalysisWorker] Restored pending job: ${record.fileId}`);
    }

    console.log(`[AnalysisWorker] Loaded ${pendingRecords.length} pending jobs from database`);
  } catch (error) {
    console.error('[AnalysisWorker] Error loading pending jobs:', error);
  }
}

/**
 * Start the worker: load pending jobs and continuously poll and process queue
 */
async function startWorker(intervalMs: number = parseInt(process.env.QUEUE_PROCESS_INTERVAL_MS || '10000')): Promise<void> {
  console.log(`[AnalysisWorker] Starting queue worker with interval ${intervalMs}ms`);

  // Load any pending jobs from database
  await loadPendingJobs();

  setInterval(async () => {
    await processQueue();
  }, intervalMs);
}

export { processQueue, startWorker, processJob, loadPendingJobs };
