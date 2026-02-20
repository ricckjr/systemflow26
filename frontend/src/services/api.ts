import { supabase } from './supabase'

const API_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:7005').replace(/\/+$/, '')

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  }
}

async function request(endpoint: string, options: RequestInit = {}) {
  const headers = await getHeaders()
  
  // Timeout de 15s para requisições ao backend
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 15000)

  try {
    const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const response = await fetch(`${API_URL}${safeEndpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      },
      signal: controller.signal
    })
    clearTimeout(id)

    if (response.status === 204) return null

    const contentType = String(response.headers.get('content-type') || '')
    let data: any = null
    let rawText: string | null = null

    if (contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch {
        data = null
      }
    } else {
      try {
        rawText = await response.text()
      } catch {
        rawText = null
      }
      if (rawText) {
        try {
          data = JSON.parse(rawText)
        } catch {
          data = null
        }
      }
    }

    if (!response.ok) {
      const apiError = typeof data?.error === 'string' ? data.error : null
      const fallback = (rawText || '').replace(/\s+/g, ' ').trim()
      const msg = apiError || (fallback ? fallback.slice(0, 200) : '') || response.statusText || 'Erro na requisição'
      throw new Error(`[${response.status}] ${msg}`)
    }

    if (data !== null) return data
    if (rawText !== null) return rawText
    return null
  } catch (error: any) {
    clearTimeout(id)
    if (error.name === 'AbortError') {
      throw new Error('O servidor demorou muito para responder. Tente novamente.')
    }
    const msg = String(error?.message || '')
    if (error instanceof TypeError || msg.includes('Failed to fetch')) {
      throw new Error('Não foi possível conectar ao servidor de API. Verifique se o backend está rodando e se VITE_API_URL aponta para o endereço correto.')
    }
    throw error
  }
}

export const api = {
  users: {
    list: (page = 1, limit = 50, search = '') => 
      request(`/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),
    
    get: (id: string) => 
      request(`/admin/users/${id}`),
    
    create: (userData: any) => 
      request('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      }),
    
    update: (id: string, userData: any) => 
      request(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(userData)
      }),

    setAvatar: (id: string, dataUrl: string) =>
      request(`/admin/users/${id}/avatar`, {
        method: 'POST',
        body: JSON.stringify({ dataUrl })
      }),
    
    disable: (id: string) => 
      request(`/admin/users/${id}/disable`, {
        method: 'PATCH'
      }),
    
    enable: (id: string) => 
      request(`/admin/users/${id}/enable`, {
        method: 'PATCH'
      }),
    
    delete: (id: string) => 
      request(`/admin/users/${id}`, {
        method: 'DELETE'
      }),
    
    resetPassword: (id: string, novaSenha: string) => 
      request(`/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ novaSenha })
      })
  },
  rbac: {
    listPerfis: () => request('/admin/rbac/perfis'),
    createPerfil: (payload: { perfil_nome: string; perfil_descricao?: string | null }) =>
      request('/admin/rbac/perfis', { method: 'POST', body: JSON.stringify(payload) }),
    updatePerfil: (perfilId: string, payload: { perfil_nome?: string; perfil_descricao?: string | null }) =>
      request(`/admin/rbac/perfis/${perfilId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deletePerfil: (perfilId: string) =>
      request(`/admin/rbac/perfis/${perfilId}`, { method: 'DELETE' }),

    listPermissoes: () => request('/admin/rbac/permissoes'),
    createPermissao: (payload: { modulo: string; acao: string; descricao?: string | null }) =>
      request('/admin/rbac/permissoes', { method: 'POST', body: JSON.stringify(payload) }),
    deletePermissao: (permissaoId: string) =>
      request(`/admin/rbac/permissoes/${permissaoId}`, { method: 'DELETE' }),

    getPerfilPermissoes: (perfilId: string) => request(`/admin/rbac/perfis/${perfilId}/permissoes`),
    setPerfilPermissoes: (perfilId: string, permissao_ids: string[]) =>
      request(`/admin/rbac/perfis/${perfilId}/permissoes`, { method: 'PUT', body: JSON.stringify({ permissao_ids }) }),

    assignUserPerfil: (userId: string, perfil_id: string) =>
      request(`/admin/users/${userId}/perfil`, { method: 'PATCH', body: JSON.stringify({ perfil_id }) })
  },
  taskflow: {
    fixBoard: () => request('/taskflow/fix-board', { method: 'POST' })
  },
  estoque: {
    movimentar: (payload: {
      prod_id: string
      tipo_movimentacao: 'Entrada' | 'Saida' | 'Ajuste' | 'Transferencia'
      quantidade: number
      local_estoque: string
      local_estoque_destino?: string | null
      valor_compra_unit?: number | null
      motivo?: string | null
      data_movimentacao?: string | null
    }) =>
      request('/estoque/movimentar', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
  }
}
