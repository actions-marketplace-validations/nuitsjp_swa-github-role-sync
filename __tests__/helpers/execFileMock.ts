import { jest } from '@jest/globals'
import { promisify } from 'node:util'

type AssertArgs = (args: unknown[]) => void

type ExecResult = {
  stdout?: string
  stderr?: string
  error?: Error & { stderr?: string }
  assertArgs?: AssertArgs
}

function attachPromisify(mock: jest.Mock): void {
  mock[promisify.custom] = (...args: unknown[]) =>
    new Promise((resolve, reject) => {
      mock(
        ...args,
        (error: Error | null, stdout?: unknown, stderr?: unknown) => {
          if (error) {
            reject(error)
            return
          }
          resolve({ stdout, stderr })
        }
      )
    })
}

export function createExecFileMock() {
  const execFileMock = jest.fn()
  attachPromisify(execFileMock)

  const queueResult = ({
    stdout = '',
    stderr = '',
    error,
    assertArgs
  }: ExecResult) => {
    execFileMock.mockImplementationOnce((...args) => {
      assertArgs?.(args)
      const callback = args.find((arg) => typeof arg === 'function') as (
        err: Error | null,
        stdout?: unknown,
        stderr?: unknown
      ) => void
      callback(error ?? null, stdout, stderr)
    })
  }

  const enqueueSuccess = (stdout: string, assertArgs?: AssertArgs): void => {
    queueResult({ stdout, stderr: '', assertArgs })
  }

  const enqueueFailure = (
    errorMessage: string,
    stderrMessage: string,
    assertArgs?: AssertArgs
  ): void => {
    const error = new Error(errorMessage) as Error & { stderr?: string }
    error.stderr = stderrMessage
    queueResult({ error, stdout: '', stderr: stderrMessage, assertArgs })
  }

  const reset = (): void => {
    execFileMock.mockReset()
    attachPromisify(execFileMock)
  }

  return {
    execFileMock,
    enqueueSuccess,
    enqueueFailure,
    enqueueResult: queueResult,
    reset
  }
}
