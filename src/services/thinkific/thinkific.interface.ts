export interface CreateThinkificUserI {
  email: string,
  firstName: string,
  lastName: string
}

export interface GetThinkificUserI {
  query?: {
    email?: string
  }
}

export interface CreateThinkificEnrollmentsI {
  userId: number,
  courseId: number,
  activatedAt: string
}

export interface CreateThinkificEnrollmentsId {
  enrollId: number
}

export interface CreateThinkificWebhookI {
  topic: string,
  targetUrl: String
}