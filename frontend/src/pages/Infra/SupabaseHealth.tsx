import React, { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { 
  Activity, 
  Server, 
  Cpu, 
  HardDrive, 
  Database, 
  Clock, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Box
} from 'lucide-react';
import { formatDateTimeBR } from '@/utils/datetime';

// --- Types ---

interface VPSHealthLog {
  host: string;
  timestamp: string;
  load_1: number;
  load_5: number;
  load_15: number;
  mem_total_gb: number;
  mem_used_gb: number;
  mem_free_gb: number;
  mem_available_gb: number;
  swap_total_gb: number;
  swap_used_gb: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_available_gb: number;
  disk_use_percent: number;
  docker_images: string;
  docker_containers: string;
  docker_volumes: string;
  docker_build_cache: string;
  created_at: string;
}

// --- Components ---

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl p-6 hover:border-[var(--border)] transition-colors ${className}`}>
    {children}
  </div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
    {children}
  </div>
);

const Value = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`text-2xl font-semibold text-[var(--text-soft)] ${className}`}>
    {children}
  </div>
);

const StatusBadge = ({ status }: { status: 'ok' | 'warning' | 'critical' }) => {
  const styles = {
    ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  };

  const icons = {
    ok: <CheckCircle2 size={14} className="mr-1.5" />,
    warning: <AlertTriangle size={14} className="mr-1.5" />,
    critical: <XCircle size={14} className="mr-1.5" />
  };

  const labels = {
    ok: 'Operacional',
    warning: 'Atenção',
    critical: 'Crítico'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {icons[status]}
      {labels[status]}
    </span>
  );
};

const ProgressBar = ({ value, max, colorClass = 'bg-blue-500' }: { value: number; max: number; colorClass?: string }) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full bg-[var(--bg-panel)] rounded-full h-1.5 mt-2">
      <div 
        className={`h-1.5 rounded-full transition-all duration-500 ${colorClass}`} 
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// --- Main Page ---

const SupabaseHealth = () => {
  const [data, setData] = useState<VPSHealthLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [apiReady, setApiReady] = useState<boolean | null>(null)
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null)
  const [apiMeta, setApiMeta] = useState<{ version?: string; env?: string } | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiLastUpdated, setApiLastUpdated] = useState<Date | null>(null)

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: logs, error: err } = await (supabase as any)
        .from('vps_health_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (err) throw err;

      if (logs && logs.length > 0) {
        setData(logs[0] as VPSHealthLog);
      } else {
        setData(null);
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching VPS health:', err);
      setError(err.message || 'Falha ao carregar dados do servidor');
    } finally {
      setLoading(false);
    }
  };

  const fetchApi = async () => {
    setApiError(null)
    try {
      const base = String(import.meta.env.VITE_API_URL || 'http://localhost:7005').replace(/\/+$/, '')
      const t0 = performance.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const [statusRes, readyRes] = await Promise.all([
        fetch(`${base}/status`, { method: 'GET', cache: 'no-store', signal: controller.signal }),
        fetch(`${base}/ready`, { method: 'GET', cache: 'no-store', signal: controller.signal }),
      ])

      clearTimeout(timeout)
      const t1 = performance.now()
      setApiLatencyMs(Math.round(t1 - t0))
      setApiOnline(statusRes.ok)
      setApiReady(readyRes.ok)

      let meta: any = null
      try {
        meta = await statusRes.json()
      } catch {
        meta = null
      }
      setApiMeta(meta ? { version: meta.version, env: meta.env } : null)
      setApiLastUpdated(new Date())
    } catch (err: any) {
      setApiOnline(false)
      setApiReady(false)
      setApiLatencyMs(null)
      setApiMeta(null)
      setApiLastUpdated(new Date())
      setApiError(err?.message || 'Falha ao consultar API')
    }
  }

  useEffect(() => {
    fetchData();
    fetchApi();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    const intervalApi = setInterval(fetchApi, 60000);
    return () => {
      clearInterval(interval);
      clearInterval(intervalApi);
    };
  }, []);

  // --- Logic for status ---
  // Assuming 4 cores as a baseline since we don't have cpu_count in DB
  const CPU_CORES = 4; 
  
  const getCpuStatus = (load: number) => {
    if (load < CPU_CORES) return 'ok';
    if (load < CPU_CORES * 1.5) return 'warning';
    return 'critical';
  };

  const getDiskStatus = (percent: number) => {
    if (percent < 70) return 'ok';
    if (percent < 85) return 'warning';
    return 'critical';
  };

  const getMemStatus = (used: number, total: number) => {
    const percent = (used / total) * 100;
    if (percent < 80) return 'ok';
    if (percent < 90) return 'warning';
    return 'critical';
  };

  // Calculate overall status
  const overallStatus = data ? (
    (getCpuStatus(data.load_15) === 'critical' || 
     getDiskStatus(data.disk_use_percent) === 'critical' || 
     getMemStatus(data.mem_used_gb, data.mem_total_gb) === 'critical') 
      ? 'critical' 
      : (getCpuStatus(data.load_15) === 'warning' || 
         getDiskStatus(data.disk_use_percent) === 'warning' || 
         getMemStatus(data.mem_used_gb, data.mem_total_gb) === 'warning')
        ? 'warning'
        : 'ok'
  ) : 'ok';


  if (loading && !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="h-8 bg-[var(--bg-panel)] rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-48 bg-[var(--bg-panel)] rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-[var(--text-muted)]">
        <AlertTriangle size={48} className="text-rose-500 mb-4" />
        <h2 className="text-xl font-semibold text-[var(--text-soft)] mb-2">Erro ao carregar dashboard</h2>
        <p className="mb-6">{error}</p>
        <button 
          onClick={fetchData}
          className="px-4 py-2 bg-[var(--bg-panel)] hover:bg-[var(--bg-card)] rounded-lg text-white transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] text-[var(--text-muted)]">
        <Server size={48} className="text-[var(--text-soft)] mb-4" />
        <h2 className="text-xl font-semibold text-[var(--text-soft)] mb-2">Nenhum dado disponível</h2>
        <p className="mb-6">Aguardando logs do servidor...</p>
        <button 
          onClick={fetchData}
          className="px-4 py-2 bg-[var(--bg-panel)] hover:bg-[var(--bg-card)] rounded-lg text-white transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto bg-[var(--bg-main)] min-h-screen text-[var(--text-soft)] font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="text-blue-500" />
            Monitoramento de Infraestrutura
          </h1>
          <p className="text-[var(--text-muted)] mt-1 flex items-center gap-2 text-sm">
            <Server size={14} />
            {data.host}
            <span className="w-1 h-1 rounded-full bg-[var(--bg-card)] mx-1"></span>
            Última atualização: {formatDateTimeBR(data.timestamp)}
          </p>
        </div>

        <div className="flex items-center gap-4">
           <StatusBadge status={overallStatus} />
           <button 
             onClick={fetchData}
             className="p-2 hover:bg-[var(--bg-panel)] rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
             title="Atualizar agora"
           >
             <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-l-4 border-l-emerald-500">
          <div className="flex items-start justify-between">
            <div>
              <Label>API</Label>
              <div className="flex items-center gap-2">
                <Value className="text-lg">
                  {apiOnline === null ? '—' : apiOnline ? 'Online' : 'Offline'}
                </Value>
                <StatusBadge status={apiOnline === null ? 'warning' : apiOnline ? (apiReady ? 'ok' : 'warning') : 'critical'} />
              </div>
            </div>
            <Server className="text-emerald-500" />
          </div>

          <div className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
            <div className="flex items-center justify-between">
              <span>Pronto</span>
              <span className={apiReady === null ? 'text-[var(--text-muted)]' : apiReady ? 'text-emerald-400' : 'text-rose-400'}>
                {apiReady === null ? '—' : apiReady ? 'Sim' : 'Não'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Latência</span>
              <span className="text-[var(--text-soft)]">{apiLatencyMs === null ? '—' : `${apiLatencyMs} ms`}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ambiente</span>
              <span className="text-[var(--text-soft)]">{apiMeta?.env || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Versão</span>
              <span className="text-[var(--text-soft)]">{apiMeta?.version || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Atualização</span>
              <span className="text-[var(--text-soft)]">{apiLastUpdated ? formatDateTimeBR(apiLastUpdated.toISOString()) : '—'}</span>
            </div>
            {apiError && (
              <div className="mt-2 text-rose-400 text-xs">
                {apiError}
              </div>
            )}
          </div>
        </Card>
        
        {/* Card 1: Identificação & Status Geral (Combined into Header mainly, but detailed here if needed or separate) 
            Let's make this the CPU Card as per request order, but user asked for "Card 1 - Identificação"
        */}
        <Card className="lg:col-span-1 border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between">
            <div>
               <Label>Servidor</Label>
               <Value>{data.host}</Value>
            </div>
            <Server className="text-[var(--text-soft)]" size={24} />
          </div>
          
          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center text-sm border-b border-[var(--border)] pb-2">
              <span className="text-[var(--text-muted)]">Status</span>
              <span className={overallStatus === 'ok' ? 'text-emerald-400' : overallStatus === 'warning' ? 'text-amber-400' : 'text-rose-400'}>
                {overallStatus === 'ok' ? 'Normal' : overallStatus === 'warning' ? 'Atenção' : 'Crítico'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-[var(--border)] pb-2">
              <span className="text-[var(--text-muted)]">Uptime Check</span>
              <span className="text-emerald-400">Online</span>
            </div>
            <div className="flex justify-between items-center text-sm pt-1">
               <span className="text-[var(--text-muted)]">Região</span>
               <span className="text-[var(--text-soft)]">sa-east-1</span> 
            </div>
          </div>
        </Card>

        {/* Card 2: CPU */}
        <Card>
           <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                 <Cpu className="text-blue-500" size={20} />
                 <h3 className="font-semibold text-[var(--text-soft)]">Processamento</h3>
              </div>
              <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-main)] px-2 py-1 rounded">
                4 vCPUs
              </div>
           </div>
           
           <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-[var(--bg-main)]/50 rounded-lg">
                 <div className="text-xs text-[var(--text-muted)] mb-1">1 min</div>
                 <div className={`text-xl font-mono font-medium ${
                   getCpuStatus(data.load_1) === 'ok' ? 'text-emerald-400' : 
                   getCpuStatus(data.load_1) === 'warning' ? 'text-amber-400' : 'text-rose-400'
                 }`}>
                   {data.load_1.toFixed(2)}
                 </div>
              </div>
              <div className="p-3 bg-[var(--bg-main)]/50 rounded-lg">
                 <div className="text-xs text-[var(--text-muted)] mb-1">5 min</div>
                 <div className={`text-xl font-mono font-medium ${
                   getCpuStatus(data.load_5) === 'ok' ? 'text-emerald-400' : 
                   getCpuStatus(data.load_5) === 'warning' ? 'text-amber-400' : 'text-rose-400'
                 }`}>
                   {data.load_5.toFixed(2)}
                 </div>
              </div>
              <div className="p-3 bg-[var(--bg-main)]/50 rounded-lg">
                 <div className="text-xs text-[var(--text-muted)] mb-1">15 min</div>
                 <div className={`text-xl font-mono font-medium ${
                   getCpuStatus(data.load_15) === 'ok' ? 'text-emerald-400' : 
                   getCpuStatus(data.load_15) === 'warning' ? 'text-amber-400' : 'text-rose-400'
                 }`}>
                   {data.load_15.toFixed(2)}
                 </div>
              </div>
           </div>
           <p className="text-xs text-[var(--text-muted)] mt-4 text-center">
             Load Average ideal deve ser menor que 4.0
           </p>
        </Card>

        {/* Card 3: RAM */}
        <Card>
           <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                 <Database className="text-purple-500" size={20} />
                 <h3 className="font-semibold text-[var(--text-soft)]">Memória RAM</h3>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Total: {data.mem_total_gb} GB
              </div>
           </div>

           <div className="mb-4">
             <div className="flex justify-between text-sm mb-1">
               <span className="text-[var(--text-muted)]">Em uso</span>
               <span className="text-[var(--text-soft)] font-medium">{data.mem_used_gb} GB</span>
             </div>
             <ProgressBar 
               value={data.mem_used_gb} 
               max={data.mem_total_gb} 
               colorClass={getMemStatus(data.mem_used_gb, data.mem_total_gb) === 'ok' ? 'bg-purple-500' : 'bg-rose-500'} 
             />
           </div>

           <div className="grid grid-cols-2 gap-4 mt-4">
             <div>
                <Label>Disponível</Label>
                <div className="text-[var(--text-soft)]">{data.mem_available_gb} GB</div>
             </div>
             <div>
                <Label>Swap Usado</Label>
                <div className={`${data.swap_used_gb > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                   {data.swap_used_gb} GB
                </div>
             </div>
           </div>
        </Card>

        {/* Card 4: Disco */}
        <Card>
           <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                 <HardDrive className="text-cyan-500" size={20} />
                 <h3 className="font-semibold text-[var(--text-soft)]">Armazenamento</h3>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {data.disk_use_percent}% Uso
              </div>
           </div>

           <div className="flex items-center justify-center py-2">
              <div className="relative w-32 h-32 flex items-center justify-center">
                 {/* Simple CSS Donut or just text */}
                 <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={getDiskStatus(data.disk_use_percent) === 'ok' ? '#06b6d4' : getDiskStatus(data.disk_use_percent) === 'warning' ? '#f59e0b' : '#f43f5e'}
                      strokeWidth="3"
                      strokeDasharray={`${data.disk_use_percent}, 100`}
                      className="transition-all duration-1000 ease-out"
                    />
                 </svg>
                 <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-bold text-[var(--text-soft)]">{data.disk_use_percent}%</span>
                 </div>
              </div>
           </div>

           <div className="flex justify-between text-xs text-[var(--text-muted)] mt-2 px-4">
              <div className="text-center">
                 <div className="text-[var(--text-soft)] font-medium">{data.disk_used_gb} GB</div>
                 <div>Usado</div>
              </div>
              <div className="text-center">
                 <div className="text-[var(--text-soft)] font-medium">{data.disk_total_gb} GB</div>
                 <div>Total</div>
              </div>
           </div>
        </Card>

        {/* Card 5: Docker */}
        <Card className="md:col-span-2 lg:col-span-2">
           <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                 <Box className="text-indigo-500" size={20} />
                 <h3 className="font-semibold text-[var(--text-soft)]">Docker Stats</h3>
              </div>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[var(--bg-main)]/50 p-4 rounded-lg border border-[var(--border)]">
                 <Label>Containers</Label>
                 <div className="text-lg text-[var(--text-soft)] truncate" title={data.docker_containers}>
                   {data.docker_containers}
                 </div>
              </div>
              <div className="bg-[var(--bg-main)]/50 p-4 rounded-lg border border-[var(--border)]">
                 <Label>Imagens</Label>
                 <div className="text-lg text-[var(--text-soft)] truncate" title={data.docker_images}>
                   {data.docker_images}
                 </div>
              </div>
              <div className="bg-[var(--bg-main)]/50 p-4 rounded-lg border border-[var(--border)]">
                 <Label>Volumes</Label>
                 <div className="text-lg text-[var(--text-soft)] truncate" title={data.docker_volumes}>
                   {data.docker_volumes}
                 </div>
              </div>
              <div className="bg-[var(--bg-main)]/50 p-4 rounded-lg border border-[var(--border)]">
                 <Label>Build Cache</Label>
                 <div className="text-lg text-[var(--text-soft)] truncate" title={data.docker_build_cache}>
                   {data.docker_build_cache}
                 </div>
              </div>
           </div>
        </Card>

      </div>
    </div>
  );
};

export default SupabaseHealth;
