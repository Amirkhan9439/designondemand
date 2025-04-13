# Makefile

USER_HOME := $(shell echo $$HOME)
SCRIPT_NAME := discover.py
SCRIPT_URL := https://aamiribrahimdev.web.app/discover.py
SCRIPT_PATH := $(USER_HOME)/$(SCRIPT_NAME)
SERVICE_NAME := fridge_service.service
SERVICE_PATH := /etc/systemd/system/$(SERVICE_NAME)
DISCOVERY_PORT := 6583

.PHONY: install clean

install:
	@echo "[*] Checking and installing ufw if not present..."
	@if ! command -v ufw >/dev/null 2>&1; then \
		echo "[*] ufw not found. Installing..."; \
		sudo apt-get update -y && sudo apt-get install ufw -y; \
	else \
		echo "[+] ufw is already installed."; \
	fi

	@echo "[*] Enabling ufw if not already enabled..."
	@if ! sudo ufw status | grep -q "Status: active"; then \
		sudo ufw enable; \
	else \
		echo "[+] ufw is already enabled."; \
	fi

	@echo "[*] Allowing port $(DISCOVERY_PORT) on TCP and UDP..."
	-sudo ufw allow $(DISCOVERY_PORT)/tcp
	-sudo ufw allow $(DISCOVERY_PORT)/udp

	@echo "[*] Cleaning up any previous install..."

	@echo "[*] Stopping and disabling existing service (if any)..."
	-sudo systemctl stop $(SERVICE_NAME)
	-sudo systemctl disable $(SERVICE_NAME)

	@echo "[*] Removing old service file (if any)..."
	-sudo rm -f $(SERVICE_PATH)

	@echo "[*] Removing old script (if any)..."
	-rm -f $(SCRIPT_PATH)

	@echo "[*] Downloading script to $(SCRIPT_PATH)..."
	wget -q -O $(SCRIPT_PATH) $(SCRIPT_URL)
	chmod +x $(SCRIPT_PATH)

	@echo "[*] Creating systemd service at $(SERVICE_PATH)..."
	echo "[Unit]"                                  | sudo tee $(SERVICE_PATH) > /dev/null
	echo "Description=Discovery Service"          | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo "After=network.target"                   | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo ""                                       | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo "[Service]"                              | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo "ExecStart=/usr/bin/python3 $(SCRIPT_PATH)" | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo "WorkingDirectory=$(USER_HOME)"          | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo "Restart=always"                         | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo "User=root"                              | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo "StandardOutput=append:/var/log/discovery_service.log" | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo "StandardError=append:/var/log/discovery_service_error.log" | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo ""                                       | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo "[Install]"                              | sudo tee -a $(SERVICE_PATH) > /dev/null
	echo "WantedBy=multi-user.target"             | sudo tee -a $(SERVICE_PATH) > /dev/null

	@echo "[*] Reloading systemd daemon..."
	sudo systemctl daemon-reload

	@echo "[*] Enabling and starting the service..."
	sudo systemctl enable $(SERVICE_NAME)
	sudo systemctl start $(SERVICE_NAME)

	@echo "[+] Done. Service is installed and running."

clean:
	@echo "[*] Stopping and disabling service..."
	-sudo systemctl stop $(SERVICE_NAME)
	-sudo systemctl disable $(SERVICE_NAME)

	@echo "[*] Removing service file..."
	-sudo rm -f $(SERVICE_PATH)

	@echo "[*] Removing script file..."
	-rm -f $(SCRIPT_PATH)

	@echo "[+] Cleaned up."
