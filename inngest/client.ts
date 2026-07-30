import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'arlogic-upload-service',
  name: 'Arlogic Upload Service',
  retryFunction: (attempt: number) => ({
    delay: Math.min(1000 * Math.pow(2, attempt), 60000),
    maxAttempts: 5,
  }),
})
