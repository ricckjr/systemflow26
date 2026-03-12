import subprocess
import sys
import time

PROJECT_DIR = "/opt/systemflow26"
COMPOSE_ENV_FILE = "./backend/.env"
HEALTH_URL = "http://localhost:7005/health"
HEALTH_RETRIES = 12
HEALTH_INTERVAL = 5  # segundos entre tentativas

compose = f"docker compose --env-file {COMPOSE_ENV_FILE}"


def run(cmd, check=True):
    print(f"\n▶ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=PROJECT_DIR)
    if check and result.returncode != 0:
        print(f"\n❌ Command failed: {cmd}")
        sys.exit(1)
    return result.returncode


def run_output(cmd):
    result = subprocess.run(
        cmd, shell=True, cwd=PROJECT_DIR,
        capture_output=True, text=True
    )
    return result.stdout.strip()


def check_dirty_files():
    """Impede reset --hard se houver arquivos não-rastreados que podem ser perdidos."""
    untracked = run_output("git status --porcelain")
    if untracked:
        print("\n⚠️  Working directory não está limpo:")
        print(untracked)
        print("\nArquivos locais NÃO commitados serão descartados pelo git reset --hard.")
        answer = input("Continuar mesmo assim? [s/N] ").strip().lower()
        if answer != "s":
            print("Deploy cancelado.")
            sys.exit(0)


def wait_healthy():
    """Aguarda o backend responder no /health após o deploy."""
    print(f"\n⏳ Aguardando backend ficar saudável ({HEALTH_RETRIES}x a cada {HEALTH_INTERVAL}s)...")
    for attempt in range(1, HEALTH_RETRIES + 1):
        code = run(
            f'curl -sf {HEALTH_URL} -o /dev/null',
            check=False
        )
        if code == 0:
            print("✅ Backend está saudável.")
            return True
        print(f"   tentativa {attempt}/{HEALTH_RETRIES} — aguardando...")
        time.sleep(HEALTH_INTERVAL)
    return False


# ──────────────────────────────────────────────
start = time.time()
print("\n🚀 SystemFlow Deploy Starting...\n")

# 1. Verificar arquivos sujos antes de destruir
check_dirty_files()

# 2. Salvar hash atual para rollback
old_hash = run_output("git rev-parse --short HEAD")
print(f"\n📌 Versão atual: {old_hash}")

# 3. Atualizar código
run("git fetch origin")
run("git reset --hard origin/main")

new_hash = run_output("git rev-parse --short HEAD")
print(f"📌 Nova versão:  {new_hash}")

if old_hash == new_hash:
    print("\nℹ️  Nenhum commit novo. Rebuild forçado mesmo assim.")

# 4. BUILD das novas imagens ANTES de derrubar os containers
#    Minimiza a janela de downtime para apenas o tempo do `down` + `up`
print("\n🔨 Construindo novas imagens (containers antigos ainda no ar)...")
build_code = run(f"{compose} build", check=False)
if build_code != 0:
    print(f"\n❌ Build falhou. Rollback para {old_hash}...")
    run(f"git reset --hard {old_hash}")
    sys.exit(1)

# 5. Substituir containers (downtime mínimo aqui)
run(f"{compose} down")
run(f"{compose} up -d")

# 6. Verificar saúde do backend
if not wait_healthy():
    print(f"\n❌ Backend não respondeu após o deploy.")
    print(f"   Iniciando rollback para {old_hash}...")
    run(f"git reset --hard {old_hash}")
    run(f"{compose} build")
    run(f"{compose} down")
    run(f"{compose} up -d")
    print("\n⚠️  Rollback concluído. Verifique os logs: docker compose logs backend")
    sys.exit(1)

# 7. Status final
run("docker ps")

elapsed = round(time.time() - start)
print(f"\n✅ SystemFlow deployed successfully! ({elapsed}s) [{old_hash} → {new_hash}]")
