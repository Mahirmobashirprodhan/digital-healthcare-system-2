import json
import base64
import hmac
import hashlib
import time

SECRET_KEY = "health_care_platform_secret_jwt_key_2026"

def hash_password(password: str) -> str:
    """Hash a password using PBKDF2 HMAC SHA256."""
    salt = b"digital_healthcare_salt_9988"
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return pwd_hash.hex()

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against stored hash."""
    return hash_password(password) == hashed_password

def b64_encode(data_bytes: bytes) -> str:
    """Url-safe base64 string without padding."""
    return base64.urlsafe_b64encode(data_bytes).decode('utf-8').rstrip('=')

def b64_decode(data_str: str) -> bytes:
    """Url-safe base64 decoding with padding restoration."""
    padding = '=' * (4 - (len(data_str) % 4))
    return base64.urlsafe_b64decode(data_str + padding)

def generate_jwt(user_id: int, email: str, role: str, name: str, expires_in_sec: int = 86400) -> str:
    """Generate JWT Token."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "name": name,
        "iat": int(time.time()),
        "exp": int(time.time()) + expires_in_sec
    }
    
    header_b64 = b64_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = b64_encode(json.dumps(payload).encode('utf-8'))
    
    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input.encode('utf-8'), hashlib.sha256).digest()
    signature_b64 = b64_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def decode_jwt(token: str):
    """Decode and verify JWT token."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input.encode('utf-8'), hashlib.sha256).digest()
        if b64_encode(expected_sig) != signature_b64:
            return None
            
        payload_bytes = b64_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        if payload.get('exp', 0) < time.time():
            return None # Expired
            
        return payload
    except Exception:
        return None
