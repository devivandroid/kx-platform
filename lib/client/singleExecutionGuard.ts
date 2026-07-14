export type SingleExecutionGuard = {
  canExecute: () => boolean;
  hasCompleted: () => boolean;
  isRunning: () => boolean;
  run: <T>(operation: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
};

export function createSingleExecutionGuard(label: string, devLog = process.env.NODE_ENV !== "production"): SingleExecutionGuard {
  let inFlight = false;
  let completed = false;
  let executionCount = 0;

  return {
    canExecute: () => !inFlight && !completed,
    hasCompleted: () => completed,
    isRunning: () => inFlight,
    reset: () => {
      inFlight = false;
      completed = false;
      executionCount = 0;
    },
    run: async (operation) => {
      if (inFlight || completed) return null;

      inFlight = true;
      executionCount += 1;
      if (devLog) {
        console.info(`[KX Protected Transactions] ${label} call count: ${executionCount}`);
      }

      try {
        const result = await operation();
        completed = true;
        return result;
      } finally {
        inFlight = false;
      }
    }
  };
}
