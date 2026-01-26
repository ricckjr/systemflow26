create table if not exists public.vps_health_logs ( 
  host text not null, 
  timestamp timestamptz not null, 
  load_1 numeric, 
  load_5 numeric, 
  load_15 numeric, 
  mem_total_gb numeric, 
  mem_used_gb numeric, 
  mem_free_gb numeric, 
  mem_available_gb numeric, 
  swap_total_gb numeric, 
  swap_used_gb numeric, 
  disk_total_gb numeric, 
  disk_used_gb numeric, 
  disk_available_gb numeric, 
  disk_use_percent integer, 
  docker_images text, 
  docker_containers text, 
  docker_volumes text, 
  docker_build_cache text, 
  created_at timestamptz default now(), 
  constraint vps_health_logs_pk primary key (host, timestamp) 
); 

-- Create index for faster queries on host and timestamp
create index if not exists vps_health_logs_host_timestamp_idx on public.vps_health_logs (host, timestamp desc);
