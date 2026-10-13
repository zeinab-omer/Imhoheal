#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <math.h>

Adafruit_MPU6050 mpu;

const int BUZZER_PIN = 8;
const int GREEN_LED = 9;
const int RED_LED = 10;

// Experimental thresholds only
const float ALERT_ON_DEG = 3.0;
const float ALERT_OFF_DEG = 2.0;

bool alarmOn = false;

float referenceAngle = 0.0;
float filteredAngle = 0.0;

// Change this to -1 if bending down
// produces a positive angle difference.
const int BEND_DIRECTION = 1;

float getWristAngle() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Signed angle using X and Z axes
  return atan2(a.acceleration.x,
               a.acceleration.z) * 180.0 / PI;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);

  if (!mpu.begin()) {
    Serial.println("ERROR: MPU6050 not detected!");

    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);

    while (true) {
      delay(100);
    }
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  Serial.println("Keep wrist in neutral position!");

  delay(1000);

  // Calibrate the neutral wrist position
  float sum = 0;

  for (int i = 0; i < 100; i++) {
    sum += getWristAngle();
    delay(10);
  }

  referenceAngle = sum / 100.0;
  filteredAngle = referenceAngle;

  digitalWrite(GREEN_LED, HIGH);

  Serial.println("Ready!");
  Serial.println("angle_change,alarm");
}

void loop() {
  float currentAngle = getWristAngle();

  // Smooth sensor readings
  filteredAngle = 0.75 * filteredAngle
                + 0.25 * currentAngle;

  // Relative change from neutral position
  float angleChange =
      BEND_DIRECTION * (filteredAngle - referenceAngle);

  // Detect bending with hysteresis
  if (!alarmOn && angleChange >= ALERT_ON_DEG) {
    alarmOn = true;
  }
  else if (alarmOn && angleChange <= ALERT_OFF_DEG) {
    alarmOn = false;
  }

  // Normal = green; bending detected = red + buzzer
  digitalWrite(GREEN_LED, alarmOn ? LOW : HIGH);
  digitalWrite(RED_LED, alarmOn ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, alarmOn ? HIGH : LOW);

  Serial.print(angleChange, 2);
  Serial.print(",");
  Serial.println(alarmOn ? 1 : 0);

  delay(20);
}