/*
  Emoheal bench prototype: ESP32 DevKit + MPU6050 breakout.

  Sends one motion sample per second to the local Flask prototype.
  This is a bench experiment only; it is not a medical measurement.
*/

#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <Wire.h>

#include "config.h"

namespace {
constexpr uint8_t kSdaPin = 21;
constexpr uint8_t kSclPin = 22;
constexpr uint8_t kMpuAddressPrimary = 0x68;
constexpr uint8_t kMpuAddressAlternate = 0x69;
constexpr uint8_t kWhoAmIRegister = 0x75;
constexpr uint8_t kSampleRateDividerRegister = 0x19;
constexpr uint8_t kConfigRegister = 0x1A;
constexpr uint8_t kGyroConfigRegister = 0x1B;
constexpr uint8_t kAccelConfigRegister = 0x1C;
constexpr uint8_t kPowerManagementRegister = 0x6B;
constexpr uint8_t kDataRegister = 0x3B;
constexpr uint32_t kSampleIntervalMs = 1000;
constexpr uint8_t kBytesPerSample = 14;
constexpr uint8_t kAccelGyroRange = 0;  // ±2 g and ±250 degrees/second.

Preferences preferences;
uint8_t mpuAddress = kMpuAddressPrimary;
uint64_t sequenceNumber = 0;
uint32_t lastSampleMs = 0;

bool writeRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(mpuAddress);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool readRegisters(uint8_t firstRegister, uint8_t *buffer, size_t length) {
  Wire.beginTransmission(mpuAddress);
  Wire.write(firstRegister);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  const size_t received = Wire.requestFrom(mpuAddress, length, true);
  if (received != length) {
    while (Wire.available()) {
      Wire.read();
    }
    return false;
  }

  for (size_t i = 0; i < length; ++i) {
    buffer[i] = static_cast<uint8_t>(Wire.read());
  }
  return true;
}

int16_t readSignedWord(const uint8_t *buffer, size_t index) {
  return static_cast<int16_t>(
      (static_cast<uint16_t>(buffer[index]) << 8) | buffer[index + 1]);
}

bool findAndStartMpu() {
  const uint8_t addresses[] = {kMpuAddressPrimary, kMpuAddressAlternate};
  for (uint8_t address : addresses) {
    mpuAddress = address;
    uint8_t identity = 0;
    if (!readRegisters(kWhoAmIRegister, &identity, 1)) {
      continue;
    }
    if (identity != 0x68) {
      Serial.printf("Unexpected MPU identity 0x%02X at 0x%02X\n", identity, address);
      continue;
    }

    if (!writeRegister(kPowerManagementRegister, 0x00)) {
      continue;
    }
    delay(100);
    // DLPF enabled; sample rate is 1 kHz / (1 + divider) = 100 Hz.
    if (!writeRegister(kConfigRegister, 0x03) ||
        !writeRegister(kSampleRateDividerRegister, 9) ||
        !writeRegister(kGyroConfigRegister, kAccelGyroRange) ||
        !writeRegister(kAccelConfigRegister, kAccelGyroRange)) {
      continue;
    }
    Serial.printf("MPU6050 ready at I2C address 0x%02X\n", address);
    return true;
  }

  Serial.println("MPU6050 not found. Check 3V3, GND, SDA, SCL and AD0.");
  return false;
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connecting to Wi-Fi %s", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.printf("\nWi-Fi connected. ESP32 address: %s\n",
                WiFi.localIP().toString().c_str());
}

bool readMpuSample(float &ax, float &ay, float &az,
                   float &gx, float &gy, float &gz) {
  uint8_t buffer[kBytesPerSample];
  if (!readRegisters(kDataRegister, buffer, sizeof(buffer))) {
    Serial.println("MPU6050 read failed.");
    return false;
  }

  ax = readSignedWord(buffer, 0) / 16384.0f;
  ay = readSignedWord(buffer, 2) / 16384.0f;
  az = readSignedWord(buffer, 4) / 16384.0f;
  gx = readSignedWord(buffer, 8) / 131.0f;
  gy = readSignedWord(buffer, 10) / 131.0f;
  gz = readSignedWord(buffer, 12) / 131.0f;
  return true;
}

void sendSample() {
  float ax, ay, az, gx, gy, gz;
  if (!readMpuSample(ax, ay, az, gx, gy, gz)) {
    return;
  }

  // Save before sending. A lost response may skip a number, but a reboot
  // will never reuse an already accepted sequence number.
  ++sequenceNumber;
  preferences.putULong64("sequence", sequenceNumber);

  char body[320];
  const int bodyLength = snprintf(
      body, sizeof(body),
      "{\"sequence\":%llu,"
      "\"accelerometer_g\":{\"x\":%.5f,\"y\":%.5f,\"z\":%.5f},"
      "\"gyroscope_dps\":{\"x\":%.4f,\"y\":%.4f,\"z\":%.4f}}",
      static_cast<unsigned long long>(sequenceNumber),
      ax, ay, az, gx, gy, gz);
  if (bodyLength < 0 || static_cast<size_t>(bodyLength) >= sizeof(body)) {
    Serial.println("Could not format sensor sample.");
    return;
  }

  const String url = String(SERVER_BASE_URL) + "/api/devices/" +
                     DEVICE_ID + "/readings";
  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, url)) {
    Serial.println("Could not start HTTP request.");
    return;
  }

  http.setTimeout(4000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  const int status = http.POST(
      reinterpret_cast<uint8_t *>(body), static_cast<size_t>(bodyLength));
  if (status > 0) {
    Serial.printf("HTTP %d, sequence %llu: %s\n", status,
                  static_cast<unsigned long long>(sequenceNumber),
                  http.getString().c_str());
  } else {
    Serial.printf("HTTP send failed (%s); sequence %llu will not be reused.\n",
                  http.errorToString(status).c_str(),
                  static_cast<unsigned long long>(sequenceNumber));
  }
  http.end();
}
}  // namespace

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\nEmoheal ESP32 / MPU6050 bench test");
  Serial.println("Motion measurements only; not a medical or healing measurement.");

  preferences.begin("emoheal", false);
  sequenceNumber = preferences.getULong64("sequence", 0);

  Wire.begin(kSdaPin, kSclPin);
  Wire.setClock(100000);
  if (!findAndStartMpu()) {
    Serial.println("Fix wiring and press RESET to retry.");
    while (true) {
      delay(1000);
    }
  }

  connectWifi();
  lastSampleMs = millis();
}

void loop() {
  connectWifi();
  const uint32_t now = millis();
  if (now - lastSampleMs >= kSampleIntervalMs) {
    lastSampleMs = now;
    sendSample();
  }
  delay(10);
}
