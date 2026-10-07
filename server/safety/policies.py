import json
from pathlib import Path

DOCUMENTS = json.loads((Path(__file__).parent / 'legal.json').read_text())
POLICY_VERSION = DOCUMENTS['version']
