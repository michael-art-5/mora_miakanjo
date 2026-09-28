export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Options = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown }

export async function api<T>(path: string, { method = 'GET', body }: Options = {}): Promise<T> {
  const isForm = body instanceof FormData
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error || 'Une erreur est survenue')
  return data as T
}
