import { useState, useCallback, useRef } from 'react';
import type { ProcessedFileData, WorkerResponse } from '../workers/fileProcessor.worker';

// Import worker using Vite's worker syntax
import FileProcessorWorker from '../workers/fileProcessor.worker?worker';

export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  stage: string;
  error: string | null;
}

export interface UseFileProcessorResult {
  processFiles: (files: {
    trips: File;
    quotes: File;
    passthroughs: File;
    hotPass: File;
    bookings: File;
    nonConverted: File;
    quotesStarted?: File;
  }) => Promise<ProcessedFileData | null>;
  state: ProcessingState;
  cancelProcessing: () => void;
}

export const useFileProcessor = (): UseFileProcessorResult => {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    stage: '',
    error: null,
  });

  const workerRef = useRef<Worker | null>(null);

  const cancelProcessing = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setState({
        isProcessing: false,
        progress: 0,
        stage: '',
        error: 'Processing cancelled',
      });
    }
  }, []);

  const processFiles = useCallback(async (files: {
    trips: File;
    quotes: File;
    passthroughs: File;
    hotPass: File;
    bookings: File;
    nonConverted: File;
    quotesStarted?: File;
  }): Promise<ProcessedFileData | null> => {
    setState({
      isProcessing: true,
      progress: 0,
      stage: 'Reading files...',
      error: null,
    });

    try {
      // Read all files as ArrayBuffers in parallel
      const bufferPromises = [
        files.trips.arrayBuffer(),
        files.quotes.arrayBuffer(),
        files.passthroughs.arrayBuffer(),
        files.hotPass.arrayBuffer(),
        files.bookings.arrayBuffer(),
        files.nonConverted.arrayBuffer(),
      ];

      // Add quotesStarted if provided
      if (files.quotesStarted) {
        bufferPromises.push(files.quotesStarted.arrayBuffer());
      }

      const buffers = await Promise.all(bufferPromises);
      const [tripsBuffer, quotesBuffer, passthroughsBuffer, hotPassBuffer, bookingsBuffer, nonConvertedBuffer] = buffers;
      const quotesStartedBuffer = files.quotesStarted ? buffers[6] : undefined;

      // Create worker
      const worker = new FileProcessorWorker();
      workerRef.current = worker;

      return new Promise((resolve, reject) => {
        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const { type, data, error, progress, stage } = e.data;

          if (type === 'progress') {
            setState((prev) => ({
              ...prev,
              progress: progress ?? prev.progress,
              stage: stage ?? prev.stage,
            }));
          } else if (type === 'success' && data) {
            setState({
              isProcessing: false,
              progress: 100,
              stage: 'Complete!',
              error: null,
            });
            worker.terminate();
            workerRef.current = null;
            resolve(data);
          } else if (type === 'error') {
            setState({
              isProcessing: false,
              progress: 0,
              stage: '',
              error: error ?? 'Unknown error',
            });
            worker.terminate();
            workerRef.current = null;
            reject(new Error(error));
          }
        };

        worker.onerror = (e) => {
          setState({
            isProcessing: false,
            progress: 0,
            stage: '',
            error: e.message || 'Worker error',
          });
          worker.terminate();
          workerRef.current = null;
          reject(new Error(e.message));
        };

        // Send files to worker (transferable for better performance)
        const transferables = [tripsBuffer, quotesBuffer, passthroughsBuffer, hotPassBuffer, bookingsBuffer, nonConvertedBuffer];
        if (quotesStartedBuffer) {
          transferables.push(quotesStartedBuffer);
        }

        worker.postMessage(
          {
            type: 'process',
            files: {
              trips: tripsBuffer,
              quotes: quotesBuffer,
              passthroughs: passthroughsBuffer,
              hotPass: hotPassBuffer,
              bookings: bookingsBuffer,
              nonConverted: nonConvertedBuffer,
              quotesStarted: quotesStartedBuffer,
            },
          },
          transferables
        );
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process files';
      setState({
        isProcessing: false,
        progress: 0,
        stage: '',
        error: errorMessage,
      });
      return null;
    }
  }, []);

  return {
    processFiles,
    state,
    cancelProcessing,
  };
};
