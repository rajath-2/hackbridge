import sys
from unittest.mock import MagicMock

try:
    import matplotlib
    import matplotlib.pyplot
    print("Import successful")
except (ImportError, Exception) as e:
    print(f"Import failed as expected: {e}")
    sys.modules["matplotlib"] = MagicMock()
    sys.modules["matplotlib.pyplot"] = MagicMock()
    print("Mocking successful")

import matplotlib.pyplot as plt
print(f"plt is now: {plt}")
