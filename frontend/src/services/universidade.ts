import { supabase } from '@/services/supabase';

export interface Catalogo {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: 'Apliflow' | 'Tecnotron';
  capa_url: string | null;
  arquivo_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export const universidadeService = {
  async fetchCatalogos() {
    const { data, error } = await (supabase
      .from('universidade_catalogos' as any)
      .select('*')
      .order('created_at', { ascending: false })) as any;

    if (error) throw error;
    return data as Catalogo[];
  },

  async createCatalogo(catalogo: Omit<Catalogo, 'id' | 'created_at' | 'updated_at' | 'created_by'>) {
    const { data, error } = await (supabase
      .from('universidade_catalogos' as any)
      .insert(catalogo)
      .select()
      .single()) as any;

    if (error) throw error;
    return data as Catalogo;
  },

  async deleteCatalogo(id: string) {
    const { error } = await (supabase
      .from('universidade_catalogos' as any)
      .delete()
      .eq('id', id)) as any;

    if (error) throw error;
  },

  async uploadFile(file: File, folder: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('universidade-catalogos')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('universidade-catalogos')
      .getPublicUrl(fileName);

    return data.publicUrl;
  }
};
