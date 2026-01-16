import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7005'

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
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      },
      signal: controller.signal
    })
    clearTimeout(id)

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Erro na requisição')
    }

    return data
  } catch (error: any) {
    clearTimeout(id)
    if (error.name === 'AbortError') {
      throw new Error('O servidor demorou muito para responder. Tente novamente.')
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
  taskflow: {
    fixBoard: () => request('/taskflow/fix-board', { method: 'POST' })
  }
}
