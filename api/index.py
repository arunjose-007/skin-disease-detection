import os
import sys

# Ensure the root project directory is on the Python module search path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# Import the Flask application instance
from app import app

# Vercel Serverless Function entry point
# Vercel automatically invokes 'app' as the WSGI/ASGI application handler
