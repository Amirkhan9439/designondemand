import socket
import threading
import os

DISCOVERY_PORT = 6583
DISCOVERY_TOKEN = "IENFJKFF((WF(*WHFFNOSJF"
ANSWER_TOKEN = "2942528fkanfwk342425j23492"

UID_FILE = "uid.txt"

def save_uid(uid):
    try:
        with open(UID_FILE, "w") as f:
            f.write(uid)
        print(f"[+] UID '{uid}' saved to {UID_FILE}")
    except Exception as e:
        print("[-] Error saving UID:", e)

def load_uid():
    if os.path.exists(UID_FILE):
        try:
            with open(UID_FILE, "r") as f:
                uid = f.read().strip()
                print(f"[+] Loaded UID from file: {uid}")
                return uid
        except Exception as e:
            print("[-] Error reading UID file:", e)
    else:
        print("[-] UID file not found. No UID is set yet.")
    return None

def discovery_server():
    udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    udp_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    udp_socket.bind(("0.0.0.0", DISCOVERY_PORT))
    print(f"[*] Listening for discovery tokens on UDP port {DISCOVERY_PORT}...")

    while True:
        try:
            data, addr = udp_socket.recvfrom(1024)
            message = data.decode("utf-8").strip()
            print(f"[+] Received '{message}' from {addr}")

            if message == DISCOVERY_TOKEN:
                udp_socket.sendto(ANSWER_TOKEN.encode("utf-8"), addr)
                print(f"[+] Sent discovery response '{ANSWER_TOKEN}' to {addr}")

                # Wait for the UID from the same address
                udp_socket.settimeout(5.0)
                try:
                    data, sender_addr = udp_socket.recvfrom(1024)
                    id_message = data.decode("utf-8").strip()
                    if sender_addr == addr:
                        print(f"[+] Received UID from {addr}: {id_message}")
                        save_uid(id_message)
                    else:
                        print(f"[-] Received UID from different address {sender_addr}, ignoring.")
                except socket.timeout:
                    print("[!] Timed out waiting for UID. Resuming discovery listening.")
                finally:
                    udp_socket.settimeout(None)
        except Exception as e:
            print("[-] Error in discovery server:", e)

if __name__ == "__main__":
    discovery_thread = threading.Thread(target=discovery_server, daemon=True)
    discovery_thread.start()
    discovery_thread.join()
