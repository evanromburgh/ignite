import { describe, expect, it, vi } from 'vitest'
import { agentContactFromRow, resolveFromAssignment, type AgentAssignment, type AgentAssignmentStore } from '@/lib/assigned-agent'
import type { AgentContact } from '@/lib/types'

const erin: AgentContact = {
  id: 'agent-erin',
  name: 'Erin Allen',
  title: 'Sales Specialist',
  phone: '+27716741771',
  email: 'erin@ignite-studios.co.za',
}

function store(overrides: Partial<AgentAssignmentStore> = {}): AgentAssignmentStore {
  return {
    readAssignment: vi.fn(),
    findActiveAgentByZohoUser: vi.fn(),
    saveAgent: vi.fn(),
    ...overrides,
  }
}

function assignment(overrides: Partial<AgentAssignment> = {}): AgentAssignment {
  return { agentId: null, zohoLeadId: null, agent: null, ...overrides }
}

describe('assigned agent', () => {
  it('keeps a saved agent without reading the lead again', async () => {
    const readOwnerId = vi.fn()
    const saved = store()

    await expect(resolveFromAssignment('user-1', assignment({
      agentId: erin.id,
      zohoLeadId: '5843104000000123456',
      agent: erin,
    }), saved, readOwnerId)).resolves.toEqual({ agent: erin, pending: false })

    expect(readOwnerId).not.toHaveBeenCalled()
    expect(saved.findActiveAgentByZohoUser).not.toHaveBeenCalled()
    expect(saved.saveAgent).not.toHaveBeenCalled()
  })

  it('does not replace a saved agent when that agent is inactive', async () => {
    const readOwnerId = vi.fn()

    await expect(resolveFromAssignment('user-1', assignment({
      agentId: erin.id,
      zohoLeadId: '5843104000000123456',
      agent: null,
    }), store(), readOwnerId)).resolves.toEqual({ agent: null, pending: false })

    expect(readOwnerId).not.toHaveBeenCalled()
  })

  it('stops when the profile has no Zoho lead', async () => {
    const readOwnerId = vi.fn()

    await expect(resolveFromAssignment('user-1', assignment(), store(), readOwnerId)).resolves.toEqual({
      agent: null,
      pending: false,
    })
    expect(readOwnerId).not.toHaveBeenCalled()
  })

  it('saves the agent that matches the lead owner', async () => {
    const readOwnerId = vi.fn().mockResolvedValue('5843104000000311031')
    const saved = store({
      findActiveAgentByZohoUser: vi.fn().mockResolvedValue(erin),
      saveAgent: vi.fn().mockResolvedValue(true),
    })

    await expect(resolveFromAssignment('user-1', assignment({
      zohoLeadId: '5843104000000123456',
    }), saved, readOwnerId)).resolves.toEqual({ agent: erin, pending: false })

    expect(saved.findActiveAgentByZohoUser).toHaveBeenCalledWith('5843104000000311031')
    expect(saved.saveAgent).toHaveBeenCalledWith('user-1', erin.id)
  })

  it('waits while the workflow has not assigned a matching owner', async () => {
    const saved = store({ findActiveAgentByZohoUser: vi.fn().mockResolvedValue(null) })

    await expect(resolveFromAssignment('user-1', assignment({
      zohoLeadId: '5843104000000123456',
    }), saved, vi.fn().mockResolvedValue(null))).resolves.toEqual({ agent: null, pending: true })

    await expect(resolveFromAssignment('user-1', assignment({
      zohoLeadId: '5843104000000123456',
    }), saved, vi.fn().mockResolvedValue('5843104000000999999'))).resolves.toEqual({ agent: null, pending: true })

    expect(saved.saveAgent).not.toHaveBeenCalled()
  })

  it('ignores an owner id that is not a Zoho user id', async () => {
    const saved = store()

    await expect(resolveFromAssignment('user-1', assignment({
      zohoLeadId: '5843104000000123456',
    }), saved, vi.fn().mockResolvedValue('api-user'))).resolves.toEqual({ agent: null, pending: true })

    expect(saved.findActiveAgentByZohoUser).not.toHaveBeenCalled()
    expect(saved.saveAgent).not.toHaveBeenCalled()
  })

  it('returns the agent saved by a concurrent request', async () => {
    const saved = store({
      findActiveAgentByZohoUser: vi.fn().mockResolvedValue(erin),
      saveAgent: vi.fn().mockResolvedValue(false),
      readAssignment: vi.fn().mockResolvedValue(assignment({ agentId: erin.id, agent: erin })),
    })

    await expect(resolveFromAssignment('user-1', assignment({
      zohoLeadId: '5843104000000123456',
    }), saved, vi.fn().mockResolvedValue('5843104000000311031'))).resolves.toEqual({ agent: erin, pending: false })
    expect(saved.readAssignment).toHaveBeenCalledWith('user-1')
  })

  it('accepts an agent row from the database or the API', () => {
    expect(agentContactFromRow({
      id: erin.id,
      name: erin.name,
      title: erin.title,
      phone: erin.phone,
      email: erin.email,
      image_url: ' https://example.com/erin.jpg ',
    })).toEqual({ ...erin, imageUrl: 'https://example.com/erin.jpg' })

    expect(agentContactFromRow({ ...erin, imageUrl: 'https://example.com/erin.jpg' })).toEqual({
      ...erin,
      imageUrl: 'https://example.com/erin.jpg',
    })
    expect(agentContactFromRow({ id: erin.id, name: erin.name })).toBeNull()
    expect(agentContactFromRow(null)).toBeNull()
  })
})