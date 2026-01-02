#!/usr/bin/env python3
"""
Simple HTTP Server for Unicorns Edu
Run: python server.py
"""

import http.server
import socketserver
import os
import webbrowser
from pathlib import Path

PORT = 3000
DIRECTORY = Path(__file__).parent

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def main():
    os.chdir(DIRECTORY)
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"🚀 Server đang chạy tại: {url}")
        print(f"📁 Serving directory: {DIRECTORY}")
        print(f"⏹️  Nhấn Ctrl+C để dừng server\n")
        
        # Auto-open browser
        try:
            webbrowser.open(url)
        except:
            pass
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n🛑 Server đã dừng")

if __name__ == "__main__":
    main()

