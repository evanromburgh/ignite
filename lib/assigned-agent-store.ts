import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentAssignment, AgentAssignmentStore } from '@/lib/assigned-agent'
import { agentContactFromRow } from '@/lib/assigned-agent'

const AGENT_COLUMNS = 'id, name, title, phone, email, image_url'

export class AgentAssignmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentAssignmentError'
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function createAgentAssignmentStore(supabase: SupabaseClient): AgentAssignmentStore {
  return {
    async readAssignment(userId): Promise<AgentAssignment> {
      const { data, error } = await supabase
        .from('profiles')
        .select('agent_id, zoho_lead_id')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw new AgentAssignmentError('profile read failed')
      const agentId = text(data?.agent_id)
      const zohoLeadId = text(data?.zoho_lead_id)
      if (!agentId) return { agentId: null, zohoLeadId: zohoLeadId || null, agent: null }

      const agent = await supabase
        .from('agents')
        .select(AGENT_COLUMNS)
        .eq('id', agentId)
        .eq('is_active', true)
        .maybeSingle()
      if (agent.error) throw new AgentAssignmentError('agent read failed')
      return { agentId, zohoLeadId: zohoLeadId || null, agent: agentContactFromRow(agent.data) }
    },

    async findActiveAgentByZohoUser(zohoUserId) {
      const { data, error } = await supabase
        .from('agents')
        .select(AGENT_COLUMNS)
        .eq('zoho_user_id', zohoUserId)
        .eq('is_active', true)
        .maybeSingle()
      if (error) throw new AgentAssignmentError('agent lookup failed')
      return agentContactFromRow(data)
    },

    async saveAgent(userId, agentId) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ agent_id: agentId })
        .eq('id', userId)
        .is('agent_id', null)
        .select('agent_id')
        .maybeSingle()
      if (error) throw new AgentAssignmentError('agent save failed')
      return Boolean(text(data?.agent_id))
    },
  }
}
