## Objetivo
- Transformar o botão de perfil do sidebar em um link para uma página dedicada de Perfil.
- Remover totalmente o modal de perfil existente.
- Padronizar a exibição do Nome, Role e E-mail no sidebar e na página, corrigindo casos em que aparecem campos errados.

## Alterações no Sidebar (Layout.tsx)
1. Substituir o onClick do botão de perfil por navegação: navigate('/app/configuracoes/perfil').
2. Remover estados e funções do modal (isProfileModalOpen, openProfileModal, profileEdit, saveProfile, savePassword, etc.).
3. Excluir o bloco do modal (overlay/dialog) do Layout.
4. Padronizar os campos no botão: mostrar profileView.nome, profileView.role e profileView.email_login com fallback seguro.
5. Atualizar o mapa de títulos do header para incluir '/app/configuracoes/perfil' → 'PERFIL'.

## Nova Página: Configurações/Perfil (pages/Configuracoes/Perfil.tsx)
1. Carregar dados do usuário autenticado via useAuth (profile).
2. Exibir formulário profissional com campos:
   - Nome (editável, obrigatório)
   - E-mail corporativo (editável, validado; manter email_login apenas como leitura)
   - Telefone, Ramal, Departamento (editáveis opcionais)
3. Upload de avatar com pré-visualização; aceitar JPG/PNG e subir para bucket 'avatars' do Supabase (gerar URL pública).
4. Validação simples (nome obrigatório, e-mail válido);
5. Ações claras: "Salvar" (update profiles) e "Cancelar" (reset do formulário e preview).
6. Layout consistente com o design industrial já usado em Usuarios.tsx.

## Router
1. Adicionar rota filha em /app: 'configuracoes/perfil' apontando para a nova página Perfil.
2. Manter rotas existentes (usuarios/permissoes) sem alterações.

## Correções de Dados
1. Garantir que no sidebar sempre apareça: Nome (profileView.nome), Role (profileView.role), E-mail (profileView.email_login).
2. Evitar mostrar email_corporativo no lugar de email_login no sidebar.

## Logout
- Manter confirmação de saída, limpeza de tokens (sb-* no localStorage), signOut, e redirect para /login.

## Verificação
- Rodar dev server e validar navegação para /app/configuracoes/perfil.
- Conferir exibição correta de Nome/Role/E-mail no sidebar.
- Validar upload de avatar, salvar e cancelar na página.

Confirma proceder com essas alterações?