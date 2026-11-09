import type { AgentContact } from '@/lib/types'

export type AgentAssignment = {
  agentId: string | null
  zohoLeadId: string | null
  agent: AgentContact | null
}

export type AssignedAgentResult = {
  agent: AgentContact | null
  pending: boolean
}

export type AgentAssignmentStore = {
  readAssignment(userId: string): Promise<AgentAssignment>
  findActiveAgentByZohoUser(zohoUserId: string): Promise<AgentContact | null>
  saveAgent(userId: string, agentId: string): Promise<boolean>
}

function text(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function zohoUserId(value: string | null) {
  const id = value?.trim() ?? ''
  return /^\d{5,30}$/.test(id) ? id : null
}

export function agentContactFromRow(value: unknown): AgentContact | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const id = text(row.id)
  const name = text(row.name)
  const phone = text(row.phone)
  const email = text(row.email)
  if (!id || !name || !phone || !email) return null
  const imageUrl = text(row.imageUrl) ?? text(row.image_url) ?? undefined
  return {
    id,
    name,
    title: text(row.title) ?? '',
    phone,
    email,
    ...(imageUrl ? { imageUrl } : {}),
  }
}

export async function resolveFromAssignment(
  userId: string,
  current: AgentAssignment,
  store: AgentAssignmentStore,
  readOwnerId: (leadId: string) => Promise<string | null>,
): Promise<AssignedAgentResult> {
  if (current.agentId) return { agent: current.agent, pending: false }
  const leadId = current.zohoLeadId?.trim() ?? ''
  if (!leadId) return { agent: null, pending: false }

  const ownerId = zohoUserId(await readOwnerId(leadId))
  if (!ownerId) return { agent: null, pending: true }
  const agent = await store.findActiveAgentByZohoUser(ownerId)
  if (!agent) return { agent: null, pending: true }

  const saved = await store.saveAgent(userId, agent.id)
  if (saved) return { agent, pending: false }
  const latest = await store.readAssignment(userId)
  if (latest.agentId) return { agent: latest.agent, pending: false }
  return { agent: null, pending: true }
}
