import subprocess
import sys

PROJECT_DIR = "/opt/systemflow26"
COMPOSE_ENV_FILE = "./backend/.env"

def run(cmd):
    print(f"\n▶ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=PROJECT_DIR)
    if result.returncode != 0:
        print(f"\n❌ Command failed: {cmd}")
        sys.exit(1)

print("\n🚀 SystemFlow Deploy Starting...\n")

run("git fetch origin")
run("git reset --hard origin/main")

compose = f"docker compose --env-file {COMPOSE_ENV_FILE}"
run(f"{compose} down")
run(f"{compose} pull")
run(f"{compose} build")
run(f"{compose} up -d")

run("docker ps")

print("\n✅ SystemFlow deployed successfully!")
