export type UserRole = 'admin' | 'user';
export type UserStatus = 'offline' | 'online' | 'bloqueado';

export interface Profile {
  id: string;
  nome: string;
  email_login: string;
  email_corporativo?: string;
  telefone?: string;
  ramal?: string;
  departamento?: string;
  role: UserRole;
  status: UserStatus;
  ativo: boolean;
  avatar_url?: string;
  created_at: string;
}

export interface Permissao {
  id: string;
  modulo: string;
  submodulo: string;
  descricao?: string;
}

export interface ProfilePermissao {
  profile_id: string;
  permissao_id: string;
  visualizar: boolean;
  editar: boolean;
  excluir: boolean;
  permissoes?: Permissao; // Joined data
}
