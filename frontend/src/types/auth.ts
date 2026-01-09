export type Cargo =
  | 'ADMIN'
  | 'VENDEDOR'
  | 'MARKETING'
  | 'ADMINISTRATIVO'
  | 'FINANCEIRO'
  | 'RECURSOS_HUMANOS'
  | 'DEPARTAMENTO_PESSOAL'
  | 'LOGISTICA'
  | 'OFICINA'
  | 'TECNICO';

export interface Profile {
  id: string;
  nome: string;
  email_login: string;
  email_corporativo?: string | null;
  telefone?: string | null;
  ramal?: string | null;
  ativo: boolean;
  avatar_url?: string | null;
  created_at: string;
  updated_at?: string;
  cargo: Cargo | null;
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
