#pragma once

// Copy this file to config.h and fill in local test values.
// Do not commit config.h: it contains Wi-Fi credentials and a device token.
#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Use the computer's LAN IPv4 address, not localhost or 127.0.0.1.
#define SERVER_BASE_URL "http://192.168.1.4:5000"

// Must exactly match the device ID paired from the doctor's patient page.
#define DEVICE_ID "esp32-p-1001"

// Paste the one-time pairing token from the doctor's patient page.
#define DEVICE_TOKEN "PASTE_DEVICE_TOKEN_HERE"
