# Gestor de Polos & Amigos - Makefile
# Define que o shell usado pelo make será o bash
SHELL := /bin/bash

# ===== VARIÁVEIS =====
PACKAGE_NAME = com.polos.gestor
APP_NAME = Gestor de Polos
APK_PATH = ./platforms/android/app/build/outputs/apk/debug/app-debug.apk
DEVICE_IP = 192.168.1.50
PORT = 5555
BACKUP_PATH = /sdcard/Download/polos-backup

# ===== PHONY TARGETS =====
.PHONY: help build clean install uninstall run logs connect mirror backup prepare \
        dev release reset db-reset

# ===== HELP =====
help:
	@echo "╔════════════════════════════════════════════════════════════╗"
	@echo "║         Gestor de Polos & Amigos - Makefile Help          ║"
	@echo "╚════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "🏗️  BUILD & COMPILE"
	@echo "  make build            - Compila APK de debug"
	@echo "  make prepare          - Prepara assets (sem compilar)"
	@echo "  make clean            - Limpa build artifacts"
	@echo ""
	@echo "📱 DEVICE MANAGEMENT"
	@echo "  make connect          - Conecta ao dispositivo (IP: $(DEVICE_IP):$(PORT))"
	@echo "  make mirror           - Espelha tela com scrcpy"
	@echo ""
	@echo "📦 INSTALLATION"
	@echo "  make install          - Instala APK no dispositivo"
	@echo "  make reinstall        - Desinstala e reinstala"
	@echo "  make uninstall        - Desinstala do dispositivo"
	@echo ""
	@echo "▶️  EXECUTION"
	@echo "  make run              - Inicia aplicativo"
	@echo "  make logs             - Mostra logs da aplicação"
	@echo "  make dev              - Build + Install + Run (workflow de desenvolvimento)"
	@echo ""
	@echo "🔧 MAINTENANCE"
	@echo "  make backup           - Faz backup do APK no celular"
	@echo "  make reset            - Limpa dados do app"
	@echo "  make db-reset         - Reseta banco de dados (remove app data)"
	@echo ""

# ===== CORDOVA BUILD =====
build:
	@echo "🔨 Compilando APK de debug..."
	cordova build android
	@echo "✅ Build concluído!"
	@ls -lh $(APK_PATH)

prepare:
	@echo "📋 Preparando assets..."
	cordova prepare android

clean:
	@echo "🧹 Limpando build artifacts..."
	cordova clean android
	@echo "✅ Limpo!"

# ===== ADB CONNECTION =====
connect:
	@echo "🔗 Conectando a $(DEVICE_IP):$(PORT)..."
	adb connect $(DEVICE_IP):$(PORT)
	@sleep 2
	adb devices

mirror:
	@echo "🖥️  Iniciando espelho de tela (scrcpy)..."
	scrcpy --always-on-top

# ===== INSTALLATION =====
install: build
	@echo "📥 Instalando APK..."
	adb install -r $(APK_PATH)
	@echo "✅ Instalado!"

reinstall: uninstall install
	@echo "✅ Reinstalação concluída!"

uninstall:
	@echo "📤 Desinstalando..."
	adb uninstall $(PACKAGE_NAME)
	@echo "✅ Desinstalado!"

# ===== EXECUTION =====
run:
	@echo "▶️  Iniciando aplicativo..."
	adb shell am start -n $(PACKAGE_NAME)/.MainActivity
	@echo "✅ Aplicativo iniciado!"

logs:
	@echo "📊 Exibindo logs (Ctrl+C para parar)..."
	adb logcat *:S $(PACKAGE_NAME):V

dev: install run logs
	@echo "🎯 Workflow de desenvolvimento concluído!"

# ===== MAINTENANCE =====
backup:
	@echo "💾 Fazendo backup do APK..."
	@adb shell mkdir -p $(BACKUP_PATH)
	@LAST_VER=$$(adb shell "ls $(BACKUP_PATH) 2>/dev/null" | grep -o 'v[0-9]\+' | sed 's/v//' | sed 's/^0*//' | sort -n | tail -1); \
	if [ -z "$$LAST_VER" ]; then \
		NEW_VER=1; \
	else \
		NEW_VER=$$((LAST_VER + 1)); \
	fi; \
	FMT_VER=$$(printf "%02d" $$NEW_VER); \
	NEW_NAME="polos-backup-v$$FMT_VER.apk"; \
	echo "🚀 Backup versão v$$FMT_VER..."; \
	adb push $(APK_PATH) $(BACKUP_PATH)/$$NEW_NAME; \
	echo "✅ Backup: $$NEW_NAME"

reset:
	@echo "🔄 Limpando dados do app..."
	adb shell pm clear $(PACKAGE_NAME)
	@echo "✅ Dados limpos!"

db-reset: uninstall install
	@echo "✅ App reinstalado com banco de dados limpo!"

# ===== DEFAULT =====
.DEFAULT_GOAL := help
