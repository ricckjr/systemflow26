I will implement the **Equipment Entry into Production** flow as requested. This involves creating a new database structure, a new Kanban board for Services, and integrating it with the existing OMIE Kanban.

### 1. Database & Types Setup
*   **Schema Definition**: I will provide the SQL to create the `services` table with the required columns (`id`, `cod_proposta`, `cliente`, `status`, `data_entrada`, etc.).
*   **TypeScript Interfaces**: I will update `src/types/database.types.ts` (manually, as I cannot introspect) and create a domain interface `Service` in `src/types/domain.ts` to match the new table structure.

### 2. Frontend Services & Hooks
*   **Service Layer**: Create `src/services/production.ts` to handle:
    *   Creating new service records (`createService`).
    *   Fetching services (`getServices`).
    *   Updating status (`updateServiceStatus`).
    *   Uploading images to Supabase Storage (bucket `production-files` or `task-attachments`).
*   **Custom Hook**: Create `src/hooks/useProduction.ts` to manage the state of the Services Kanban (fetching, real-time updates if possible, drag-and-drop logic).

### 3. New Components (Production)
*   **`src/components/producao/EquipmentEntryModal.tsx`**:
    *   A modal form with the specified fields (`id_rst`, `cod_proposta`, `cliente`, etc.).
    *   Logic to pre-fill data from the OMIE proposal.
    *   Image upload functionality.
*   **`src/components/producao/ServiceKanbanBoard.tsx`**:
    *   The Kanban board with fixed columns (`ANALISE`, `LABORATORIO`, `OFICINA`, etc.).
    *   Drag-and-drop implementation using `@hello-pangea/dnd`.
*   **`src/components/producao/ServiceCard.tsx`**:
    *   The individual card component for the Kanban.

### 4. Integration with OMIE Kanban
*   **Modify `src/pages/Producao/OmieKanban.tsx`**:
    *   Add the **"ENTRADA DE EQUIPAMENTO"** button to the proposal details modal.
    *   Implement the **"Equipamentos em Produção"** list view within the same modal to show linked equipments and their current status.
    *   Connect the button to open the `EquipmentEntryModal`.

### 5. Page Updates
*   **Update `src/pages/Producao/Servicos.tsx`**:
    *   Replace the current list view with the new `ServiceKanbanBoard`.

### Technical Details
*   **Status Management**: The Kanban will strictly follow the 8 fixed stages.
*   **Storage**: I will assume a bucket named `production-files` exists or use `task-attachments` if you prefer.
*   **Styling**: Use Tailwind CSS to match the existing "SystemFlow" design (dark mode, specific colors).

**Confirmation Needed**:
*   Can I proceed with creating the `services` table structure via SQL instruction in the response (for you to run) or should I assume it's done? (I will provide the SQL regardless).
*   For the storage bucket, I will default to `production-files`.
