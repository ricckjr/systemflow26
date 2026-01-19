import subprocess
import sys
import os

PROJECT_DIR = "/opt/systemflow26"

def run(cmd):
    print(f"\n▶ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=PROJECT_DIR)
    if result.returncode != 0:
        print(f"\n❌ Command failed: {cmd}")
        sys.exit(1)

print("\n🚀 SystemFlow Deploy Starting...\n")

run("git fetch origin")
run("git reset --hard origin/main")

run("docker compose down")
run("docker compose pull")
run("docker compose build")
run("docker compose up -d")

run("docker ps")

print("\n✅ SystemFlow deployed successfully!")
