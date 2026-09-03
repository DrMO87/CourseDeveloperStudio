import os
import json
import base64
import sqlite3
import shutil
import ctypes
import sys
from ctypes import wintypes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class DATA_BLOB(ctypes.Structure):
    _fields_ = [('cbData', wintypes.DWORD), ('pbData', ctypes.POINTER(ctypes.c_byte))]

def decrypt_dpapi(encrypted_data):
    blob_in = DATA_BLOB(len(encrypted_data), ctypes.cast(ctypes.create_string_buffer(encrypted_data), ctypes.POINTER(ctypes.c_byte)))
    blob_out = DATA_BLOB()
    if ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)):
        data = ctypes.string_at(blob_out.pbData, blob_out.cbData)
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)
        return data
    raise RuntimeError('DPAPI decrypt failed')

def extract_edge_cookies():
    local_state_path = os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Edge\User Data\Local State')
    if not os.path.exists(local_state_path):
        raise FileNotFoundError(f"Local State not found at {local_state_path}")

    with open(local_state_path, 'r', encoding='utf-8') as f:
        local_state = json.load(f)

    encrypted_key = base64.b64decode(local_state['os_crypt']['encrypted_key'])[5:]
    master_key = decrypt_dpapi(encrypted_key)
    aesgcm = AESGCM(master_key)

    db_path = os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Network\Cookies')
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Edge Cookies database not found at {db_path}")

    temp_db = os.path.join(os.path.dirname(__file__), 'temp_edge_cookies.db')
    shutil.copy2(db_path, temp_db)

    conn = sqlite3.connect(temp_db)
    cursor = conn.cursor()
    cursor.execute("SELECT name, value, encrypted_value FROM cookies WHERE host_key LIKE '%google.com'")

    google_cookies = {}
    for name, value, enc_val in cursor.fetchall():
        if value:
            google_cookies[name] = value
        elif enc_val:
            try:
                if enc_val[:3] == b'v10':
                    nonce = enc_val[3:15]
                    ciphertext = enc_val[15:]
                    decrypted = aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
                    google_cookies[name] = decrypted
            except Exception:
                pass

    conn.close()
    if os.path.exists(temp_db):
        os.remove(temp_db)

    return google_cookies

if __name__ == '__main__':
    try:
        cookies = extract_edge_cookies()
        print(f"Total Google cookies extracted: {len(cookies)}")
        keys = [k for k in ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', 'OSID', '__Secure-1PSID'] if k in cookies]
        print(f"Key Google auth cookies: {keys}")
        
        # Save to temp cookies.txt
        out_file = os.path.join(os.path.dirname(__file__), 'extracted_cookies.txt')
        cookie_header = "; ".join([f"{k}={v}" for k, v in cookies.items()])
        with open(out_file, 'w', encoding='utf-8') as f:
            f.write(cookie_header)
        print(f"Saved cookies to {out_file}")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
