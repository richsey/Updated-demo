"""
conftest.py — makes the ai-service root importable when pytest is run from
the ai-service/ directory.
"""
import sys
import os

# Add the ai-service directory to sys.path so that `from services.X import Y`
# works without installing the package.
sys.path.insert(0, os.path.dirname(__file__))
