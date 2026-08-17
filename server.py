import http.server
import socketserver
import json
import urllib.parse
import os
import sqlite3
import random
import time
from database import init_db, get_db
from auth import hash_password, verify_password, generate_jwt, decode_jwt

PORT = int(os.environ.get('PORT', 5001))
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

class HealthcareRequestHandler(http.server.BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {self.command} {self.path}")

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def send_error_json(self, message, status=400):
        self.send_json({"error": message}, status)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.end_headers()

    def get_auth_user(self):
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ')[1]
        return decode_jwt(token)

    def parse_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        body_bytes = self.rfile.read(content_length)
        try:
            return json.loads(body_bytes.decode('utf-8'))
        except Exception:
            return {}

    def serve_static(self, path):
        if path == '/' or path == '':
            path = '/index.html'
        
        file_path = os.path.normpath(os.path.join(PUBLIC_DIR, path.lstrip('/')))
        if not os.path.exists(file_path) and os.path.exists(file_path + '.html'):
            file_path = file_path + '.html'

        if not file_path.startswith(PUBLIC_DIR) or not os.path.exists(file_path) or os.path.isdir(file_path):
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"404 Not Found")
            return

        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        }
        content_type = mime_types.get(ext, 'application/octet-stream')

        with open(file_path, 'rb') as f:
            content = f.read()

        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

        # API Router
        if path.startswith('/api/'):
            conn = get_db()
            cursor = conn.cursor()
            try:
                # 1. Auth check endpoint
                if path == '/api/auth/me':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    cursor.execute("SELECT id, name, email, role, phone, profile_image, is_verified FROM users WHERE id=?", (user['user_id'],))
                    u = cursor.fetchone()
                    if not u:
                        return self.send_error_json("User not found", 404)
                    
                    u_dict = dict(u)
                    if user['role'] == 'patient':
                        cursor.execute("SELECT * FROM patients WHERE user_id=?", (u_dict['id'],))
                        p = cursor.fetchone()
                        if p:
                            u_dict['patient_info'] = dict(p)
                    elif user['role'] == 'doctor':
                        cursor.execute("SELECT * FROM doctors WHERE user_id=?", (u_dict['id'],))
                        d = cursor.fetchone()
                        if d:
                            u_dict['doctor_info'] = dict(d)
                            
                    return self.send_json({"user": u_dict})

                # 2. Doctors list & search
                elif path == '/api/doctors':
                    sql = """
                    SELECT d.*, u.name, u.email, u.phone, u.profile_image 
                    FROM doctors d 
                    JOIN users u ON d.user_id = u.id 
                    WHERE 1=1
                    """
                    params = []
                    
                    if 'department' in query and query['department'][0]:
                        sql += " AND d.specialization LIKE ?"
                        params.append(f"%{query['department'][0]}%")
                    if 'name' in query and query['name'][0]:
                        sql += " AND (u.name LIKE ? OR d.specialization LIKE ? OR d.hospital LIKE ?)"
                        q_name = f"%{query['name'][0]}%"
                        params.extend([q_name, q_name, q_name])
                    if 'max_fee' in query and query['max_fee'][0]:
                        sql += " AND d.fee <= ?"
                        params.append(float(query['max_fee'][0]))
                        
                    sql += " ORDER BY d.rating DESC"
                    cursor.execute(sql, params)
                    rows = [dict(r) for r in cursor.fetchall()]
                    for r in rows:
                        try:
                            r['available_days'] = json.loads(r['available_days'])
                        except Exception:
                            r['available_days'] = ["Mon", "Wed", "Fri"]
                    return self.send_json({"doctors": rows})

                # 3. Doctor Details
                elif path.startswith('/api/doctors/'):
                    doc_id = path.split('/')[-1]
                    cursor.execute("""
                    SELECT d.*, u.name, u.email, u.phone, u.profile_image 
                    FROM doctors d 
                    JOIN users u ON d.user_id = u.id 
                    WHERE d.id=?
                    """, (doc_id,))
                    doc = cursor.fetchone()
                    if not doc:
                        return self.send_error_json("Doctor not found", 404)
                    
                    doc_dict = dict(doc)
                    try:
                        doc_dict['available_days'] = json.loads(doc_dict['available_days'])
                    except Exception:
                        doc_dict['available_days'] = ["Mon", "Wed", "Fri"]
                    
                    # Fetch reviews for this doctor
                    cursor.execute("""
                    SELECT r.*, u.name as patient_name, u.profile_image as patient_image 
                    FROM reviews r 
                    JOIN users u ON r.patient_id = u.id 
                    WHERE r.doctor_id=? 
                    ORDER BY r.created_at DESC
                    """, (doc_id,))
                    doc_dict['reviews'] = [dict(rev) for rev in cursor.fetchall()]
                    return self.send_json({"doctor": doc_dict})

                # 4. Patient Appointments
                elif path == '/api/appointments/patient':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    cursor.execute("""
                    SELECT a.*, d.specialization, d.hospital, u.name as doctor_name, u.profile_image as doctor_image, u.phone as doctor_phone
                    FROM appointments a
                    JOIN doctors d ON a.doctor_id = d.id
                    JOIN users u ON d.user_id = u.id
                    WHERE a.patient_id=?
                    ORDER BY a.date DESC, a.time_slot ASC
                    """, (user['user_id'],))
                    appts = [dict(r) for r in cursor.fetchall()]
                    return self.send_json({"appointments": appts})

                # 5. Doctor Appointments (RBAC: Doctor views ONLY their own)
                elif path == '/api/appointments/doctor':
                    user = self.get_auth_user()
                    if not user or user['role'] != 'doctor':
                        return self.send_error_json("Access Denied: Doctor role required", 403)
                    
                    cursor.execute("SELECT id FROM doctors WHERE user_id=?", (user['user_id'],))
                    doc = cursor.fetchone()
                    if not doc:
                        return self.send_error_json("Doctor profile not found", 404)
                    
                    cursor.execute("""
                    SELECT a.*, pu.name as patient_name, pu.email as patient_email, pu.phone as patient_phone, pu.profile_image as patient_image, p.age, p.gender, p.blood_group, p.medical_history_summary
                    FROM appointments a
                    JOIN users pu ON a.patient_id = pu.id
                    LEFT JOIN patients p ON pu.id = p.user_id
                    WHERE a.doctor_id=?
                    ORDER BY a.date DESC, a.time_slot ASC
                    """, (doc['id'],))
                    appts = [dict(r) for r in cursor.fetchall()]
                    return self.send_json({"appointments": appts})

                # 6. Medical Records Privacy Access & Audit Logging
                elif path.startswith('/api/medical-records/patient/'):
                    target_patient_id = int(path.split('/')[-1])
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)

                    # Privacy & RBAC Check
                    if user['role'] == 'patient':
                        if user['user_id'] != target_patient_id:
                            return self.send_error_json("Access Denied: Patients can only view their own medical records.", 403)
                    elif user['role'] == 'doctor':
                        cursor.execute("SELECT id FROM doctors WHERE user_id=?", (user['user_id'],))
                        doc = cursor.fetchone()
                        if not doc:
                            return self.send_error_json("Doctor profile not found", 404)
                        
                        # Doctor can ONLY view if active or past appointment exists with this patient!
                        cursor.execute("SELECT COUNT(*) FROM appointments WHERE doctor_id=? AND patient_id=?", (doc['id'], target_patient_id))
                        if cursor.fetchone()[0] == 0:
                            # Audit log attempted unauthorized view
                            cursor.execute("""
                            INSERT INTO audit_logs (actor_id, actor_role, target_patient_id, action, endpoint)
                            VALUES (?, 'doctor', ?, 'BLOCKED_VIEW_RECORD', ?)
                            """, (user['user_id'], target_patient_id, path))
                            conn.commit()
                            return self.send_error_json("Privacy Guard: You can only access records of patients who have consulted or scheduled an appointment with you.", 403)
                    
                    # AUDIT LOG: Record legitimate access
                    cursor.execute("""
                    INSERT INTO audit_logs (actor_id, actor_role, target_patient_id, action, endpoint)
                    VALUES (?, ?, ?, 'VIEW_RECORD', ?)
                    """, (user['user_id'], user['role'], target_patient_id, path))
                    conn.commit()

                    cursor.execute("""
                    SELECT * FROM medical_records WHERE patient_id=? ORDER BY date DESC
                    """, (target_patient_id,))
                    records = [dict(r) for r in cursor.fetchall()]
                    return self.send_json({"records": records})

                # 7. Patient Prescriptions
                elif path == '/api/prescriptions/patient':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    cursor.execute("""
                    SELECT pr.*, u.name as doctor_name, d.specialization, d.hospital, d.qualification
                    FROM prescriptions pr
                    JOIN doctors d ON pr.doctor_id = d.id
                    JOIN users u ON d.user_id = u.id
                    WHERE pr.patient_id=?
                    ORDER BY pr.created_at DESC
                    """, (user['user_id'],))
                    rows = [dict(r) for r in cursor.fetchall()]
                    for r in rows:
                        try:
                            r['medicines'] = json.loads(r['medicines'])
                        except Exception:
                            r['medicines'] = []
                    return self.send_json({"prescriptions": rows})

                # 8. Lab Tests
                elif path == '/api/labs':
                    cursor.execute("SELECT * FROM lab_tests ORDER BY id ASC")
                    return self.send_json({"tests": [dict(r) for r in cursor.fetchall()]})

                elif path == '/api/labs/my-bookings':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    cursor.execute("""
                    SELECT lb.*, lt.title, lt.department, lt.turnaround_time
                    FROM lab_bookings lb
                    JOIN lab_tests lt ON lb.lab_test_id = lt.id
                    WHERE lb.patient_id=?
                    ORDER BY lb.created_at DESC
                    """, (user['user_id'],))
                    return self.send_json({"bookings": [dict(r) for r in cursor.fetchall()]})

                # 9. Blood Donors Search
                elif path == '/api/blood-donors':
                    sql = "SELECT * FROM blood_donors WHERE is_available=1"
                    params = []
                    if 'blood_group' in query and query['blood_group'][0]:
                        sql += " AND blood_group = ?"
                        params.append(query['blood_group'][0])
                    if 'city' in query and query['city'][0]:
                        sql += " AND city LIKE ?"
                        params.append(f"%{query['city'][0]}%")
                    
                    cursor.execute(sql, params)
                    return self.send_json({"donors": [dict(r) for r in cursor.fetchall()]})

                # 10. Medicine Reminders
                elif path == '/api/reminders':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    cursor.execute("SELECT * FROM medicine_reminders WHERE patient_id=? AND status='Active'", (user['user_id'],))
                    return self.send_json({"reminders": [dict(r) for r in cursor.fetchall()]})

                # 11. Home Healthcare Requests
                elif path == '/api/home-services/my-requests':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    cursor.execute("SELECT * FROM home_service_requests WHERE patient_id=? ORDER BY created_at DESC", (user['user_id'],))
                    return self.send_json({"requests": [dict(r) for r in cursor.fetchall()]})

                # 12. Notifications
                elif path == '/api/notifications':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    cursor.execute("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC", (user['user_id'],))
                    return self.send_json({"notifications": [dict(r) for r in cursor.fetchall()]})

                # 13. Admin Data Endpoints
                elif path == '/api/admin/stats':
                    user = self.get_auth_user()
                    if not user or user['role'] != 'admin':
                        return self.send_error_json("Admin access required", 403)
                    
                    cursor.execute("SELECT COUNT(*) FROM users WHERE role='patient'")
                    total_patients = cursor.fetchone()[0]
                    cursor.execute("SELECT COUNT(*) FROM users WHERE role='doctor'")
                    total_doctors = cursor.fetchone()[0]
                    cursor.execute("SELECT COUNT(*) FROM appointments")
                    total_appts = cursor.fetchone()[0]
                    cursor.execute("SELECT SUM(amount) FROM payments WHERE status='Success'")
                    revenue = cursor.fetchone()[0] or 0.0

                    return self.send_json({
                        "total_patients": total_patients,
                        "total_doctors": total_doctors,
                        "total_appointments": total_appts,
                        "total_revenue": revenue
                    })

                elif path == '/api/admin/audit-logs':
                    user = self.get_auth_user()
                    if not user or user['role'] != 'admin':
                        return self.send_error_json("Admin access required", 403)
                    
                    cursor.execute("""
                    SELECT al.*, u.name as actor_name, u.email as actor_email, pu.name as target_patient_name
                    FROM audit_logs al
                    JOIN users u ON al.actor_id = u.id
                    JOIN users pu ON al.target_patient_id = pu.id
                    ORDER BY al.timestamp DESC LIMIT 50
                    """)
                    return self.send_json({"audit_logs": [dict(r) for r in cursor.fetchall()]})

                elif path == '/api/admin/users':
                    user = self.get_auth_user()
                    if not user or user['role'] != 'admin':
                        return self.send_error_json("Admin access required", 403)
                    cursor.execute("""
                    SELECT u.id, u.name, u.email, u.role, u.phone, u.is_verified, u.created_at, d.id as doctor_id, d.specialization
                    FROM users u
                    LEFT JOIN doctors d ON u.id = d.user_id
                    ORDER BY u.created_at DESC
                    """)
                    return self.send_json({"users": [dict(r) for r in cursor.fetchall()]})

                elif path == '/api/admin/appointments':
                    user = self.get_auth_user()
                    if not user or user['role'] != 'admin':
                        return self.send_error_json("Admin access required", 403)
                    cursor.execute("""
                    SELECT a.id, a.date, a.time_slot, a.status, a.fee, a.payment_status, a.symptoms,
                           pu.name as patient_name, pu.email as patient_email,
                           du.name as doctor_name, d.specialization
                    FROM appointments a
                    JOIN users pu ON a.patient_id = pu.id
                    JOIN doctors d ON a.doctor_id = d.id
                    JOIN users du ON d.user_id = du.id
                    ORDER BY a.date DESC, a.time_slot ASC
                    """)
                    return self.send_json({"appointments": [dict(r) for r in cursor.fetchall()]})

                else:
                    return self.send_error_json("Endpoint not found", 404)

            finally:
                conn.close()

        else:
            self.serve_static(path)

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        body = self.parse_body()

        if path.startswith('/api/'):
            conn = get_db()
            cursor = conn.cursor()
            try:
                # 1. Registration
                if path == '/api/auth/register':
                    name = body.get('name')
                    email = body.get('email')
                    password = body.get('password')
                    role = body.get('role', 'patient')
                    phone = body.get('phone', '')

                    if not name or not email or not password:
                        return self.send_error_json("Name, email, and password are required.")
                    
                    cursor.execute("SELECT id FROM users WHERE email=?", (email,))
                    if cursor.fetchone():
                        return self.send_error_json("Email is already registered.")

                    pw_hash = hash_password(password)
                    default_img = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80"
                    
                    cursor.execute("""
                    INSERT INTO users (name, email, password, role, phone, profile_image)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, (name, email, pw_hash, role, phone, default_img))
                    user_id = cursor.lastrowid

                    if role == 'patient':
                        cursor.execute("""
                        INSERT INTO patients (user_id, age, gender, blood_group, address, emergency_contact)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """, (user_id, body.get('age', 30), body.get('gender', 'Male'), body.get('blood_group', 'O+'), body.get('address', 'Dhaka'), body.get('emergency_contact', phone)))
                    elif role == 'doctor':
                        cursor.execute("""
                        INSERT INTO doctors (user_id, specialization, hospital, qualification, experience_years, fee, available_days, available_time, about)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (user_id, body.get('specialization', 'General Physician'), body.get('hospital', 'Not specified'), body.get('qualification', 'MBBS'), body.get('experience_years', 5), body.get('fee', 1000.0), json.dumps(body.get('available_days', ["Mon", "Wed", "Fri"])), body.get('available_time', "10:00 AM - 04:00 PM"), body.get('about', 'Specialist Doctor')))

                    conn.commit()

                    token = generate_jwt(user_id, email, role, name)
                    return self.send_json({
                        "message": "Registration successful!",
                        "token": token,
                        "user": {"id": user_id, "name": name, "email": email, "role": role}
                    }, 201)

                elif path == '/api/auth/upgrade-doctor':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    user_id = user['user_id']
                    cursor.execute("UPDATE users SET role='doctor' WHERE id=?", (user_id,))
                    cursor.execute("SELECT id FROM doctors WHERE user_id=?", (user_id,))
                    if not cursor.fetchone():
                        cursor.execute("""
                        INSERT INTO doctors (user_id, specialization, hospital, qualification, experience_years, fee, available_days, available_time, about)
                        VALUES (?, 'General Physician', 'Not specified', 'MBBS', 5, 1000.0, ?, '10:00 AM - 04:00 PM', 'Specialist Doctor')
                        """, (user_id, json.dumps(["Mon", "Wed", "Fri"])))
                    conn.commit()
                    
                    cursor.execute("SELECT id, name, email, role FROM users WHERE id=?", (user_id,))
                    u = dict(cursor.fetchone())
                    token = generate_jwt(u['id'], u['email'], u['role'], u['name'])
                    return self.send_json({
                        "message": "Account successfully upgraded to Doctor profile!",
                        "token": token,
                        "user": u
                    })

                # 2. Login
                elif path == '/api/auth/login':
                    email = body.get('email')
                    password = body.get('password')

                    cursor.execute("SELECT * FROM users WHERE email=?", (email,))
                    user = cursor.fetchone()
                    if not user or not verify_password(password, user['password']):
                        return self.send_error_json("Invalid email or password.", 401)

                    user_dict = dict(user)
                    token = generate_jwt(user_dict['id'], user_dict['email'], user_dict['role'], user_dict['name'])
                    
                    del user_dict['password']
                    return self.send_json({
                        "message": "Login successful!",
                        "token": token,
                        "user": user_dict
                    })

                # 3. Google OAuth Login Simulation
                elif path == '/api/auth/google':
                    email = body.get('email', 'google.user@gmail.com')
                    name = body.get('name', 'Google Patient')
                    
                    cursor.execute("SELECT * FROM users WHERE email=?", (email,))
                    user = cursor.fetchone()
                    if not user:
                        pw_hash = hash_password("google123456")
                        cursor.execute("INSERT INTO users (name, email, password, role, phone, profile_image) VALUES (?, ?, ?, 'patient', '+8801700000000', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80')", (name, email, pw_hash))
                        user_id = cursor.lastrowid
                        cursor.execute("INSERT INTO patients (user_id, age, gender, blood_group, address) VALUES (?, 29, 'Male', 'B+', 'Dhaka')", (user_id,))
                        conn.commit()
                        cursor.execute("SELECT * FROM users WHERE id=?", (user_id,))
                        user = cursor.fetchone()

                    user_dict = dict(user)
                    token = generate_jwt(user_dict['id'], user_dict['email'], user_dict['role'], user_dict['name'])
                    del user_dict['password']
                    return self.send_json({"message": "Google Login successful!", "token": token, "user": user_dict})

                # 4. Forgot Password Reset Request
                elif path == '/api/auth/forgot-password':
                    email = body.get('email')
                    cursor.execute("SELECT id FROM users WHERE email=?", (email,))
                    if cursor.fetchone():
                        return self.send_json({"message": "Password reset instructions sent to your email address."})
                    return self.send_error_json("Email address not found.", 404)

                # 5. Book Appointment
                elif path == '/api/appointments':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    doctor_id = body.get('doctor_id')
                    date = body.get('date')
                    time_slot = body.get('time_slot')
                    symptoms = body.get('symptoms', '')
                    fee = body.get('fee', 1000.0)

                    if not doctor_id or not date or not time_slot:
                        return self.send_error_json("Doctor ID, date, and time slot are required.")

                    cursor.execute("""
                    INSERT INTO appointments (patient_id, doctor_id, date, time_slot, status, symptoms, fee, payment_status)
                    VALUES (?, ?, ?, ?, 'Pending', ?, ?, 'Paid')
                    """, (user['user_id'], doctor_id, date, time_slot, symptoms, fee))
                    conn.commit()
                    appt_id = cursor.lastrowid

                    # Add notification for patient
                    cursor.execute("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'Appointment Request Sent', ?, 'appointment')", (user['user_id'], f"Your appointment request for {date} at {time_slot} has been sent to the doctor."))

                    # Add notification for doctor
                    cursor.execute("SELECT user_id FROM doctors WHERE id=?", (doctor_id,))
                    doc_user = cursor.fetchone()
                    if doc_user:
                        cursor.execute("INSERT INTO notifications (user_id, title, message, type) VALUES (?, 'New Patient Request', ?, 'appointment')", (doc_user['user_id'], f"New appointment request from {user['name']} for {date} at {time_slot}. Please accept or reject."))

                    conn.commit()
                    return self.send_json({"message": "Appointment request submitted successfully! Waiting for doctor confirmation.", "appointment_id": appt_id}, 201)

                # 6. Write Prescription (Doctor only)
                elif path == '/api/prescriptions':
                    user = self.get_auth_user()
                    if not user or user['role'] != 'doctor':
                        return self.send_error_json("Doctor role required", 403)
                    
                    cursor.execute("SELECT id FROM doctors WHERE user_id=?", (user['user_id'],))
                    doc = cursor.fetchone()

                    appointment_id = body.get('appointment_id')
                    patient_id = body.get('patient_id')
                    diagnosis = body.get('diagnosis')
                    medicines = body.get('medicines', [])
                    instructions = body.get('instructions', '')

                    cursor.execute("""
                    INSERT INTO prescriptions (appointment_id, patient_id, doctor_id, diagnosis, medicines, instructions)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, (appointment_id, patient_id, doc['id'], diagnosis, json.dumps(medicines), instructions))
                    
                    if appointment_id:
                        cursor.execute("UPDATE appointments SET status='Completed' WHERE id=?", (appointment_id,))

                    conn.commit()
                    return self.send_json({"message": "Digital prescription created successfully!"}, 201)

                # 7. Contact Form Submission
                elif path == '/api/contact':
                    name = body.get('name')
                    email = body.get('email')
                    subject = body.get('subject', 'General Inquiry')
                    message = body.get('message')

                    cursor.execute("""
                    INSERT INTO contact_messages (name, email, subject, message)
                    VALUES (?, ?, ?, ?)
                    """, (name, email, subject, message))
                    conn.commit()
                    return self.send_json({"message": "Thank you! Your message has been sent to our support team."})

                # 8. Book Lab Test
                elif path == '/api/labs/book':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    lab_test_id = body.get('lab_test_id')
                    booking_date = body.get('booking_date')
                    sample_type = body.get('sample_collection_type', 'Lab Visit')
                    address = body.get('address', '')
                    payment_method = body.get('payment_method', 'bKash')
                    amount = body.get('amount', 500.0)

                    cursor.execute("""
                    INSERT INTO lab_bookings (patient_id, lab_test_id, booking_date, sample_collection_type, address, payment_method, amount)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (user['user_id'], lab_test_id, booking_date, sample_type, address, payment_method, amount))
                    conn.commit()

                    return self.send_json({"message": "Lab test booked successfully!"}, 201)

                # 9. Home Healthcare Request
                elif path == '/api/home-services/request':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    service_type = body.get('service_type')
                    schedule_date = body.get('schedule_date')
                    phone = body.get('phone')
                    address = body.get('address')
                    notes = body.get('notes', '')
                    amount = body.get('amount', 1500.0)

                    cursor.execute("""
                    INSERT INTO home_service_requests (patient_id, service_type, schedule_date, phone, address, notes, amount)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (user['user_id'], service_type, schedule_date, phone, address, notes, amount))
                    conn.commit()

                    return self.send_json({"message": "Home healthcare request submitted successfully!"}, 201)

                # 10. Add Medicine Reminder
                elif path == '/api/reminders':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    medicine_name = body.get('medicine_name')
                    dosage = body.get('dosage')
                    time_slot = body.get('time_slot')
                    frequency = body.get('frequency', 'Daily')

                    cursor.execute("""
                    INSERT INTO medicine_reminders (patient_id, medicine_name, dosage, time_slot, frequency)
                    VALUES (?, ?, ?, ?, ?)
                    """, (user['user_id'], medicine_name, dosage, time_slot, frequency))
                    conn.commit()

                    return self.send_json({"message": "Medicine reminder added!"}, 201)

                # 11. Payment Checkout (SSLCommerz, bKash, Nagad, Rocket)
                elif path == '/api/payments/checkout':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)

                    gateway = body.get('gateway', 'bKash')
                    amount = body.get('amount', 1000.0)
                    related_type = body.get('related_type', 'Appointment')
                    related_id = body.get('related_id', 1)
                    
                    trx_id = f"TRX-{gateway.upper()}-{int(time.time())}-{random.randint(1000,9999)}"

                    cursor.execute("""
                    INSERT INTO payments (patient_id, related_type, related_id, amount, gateway, transaction_id, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'Success')
                    """, (user['user_id'], related_type, related_id, amount, gateway, trx_id))
                    conn.commit()

                    return self.send_json({
                        "message": "Payment completed successfully!",
                        "transaction_id": trx_id,
                        "gateway": gateway,
                        "amount": amount
                    })

                # 12. Register Blood Donor
                elif path == '/api/blood-donors' or path == '/api/blood-donors/register':
                    name = body.get('name')
                    blood_group = body.get('blood_group')
                    city = body.get('city')
                    area = body.get('area')
                    phone = body.get('phone')
                    last_donated = body.get('last_donated', 'Never')

                    cursor.execute("""
                    INSERT INTO blood_donors (name, blood_group, city, area, phone, last_donated)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, (name, blood_group, city, area, phone, last_donated))
                    conn.commit()

                    return self.send_json({"message": "Registered as blood donor successfully!"}, 201)

                # 13. Image Upload Simulation (Cloudinary)
                elif path == '/api/upload/image':
                    img_url = body.get('image_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80')
                    return self.send_json({"url": img_url, "message": "Uploaded to Cloudinary CDN successfully!"})

                # 14. Submit Doctor Review
                elif path == '/api/reviews':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    doctor_id = body.get('doctor_id')
                    rating = body.get('rating', 5)
                    comment = body.get('comment', '')

                    cursor.execute("""
                    INSERT INTO reviews (patient_id, doctor_id, rating, comment)
                    VALUES (?, ?, ?, ?)
                    """, (user['user_id'], doctor_id, rating, comment))
                    
                    cursor.execute("SELECT AVG(rating) FROM reviews WHERE doctor_id=?", (doctor_id,))
                    avg_r = round(cursor.fetchone()[0], 1)
                    cursor.execute("UPDATE doctors SET rating=? WHERE id=?", (avg_r, doctor_id))
                    
                    conn.commit()
                    return self.send_json({"message": "Review submitted successfully!"}, 201)

                else:
                    return self.send_error_json("POST endpoint not found", 404)

            finally:
                conn.close()

    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        body = self.parse_body()

        if path.startswith('/api/'):
            conn = get_db()
            cursor = conn.cursor()
            try:
                # Update Appointment Status (Doctor Accept / Reject / Cancel / Complete)
                if path.startswith('/api/appointments/') and path.endswith('/status'):
                    appt_id = path.split('/')[-2]
                    status = body.get('status')
                    user = self.get_auth_user()
                    if not user or user['role'] not in ['doctor', 'admin', 'patient']:
                        return self.send_error_json("Permission denied", 403)

                    cursor.execute("""
                    SELECT a.*, pu.name as patient_name, du.name as doctor_name
                    FROM appointments a
                    JOIN users pu ON a.patient_id = pu.id
                    JOIN doctors d ON a.doctor_id = d.id
                    JOIN users du ON d.user_id = du.id
                    WHERE a.id=?
                    """, (appt_id,))
                    appt = cursor.fetchone()
                    if not appt:
                        return self.send_error_json("Appointment not found", 404)

                    cursor.execute("UPDATE appointments SET status=? WHERE id=?", (status, appt_id))

                    # Notification when Doctor Accepts
                    if status == 'Confirmed':
                        cursor.execute("""
                        INSERT INTO notifications (user_id, title, message, type)
                        VALUES (?, 'Appointment Accepted! 🎉', ?, 'appointment')
                        """, (appt['patient_id'], f"Dr. {appt['doctor_name']} has accepted your appointment for {appt['date']} at {appt['time_slot']}."))

                    # Notification & Auto-refund when Doctor or Patient Cancels / Rejects
                    elif status in ('Cancelled', 'Rejected'):
                        action_word = 'declined by the doctor' if status == 'Rejected' else 'cancelled'
                        if appt['payment_status'] == 'Paid':
                            cursor.execute("UPDATE appointments SET payment_status='Refunded' WHERE id=?", (appt_id,))
                            import uuid
                            refund_txn = 'REFUND-' + str(uuid.uuid4())[:8].upper()
                            cursor.execute(
                                """INSERT INTO payments
                                   (patient_id, related_type, related_id, amount, gateway, transaction_id, status)
                                   VALUES (?, 'Appointment', ?, ?, 'Refund', ?, 'Refunded')""",
                                (appt['patient_id'], appt_id, appt['fee'], refund_txn)
                            )
                            cursor.execute(
                                """INSERT INTO notifications (user_id, title, message, type)
                                   VALUES (?, ?, ?, 'refund')""",
                                (appt['patient_id'],
                                 f"Appointment {status}: Refund Processed",
                                 f"Your appointment with Dr. {appt['doctor_name']} on {appt['date']} was {action_word}. Full refund of ৳{appt['fee']} has been processed. TRX: {refund_txn}")
                            )
                        else:
                            cursor.execute(
                                """INSERT INTO notifications (user_id, title, message, type)
                                   VALUES (?, ?, ?, 'appointment')""",
                                (appt['patient_id'],
                                 f"Appointment {status}",
                                 f"Your appointment with Dr. {appt['doctor_name']} on {appt['date']} was {action_word}.")
                            )

                    conn.commit()
                    return self.send_json({"message": f"Appointment request has been {status.lower()}."})

                # Cancel Appointment
                elif path.startswith('/api/appointments/') and path.endswith('/cancel'):
                    appt_id = path.split('/')[-2]
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)

                    cursor.execute(
                        "SELECT payment_status, fee, patient_id FROM appointments WHERE id=? AND patient_id=?",
                        (appt_id, user['user_id'])
                    )
                    appt = cursor.fetchone()
                    if not appt:
                        return self.send_error_json("Appointment not found", 404)

                    cursor.execute(
                        "UPDATE appointments SET status='Cancelled' WHERE id=? AND patient_id=?",
                        (appt_id, user['user_id'])
                    )

                    # Auto-refund if already paid
                    if appt['payment_status'] == 'Paid':
                        cursor.execute(
                            "UPDATE appointments SET payment_status='Refunded' WHERE id=?",
                            (appt_id,)
                        )
                        import uuid
                        refund_txn = 'REFUND-' + str(uuid.uuid4())[:8].upper()
                        cursor.execute(
                            """INSERT INTO payments
                               (patient_id, related_type, related_id, amount, gateway, transaction_id, status)
                               VALUES (?, 'Appointment', ?, ?, 'Refund', ?, 'Refunded')""",
                            (appt['patient_id'], appt_id, appt['fee'], refund_txn)
                        )
                        cursor.execute(
                            """INSERT INTO notifications (user_id, title, message, type)
                               VALUES (?, 'Refund Processed',
                               'Your payment of ৳' || ? || ' for appointment #' || ? || ' has been refunded. TRX: ' || ?,
                               'refund')""",
                            (appt['patient_id'], appt['fee'], appt_id, refund_txn)
                        )

                    conn.commit()
                    return self.send_json({"message": "Appointment cancelled."})

                # Reschedule Appointment
                elif path.startswith('/api/appointments/') and path.endswith('/reschedule'):
                    appt_id = path.split('/')[-2]
                    new_date = body.get('date')
                    new_slot = body.get('time_slot')
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)

                    cursor.execute("UPDATE appointments SET date=?, time_slot=? WHERE id=? AND patient_id=?", (new_date, new_slot, appt_id, user['user_id']))
                    conn.commit()
                    return self.send_json({"message": "Appointment rescheduled successfully!"})

                # Doctor profile update
                elif path == '/api/doctors/profile':
                    user = self.get_auth_user()
                    if not user or user['role'] != 'doctor':
                        return self.send_error_json("Doctor role required", 403)
                    
                    user_id = user['user_id']
                    name = body.get('name')
                    phone = body.get('phone')
                    specialization = body.get('specialization')
                    hospital = body.get('hospital')
                    qualification = body.get('qualification')
                    experience_years = body.get('experience_years')
                    fee = body.get('fee')
                    available_days = body.get('available_days')
                    available_time = body.get('available_time')
                    about = body.get('about')

                    if name:
                        cursor.execute("UPDATE users SET name=? WHERE id=?", (name, user_id))
                    if phone is not None:
                        cursor.execute("UPDATE users SET phone=? WHERE id=?", (phone, user_id))

                    cursor.execute("SELECT id FROM doctors WHERE user_id=?", (user_id,))
                    doc_row = cursor.fetchone()
                    if not doc_row:
                        cursor.execute("""
                        INSERT INTO doctors (user_id, specialization, hospital, qualification, experience_years, fee, available_days, available_time, about)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (user_id, specialization or 'General Physician', hospital or 'Not specified', qualification or 'MBBS', experience_years or 5, fee or 1000.0, json.dumps(available_days or ["Mon", "Wed", "Fri"]), available_time or "10:00 AM - 04:00 PM", about or 'Specialist Doctor'))
                    else:
                        updates = []
                        params = []
                        if specialization is not None:
                            updates.append("specialization=?")
                            params.append(specialization)
                        if hospital is not None:
                            updates.append("hospital=?")
                            params.append(hospital)
                        if qualification is not None:
                            updates.append("qualification=?")
                            params.append(qualification)
                        if experience_years is not None:
                            updates.append("experience_years=?")
                            params.append(experience_years)
                        if fee is not None:
                            updates.append("fee=?")
                            params.append(fee)
                        if available_days is not None:
                            updates.append("available_days=?")
                            params.append(json.dumps(available_days))
                        if available_time is not None:
                            updates.append("available_time=?")
                            params.append(available_time)
                        if about is not None:
                            updates.append("about=?")
                            params.append(about)

                        if updates:
                            params.append(user_id)
                            cursor.execute(f"UPDATE doctors SET {', '.join(updates)} WHERE user_id=?", params)

                    conn.commit()
                    return self.send_json({"message": "Doctor profile updated successfully!"})

                # Patient Profile Update
                elif path == '/api/patient/profile':
                    user = self.get_auth_user()
                    if not user:
                        return self.send_error_json("Unauthorized", 401)
                    
                    user_id = user['user_id']
                    name = body.get('name')
                    phone = body.get('phone')
                    age = body.get('age')
                    gender = body.get('gender')
                    blood_group = body.get('blood_group')
                    address = body.get('address')
                    emergency = body.get('emergency_contact')

                    if name:
                        cursor.execute("UPDATE users SET name=? WHERE id=?", (name, user_id))
                    if phone is not None:
                        cursor.execute("UPDATE users SET phone=? WHERE id=?", (phone, user_id))

                    cursor.execute("SELECT id FROM patients WHERE user_id=?", (user_id,))
                    pat_row = cursor.fetchone()
                    if not pat_row:
                        cursor.execute("""
                        INSERT INTO patients (user_id, age, gender, blood_group, address, emergency_contact)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """, (user_id, age or 30, gender or 'Male', blood_group or 'O+', address or 'Dhaka', emergency or phone))
                    else:
                        updates = []
                        params = []
                        if age is not None:
                            updates.append("age=?")
                            params.append(age)
                        if gender is not None:
                            updates.append("gender=?")
                            params.append(gender)
                        if blood_group is not None:
                            updates.append("blood_group=?")
                            params.append(blood_group)
                        if address is not None:
                            updates.append("address=?")
                            params.append(address)
                        if emergency is not None:
                            updates.append("emergency_contact=?")
                            params.append(emergency)

                        if updates:
                            params.append(user_id)
                            cursor.execute(f"UPDATE patients SET {', '.join(updates)} WHERE user_id=?", params)

                    conn.commit()
                    return self.send_json({"message": "Patient profile updated successfully!"})

                # Clinical Data Immutability Guard: Medical records & prescriptions cannot be altered
                elif path.startswith('/api/medical-records') or path.startswith('/api/prescriptions') or path.startswith('/api/labs/reports'):
                    return self.send_error_json("Clinical Data Protection: Patient medical records, lab reports, and prescriptions are immutable and cannot be altered.", 403)

                else:
                    return self.send_error_json("PUT route not found", 404)
            finally:
                conn.close()

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # Clinical Data Immutability Guard: Medical records & prescriptions cannot be deleted
        if path.startswith('/api/medical-records') or path.startswith('/api/prescriptions') or path.startswith('/api/labs/reports'):
            return self.send_error_json("Clinical Data Protection: Patient medical records, lab reports, and prescriptions are permanent legal healthcare records and cannot be deleted.", 403)

        # Admin Delete Doctor Profile / User Endpoint
        if path.startswith('/api/admin/doctors/') or path.startswith('/api/admin/users/'):
            user = self.get_auth_user()
            if not user or user['role'] != 'admin':
                return self.send_error_json("Admin access required", 403)

            target_id = int(path.split('/')[-1])
            conn = get_db()
            cursor = conn.cursor()
            try:
                cursor.execute("SELECT * FROM users WHERE id=?", (target_id,))
                target_user = cursor.fetchone()
                if not target_user:
                    # Also check if target_id is doctor_id
                    cursor.execute("SELECT user_id FROM doctors WHERE id=?", (target_id,))
                    d_row = cursor.fetchone()
                    if d_row:
                        cursor.execute("SELECT * FROM users WHERE id=?", (d_row['user_id'],))
                        target_user = cursor.fetchone()

                if not target_user:
                    return self.send_error_json("Target user/doctor profile not found", 404)

                user_id = target_user['id']

                # Find associated doctor record if any
                cursor.execute("SELECT id FROM doctors WHERE user_id=?", (user_id,))
                doc_record = cursor.fetchone()
                if doc_record:
                    doc_id = doc_record['id']
                    # Clean up doctor associations
                    cursor.execute("DELETE FROM reviews WHERE doctor_id=?", (doc_id,))
                    cursor.execute("DELETE FROM prescriptions WHERE doctor_id=?", (doc_id,))
                    cursor.execute("DELETE FROM appointments WHERE doctor_id=?", (doc_id,))
                    cursor.execute("DELETE FROM doctors WHERE id=?", (doc_id,))

                # Remove notifications and user account
                cursor.execute("DELETE FROM notifications WHERE user_id=?", (user_id,))
                cursor.execute("DELETE FROM users WHERE id=?", (user_id,))
                conn.commit()

                return self.send_json({"message": f"Doctor profile '{target_user['name']}' has been removed successfully."})
            finally:
                conn.close()

        if path.startswith('/api/reminders/'):
            rem_id = path.split('/')[-1]
            user = self.get_auth_user()
            if not user:
                return self.send_error_json("Unauthorized", 401)
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM medicine_reminders WHERE id=? AND patient_id=?", (rem_id, user['user_id']))
            conn.commit()
            conn.close()
            return self.send_json({"message": "Reminder deleted."})

        return self.send_error_json("DELETE route not found", 404)

def run_server():
    init_db()
    socketserver.TCPServer.allow_reuse_address = True
    server_address = ('', PORT)
    httpd = socketserver.TCPServer(server_address, HealthcareRequestHandler)
    print(f"===============================================================")
    print(f" Digital Healthcare System Running Live at: http://localhost:{PORT}")
    print(f"===============================================================")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()
