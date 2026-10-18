import sys
from pathlib import Path


LOGGER_DIR = Path(__file__).resolve().parent.parent / "firmware" / "arduino_wrist_alarm"
sys.path.insert(0, str(LOGGER_DIR))

from logger import main


if __name__ == "__main__":
    main()
