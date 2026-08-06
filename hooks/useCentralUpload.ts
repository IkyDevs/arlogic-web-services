"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  PendingFile,
  TransactionType,
  CreateSessionResponse,
  UploadSessionStatus,
} from "@/lib/upload/upload-types";
import { uploadService } from "@/lib/upload/upload-service";

export interface UseCentralUploadReturn {
  pendingFiles: PendingFile[];
  sessionId: string | null;
  uploadSession: CreateSessionResponse | null;
  uploading: boolean;
  progress: number;
  errors: string[];
  success: boolean;
  addFiles: (
    files: File[],
  ) => Promise<{ files: PendingFile[]; errors: string[] }>;
  removeFile: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  recover: (sessionKey: string) => Promise<PendingFile[]>;
  submit: (options: {
    transactionType: TransactionType;
    caption?: string;
    userId: string;
    transactionData: Record<string, unknown>;
    sessionKey: string;
  }) => Promise<{
    success: boolean;
    session: CreateSessionResponse | null;
    errors: string[];
  }>;
  uploadToSupabase: (
    session: CreateSessionResponse,
    files: PendingFile[],
    onProgress?: (completed: number, total: number) => void,
  ) => Promise<{ success: boolean; errors: string[] }>;
  completeSession: (sessionId: string) => Promise<boolean>;
  checkStatus: (sessionId: string) => Promise<UploadSessionStatus>;
  retry: (sessionId: string) => Promise<boolean>;
  retryPhotoUpload: (options: {
    transactionId: string;
    sessionKey: string;
    type: string;
    caption?: string;
    branchCode?: string;
    onProgress?: (completed: number, total: number) => void;
  }) => Promise<{ success: boolean; errors: string[] }>;
  legacyUpload: (
    files: File[],
    type: string,
    caption?: string,
    timeout?: number,
    branchCode?: string,
  ) => Promise<
    Array<{
      url: string;
      chat_id: string;
      message_id: number;
      file_id?: string;
    }>
  >;
  reset: () => void;
}

export function useCentralUpload(sessionKey: string): UseCentralUploadReturn {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadSession, setUploadSession] =
    useState<CreateSessionResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const mountedRef = useRef(true);
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current++;
    console.log("[DEBUG:useCentralUpload] MOUNT #" + renderCount.current, {
      mountedRef_before: mountedRef.current,
      sessionKey,
      pendingFiles_length: pendingFiles.length,
      timestamp: Date.now(),
    });
    mountedRef.current = true;
    console.log("[DEBUG:useCentralUpload] MOUNT effect done", {
      mountedRef_after: mountedRef.current,
    });
    return () => {
      console.log("[DEBUG:useCentralUpload] UNMOUNT #" + renderCount.current, {
        mountedRef_before_cleanup: mountedRef.current,
        sessionKey,
        timestamp: Date.now(),
      });
      mountedRef.current = false;
    };
  }, []);

  const refreshFiles = useCallback(async () => {
    const files = await uploadService.getFiles(sessionKey);
    if (mountedRef.current) {
      setPendingFiles(files);
    }
  }, [sessionKey]);

  const addFiles = useCallback(
    async (
      rawFiles: File[],
    ): Promise<{ files: PendingFile[]; errors: string[] }> => {
      console.log("[DEBUG:useCentralUpload] addFiles ENTER", {
        rawFiles_count: rawFiles.length,
        mountedRef_current: mountedRef.current,
        sessionKey,
        pendingFiles_length_before: pendingFiles.length,
      });
      const result = await uploadService.addFiles(rawFiles, sessionKey);
      console.log("[DEBUG:useCentralUpload] addFiles after service.addFiles", {
        result_files_count: result.files.length,
        result_errors: result.errors,
        mountedRef_current: mountedRef.current,
      });
      if (mountedRef.current) {
        console.log(
          "[DEBUG:useCentralUpload] addFiles calling setPendingFiles",
          {
            prev_pendingFiles_length: pendingFiles.length,
            new_files_count: result.files.length,
          },
        );
        setPendingFiles((prev) => {
          const newLen = prev.length + result.files.length;
          console.log("[DEBUG:useCentralUpload] setPendingFiles callback", {
            prev_len: prev.length,
            result_len: result.files.length,
            new_len: newLen,
          });
          return [...prev, ...result.files];
        });
        if (result.errors.length > 0) {
          setErrors((prev) => [...prev, ...result.errors]);
        }
      } else {
        console.log(
          "[DEBUG:useCentralUpload] addFiles SKIPPED setPendingFiles - mountedRef is FALSE",
        );
      }
      return result;
    },
    [sessionKey],
  );

  const removeFile = useCallback(
    async (id: string) => {
      await uploadService.removeFile(sessionKey, id);
      if (mountedRef.current) {
        setPendingFiles((prev) => prev.filter((f) => f.id !== id));
      }
    },
    [sessionKey],
  );

  const clear = useCallback(async () => {
    await uploadService.clearSession(sessionKey);
    if (mountedRef.current) {
      setPendingFiles([]);
      setSessionId(null);
      setUploadSession(null);
      setProgress(0);
      setErrors([]);
      setSuccess(false);
    }
  }, [sessionKey]);

  const recover = useCallback(async (key: string): Promise<PendingFile[]> => {
    const files = await uploadService.recoverSession(key);
    if (mountedRef.current) {
      setPendingFiles(files);
    }
    return files;
  }, []);

  const submit = useCallback(
    async (options: {
      transactionType: TransactionType;
      caption?: string;
      userId: string;
      transactionData: Record<string, unknown>;
      sessionKey: string;
    }): Promise<{
      success: boolean;
      session: CreateSessionResponse | null;
      errors: string[];
    }> => {
      setUploading(true);
      setErrors([]);
      setSuccess(false);

      const result = await uploadService.submit(options.sessionKey, {
        transactionType: options.transactionType,
        caption: options.caption,
        userId: options.userId,
        transactionData: options.transactionData,
      });

      if (mountedRef.current) {
        setUploading(false);
        if (result.success && result.session) {
          setSessionId(result.session.session_id);
          setUploadSession(result.session);
          setSuccess(true);
        } else {
          setErrors(result.errors);
        }
      }

      return {
        success: result.success,
        session: result.session ?? null,
        errors: result.errors,
      };
    },
    [],
  );

  const uploadToSupabase = useCallback(
    async (
      session: CreateSessionResponse,
      files: PendingFile[],
      onProgress?: (completed: number, total: number) => void,
    ): Promise<{ success: boolean; errors: string[] }> => {
      setUploading(true);
      setProgress(0);

      const result = await uploadService.uploadToSupabase(
        session,
        files,
        (completed, total) => {
          const pct = Math.round((completed / total) * 100);
          if (mountedRef.current) setProgress(pct);
          onProgress?.(completed, total);
        },
      );

      if (mountedRef.current) {
        setUploading(false);
        if (!result.success) {
          setErrors((prev) => [...prev, ...result.errors]);
        }
      }

      return result;
    },
    [],
  );

  const completeSession = useCallback(async (sid: string): Promise<boolean> => {
    try {
      const result = await uploadService.completeSession(sid);
      if (mountedRef.current) {
        setSessionId(result.session_id);
      }
      return result.status === "QUEUED";
    } catch {
      return false;
    }
  }, []);

  const checkStatus = useCallback(
    async (sid: string): Promise<UploadSessionStatus> => {
      return uploadService.checkSessionStatus(sid);
    },
    [],
  );

  const retry = useCallback(async (sid: string): Promise<boolean> => {
    return uploadService.retrySession(sid);
  }, []);

  const legacyUpload = useCallback(
    async (
      files: File[],
      type: string,
      caption?: string,
      timeout?: number,
      branchCode?: string,
    ): Promise<
      Array<{
        url: string;
        chat_id: string;
        message_id: number;
        file_id?: string;
      }>
    > => {
      setUploading(true);
      try {
        const results = await uploadService.legacyUpload(
          files,
          type,
          caption,
          timeout,
          branchCode,
        );
        return results;
      } finally {
        if (mountedRef.current) setUploading(false);
      }
    },
    [],
  );

  const retryPhotoUpload = useCallback(
    async (options: {
      transactionId: string;
      sessionKey: string;
      type: string;
      caption?: string;
      branchCode?: string;
      onProgress?: (completed: number, total: number) => void;
    }): Promise<{ success: boolean; errors: string[] }> => {
      setUploading(true);
      setProgress(0);
      setErrors([]);

      try {
        // Recover files dari IndexedDB menggunakan session key
        const recovered = await uploadService.recoverSession(
          options.sessionKey,
        );

        if (!recovered.length) {
          const err = "Draft foto tidak ditemukan, silakan upload ulang manual";
          setErrors([err]);
          return { success: false, errors: [err] };
        }

        // Upload files via legacy endpoint (sama seperti flow lama)
        const filesToUpload = recovered.map((f) => f.file);
        const results = await uploadService.legacyUpload(
          filesToUpload,
          options.type,
          options.caption,
          undefined,
          options.branchCode,
        );

        if (!results?.length) {
          const err = "Upload gagal: tidak ada hasil dari server";
          setErrors([err]);
          return { success: false, errors: [err] };
        }

        // Update progress
        if (mountedRef.current) {
          setProgress(100);
          options.onProgress?.(results.length, results.length);
        }

        return { success: true, errors: [] };
      } catch (err: any) {
        const errMsg =
          err instanceof Error ? err.message : "Retry gagal, coba lagi nanti";
        setErrors([errMsg]);
        return { success: false, errors: [errMsg] };
      } finally {
        if (mountedRef.current) {
          setUploading(false);
        }
      }
    },
    [],
  );

  const reset = useCallback(() => {
    if (mountedRef.current) {
      setPendingFiles([]);
      setSessionId(null);
      setUploadSession(null);
      setUploading(false);
      setProgress(0);
      setErrors([]);
      setSuccess(false);
    }
  }, []);

  useEffect(() => {
    const savedFiles = pendingFiles;
    console.log("[DEBUG:useCentralUpload] recoverEffect run", {
      savedFiles_length: savedFiles.length,
      mountedRef: mountedRef.current,
      sessionKey,
    });
    if (savedFiles.length === 0) {
      uploadService.recoverSession(sessionKey).then((files) => {
        console.log("[DEBUG:useCentralUpload] recoverSession resolved", {
          recovered_count: files.length,
          mountedRef: mountedRef.current,
          will_setState: files.length > 0 && mountedRef.current,
        });
        if (files.length > 0 && mountedRef.current) {
          setPendingFiles(files);
        }
      });
    }
  }, [sessionKey]);

  useEffect(() => {
    console.log("[DEBUG:useCentralUpload] pendingFiles STATE CHANGED", {
      length: pendingFiles.length,
      file_ids: pendingFiles.map((f) => f.id),
      file_names: pendingFiles.map((f) => f.name),
      file_statuses: pendingFiles.map((f) => f.status),
    });
  }, [pendingFiles]);

  return {
    pendingFiles,
    sessionId,
    uploadSession,
    uploading,
    progress,
    errors,
    success,
    addFiles,
    removeFile,
    clear,
    recover,
    submit,
    uploadToSupabase,
    completeSession,
    checkStatus,
    retry,
    retryPhotoUpload,
    legacyUpload,
    reset,
  };
}
