import serial
import json
import requests
import time

PORT = 'COM11'
BAUD_RATE = 115200
PATIENT_ID = "P-BCC60BDB93B"
FLASK_URL = 'http://127.0.0.1:5000/api/readings'

def run_bridge():
    print(f"Connecting to Arduino on {PORT}...")
    while True:
        try:
            ser = serial.Serial(PORT, BAUD_RATE, timeout=2)
            time.sleep(2)
            print("Arduino Connected! Sending data to dashboard...")
            
            while True:
                if ser.in_waiting > 0:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    if line.startswith('{') and line.endswith('جات'): # أو ببساطة تبدأ بـ {
                        try:
                            pass
                        except:
                            pass
                    
                    if line.startswith('{') and line.endswith('}'):
                        try:
                            data = json.loads(line)
                            data['patient_id'] = PATIENT_ID
                            
                            response = requests.post(FLASK_URL, json=data)
                            print(f"Sent Angle: {data.get('angle')}° | Server Status: {response.status_code}")
                        except Exception as e:
                            print("Error parsing/sending:", e)
                time.sleep(0.5)
        except Exception as e:
            print("Connection error:", e)
            time.sleep(3)

if __name__ == '__main__':
    run_bridge()