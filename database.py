import sqlite3
import json
import os
from auth import hash_password

DB_FILE = os.path.join(os.path.dirname(__file__), 'healthcare.db')

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Users
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('patient', 'doctor', 'admin')),
        phone TEXT,
        profile_image TEXT,
        is_verified INTEGER DEFAULT 1,
        verification_token TEXT,
        reset_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 2. Doctors
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        specialization TEXT NOT NULL,
        hospital TEXT NOT NULL,
        qualification TEXT NOT NULL,
        experience_years INTEGER DEFAULT 5,
        fee REAL NOT NULL,
        available_days TEXT NOT NULL, -- JSON array e.g. ["Mon", "Wed", "Fri"]
        available_time TEXT NOT NULL, -- e.g. "10:00 AM - 04:00 PM"
        available_slots TEXT DEFAULT '["10:00 AM", "11:00 AM", "02:30 PM", "04:00 PM", "07:00 PM"]',
        rating REAL DEFAULT 4.8,
        about TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    # 3. Patients
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        age INTEGER,
        gender TEXT,
        blood_group TEXT,
        address TEXT,
        emergency_contact TEXT,
        medical_history_summary TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    # 4. Appointments
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        status TEXT DEFAULT 'Confirmed' CHECK(status IN ('Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rejected')),
        type TEXT DEFAULT 'Online Video',
        symptoms TEXT,
        fee REAL,
        payment_status TEXT DEFAULT 'Paid',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES users(id),
        FOREIGN KEY(doctor_id) REFERENCES doctors(id)
    )
    ''')

    # 5. Prescriptions
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER UNIQUE,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        diagnosis TEXT NOT NULL,
        medicines TEXT NOT NULL, -- JSON string array of medicines [{name, dosage, frequency, duration}]
        instructions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES users(id),
        FOREIGN KEY(doctor_id) REFERENCES doctors(id)
    )
    ''')

    # 6. MedicalRecords
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS medical_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        record_type TEXT NOT NULL, -- Consultation, Lab Result, Surgery, Imaging
        doctor_name TEXT,
        notes TEXT,
        file_url TEXT,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES users(id)
    )
    ''')

    # 7. LabTests
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS lab_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        department TEXT NOT NULL,
        price REAL NOT NULL,
        sample_type TEXT NOT NULL,
        turnaround_time TEXT NOT NULL,
        description TEXT
    )
    ''')

    # 8. LabBookings
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS lab_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        lab_test_id INTEGER NOT NULL,
        booking_date TEXT NOT NULL,
        sample_collection_type TEXT DEFAULT 'Lab Visit', -- 'Lab Visit' or 'Home Collection'
        address TEXT,
        status TEXT DEFAULT 'Scheduled', -- Scheduled, Processing, Completed
        report_url TEXT,
        payment_method TEXT,
        amount REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES users(id),
        FOREIGN KEY(lab_test_id) REFERENCES lab_tests(id)
    )
    ''')

    # 9. BloodDonors
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS blood_donors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        blood_group TEXT NOT NULL,
        city TEXT NOT NULL,
        area TEXT NOT NULL,
        phone TEXT NOT NULL,
        last_donated TEXT,
        is_available INTEGER DEFAULT 1
    )
    ''')

    # 10. HomeServiceRequests
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS home_service_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        service_type TEXT NOT NULL, -- Home Nursing, Sample Collection, Elder Care, Physiotherapy
        schedule_date TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'Pending', -- Pending, Assigned, Completed
        amount REAL,
        payment_status TEXT DEFAULT 'Pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES users(id)
    )
    ''')

    # 11. Payments
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        related_type TEXT NOT NULL, -- Appointment, LabTest, HomeService
        related_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        gateway TEXT NOT NULL, -- SSLCommerz, bKash, Nagad, Rocket
        transaction_id TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'Success',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES users(id)
    )
    ''')

    # 12. Reviews
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(patient_id) REFERENCES users(id),
        FOREIGN KEY(doctor_id) REFERENCES doctors(id)
    )
    ''')

    # 13. AuditLogs
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER NOT NULL,
        actor_role TEXT NOT NULL,
        target_patient_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 14. MedicineReminders
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS medicine_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        medicine_name TEXT NOT NULL,
        dosage TEXT NOT NULL,
        time_slot TEXT NOT NULL, -- e.g. "08:00 AM", "02:00 PM", "08:00 PM"
        frequency TEXT DEFAULT 'Daily',
        status TEXT DEFAULT 'Active',
        FOREIGN KEY(patient_id) REFERENCES users(id)
    )
    ''')

    # 15. ContactMessages
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS contact_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 16. Notifications
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    ''')

    conn.commit()
    seed_initial_data(conn)
    conn.close()

def seed_initial_data(conn):
    cursor = conn.cursor()
    
    # Check if users already seeded
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] > 0:
        return # Already seeded

    pw_hash = hash_password("password123")
    admin_pw_hash = hash_password("admin123")

    # 1. Add Admin
    cursor.execute("""
    INSERT INTO users (name, email, password, role, phone, profile_image)
    VALUES ('System Admin', 'admin@demo.com', ?, 'admin', '+8801711000000', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80')
    """, (admin_pw_hash,))

    # 2. Add Patients
    cursor.execute("""
    INSERT INTO users (name, email, password, role, phone, profile_image)
    VALUES ('Rahim Uddin', 'patient@demo.com', ?, 'patient', '+8801812345678', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80')
    """, (pw_hash,))
    patient1_user_id = cursor.lastrowid

    cursor.execute("""
    INSERT INTO patients (user_id, age, gender, blood_group, address, emergency_contact, medical_history_summary)
    VALUES (?, 34, 'Male', 'A+', 'House 42, Road 11, Banani, Dhaka', '+8801812345600', 'Hypertension diagnosed 2023. Routine annual checkups.')
    """, (patient1_user_id,))

    cursor.execute("""
    INSERT INTO users (name, email, password, role, phone, profile_image)
    VALUES ('Nusrat Sultana', 'nusrat.patient@demo.com', ?, 'patient', '+8801712345679', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80')
    """, (pw_hash,))
    patient2_user_id = cursor.lastrowid

    cursor.execute("""
    INSERT INTO patients (user_id, age, gender, blood_group, address, emergency_contact, medical_history_summary)
    VALUES (?, 28, 'Female', 'O+', 'Sector 4, Uttara, Dhaka', '+8801712345600', 'No chronic illness. Seasonal allergies.')
    """, (patient2_user_id,))

    # 3. Add Doctors
    doctors_data = [
        {
            "name": "Dr. Anisur Rahman",
            "email": "doctor@demo.com", # Primary demo doctor account
            "phone": "+8801715551111",
            "image": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=300&q=80",
            "specialization": "Cardiology",
            "hospital": "Square Hospital, Dhaka",
            "qualification": "MBBS, FCPS (Cardiology), MD",
            "exp": 12,
            "fee": 1200.0,
            "days": ["Mon", "Tue", "Wed", "Thu", "Sat"],
            "time": "10:00 AM - 04:00 PM",
            "rating": 4.9,
            "about": "Senior Consultant Cardiologist specializing in interventional cardiology, blood pressure control, and heart health management with over 12 years of experience."
        },
        {
            "name": "Dr. Nusrat Jahan",
            "email": "dr.nusrat@demo.com",
            "phone": "+8801815552222",
            "image": "https://images.unsplash.com/photo-1594824813566-88855ce78c0c?auto=format&fit=crop&w=300&q=80",
            "specialization": "Neurology",
            "hospital": "United Hospital, Dhaka",
            "qualification": "MBBS, MS (Neuro), FRCS",
            "exp": 10,
            "fee": 1500.0,
            "days": ["Sun", "Tue", "Thu", "Sat"],
            "time": "02:00 PM - 08:00 PM",
            "rating": 4.8,
            "about": "Expert Neurologist focusing on migraine management, stroke recovery, and nerve disorder treatment."
        },
        {
            "name": "Dr. Tanvir Hossain",
            "email": "dr.tanvir@demo.com",
            "phone": "+8801915553333",
            "image": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=300&q=80",
            "specialization": "Pediatrics",
            "hospital": "Evercare Hospital, Dhaka",
            "qualification": "MBBS, DCH, MD (Child Health)",
            "exp": 8,
            "fee": 1000.0,
            "days": ["Mon", "Wed", "Fri", "Sun"],
            "time": "09:00 AM - 02:00 PM",
            "rating": 4.9,
            "about": "Child specialist delivering compassionate pediatric care, growth monitoring, and pediatric nutrition guidance."
        },
        {
            "name": "Dr. Farhana Ahmed",
            "email": "dr.farhana@demo.com",
            "phone": "+8801615554444",
            "image": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=300&q=80",
            "specialization": "Gynecology",
            "hospital": "Labaid Specialized Hospital",
            "qualification": "MBBS, FCPS (OBGYN)",
            "exp": 14,
            "fee": 1300.0,
            "days": ["Mon", "Tue", "Thu", "Sat"],
            "time": "04:00 PM - 09:00 PM",
            "rating": 4.9,
            "about": "Senior Gynecologist & Obstetrician specializing in women's reproductive health, prenatal care, and minimally invasive surgeries."
        },
        {
            "name": "Dr. Mahmudul Hasan",
            "email": "dr.mahmud@demo.com",
            "phone": "+8801515555555",
            "image": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=300&q=80",
            "specialization": "Orthopedics",
            "hospital": "Ibn Sina Hospital, Dhanmondi",
            "qualification": "MBBS, MS (Orthopedics)",
            "exp": 11,
            "fee": 1100.0,
            "days": ["Sun", "Mon", "Wed", "Fri"],
            "time": "11:00 AM - 05:00 PM",
            "rating": 4.7,
            "about": "Orthopedic Surgeon expert in joint replacement, sports injury rehabilitation, and bone fracture care."
        }
    ]

    doctor_ids = []
    for d in doctors_data:
        cursor.execute("""
        INSERT INTO users (name, email, password, role, phone, profile_image)
        VALUES (?, ?, ?, 'doctor', ?, ?)
        """, (d["name"], d["email"], pw_hash, d["phone"], d["image"]))
        u_id = cursor.lastrowid

        cursor.execute("""
        INSERT INTO doctors (user_id, specialization, hospital, qualification, experience_years, fee, available_days, available_time, rating, about)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (u_id, d["specialization"], d["hospital"], d["qualification"], d["exp"], d["fee"], json.dumps(d["days"]), d["time"], d["rating"], d["about"]))
        doctor_ids.append(cursor.lastrowid)

    demo_doctor_id = doctor_ids[0] # Dr. Anisur Rahman

    # 4. Add Initial Appointments for Patient 1 with Demo Doctor
    cursor.execute("""
    INSERT INTO appointments (patient_id, doctor_id, date, time_slot, status, type, symptoms, fee, payment_status)
    VALUES (?, ?, '2026-08-05', '10:30 AM', 'Confirmed', 'Online Video', 'High blood pressure & chest mild discomfort', 1200.0, 'Paid')
    """, (patient1_user_id, demo_doctor_id))
    appt_id = cursor.lastrowid

    cursor.execute("""
    INSERT INTO appointments (patient_id, doctor_id, date, time_slot, status, type, symptoms, fee, payment_status)
    VALUES (?, ?, '2026-07-20', '11:00 AM', 'Completed', 'Online Video', 'Routine cardiac follow-up', 1200.0, 'Paid')
    """, (patient1_user_id, demo_doctor_id))
    past_appt_id = cursor.lastrowid

    # 5. Add Prescription for past appointment
    sample_meds = json.dumps([
        {"name": "Tab. Amlodipine", "dosage": "5mg", "frequency": "1-0-0 (Morning)", "duration": "30 Days"},
        {"name": "Tab. Telmisartan", "dosage": "40mg", "frequency": "0-0-1 (Night)", "duration": "30 Days"},
        {"name": "Cap. Omeprazole", "dosage": "20mg", "frequency": "1-0-1 (Before Meals)", "duration": "14 Days"}
    ])
    cursor.execute("""
    INSERT INTO prescriptions (appointment_id, patient_id, doctor_id, diagnosis, medicines, instructions)
    VALUES (?, ?, ?, 'Essential Hypertension Stage 1', ?, 'Maintain low-sodium diet, 30 min daily walk, recheck BP after 3 weeks.')
    """, (past_appt_id, patient1_user_id, demo_doctor_id, sample_meds))

    # 6. Add Medical Records for Patient 1
    cursor.execute("""
    INSERT INTO medical_records (patient_id, title, record_type, doctor_name, notes, file_url, date)
    VALUES (?, 'Echocardiogram Report 2026', 'Imaging', 'Dr. Anisur Rahman', 'Normal left ventricular systolic function. EF: 62%. No valvular abnormality.', 'echo_report_2026.pdf', '2026-07-21')
    """, (patient1_user_id,))
    
    cursor.execute("""
    INSERT INTO medical_records (patient_id, title, record_type, doctor_name, notes, file_url, date)
    VALUES (?, 'Comprehensive Blood Profile & Lipid Panel', 'Lab Result', 'Diagnostic Lab', 'Fasting Blood Sugar: 95 mg/dL. Total Cholesterol: 185 mg/dL. Triglycerides: 140 mg/dL.', 'lipid_profile_2026.pdf', '2026-06-15')
    """, (patient1_user_id,))

    # 7. Add Lab Tests
    lab_tests_data = [
        ("Complete Blood Count (CBC)", "Hematology", 600.0, "Blood", "12 Hours", "Evaluates overall health and detects a wide range of disorders including anemia and infection."),
        ("Lipid Profile Test", "Biochemistry", 1200.0, "Blood (Fasting)", "24 Hours", "Measures cholesterol and triglyceride levels to assess cardiovascular health risk."),
        ("HbA1c (Glycated Hemoglobin)", "Endocrinology", 800.0, "Blood", "12 Hours", "Standard diagnostic test for diabetes monitoring over the past 3 months."),
        ("Chest X-Ray (PA View)", "Radiology", 900.0, "Imaging", "2 Hours", "High-resolution digital imaging for lung, heart, and chest wall evaluation."),
        ("Thyroid Profile (T3, T4, TSH)", "Hormone", 1400.0, "Blood", "24 Hours", "Evaluates thyroid gland function and metabolic health."),
        ("Serum Creatinine & Kidney Panel", "Nephrology", 750.0, "Serum", "12 Hours", "Assesses renal performance and kidney filtration capacity.")
    ]

    for lt in lab_tests_data:
        cursor.execute("""
        INSERT INTO lab_tests (title, department, price, sample_type, turnaround_time, description)
        VALUES (?, ?, ?, ?, ?, ?)
        """, lt)

    # 8. Add Blood Donors
    donors = [
        ("Kamrul Hasan", "A+", "Dhaka", "Dhanmondi", "+8801710001111", "2026-04-10", 1),
        ("Sabbir Hossain", "O+", "Dhaka", "Uttara", "+8801810002222", "2026-05-15", 1),
        ("Mahin Rahman", "B+", "Dhaka", "Gulshan", "+8801910003333", "2026-02-20", 1),
        ("Nigar Sultana", "AB+", "Dhaka", "Mirpur", "+8801610004444", "2026-06-01", 1),
        ("Ariful Islam", "O-", "Dhaka", "Banani", "+8801510005555", "2026-01-12", 1),
        ("Tanzim Ahmed", "B-", "Dhaka", "Mohakhali", "+8801310006666", "2026-03-30", 1)
    ]
    for bd in donors:
        cursor.execute("""
        INSERT INTO blood_donors (name, blood_group, city, area, phone, last_donated, is_available)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, bd)

    # 9. Add Sample Medicine Reminders for Patient 1
    cursor.execute("""
    INSERT INTO medicine_reminders (patient_id, medicine_name, dosage, time_slot, frequency)
    VALUES (?, 'Tab. Amlodipine 5mg', '1 Tablet', '08:00 AM', 'Daily')
    """, (patient1_user_id,))
    cursor.execute("""
    INSERT INTO medicine_reminders (patient_id, medicine_name, dosage, time_slot, frequency)
    VALUES (?, 'Tab. Telmisartan 40mg', '1 Tablet', '09:00 PM', 'Daily')
    """, (patient1_user_id,))

    # 10. Sample Reviews for Demo Doctor
    cursor.execute("""
    INSERT INTO reviews (patient_id, doctor_id, rating, comment)
    VALUES (?, ?, 5, 'Dr. Anisur is extremely knowledgeable and patient. Listened carefully and explained my hypertension treatment clearly!')
    """, (patient1_user_id, demo_doctor_id))

    # 11. Initial Notifications for Patient 1
    cursor.execute("""
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (?, 'Appointment Confirmed', 'Your appointment with Dr. Anisur Rahman on 2026-08-05 at 10:30 AM is confirmed.', 'appointment')
    """, (patient1_user_id,))

    conn.commit()

if __name__ == "__main__":
    init_db()
